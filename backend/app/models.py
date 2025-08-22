from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class UserRole(enum.Enum):
    ADMIN = "admin"
    USER = "user"

class JobStatus(enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    jobs = relationship("Job", back_populates="user")

class Template(Base):
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    filename = Column(String)
    file_path = Column(String)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    uploader = relationship("User")
    jobs = relationship("Job", back_populates="template")

class ExcelData(Base):
    __tablename__ = "excel_data"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    filename = Column(String)
    file_path = Column(String)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    uploader = relationship("User")
    jobs = relationship("Job", back_populates="excel_data")

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    template_id = Column(Integer, ForeignKey("templates.id"))
    excel_data_id = Column(Integer, ForeignKey("excel_data.id"))
    txt_filename = Column(String)
    txt_file_path = Column(String)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    output_pptx_path = Column(String)
    output_pdf_path = Column(String)
    error_message = Column(Text)
    progress = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="jobs")
    template = relationship("Template", back_populates="jobs")
    excel_data = relationship("ExcelData", back_populates="jobs")