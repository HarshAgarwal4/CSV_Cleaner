import pandas as pd
from AI.agent import State
from AI.nodes.manual_col import clean_column_by_type


def manual_col_clean(state: State) -> dict:
    """
    Node that takes original data (whole df) and column info
    from generated rules, then loops through each column one by one
    and cleans each column based on its datatype from manual_col.py.
    """
    original = state.get("Original_Data", {})
    # Always prefer fresh copy of raw_data to ensure clean retries
    raw_df = original.get("raw_data")
    if raw_df is not None and isinstance(raw_df, pd.DataFrame):
        df = raw_df.copy(deep=True)
    else:
        df = original.get("data")
        if df is None:
            # Also check direct state["data"] if available
            df = state.get("data")
            if df is None:
                return {
                    "Original_Data": {
                        "cleaning_error": "DataFrame is missing",
                    }
                }
        df = df.copy(deep=True)
    rules = original.get("rules", []) or state.get("generated_rules", [])

    cleaned_columns = set()

    # Loop through each column in generated rules and clean one by one
    for col_info in rules:
        if isinstance(col_info, dict):
            col_name = col_info.get("name")
            col_type = col_info.get("type", "object")
        else:
            col_name = getattr(col_info, "name", None)
            col_type = getattr(col_info, "type", "object")

        if col_name and col_name in df.columns:
            df = clean_column_by_type(df, col_name, col_type)
            cleaned_columns.add(col_name)

    # Clean any remaining columns not explicitly in rules
    for col_name in df.columns:
        if col_name not in cleaned_columns:
            df = clean_column_by_type(
                df,
                col_name,
                str(df[col_name].dtype),
            )

    return {
        "Original_Data": {
            "data": df,
            "cleaning_error": None,
        }
    }

