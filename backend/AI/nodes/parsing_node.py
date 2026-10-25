import pandas as pd
from AI.agent import State


def Parse_CSV_Node(state: State) -> dict:
    url = state.get("document_url")

    if not url:
        return {
            "Original_Data": {
                "error": "Missing document_url",
            }
        }

    try:
        if str(url).startswith("http://") or str(url).startswith("https://"):
            try:
                import io
                import requests
                resp = requests.get(url, timeout=45)
                resp.raise_for_status()
                try:
                    df = pd.read_csv(io.BytesIO(resp.content), encoding="utf-8-sig")
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(resp.content), encoding="latin1")
            except Exception:
                df = pd.read_csv(url)
        else:
            try:
                df = pd.read_csv(url, encoding="utf-8-sig")
            except UnicodeDecodeError:
                df = pd.read_csv(url, encoding="latin1")

        if not df.columns.is_unique:
            raise ValueError(
                "Duplicate column names are not supported"
            )

        if df.empty:
            raise ValueError("The CSV contains no data rows")

        total_missing = int(df.isna().sum().sum())
        total_cells = df.size
        missing_pct = round((total_missing / total_cells * 100), 2) if total_cells > 0 else 0.0

        initial_analysis = {
            "total_rows": len(df),
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
            "preview": df.head(5).to_dict(
                orient="records"
            ),
        }

        return {
            "initial_analysis": initial_analysis,
            "analysis": initial_analysis,
            "Original_Data": {
                "columns": df.columns.tolist(),
                "rows": len(df),
                "dtypes": {
                    col: str(dtype)
                    for col, dtype in df.dtypes.items()
                },
                "preview": df.head(5).to_dict(
                    orient="records"
                ),
                "missing": df.isna().sum().to_dict(),
                "unique_counts": df.nunique().to_dict(),
                "error": None,
                "data": df,
                "raw_data": df.copy(deep=True),
            }
        }

    except Exception as exc:
        return {
            "Original_Data": {
                "error": str(exc),
            }
        }
