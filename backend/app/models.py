from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class UserRole(enum.Enum):
    SUPERADMIN = "superadmin"
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
    processing_count = Column(Integer, default=0)
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

class VcfFile(Base):
    __tablename__ = "vcf_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    filename = Column(String)
    file_path = Column(String)
    file_size = Column(Integer)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploader = relationship("User")
    conversions = relationship("VcfConversion", back_populates="vcf_file")

class ConversionStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"

class VcfConversion(Base):
    __tablename__ = "vcf_conversions"

    id = Column(Integer, primary_key=True, index=True)
    vcf_file_id = Column(Integer, ForeignKey("vcf_files.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    txt_filename = Column(String)
    txt_file_path = Column(String)
    status = Column(Enum(ConversionStatus), default=ConversionStatus.PENDING)
    error_message = Column(Text)
    progress = Column(Integer, default=0)
    total_variants = Column(Integer, default=0)
    processed_variants = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    vcf_file = relationship("VcfFile", back_populates="conversions")
    user = relationship("User")

class JobPermission(Base):
    __tablename__ = "job_permissions"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="permissions")
    user = relationship("User")

class ConversionFile(Base):
    __tablename__ = "conversion_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    filename = Column(String)
    file_path = Column(String)
    file_size = Column(Integer)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploader = relationship("User")
    individual_files = relationship("IndividualFile", back_populates="conversion_file")

class IndividualFile(Base):
    __tablename__ = "individual_files"

    id = Column(Integer, primary_key=True, index=True)
    conversion_file_id = Column(Integer, ForeignKey("conversion_files.id"), nullable=True)  # Allow independent files
    name = Column(String, index=True)
    filename = Column(String)
    file_path = Column(String)
    file_size = Column(Integer)
    upload_progress = Column(Integer, default=0)
    is_uploaded = Column(Boolean, default=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversion_file = relationship("ConversionFile", back_populates="individual_files")
    uploader = relationship("User")
    conversion_groups = relationship("ConversionGroup", back_populates="individual_file")

class ConversionGroup(Base):
    __tablename__ = "conversion_groups"

    id = Column(Integer, primary_key=True, index=True)
    individual_file_id = Column(Integer, ForeignKey("individual_files.id"))
    name = Column(String, index=True)
    status = Column(Enum(ConversionStatus), default=ConversionStatus.PENDING)
    progress = Column(Integer, default=0)
    total_outputs = Column(Integer, default=0)
    processed_outputs = Column(Integer, default=0)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    individual_file = relationship("IndividualFile", back_populates="conversion_groups")
    results = relationship("ConversionResult", back_populates="group", cascade="all, delete-orphan")

class ConversionResult(Base):
    __tablename__ = "conversion_results"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("conversion_groups.id"))
    output_name = Column(String)  # Name of the OUTPUT column
    filename = Column(String)
    file_path = Column(String)
    file_size = Column(Integer)
    total_records = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("ConversionGroup", back_populates="results")

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
    pdf_created = Column(Boolean, default=False)
    error_message = Column(Text)
    progress = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="jobs")
    template = relationship("Template", back_populates="jobs")
    excel_data = relationship("ExcelData", back_populates="jobs")
    permissions = relationship("JobPermission", back_populates="job", cascade="all, delete-orphan")