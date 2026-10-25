from fastapi import APIRouter
from ..controllers.document import (
    uploadDocument,
    cleanDocument,
    getDocuments,
    getDocumentById,
    deleteDocument,
)

documentRoutes = APIRouter(prefix="/documents", tags=["documents"])

documentRoutes.post("/upload")(uploadDocument)
documentRoutes.post("/{document_id}/clean")(cleanDocument)
documentRoutes.get("")(getDocuments)
documentRoutes.get("/")(getDocuments)
documentRoutes.get("/{document_id}")(getDocumentById)
documentRoutes.delete("/{document_id}")(deleteDocument)

