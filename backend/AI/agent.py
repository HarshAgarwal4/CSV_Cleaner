import os
import sys
from pathlib import Path
from typing import TypedDict, Annotated, Literal
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from rich import print

# Ensure backend directory is in sys.path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Alias __main__ as AI.agent when run directly to prevent duplicate module instances
if __name__ == "__main__":
    sys.modules.setdefault("AI.agent", sys.modules[__name__])

# ============================================================
# CONFIGURATION & ENVIRONMENT
# ============================================================

backend_env = backend_dir / ".env"
load_dotenv(dotenv_path=backend_env if backend_env.exists() else None)

import tempfile

TEMP_DIR = tempfile.gettempdir()
MAX_RETRIES = 3
ORIGINAL_OUTPUT_FILE = os.path.join(TEMP_DIR, "original_data.csv")
OUTPUT_FILE = os.path.join(TEMP_DIR, "cleaned_data.csv")
FINAL_OUTPUT_FILE = os.path.join(TEMP_DIR, "cleaned_data.csv")

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY is missing from the .env file")

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0.1,
    api_key=api_key,
)


# ============================================================
# STATE REDUCERS & SCHEMAS
# ============================================================

def merge_dict(a: dict, b: dict) -> dict:
    return {**a, **b}


class ColumnRule(BaseModel):
    name: str = Field(
        description="Exact CSV column name."
    )

    type: Literal[
        "int64",
        "float64",
        "object",
        "string",
        "bool",
        "datetime64[ns]",
        "category",
    ] = Field(
        description=(
            "Semantic data type inferred from column meaning "
            "and observed values."
        )
    )

    primary_key_candidate: bool = Field(
        default=False,
        description=(
            "Whether the column appears intended to identify "
            "each record, such as id, customer_id, user_id, "
            "or order_id. This is a candidate only."
        )
    )

    unique_constraint_candidate: bool = Field(
        default=False,
        description=(
            "Whether the column's meaning suggests a unique "
            "constraint, such as email, username, SKU, or "
            "serial_number. This is a candidate only."
        )
    )

    primary_key: bool = Field(
        default=False,
        description=(
            "Final validated primary-key status. Set true only "
            "after checking the complete dataset for missing "
            "values and duplicates, and confirming the column "
            "is a plausible record identifier."
        )
    )

    nullable: bool = Field(
        description=(
            "Whether missing values are permitted by the intended "
            "schema. Do not infer schema policy from observed "
            "missing values alone."
        )
    )

    unique: bool = Field(
        description=(
            "Final observed uniqueness status: true when all "
            "non-missing values are distinct in the complete "
            "dataset. This does not mean the schema requires "
            "a unique constraint."
        )
    )

    description: str = Field(
        description="Meaning and purpose of the column."
    )

    issues: list[str] = Field(
        default_factory=list,
        description=(
            "Evidence-based issues, including missing values, "
            "duplicates, and constraint violations."
        )
    )

    cleaning_actions: list[str] = Field(
        default_factory=list,
        description="Specific, safe cleaning actions."
    )


class Rule(BaseModel):
    columns: list[ColumnRule]


rule_llm = llm.with_structured_output(Rule)


class State(TypedDict, total=False):
    document_url: str
    analysis: Annotated[dict, merge_dict]
    initial_analysis: Annotated[dict, merge_dict]
    final_analysis: Annotated[dict, merge_dict]
    review: Annotated[dict, merge_dict]
    Original_Data: Annotated[dict, merge_dict]
    Failed_Rules: dict
    current_rule_index: int
    retry_count: int
    cleaning_report: dict

def initial_sample(df: pd.DataFrame, limit: int = 25) -> pd.DataFrame:
    """
    Select up to 25 representative rows:
    - First and last rows
    - Random middle rows
    - Rows with missing values
    - Duplicate rows
    - Potential numeric outliers
    """
    if df.empty:
        return df.copy()

    parts = [
        df.head(3),
        df.tail(3),
    ]

    # Random rows from the middle.
    if len(df) > 6:
        middle = df.iloc[3:-3]
        if not middle.empty:
            parts.append(
                middle.sample(
                    n=min(5, len(middle)),
                    random_state=None,
                )
            )

    # Rows containing missing values.
    missing = df[df.isna().any(axis=1)]
    if not missing.empty:
        parts.append(
            missing.sample(
                n=min(5, len(missing)),
                random_state=None,
            )
        )

    # All occurrences of duplicated rows.
    duplicates = df[df.duplicated(keep=False)]
    if not duplicates.empty:
        parts.append(
            duplicates.sample(
                n=min(5, len(duplicates)),
                random_state=None,
            )
        )

    # Potential numeric outliers using the IQR method.
    numeric = df.select_dtypes(include=np.number)
    outlier_indices = set()

    for col in numeric.columns:
        q1 = numeric[col].quantile(0.25)
        q3 = numeric[col].quantile(0.75)
        iqr = q3 - q1

        if pd.notna(iqr) and iqr > 0:
            mask = (
                (numeric[col] < q1 - 1.5 * iqr)
                | (numeric[col] > q3 + 1.5 * iqr)
            )
            outlier_indices.update(df.index[mask].tolist())

    outliers = df.loc[df.index.isin(outlier_indices)]

    if not outliers.empty:
        parts.append(
            outliers.sample(
                n=min(5, len(outliers)),
                random_state=None,
            )
        )

    combined = pd.concat(parts)

    # Remove repeated rows introduced by overlapping sample groups.
    combined = combined.loc[
        ~combined.index.duplicated(keep="first")
    ]

    return combined.sample(
        n=min(limit, len(combined)),
        random_state=None,
    )


def recovery_sample(
    df: pd.DataFrame,
    column_name: str,
    limit: int,
) -> pd.DataFrame:
    """
    Build a repair sample that prioritizes suspicious values
    from the failed column, then fills remaining places randomly.
    """
    if df.empty:
        return df.copy()

    series = df[column_name]
    priority_indices = []

    # Missing values in the failed column.
    missing = series[series.isna()]
    if not missing.empty:
        priority_indices.extend(missing.index.tolist())

    # Values that cannot be converted to numbers.
    try:
        converted = pd.to_numeric(series, errors="coerce")
        invalid_numeric = series.notna() & converted.isna()

        priority_indices.extend(
            series.index[invalid_numeric].tolist()
        )
    except Exception:
        pass

    # Duplicate records can also reveal cleaning problems.
    duplicate_mask = df.duplicated(keep=False)
    priority_indices.extend(
        df.index[duplicate_mask].tolist()
    )

    # Keep only indices actually present in the DataFrame.
    priority_indices = list(dict.fromkeys(priority_indices))
    priority_indices = [
        idx for idx in priority_indices if idx in df.index
    ]

    # Randomly shuffle priority candidates to avoid a fixed bias.
    if priority_indices:
        priority_df = df.loc[priority_indices]
        priority_df = priority_df.sample(frac=1)
    else:
        priority_df = df.iloc[0:0]

    # Reserve space for random rows from the entire dataset.
    selected_indices = priority_df.index.tolist()[:limit]

    remaining = df.loc[
        ~df.index.isin(selected_indices)
    ]

    remaining_count = limit - len(selected_indices)

    if remaining_count > 0 and not remaining.empty:
        random_df = remaining.sample(
            n=min(remaining_count, len(remaining)),
            random_state=None,
        )
        selected_indices.extend(random_df.index.tolist())

    return df.loc[selected_indices]


# ============================================================
# ROUTING
# ============================================================

def route_after_generation(
    state: State,
) -> Literal["clean", "done"]:
    original = state.get("Original_Data", {})

    # Stop after parsing or initial generation errors
    if original.get("error"):
        return "done"

    if not original.get("rules"):
        return "done"

    return "clean"


def route_after_review(
    state: State,
) -> Literal["retry", "done"]:
    review = state.get("review") or {}
    score = review.get("score", 10.0)
    retry_count = state.get("retry_count", 0)

    # If final score < 6.5, retry in loop after rule generation node, max retry 5 attempts
    if score < 6.5 and retry_count <= 5:
        print(
            f"\n[ROUTING] Review score {score}/10 < 6.5. "
            f"Retrying in loop after rule generation node (Attempt {retry_count} of 5)..."
        )
        return "retry"

    return "done"


# ============================================================
# NODES
# ============================================================

from AI.nodes import (
    Parse_CSV_Node,
    rule_generator,
    manual_col_clean,
    clean_complete_csv,
    review_node,
)


# ============================================================
# BUILD LANGGRAPH
# ============================================================

builder = StateGraph(State)

builder.add_node("parse_csv", Parse_CSV_Node)
builder.add_node("generate_rules", rule_generator)
builder.add_node("manual-col-clean", manual_col_clean)
builder.add_node("final_clean", clean_complete_csv)
builder.add_node("review_node", review_node)

builder.add_edge(START, "parse_csv")
builder.add_edge("parse_csv", "generate_rules")

builder.add_conditional_edges(
    "generate_rules",
    route_after_generation,
    {
        "clean": "manual-col-clean",
        "done": END,
    },
)

builder.add_edge("manual-col-clean", "final_clean")
builder.add_edge("final_clean", "review_node")

builder.add_conditional_edges(
    "review_node",
    route_after_review,
    {
        "retry": "manual-col-clean",
        "done": END,
    },
)

graph = builder.compile()


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    download_path = Path(r'C:\Users\ACSS\Downloads\ecommerce_retail_transactions_raw-selected-columns.csv')
    local_backend_path = backend_dir / "original_data.csv"
    local_root_path = backend_dir.parent / "original_data.csv"

    csv_url = None
    try:
        if download_path.is_file():
            csv_url = str(download_path)
    except Exception:
        pass

    if not csv_url:
        if local_backend_path.is_file():
            csv_url = str(local_backend_path)
        elif local_root_path.is_file():
            csv_url = str(local_root_path)
        else:
            csv_url = 'https://datanemics.com/datasets/data/dirty-customers.csv'

    try:
        result = graph.invoke({
            "document_url": csv_url,
            "Original_Data": {},
            "analysis": {},
            "initial_analysis": {},
            "final_analysis": {},
            "review": {},
            "Failed_Rules": {},
            "current_rule_index": 0,
            "retry_count": 0,
        })

        initial_info = result.get("initial_analysis", {})
        final_info = result.get("final_analysis", {})
        review_info = result.get("review", {})

        if initial_info:
            print("\n========== INITIAL ANALYSIS ==========")
            print(f"Total Rows        : {initial_info.get('total_rows')}")
            print(f"Total Columns     : {initial_info.get('total_columns')}")
            print(f"Total Missing     : {initial_info.get('total_missing_values')} ({initial_info.get('missing_percentage')}%)")
            print(f"Duplicate Rows    : {initial_info.get('duplicate_rows')}")

        if final_info:
            print("\n========== FINAL ANALYSIS ==========")
            print(f"Cleaned Rows      : {final_info.get('final_rows')} (Removed: {final_info.get('rows_removed')}, {final_info.get('rows_removed_percentage')}%)")
            print(f"Total Columns     : {final_info.get('total_columns')}")
            print(f"Total Missing     : {final_info.get('total_missing_values')} ({final_info.get('missing_percentage')}%)")
            print(f"Duplicate Rows    : {final_info.get('duplicate_rows')}")

        if review_info:
            print("\n========== REVIEW EVALUATION ==========")
            print(f"Final Score       : {review_info.get('score')} / 10.0")
            print(f"Passed Threshold  : {'YES' if review_info.get('passed') else 'NO (Below 6.5)'}")
            print(f"Total Attempts    : {review_info.get('attempt', 1)} (Max Retries: {review_info.get('max_retries', 5)})")

            improved = review_info.get("improved_list", [])
            if improved:
                print("\nWhat Actually Improved:")
                for item in improved:
                    print(f"  + {item}")

            to_improve = review_info.get("things_to_improve", [])
            if to_improve:
                print("\nThings to Improve:")
                for item in to_improve:
                    print(f"  - {item}")

        final_data = result.get("Original_Data", {})
        failed = result.get("Failed_Rules") or {}

        print("\n========== FINAL RESULT ==========")
        print("Original CSV file:", final_data.get("original_csv"))
        print("Cleaned CSV file :", final_data.get("cleaned_csv"))
        print("Final rows       :", final_data.get("rows"))
        print("Cleaning error   :", final_data.get("cleaning_error"))
        print("Graph error      :", final_data.get("error"))

        if failed:
            print("\n========== UNRESOLVED FAILURE ==========")
            print(failed)

        elif final_data.get("cleaned_csv"):
            print("\nCSV cleaned and saved successfully.")

            print("\nCleaned preview:")
            print(pd.DataFrame(final_data.get("cleaned_preview", [])))

        else:
            print(
                "\nThe graph stopped without producing "
                "a cleaned CSV. Check the errors above."
            )

    except Exception as exc:
        print(f"\nExecution error: {exc}")
