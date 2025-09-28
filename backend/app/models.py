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

class ConversionJobStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"

class ConversionFile(Base):
    __tablename__ = "conversion_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    uploader = relationship("User")
    jobs = relationship("ConversionJob", back_populates="conversion_file")

class IndividualFile(Base):
    __tablename__ = "individual_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    uploader = relationship("User")
    job_files = relationship("ConversionJobFile", back_populates="individual_file")
    result_groups = relationship("ResultGroup", back_populates="individual_file")

class ConversionJob(Base):
    __tablename__ = "conversion_jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    conversion_file_id = Column(Integer, ForeignKey("conversion_files.id"), nullable=False)
    status = Column(Enum(ConversionJobStatus), default=ConversionJobStatus.PENDING)
    error_message = Column(Text)
    progress = Column(Integer, default=0)
    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User")
    conversion_file = relationship("ConversionFile", back_populates="jobs")
    job_files = relationship("ConversionJobFile", back_populates="job", cascade="all, delete-orphan")
    result_groups = relationship("ResultGroup", back_populates="job", cascade="all, delete-orphan")

class ConversionJobFile(Base):
    __tablename__ = "conversion_job_files"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("conversion_jobs.id"), nullable=False)
    individual_file_id = Column(Integer, ForeignKey("individual_files.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("ConversionJob", back_populates="job_files")
    individual_file = relationship("IndividualFile", back_populates="job_files")

class ResultGroup(Base):
    __tablename__ = "result_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)  # individual_file_name + date
    job_id = Column(Integer, ForeignKey("conversion_jobs.id"), nullable=False)
    individual_file_id = Column(Integer, ForeignKey("individual_files.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("ConversionJob", back_populates="result_groups")
    individual_file = relationship("IndividualFile", back_populates="result_groups")
    result_files = relationship("ResultFile", back_populates="group", cascade="all, delete-orphan")

class ResultFile(Base):
    __tablename__ = "result_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)  # column name or description
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    group_id = Column(Integer, ForeignKey("result_groups.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("ResultGroup", back_populates="result_files")

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