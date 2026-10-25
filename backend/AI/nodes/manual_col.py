import numpy as np
import pandas as pd
import re
import unicodedata
from dateutil import parser
from pydantic import BaseModel, Field
from difflib import get_close_matches

from AI.agent import llm

class Category(BaseModel):
    categories: list[str] = Field(
        description="List of canonical valid categories"
    )

    mapping: dict[str, str | None] = Field(
        description=(
            "Map each observed category value to its canonical category. "
            "Use null only for confirmed missing or invalid values."
        )
    )

    uncertain_values: list[str] = Field(default_factory=list)

def clean_string_column(col_name: str, df: pd.DataFrame) -> pd.DataFrame:
    """Clean a string/object column in a DataFrame."""

    if col_name not in df.columns:
        raise ValueError(f"Column '{col_name}' not found in DataFrame")

    def clean_value(value):
        if pd.isna(value):
            return pd.NA

        value = unicodedata.normalize("NFKC", str(value))

        # Remove invisible Unicode formatting characters
        value = "".join(
            ch for ch in value
            if unicodedata.category(ch) not in {"Cf", "Cs"}
        )

        # Normalize whitespace
        value = re.sub(r"\s+", " ", value).strip()

        # Convert common missing-value markers to NA
        if value.casefold() in {
            "", "null", "none", "nan", "n/a",
            "na", "n.a.", "nil", "missing", "not available"
        }:
            return pd.NA

        return value

    df[col_name] = df[col_name].map(clean_value).astype("string")

    return df

def clean_datetime_column(df: pd.DataFrame, col_name: str) -> pd.DataFrame:
    if col_name not in df.columns:
        raise ValueError(f"Column '{col_name}' not found")

    missing_markers = {
        "", "null", "none", "nan", "nat", "n/a",
        "na", "unknown", "missing", "not available", "-"
    }

    def parse_date(value):
        if pd.isna(value):
            return pd.NaT

        text = str(value).strip()

        if text.casefold() in missing_markers:
            return pd.NaT

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text)

        # Remove ordinal suffixes: 1st, 2nd, 3rd, 4th
        text = re.sub(
            r"(?<=\d)(st|nd|rd|th)\b",
            "",
            text,
            flags=re.IGNORECASE,
        )

        # Try automatic parsing
        try:
            result = pd.to_datetime(
                text,
                errors="coerce",
                dayfirst=True,
                format="mixed",
            )
            if not pd.isna(result):
                return result
        except (ValueError, TypeError, OverflowError):
            pass

        # Fallback for textual dates
        try:
            return pd.Timestamp(
                parser.parse(text, dayfirst=True, fuzzy=False)
            )
        except (ValueError, TypeError, OverflowError):
            return pd.NaT

    original = df[col_name].copy()
    parsed = original.map(parse_date)

    # Log invalid non-missing values
    invalid_mask = original.notna() & parsed.isna()

    print(f"\nCleaning datetime column: {col_name}")
    print(f"Total rows: {len(df)}")
    print(f"Valid dates: {parsed.notna().sum()}")
    print(f"Missing/invalid dates: {parsed.isna().sum()}")

    if invalid_mask.any():
        print("Invalid values:", original[invalid_mask].head(10).tolist())

    # Normalize timezone-aware timestamps to UTC
    parsed = pd.to_datetime(parsed, errors="coerce", utc=True)
    parsed = parsed.dt.tz_localize(None)

    # Store actual datetime values in the DataFrame
    df[col_name] = parsed

    return df

def clean_numeric_column(df: pd.DataFrame, col_name: str) -> pd.DataFrame:
    if col_name not in df.columns:
        raise ValueError(f"Column '{col_name}' not found")

    missing_markers = {
        "", "null", "none", "nan", "n/a", "na",
        "nil", "missing", "not available", "-"
    }

    def extract_number(value):
        if pd.isna(value):
            return pd.NA

        if isinstance(value, (int, float)):
            return value

        text = str(value).strip()

        if text.casefold() in missing_markers:
            return pd.NA

        # Remove common currency labels and symbols
        text = re.sub(r"(?i)\b(?:USD|INR|EUR|GBP)\b", "", text)
        text = re.sub(r"[$₹€£]", "", text)

        # If multiple numbers are separated by arithmetic operators,
        # evaluate simple addition/subtraction expressions.
        expression = re.fullmatch(
            r"\s*(\d+(?:\.\d*)?|\.\d+)"
            r"(?:\s*([+-])\s*(\d+(?:\.\d*)?|\.\d+))+\s*",
            text
        )

        if expression:
            parts = re.findall(r"\d+(?:\.\d*)?|\.\d+", text)
            operators = re.findall(r"[+-]", text)

            result = float(parts[0])
            for operator, number in zip(operators, parts[1:]):
                if operator == "+":
                    result += float(number)
                else:
                    result -= float(number)

            return result

        # Otherwise, extract digits and decimal points, ignoring letters
        text = re.sub(r"[^0-9.]", "", text)

        if not text or text == ".":
            return pd.NA

        # Keep the first decimal point and join later decimal fragments
        pieces = text.split(".")
        if len(pieces) > 2:
            text = pieces[0] + "." + "".join(pieces[1:])

        try:
            return float(text)
        except (ValueError, OverflowError):
            return pd.NA

    original = df[col_name].copy()
    numeric = original.map(extract_number)

    invalid_mask = original.notna() & numeric.isna()

    print(f"\nCleaning numeric column: {col_name}")
    print(f"Total rows: {len(df)}")
    print(f"Successfully parsed: {numeric.notna().sum()}")
    print(f"Missing/unparseable: {numeric.isna().sum()}")

    if invalid_mask.any():
        print("Unparseable examples:", original[invalid_mask].head(10).tolist())

    values = numeric.dropna()

    if not values.empty and values.map(
        lambda x: float(x).is_integer()
    ).all():
        df[col_name] = numeric.astype("Int64")
    else:
        df[col_name] = numeric.astype("Float64")

    return df

def clean_object_column(col_name: str, df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean an object/string column in a DataFrame.

    Handles:
    - Leading/trailing whitespace
    - Multiple spaces and tabs
    - Unicode normalization
    - Invisible format characters
    - Common missing-value strings
    - Empty strings
    - Preserves non-string values
    """

    if col_name not in df.columns:
        raise KeyError(f"Column '{col_name}' not found in DataFrame")

    missing_markers = {
        "", "na", "n/a", "nan", "none", "null",
        "nil", "undefined", "not available",
        "not applicable", "missing"
    }

    def clean_value(value):
        # Preserve actual missing values
        if pd.isna(value):
            return pd.NA

        # Clean text only
        if not isinstance(value, str):
            return value

        # Normalize Unicode representations
        value = unicodedata.normalize("NFKC", value)

        # Remove invisible Unicode format characters
        value = "".join(
            char for char in value
            if unicodedata.category(char) != "Cf"
        )

        # Replace non-breaking spaces and normalize whitespace
        value = value.replace("\u00A0", " ")
        value = re.sub(r"\s+", " ", value).strip()

        # Convert known missing markers to missing values
        if value.casefold() in missing_markers:
            return pd.NA

        return value

    df[col_name] = df[col_name].map(clean_value)

    print(f"\n[OBJECT CLEANING] Column: {col_name}")
    print(f"Remaining missing values: {df[col_name].isna().sum()}")
    print(f"Unique values: {df[col_name].nunique(dropna=True)}")
    print("Cleaning completed.")

    return df

def clean_bool_column(col_name: str, df: pd.DataFrame) -> pd.DataFrame:
    """
    Robust boolean column cleaner.

    Handles:
    - True/False, TRUE/FALSE, mixed case
    - yes/no, y/n, t/f
    - 1/0 and numeric 1.0/0.0
    - on/off, enabled/disabled
    - active/inactive, valid/invalid
    - common affirmative/negative phrases
    - surrounding punctuation, whitespace, Unicode variants
    - configurable fuzzy matching for obvious typos

    Unknown values become pd.NA rather than being guessed.
    """

    if col_name not in df.columns:
        raise KeyError(f"Column '{col_name}' not found in DataFrame")

    true_values = {
        "true", "t", "1", "1.0", "yes", "y", "yeah", "yep",
        "yup", "sure", "correct", "right", "affirmative",
        "positive", "enabled", "enable", "on", "active",
        "activated", "valid", "verified", "present",
        "available", "accepted", "allow", "allowed",
        "agree", "agreed", "success", "successful",
        "pass", "passed", "checked", "selected",
        "confirmed", "exists", "exist", "ok", "okay",
        "true value", "is true", "is yes", "1 yes",
        "yes please", "definitely", "indeed"
    }

    false_values = {
        "false", "f", "0", "0.0", "no", "n", "nope",
        "nah", "incorrect", "wrong", "negative",
        "disabled", "disable", "off", "inactive",
        "deactivated", "invalid", "unverified", "absent",
        "unavailable", "rejected", "deny", "denied",
        "disagree", "disagreed", "failure", "failed",
        "fail", "not checked", "unchecked", "unselected",
        "unconfirmed", "does not exist", "doesn't exist",
        "not true", "not yes", "no thanks", "never",
        "false value", "is false", "is no", "not applicable"
    }

    missing_values = {
        "", "na", "n/a", "nan", "none", "null", "nil",
        "undefined", "missing", "unknown", "?", "-", "--",
        "not known", "not provided", "blank", "empty",
        "not available", "not specified"
    }

    # Only these values can be fuzzy-matched.
    # Keep this set conservative to avoid changing meaning.
    fuzzy_true = {"true", "false"}  # Exact values are handled first.
    fuzzy_candidates = sorted(true_values | false_values)

    stats = {
        "true": 0,
        "false": 0,
        "missing": 0,
        "unrecognized": 0,
        "fuzzy_matched": 0
    }
    unrecognized = []

    def normalize(value):
        value = unicodedata.normalize("NFKC", str(value))
        value = value.casefold().strip()

        # Normalize common Unicode apostrophes and dashes
        value = value.replace("’", "'").replace("‘", "'")
        value = value.replace("–", "-").replace("—", "-")

        # Remove zero-width and other format characters
        value = "".join(
            ch for ch in value
            if unicodedata.category(ch) != "Cf"
        )

        # Normalize whitespace
        value = re.sub(r"\s+", " ", value)

        # Remove surrounding punctuation, not internal punctuation
        value = re.sub(r"^[\s\"'`.,;:!?()[\]{}]+", "", value)
        value = re.sub(r"[\s\"'`.,;:!?()[\]{}]+$", "", value)

        return value.strip()

    def parse_bool(value):
        if pd.isna(value):
            stats["missing"] += 1
            return pd.NA

        # Handle actual boolean values before numeric values
        if isinstance(value, (bool, np.bool_)):
            result = bool(value)
            stats["true" if result else "false"] += 1
            return result

        # Numeric 1/0 only; never interpret arbitrary nonzero values as True
        if isinstance(value, (int, float, np.integer, np.floating)):
            if not np.isfinite(value):
                stats["missing"] += 1
                return pd.NA
            if value == 1:
                stats["true"] += 1
                return True
            if value == 0:
                stats["false"] += 1
                return False
            unrecognized.append(repr(value))
            stats["unrecognized"] += 1
            return pd.NA

        if not isinstance(value, str):
            unrecognized.append(repr(value))
            stats["unrecognized"] += 1
            return pd.NA

        text = normalize(value)

        if text in missing_values:
            stats["missing"] += 1
            return pd.NA

        # Exact matches have priority over fuzzy matching
        if text in true_values:
            stats["true"] += 1
            return True

        if text in false_values:
            stats["false"] += 1
            return False

        # Normalize common separators and repeated punctuation
        compact = re.sub(r"[_-]+", " ", text)
        compact = re.sub(r"\s+", " ", compact).strip()

        if compact in true_values:
            stats["true"] += 1
            return True

        if compact in false_values:
            stats["false"] += 1
            return False

        # Handle explicit phrases without using arbitrary substring matching
        true_phrases = (
            "yes it is", "it is true", "is enabled",
            "turned on", "switch on", "has access"
        )
        false_phrases = (
            "it is false", "is disabled", "turned off",
            "switch off", "no access"
        )

        if compact in true_phrases:
            stats["true"] += 1
            return True

        if compact in false_phrases:
            stats["false"] += 1
            return False

        # Conservative typo matching: require a close match and a
        # sufficiently long input. Single-letter values are never fuzzy-matched.
        if len(compact) >= 4:
            match = get_close_matches(
                compact,
                fuzzy_candidates,
                n=1,
                cutoff=0.90
            )

            if match:
                candidate = match[0]
                result = candidate in true_values
                stats["fuzzy_matched"] += 1
                stats["true" if result else "false"] += 1
                return result

        unrecognized.append(repr(value))
        stats["unrecognized"] += 1
        return pd.NA

    print(f"\n{'=' * 50}")
    print(f"BOOLEAN CLEANING: {col_name}")
    print(f"Original dtype: {df[col_name].dtype}")
    print(f"Rows: {len(df)}")

    cleaned = df[col_name].map(parse_bool)
    df[col_name] = pd.array(cleaned, dtype="boolean")

    print("\n--- Cleaning Summary ---")
    for key, count in stats.items():
        print(f"{key.replace('_', ' ').title()}: {count}")

    if unrecognized:
        unique_unknowns = list(dict.fromkeys(unrecognized))
        print("\nUnrecognized values (first 20):")
        print(unique_unknowns[:20])

    print("\nFinal dtype:", df[col_name].dtype)
    print("Final value counts:")
    print(df[col_name].value_counts(dropna=False))
    print(f"{'=' * 50}")

    return df

def clean_category_column(
    df: pd.DataFrame,
    col_name: str
) -> pd.DataFrame:

    if col_name not in df.columns:
        raise ValueError(f"Column '{col_name}' not found")

    missing_markers = {
        "", "null", "none", "nan", "n/a", "na",
        "n.a.", "nil", "missing", "not available", "-"
    }

    def clean_value(value):
        if pd.isna(value):
            return pd.NA

        value = str(value).strip()

        if value.casefold() in missing_markers:
            return pd.NA

        return value

    # Step 1: Clean missing markers
    original = df[col_name].copy()
    cleaned = original.map(clean_value).astype("string")

    # Step 2: Extract unique observed categories
    unique_values = cleaned.dropna().unique().tolist()

    print(f"\n[Category Cleaning] Column: {col_name}")
    print(f"Unique values before LLM: {len(unique_values)}")
    print("Observed categories:", unique_values)

    if not unique_values:
        df[col_name] = cleaned.astype("category")
        return df

    # Step 3: Ask LLM to generate canonical categories and mapping
    structured_llm = llm.with_structured_output(Category)

    prompt = f"""
You are an expert categorical data-cleaning engineer.

Column name: {col_name}

Demo Data: {df.head()}

Observed unique values:
{unique_values}

Tasks:
1. Identify valid canonical categories.
2. Merge genuine aliases, spelling variations, casing differences,
   and abbreviations when their meanings are equivalent.
3. Do not merge categories with different meanings.
4. Map every observed value to exactly one canonical category.
5. Use null only for confirmed invalid or missing categories.
6. List ambiguous values in uncertain_values.
7. Every non-null mapping target must exist in categories.
8. Include every observed value as a mapping key.
9. Preserve uncertain values as separate categories instead of guessing.
"""

    result = structured_llm.invoke(prompt)

    # Step 4: Validate LLM output
    missing_mappings = set(unique_values) - set(result.mapping.keys())

    if missing_mappings:
        raise ValueError(
            f"LLM omitted mappings for: {missing_mappings}"
        )

    valid_categories = set(result.categories)

    invalid_targets = {
        value for value in result.mapping.values()
        if value is not None and value not in valid_categories
    }

    if invalid_targets:
        raise ValueError(
            f"LLM returned mapping targets absent from categories: "
            f"{invalid_targets}"
        )

    print("\nCanonical categories:", result.categories)
    print("Generated mapping:", result.mapping)
    print("Uncertain values:", result.uncertain_values)

    # Step 5: Apply mapping to every row
    mapped = cleaned.map(result.mapping)

    # Preserve original values if the LLM marked them uncertain
    uncertain = set(result.uncertain_values)
    uncertain_mask = cleaned.isin(uncertain)

    mapped.loc[uncertain_mask] = cleaned.loc[uncertain_mask]

    # Step 6: Report unexpected unmapped values
    unexpected = cleaned.notna() & mapped.isna()

    if unexpected.any():
        print(
            "WARNING: Values mapped to missing:",
            cleaned[unexpected].unique().tolist()
        )

    # Include preserved uncertain values in category definitions
    final_categories = list(dict.fromkeys(
        result.categories + cleaned.loc[uncertain_mask].dropna().tolist()
    ))

    df[col_name] = pd.Categorical(
        mapped,
        categories=final_categories
    )

    print("\nFinal category count:", df[col_name].nunique())
    print("Missing values:", df[col_name].isna().sum())
    print("Final categories:", df[col_name].cat.categories.tolist())

    return df

def clean_column_by_type(df: pd.DataFrame, col_name: str, col_type: str) -> pd.DataFrame:
    """Clean a single column based on its datatype using manual_col functions."""
    if col_name not in df.columns:
        return df

    col_type_str = str(col_type).lower().strip()

    try:
        if col_type_str in ["int64", "float64", "int32", "float32", "int", "float", "numeric", "number"]:
            return clean_numeric_column(df, col_name)
        elif col_type_str in ["datetime64[ns]", "datetime", "date", "timestamp"]:
            return clean_datetime_column(df, col_name)
        elif col_type_str in ["bool", "boolean"]:
            return clean_bool_column(col_name, df)
        elif col_type_str in ["category", "categorical"]:
            return clean_category_column(df, col_name)
        elif col_type_str in ["string", "str"]:
            return clean_string_column(col_name, df)
        elif col_type_str in ["object"]:
            return clean_object_column(col_name, df)
        else:
            if pd.api.types.is_numeric_dtype(df[col_name]):
                return clean_numeric_column(df, col_name)
            elif pd.api.types.is_datetime64_any_dtype(df[col_name]):
                return clean_datetime_column(df, col_name)
            elif pd.api.types.is_bool_dtype(df[col_name]):
                return clean_bool_column(col_name, df)
            else:
                return clean_object_column(col_name, df)
    except Exception:
        try:
            return clean_object_column(col_name, df)
        except Exception:
            return df
