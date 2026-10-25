import numpy as np
import pandas as pd


def _is_null_series(series: pd.Series) -> pd.Series:
    """Check if values in a series are missing (NA, NaN, None, NaT, or empty string)."""
    null_mask = series.isna()
    if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
        null_mask = null_mask | (series.astype(str).str.strip().isin(["", "nan", "<NA>", "None", "null"]))
    return null_mask


def clean_dataset(df: pd.DataFrame, column_details: list | dict = None) -> pd.DataFrame:
    """
    Perform row-level cleaning on the DataFrame:
    1. Drop exact duplicate rows
    2. Drop completely empty rows
    3. Apply column details/rules:
       - Remove all rows where primary key column is duplicated (and null primary keys)
       - Remove all rows where unique key is duplicated or where unique key which cannot be nullable gets null
       - Remove all rows where a column is not nullable and has null
    """
    if df is None:
        raise ValueError("DataFrame cannot be None")

    cleaned_df = df.copy(deep=True)

    # Step 1: Remove exact duplicate rows
    cleaned_df = cleaned_df.drop_duplicates(keep="first")

    # Step 2: Remove completely empty rows
    cleaned_df = cleaned_df.dropna(how="all")

    if not column_details:
        return cleaned_df

    # Normalize column_details into a list of column rules
    rules_list = []
    if isinstance(column_details, list):
        rules_list = column_details
    elif isinstance(column_details, dict):
        if "rules" in column_details and isinstance(column_details["rules"], list):
            rules_list = column_details["rules"]
        elif "columns" in column_details and isinstance(column_details["columns"], list):
            rules_list = column_details["columns"]
        elif "Original_Data" in column_details and isinstance(column_details["Original_Data"], dict):
            rules_list = column_details["Original_Data"].get("rules", [])

    for col_info in rules_list:
        if isinstance(col_info, dict):
            col_name = col_info.get("name")
            is_pk = bool(col_info.get("primary_key", False))
            is_unique = bool(col_info.get("unique", False))
            is_nullable = bool(col_info.get("nullable", True))
        else:
            col_name = getattr(col_info, "name", None)
            is_pk = bool(getattr(col_info, "primary_key", False))
            is_unique = bool(getattr(col_info, "unique", False))
            is_nullable = bool(getattr(col_info, "nullable", True))

        if not col_name or col_name not in cleaned_df.columns:
            continue

        # Requirement 1: Remove all rows where primary key col is duplicated
        if is_pk:
            # Primary key cannot be null
            pk_null = _is_null_series(cleaned_df[col_name])
            cleaned_df = cleaned_df[~pk_null]

            # Remove rows with duplicate primary key values (keep first occurrence)
            cleaned_df = cleaned_df.drop_duplicates(subset=[col_name], keep="first")

        # Requirement 2: Remove all rows where unique key is duplicated
        # or where unique key which cannot be nullable gets null
        if is_unique:
            if not is_nullable:
                # Unique key which cannot be nullable: remove nulls
                null_mask = _is_null_series(cleaned_df[col_name])
                cleaned_df = cleaned_df[~null_mask]
                # Remove duplicates
                cleaned_df = cleaned_df.drop_duplicates(subset=[col_name], keep="first")
            else:
                # Unique key that can be nullable: keep nulls, but remove duplicate non-null values
                not_null_mask = ~_is_null_series(cleaned_df[col_name])
                dup_mask = cleaned_df.duplicated(subset=[col_name], keep="first") & not_null_mask
                cleaned_df = cleaned_df[~dup_mask]

        # Requirement 3: Remove all rows where if a column is not nullable gets null
        if not is_nullable:
            null_mask = _is_null_series(cleaned_df[col_name])
            cleaned_df = cleaned_df[~null_mask]

    return cleaned_df
