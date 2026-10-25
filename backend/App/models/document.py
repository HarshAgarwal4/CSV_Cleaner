from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base


class DocumentModel(Base):
    """
    SQL Documents Table:
    Stores only the Cloudinary public URLs, file metadata, and analytics summaries.
    No CSV data rows are stored in the database.
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)

    # Cloudinary Public URL for Original CSV
    file_url = Column(String, nullable=False)
    public_id = Column(String, nullable=True)
    file_size = Column(Integer, default=0)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    status = Column(String, default="uploaded")  # uploaded, cleaning, cleaned, failed

    # Cloudinary Public URL for Cleaned CSV
    cleaned_file_url = Column(String, nullable=True)
    cleaned_public_id = Column(String, nullable=True)
    cleaned_file_size = Column(Integer, default=0)
    cleaned_row_count = Column(Integer, default=0)

    # Summary Analytics Metrics Only (no dataset rows stored)
    initial_analysis = Column(JSON, default=dict)
    final_analysis = Column(JSON, default=dict)
    review = Column(JSON, default=dict)
    cleaning_error = Column(String, nullable=True)

    cleaned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to user
    user = relationship("UserModel", backref="documents")

    @property
    def _id(self):
        return str(self.id)

    def to_dict(self):
        return {
            "id": self.id,
            "_id": str(self.id),
            "user_id": self.user_id,
            "filename": self.filename,
            "file_url": self.file_url,
            "public_id": self.public_id,
            "file_size": self.file_size,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "status": self.status,
            "cleaned_file_url": self.cleaned_file_url,
            "cleaned_public_id": self.cleaned_public_id,
            "cleaned_file_size": self.cleaned_file_size,
            "cleaned_row_count": self.cleaned_row_count,
            "initial_analysis": self.initial_analysis or {},
            "final_analysis": self.final_analysis or {},
            "review": self.review or {},
            "cleaning_error": self.cleaning_error,
            "cleaned_at": self.cleaned_at.strftime("%Y-%m-%d %H:%M:%S") if self.cleaned_at else None,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else None,
        }
