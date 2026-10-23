from sqlalchemy import Column, Integer, String, JSON
from .database import Base

class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    profile = Column(String, default="/defaultProfile.png")
    sessions = Column(JSON, default=list)

    @property
    def _id(self):
        return str(self.id)

    def to_dict(self):
        return {
            "id": self.id,
            "_id": str(self.id),
            "name": self.name,
            "email": self.email,
            "profile": self.profile,
            "sessions": self.sessions or []
        }

