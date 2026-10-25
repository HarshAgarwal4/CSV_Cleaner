import json
import logging
from typing import Any
import pandas as pd
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from rich import print

from AI.agent import State, llm

logger = logging.getLogger("csv-review-node")


# ============================================================
# EVALUATION SCHEMA
# ============================================================

class ReviewEvaluation(BaseModel):
    score: float = Field(
        description=(
            "Final quality score from 0.0 to 10.0 assessing overall data "
            "cleaning quality, deduplication, primary/unique key integrity, "
            "schema compliance, and missing value management."
        )
    )
    improved_list: list[str] = Field(
        description=(
            "List of concrete, specific improvements observed in the "
            "cleaned dataset compared to the original raw dataset."
        )
    )
    things_to_improve: list[str] = Field(
        description=(
            "List of remaining issues, unhandled columns, potential risks, "
            "or areas that could still be improved in future cleaning passes."
        )
    )


# ============================================================
# REVIEW PROMPT
# ============================================================

REVIEW_SYSTEM_PROMPT = """You are a Principal Data Quality Auditor.
Your task is to thoroughly compare the Original Raw Dataset and the Final Cleaned Dataset.

You are provided with:
1. Initial Analysis (original raw dataset profile: total rows, missing values, duplicate counts, dtypes).
2. Final Analysis (cleaned dataset profile: final rows, rows removed, remaining missing, duplicate counts, dtypes).
3. Column Rules Basic Fields (expected types, primary key, unique constraints, nullability, issues, actions).
4. 25 random sample rows from Original Raw Data.
5. 25 random sample rows from Final Cleaned Data.

Scoring Rubric (0.0 to 10.0):
- 9.0 - 10.0: Excellent cleaning. All duplicate rows eliminated, primary key and unique constraints strictly enforced without duplicate keys or null keys, types properly cast, missing values handled cleanly.
- 7.0 - 8.9: Good cleaning with minor residual issues (e.g., minor acceptable nulls in nullable columns).
- 6.5 - 6.9: Satisfactory minimal baseline.
- Below 6.5: Failed/unsatisfactory cleaning. Unresolved duplicate rows, primary key collisions remaining, severe or corrupt data loss, or type mismatches.

Provide:
- score: Float out of 10.0.
- improved_list: Specific list of what actually improved.
- things_to_improve: Specific list of remaining concerns or items to improve.
"""

REVIEW_USER_PROMPT = """
--- INITIAL ANALYSIS (RAW DATA) ---
{initial_analysis}

--- FINAL ANALYSIS (CLEANED DATA) ---
{final_analysis}

--- COLUMN RULES (BASIC FIELDS) ---
{column_rules}

--- 25 SAMPLE ROWS: ORIGINAL RAW DATA ---
{sample_raw}

--- 25 SAMPLE ROWS: FINAL CLEANED DATA ---
{sample_cleaned}

Evaluate and return the structured review evaluation.
"""


# ============================================================
# DETERMINISTIC FALLBACK EVALUATION
# ============================================================

def deterministic_evaluate(
    init_analysis: dict,
    final_analysis: dict,
    basic_rules: list[dict],
    cleaned_df: pd.DataFrame | None,
) -> tuple[float, list[str], list[str]]:
    """
    Fallback deterministic evaluator that computes quality score and
    improvement lists based on objective data integrity metrics.
    """
    score = 10.0
    improved_list = []
    things_to_improve = []

    init_dups = init_analysis.get("duplicate_rows", 0)
    final_dups = final_analysis.get("duplicate_rows", 0)
    init_missing = init_analysis.get("total_missing_values", 0)
    final_missing = final_analysis.get("total_missing_values", 0)
    init_missing_pct = init_analysis.get("missing_percentage", 0.0)
    final_missing_pct = final_analysis.get("missing_percentage", 0.0)
    init_rows = init_analysis.get("total_rows", 0)
    final_rows = final_analysis.get("final_rows", 0)
    rows_removed = final_analysis.get("rows_removed", 0)

    # 1. Duplicates check
    if init_dups > 0 and final_dups == 0:
        improved_list.append(
            f"Completely eliminated all {init_dups} duplicate row(s)."
        )
    elif final_dups > 0:
        score -= 2.5
        things_to_improve.append(
            f"{final_dups} duplicate row(s) still remain in the cleaned data."
        )

    # 2. Primary key & unique constraints check
    pk_cols = [r["name"] for r in basic_rules if r.get("primary_key")]
    uniq_cols = [
        r["name"]
        for r in basic_rules
        if r.get("unique") and not r.get("primary_key")
    ]

    if cleaned_df is not None and not cleaned_df.empty:
        for col in pk_cols:
            if col in cleaned_df.columns:
                pk_dups = int(cleaned_df[col].duplicated().sum())
                pk_nulls = int(cleaned_df[col].isna().sum())
                if pk_dups == 0 and pk_nulls == 0:
                    improved_list.append(
                        f"Primary key '{col}' fully enforced (0 duplicates, 0 nulls)."
                    )
                else:
                    if pk_dups > 0:
                        score -= 3.0
                        things_to_improve.append(
                            f"Primary key '{col}' contains {pk_dups} duplicate value(s)."
                        )
                    if pk_nulls > 0:
                        score -= 2.0
                        things_to_improve.append(
                            f"Primary key '{col}' contains {pk_nulls} null value(s)."
                        )

        for col in uniq_cols:
            if col in cleaned_df.columns:
                u_dups = int(cleaned_df[col].dropna().duplicated().sum())
                if u_dups == 0:
                    improved_list.append(
                        f"Unique key '{col}' enforced (0 non-null duplicates)."
                    )
                else:
                    score -= 1.0
                    things_to_improve.append(
                        f"Unique key '{col}' has {u_dups} duplicate value(s)."
                    )

    # 3. Missing values check
    if final_missing < init_missing:
        improved_list.append(
            f"Reduced total missing values from {init_missing} ({init_missing_pct}%) to {final_missing} ({final_missing_pct}%)."
        )
    elif final_missing > init_missing:
        score -= 1.5
        things_to_improve.append(
            f"Missing values increased from {init_missing} to {final_missing}."
        )

    if final_missing > 0:
        things_to_improve.append(
            f"{final_missing} missing value(s) remain across nullable columns."
        )

    # 4. Row retention check
    if final_rows == 0:
        score = 0.0
        things_to_improve.append("Critical failure: Cleaned dataset contains 0 rows.")
    elif init_rows > 0:
        retention = round((final_rows / init_rows) * 100, 1)
        improved_list.append(
            f"Retained {final_rows} valid rows ({retention}% retention, {rows_removed} dirty rows pruned)."
        )

    # 5. Type standardization
    cleaned_dtypes = final_analysis.get("dtypes", {})
    if cleaned_dtypes:
        improved_list.append(
            "Standardized data types across all columns (categories, numerics, datetimes)."
        )

    score = max(0.0, min(10.0, round(score, 1)))
    return score, improved_list, things_to_improve


# ============================================================
# REVIEW NODE
# ============================================================

def review_node(state: State) -> dict:
    """
    Review node:
    - Samples 25 random rows from original data and cleaned data.
    - Extracts column rules basic fields.
    - Evaluates initial analysis and final analysis.
    - Generates score out of 10, improved list, and things to improve.
    - Tracks retry count (up to 5 attempts).
    """
    original = state.get("Original_Data", {})
    raw_df = original.get("raw_data")
    if raw_df is None:
        raw_df = state.get("raw_data")

    cleaned_df = original.get("data")
    if cleaned_df is None:
        cleaned_df = state.get("data")

    initial_analysis = state.get("initial_analysis", {})
    final_analysis = state.get("final_analysis", {})
    rules = original.get("rules", []) or state.get("generated_rules", [])
    retry_count = state.get("retry_count", 0)

    # 1. Sample 25 random rows of original data and cleaned data
    raw_sample_rows: list[dict] = []
    if raw_df is not None and isinstance(raw_df, pd.DataFrame) and not raw_df.empty:
        sample_n = min(25, len(raw_df))
        raw_sample_df = raw_df.sample(n=sample_n, random_state=42)
        raw_sample_rows = raw_sample_df.to_dict(orient="records")

    cleaned_sample_rows: list[dict] = []
    if cleaned_df is not None and isinstance(cleaned_df, pd.DataFrame) and not cleaned_df.empty:
        sample_n = min(25, len(cleaned_df))
        cleaned_sample_df = cleaned_df.sample(n=sample_n, random_state=42)
        cleaned_sample_rows = cleaned_sample_df.to_dict(orient="records")

    # 2. Extract column rules basic fields
    basic_rules: list[dict[str, Any]] = []
    for r in rules:
        if hasattr(r, "model_dump"):
            d = r.model_dump()
        elif isinstance(r, dict):
            d = r
        elif hasattr(r, "__dict__"):
            d = vars(r)
        else:
            d = {}
        basic_rules.append({
            "name": d.get("name"),
            "type": d.get("type"),
            "primary_key": d.get("primary_key", False),
            "unique": d.get("unique", False),
            "nullable": d.get("nullable", True),
            "issues": d.get("issues", []),
            "cleaning_actions": d.get("cleaning_actions", []),
        })

    # 3. Calculate deterministic baseline
    det_score, det_improved, det_to_improve = deterministic_evaluate(
        initial_analysis,
        final_analysis,
        basic_rules,
        cleaned_df,
    )

    # 4. Call LLM for audit scoring
    score = det_score
    improved_list = det_improved
    things_to_improve = det_to_improve

    try:
        review_llm = llm.with_structured_output(ReviewEvaluation)
        prompt = ChatPromptTemplate.from_messages([
            ("system", REVIEW_SYSTEM_PROMPT),
            ("user", REVIEW_USER_PROMPT),
        ])

        # Serialize sample data concisely
        raw_sample_str = json.dumps(raw_sample_rows[:25], default=str, indent=2)
        cleaned_sample_str = json.dumps(cleaned_sample_rows[:25], default=str, indent=2)
        init_str = json.dumps(
            {k: v for k, v in initial_analysis.items() if k != "preview"},
            default=str,
            indent=2,
        )
        final_str = json.dumps(
            {k: v for k, v in final_analysis.items() if k != "preview"},
            default=str,
            indent=2,
        )
        rules_str = json.dumps(basic_rules, default=str, indent=2)

        chain = prompt | review_llm
        eval_result: ReviewEvaluation = chain.invoke({
            "initial_analysis": init_str,
            "final_analysis": final_str,
            "column_rules": rules_str,
            "sample_raw": raw_sample_str,
            "sample_cleaned": cleaned_sample_str,
        })

        if eval_result and eval_result.score is not None:
            score = max(0.0, min(10.0, round(float(eval_result.score), 1)))
            improved_list = eval_result.improved_list or det_improved
            things_to_improve = eval_result.things_to_improve or det_to_improve

    except Exception as exc:
        logger.warning(
            f"LLM review evaluation error ({exc}). Using deterministic audit results."
        )

    # 5. Build review output dictionary
    passed = score >= 6.5
    review_output = {
        "score": score,
        "improved_list": improved_list,
        "things_to_improve": things_to_improve,
        "passed": passed,
        "attempt": retry_count + 1,
        "max_retries": 5,
        "sample_25_original": raw_sample_rows,
        "sample_25_cleaned": cleaned_sample_rows,
        "column_rules_basic": basic_rules,
    }

    # If score < 6.5, increment retry_count
    new_retry_count = retry_count + 1 if not passed else retry_count

    print("\n[REVIEW NODE] Evaluation Complete:")
    print(f"  Score: {score} / 10.0 (Threshold: 6.5)")
    print(f"  Status: {'PASSED' if passed else 'NEEDS RETRY'}")
    print(f"  Attempt: {retry_count + 1} of 5")

    return {
        "review": review_output,
        "retry_count": new_retry_count,
    }
