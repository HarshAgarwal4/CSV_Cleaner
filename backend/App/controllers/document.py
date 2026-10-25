import os
import io
import asyncio
from datetime import datetime
import pandas as pd
from fastapi import Request, UploadFile, File, Depends
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.document import DocumentModel
from services.upload import uploadCsvToCloud, deleteCsvFromCloud
from AI.agent import graph


def get_user_id(request: Request) -> int | None:
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        user_data = getattr(request.state, "user", None)
        if isinstance(user_data, dict):
            user_id = user_data.get("id") or user_data.get("_id")
    try:
        return int(user_id) if user_id is not None else None
    except (ValueError, TypeError):
        return None


async def uploadDocument(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    1. Validates that the uploaded file is a valid CSV.
    2. Uploads the CSV to Cloudinary raw storage.
    3. Saves document record with user_id to the database.
    """
    user_id = get_user_id(request)
    if not user_id:
        return {"status": 50, "msg": "Unauthorized: Please log in first."}

    # 1. Validate file extension
    filename = file.filename or "unknown.csv"
    if not filename.lower().endswith(".csv"):
        return {
            "status": 7,
            "msg": "Invalid file type. Please upload a valid .csv file.",
        }

    try:
        file_bytes = await file.read()
    except Exception as exc:
        return {"status": 0, "msg": f"Failed to read uploaded file: {str(exc)}"}

    if not file_bytes or len(file_bytes) == 0:
        return {"status": 7, "msg": "The uploaded CSV file is empty."}

    # 2. Validate CSV content & parse structure
    try:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8-sig")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1")

        if df.empty:
            return {
                "status": 7,
                "msg": "The CSV contains no data rows.",
            }

        if len(df.columns) == 0:
            return {
                "status": 7,
                "msg": "The CSV contains no column headers.",
            }

        columns = df.columns.astype(str).tolist()
        row_count = len(df)
        column_count = len(columns)
        file_size = len(file_bytes)

    except Exception as exc:
        return {
            "status": 7,
            "msg": f"Invalid CSV file format. Parser error: {str(exc)}",
        }

    # 3. Upload to Cloudinary as a raw document
    try:
        cloud_res = await uploadCsvToCloud(file_bytes, filename)
        file_url = cloud_res.get("secure_url")
        public_id = cloud_res.get("public_id")

        if not file_url:
            raise ValueError("No secure_url returned by Cloudinary")

    except Exception as exc:
        return {
            "status": 0,
            "msg": f"Failed to upload CSV to Cloudinary: {str(exc)}",
        }

    # 4. Store document link and metadata in database (No complete CSV in SQL, only Cloudinary URLs)
    try:
        document = DocumentModel(
            user_id=user_id,
            filename=filename,
            file_url=file_url,
            public_id=public_id,
            file_size=file_size,
            row_count=row_count,
            column_count=column_count,
            status="uploaded",
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        return {
            "status": 1,
            "msg": "CSV verified, uploaded to Cloudinary, and saved to My Documents successfully!",
            "document": document.to_dict(),
        }

    except Exception as exc:
        db.rollback()
        # Clean up uploaded Cloudinary file if database insertion fails
        if public_id:
            try:
                await deleteCsvFromCloud(public_id)
            except Exception:
                pass
        return {
            "status": 0,
            "msg": f"Failed to save document in database: {str(exc)}",
        }


async def cleanDocument(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    1. Sends the public URL of the CSV to the AI cleaning agent.
    2. AI agent executes cleaning workflow (rules, cleaning, review scoring).
    3. Automatically saves the cleaned output CSV to Cloudinary.
    4. Updates database state with complete analytics and user_id.
    """
    user_id = get_user_id(request)
    if not user_id:
        return {"status": 50, "msg": "Unauthorized: Please log in first."}

    doc = (
        db.query(DocumentModel)
        .filter(
            DocumentModel.id == document_id,
            DocumentModel.user_id == user_id,
        )
        .first()
    )
    if not doc:
        return {"status": 9, "msg": "Document not found."}

    # Mark as cleaning in progress
    doc.status = "cleaning"
    db.commit()

    try:
        # Run agent in threadpool to keep FastAPI non-blocking
        def execute_agent(url: str):
            return graph.invoke({
                "document_url": url,
                "Original_Data": {},
                "analysis": {},
                "initial_analysis": {},
                "final_analysis": {},
                "review": {},
                "Failed_Rules": {},
                "current_rule_index": 0,
                "retry_count": 0,
            })

        print(f"\n[AI CLEANER] Starting AI cleaning for doc #{doc.id}: {doc.filename}")
        print(f"[AI CLEANER] Input URL: {doc.file_url}")

        result = await asyncio.to_thread(execute_agent, doc.file_url)

        original_data = result.get("Original_Data", {})
        cleaning_error = original_data.get("cleaning_error") or original_data.get("error")
        cleaned_csv_path = original_data.get("cleaned_csv") or original_data.get("output_path")

        if cleaning_error or not cleaned_csv_path or not os.path.isfile(cleaned_csv_path):
            err_msg = str(cleaning_error or "AI cleaner could not produce a cleaned CSV")
            doc.status = "failed"
            doc.cleaning_error = err_msg
            db.commit()
            return {
                "status": 0,
                "msg": f"AI cleaning failed: {err_msg}",
                "document": doc.to_dict(),
            }

        # Read the generated cleaned CSV file
        with open(cleaned_csv_path, "rb") as f:
            cleaned_bytes = f.read()

        # Automatically upload generated cleaned CSV to Cloudinary
        cleaned_filename = f"cleaned_{doc.filename}"
        cloud_res = await uploadCsvToCloud(
            cleaned_bytes,
            cleaned_filename,
            folder="cleaned_csv_documents",
        )
        cleaned_url = cloud_res.get("secure_url")
        cleaned_public_id = cloud_res.get("public_id")

        # Extract analytics & reviews (Strip out any raw data rows so SQL only stores metrics)
        init_analysis = result.get("initial_analysis", {})
        fin_analysis = result.get("final_analysis", {})
        review_data = result.get("review", {})
        final_row_count = fin_analysis.get("final_rows", original_data.get("rows", 0))

        init_summary = {k: v for k, v in init_analysis.items() if k != "preview"}
        fin_summary = {k: v for k, v in fin_analysis.items() if k != "preview"}

        # Update document state in database:
        # Stores ONLY Cloudinary public URLs, file sizes, and summary metrics.
        # Zero CSV rows are stored in SQL.
        doc.status = "cleaned"
        doc.cleaned_file_url = cleaned_url
        doc.cleaned_public_id = cleaned_public_id
        doc.cleaned_file_size = len(cleaned_bytes)
        doc.cleaned_row_count = final_row_count
        doc.initial_analysis = init_summary
        doc.final_analysis = fin_summary
        doc.review = {
            "score": review_data.get("score"),
            "passed": review_data.get("passed"),
            "attempt": review_data.get("attempt"),
            "max_retries": review_data.get("max_retries"),
            "improved_list": review_data.get("improved_list", []),
            "things_to_improve": review_data.get("things_to_improve", []),
            "column_rules": review_data.get("column_rules_basic", []),
        }
        doc.cleaning_error = None
        doc.cleaned_at = datetime.utcnow()

        db.commit()
        db.refresh(doc)

        print(f"[AI CLEANER] Cleaning completed successfully for doc #{doc.id}")
        print(f"[AI CLEANER] Cleaned Cloudinary URL: {cleaned_url}")

        return {
            "status": 1,
            "msg": "AI Cleaning completed and output file saved to Cloudinary successfully!",
            "document": doc.to_dict(),
        }

    except Exception as exc:
        doc.status = "failed"
        doc.cleaning_error = str(exc)
        db.commit()
        print(f"[AI CLEANER ERROR] {exc}")
        return {
            "status": 0,
            "msg": f"Error running AI cleaning agent: {str(exc)}",
            "document": doc.to_dict(),
        }


async def getDocuments(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Fetch all documents uploaded by the authenticated user.
    """
    user_id = get_user_id(request)
    if not user_id:
        return {"status": 50, "msg": "Unauthorized: Please log in first."}

    try:
        documents = (
            db.query(DocumentModel)
            .filter(DocumentModel.user_id == user_id)
            .order_by(DocumentModel.created_at.desc())
            .all()
        )
        return {
            "status": 1,
            "documents": [doc.to_dict() for doc in documents],
        }
    except Exception as exc:
        return {"status": 0, "msg": f"Failed to retrieve documents: {str(exc)}"}


async def getDocumentById(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Fetch a specific document belonging to the user.
    """
    user_id = get_user_id(request)
    if not user_id:
        return {"status": 50, "msg": "Unauthorized: Please log in first."}

    try:
        doc = (
            db.query(DocumentModel)
            .filter(
                DocumentModel.id == document_id,
                DocumentModel.user_id == user_id,
            )
            .first()
        )
        if not doc:
            return {"status": 9, "msg": "Document not found."}

        return {"status": 1, "document": doc.to_dict()}
    except Exception as exc:
        return {"status": 0, "msg": f"Failed to fetch document: {str(exc)}"}


async def deleteDocument(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Delete a document from Cloudinary and remove it from the database.
    """
    user_id = get_user_id(request)
    if not user_id:
        return {"status": 50, "msg": "Unauthorized: Please log in first."}

    try:
        doc = (
            db.query(DocumentModel)
            .filter(
                DocumentModel.id == document_id,
                DocumentModel.user_id == user_id,
            )
            .first()
        )
        if not doc:
            return {"status": 9, "msg": "Document not found."}

        # Delete raw original file from Cloudinary
        if doc.public_id:
            try:
                await deleteCsvFromCloud(doc.public_id)
            except Exception as exc:
                print(f"Warning: Cloudinary original deletion error: {exc}")

        # Delete cleaned file from Cloudinary if present
        if doc.cleaned_public_id:
            try:
                await deleteCsvFromCloud(doc.cleaned_public_id)
            except Exception as exc:
                print(f"Warning: Cloudinary cleaned deletion error: {exc}")

        db.delete(doc)
        db.commit()

        return {"status": 1, "msg": "Document deleted successfully."}
    except Exception as exc:
        db.rollback()
        return {"status": 0, "msg": f"Failed to delete document: {str(exc)}"}
