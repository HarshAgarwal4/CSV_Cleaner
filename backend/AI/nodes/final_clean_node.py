import os
import pandas as pd

from AI.agent import State, ORIGINAL_OUTPUT_FILE, FINAL_OUTPUT_FILE
from AI.nodes.manual_row import clean_dataset


def clean_complete_csv(state: State) -> dict:
    """
    Perform final row-level cleanup on DataFrame using manual_row.py,
    and save both original_csv and cleaned_csv as separate files.
    """
    original = state.get("Original_Data", {})
    df = original.get("data")
    if df is None:
        df = state.get("data")

    raw_df = original.get("raw_data")
    if raw_df is None:
        raw_df = state.get("raw_data")

    if df is None:
        raise ValueError("Original_Data['data'] is missing")

    if not isinstance(df, pd.DataFrame):
        df = pd.DataFrame(df)

    if raw_df is None:
        raw_df = df.copy(deep=True)
    elif not isinstance(raw_df, pd.DataFrame):
        raw_df = pd.DataFrame(raw_df)

    rules = original.get("rules", []) or state.get("generated_rules", [])

    # Call row-level cleaning function from manual_row.py
    df = clean_dataset(df, rules)

    # File paths for saving separate files
    original_output_path = os.path.abspath(ORIGINAL_OUTPUT_FILE)
    cleaned_output_path = os.path.abspath(FINAL_OUTPUT_FILE)

    # Save original raw CSV
    raw_df.to_csv(
        original_output_path,
        index=False,
        encoding="utf-8-sig",
    )

    # Save final cleaned CSV
    df.to_csv(
        cleaned_output_path,
        index=False,
        encoding="utf-8-sig",
        na_rep="",
    )

    if not os.path.isfile(original_output_path):
        raise OSError(f"Original CSV file was not created: {original_output_path}")

    if not os.path.isfile(cleaned_output_path):
        raise OSError(f"Cleaned CSV file was not created: {cleaned_output_path}")

    total_missing = int(df.isna().sum().sum())
    total_cells = df.size
    missing_pct = round((total_missing / total_cells * 100), 2) if total_cells > 0 else 0.0
    original_row_count = len(raw_df)
    final_row_count = len(df)
    removed_rows = original_row_count - final_row_count
    removed_pct = round((removed_rows / original_row_count * 100), 2) if original_row_count > 0 else 0.0

    final_analysis = {
        "original_rows": original_row_count,
        "final_rows": final_row_count,
        "rows_removed": removed_rows,
        "rows_removed_percentage": removed_pct,
        "total_columns": len(df.columns),
        "columns": df.columns.tolist(),
        "dtypes": {
            col: str(dtype)
            for col, dtype in df.dtypes.items()
        },
        "missing_values": df.isna().sum().to_dict(),
        "total_missing_values": total_missing,
        "missing_percentage": missing_pct,
        "duplicate_rows": int(df.duplicated().sum()),
        "unique_counts": df.nunique().to_dict(),
        "original_csv": original_output_path,
        "cleaned_csv": cleaned_output_path,
        "preview": df.head(5).to_dict(
            orient="records"
        ),
    }

    report = {
        "original_rows": original_row_count,
        "final_rows": final_row_count,
        "columns": len(df.columns),
        "original_csv": original_output_path,
        "cleaned_csv": cleaned_output_path,
    }

    return {
        "final_analysis": final_analysis,
        "Original_Data": {
            "data": df,
            "raw_data": raw_df,
            "original_csv": original_output_path,
            "cleaned_csv": cleaned_output_path,
            "original_output_path": original_output_path,
            "output_path": cleaned_output_path,
            "rows": len(df),
            "columns": df.columns.tolist(),
            "cleaned_preview": df.head(5).to_dict(
                orient="records"
            ),
            "cleaning_error": None,
        },
        "cleaning_report": report,
    }

