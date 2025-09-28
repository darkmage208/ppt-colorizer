from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .models import UserRole, JobStatus, ConversionStatus, ConversionJobStatus

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    role: UserRole
    is_active: bool
    processing_count: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class TemplateBase(BaseModel):
    name: str

class TemplateCreate(TemplateBase):
    pass

class Template(TemplateBase):
    id: int
    filename: str
    file_path: str
    version: int
    is_active: bool
    uploaded_by: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ExcelDataBase(BaseModel):
    name: str

class ExcelDataCreate(ExcelDataBase):
    pass

class ExcelData(ExcelDataBase):
    id: int
    filename: str
    file_path: str
    version: int
    is_active: bool
    uploaded_by: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class JobBase(BaseModel):
    template_id: int
    excel_data_id: int

class JobCreate(JobBase):
    user_emails: Optional[List[str]] = []

class Job(JobBase):
    id: int
    user_id: int
    txt_filename: str
    txt_file_path: str
    status: JobStatus
    output_pptx_path: Optional[str] = None
    output_pdf_path: Optional[str] = None
    pdf_created: bool = False
    error_message: Optional[str] = None
    progress: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class JobPermission(BaseModel):
    id: int
    job_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class JobWithDetails(Job):
    user: User
    template: Template
    excel_data: ExcelData
    permissions: List[JobPermission] = []

    class Config:
        from_attributes = True

class VcfFileBase(BaseModel):
    name: str

class VcfFileCreate(VcfFileBase):
    pass

class VcfFile(VcfFileBase):
    id: int
    filename: str
    file_path: str
    file_size: int
    is_active: bool
    uploaded_by: int
    created_at: datetime

    class Config:
        from_attributes = True

class VcfConversionBase(BaseModel):
    vcf_file_id: int

class VcfConversionCreate(VcfConversionBase):
    pass

class VcfConversion(VcfConversionBase):
    id: int
    user_id: int
    txt_filename: Optional[str] = None
    txt_file_path: Optional[str] = None
    status: ConversionStatus
    error_message: Optional[str] = None
    progress: int
    total_variants: int
    processed_variants: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class VcfConversionWithDetails(VcfConversion):
    vcf_file: VcfFile
    user: User

    class Config:
        from_attributes = True

# New Conversion System Schemas
class ConversionFileBase(BaseModel):
    name: str

class ConversionFileCreate(ConversionFileBase):
    pass

class ConversionFile(ConversionFileBase):
    id: int
    filename: str
    file_path: str
    file_size: Optional[int] = None
    is_active: bool
    uploaded_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class IndividualFileBase(BaseModel):
    name: str

class IndividualFileCreate(IndividualFileBase):
    pass

class IndividualFile(IndividualFileBase):
    id: int
    filename: str
    file_path: str
    file_size: Optional[int] = None
    is_active: bool
    uploaded_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ConversionJobBase(BaseModel):
    name: str
    conversion_file_id: int

class ConversionJobCreate(ConversionJobBase):
    individual_file_ids: List[int]

class ConversionJob(ConversionJobBase):
    id: int
    status: ConversionJobStatus
    error_message: Optional[str] = None
    progress: int
    total_files: int
    processed_files: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ResultFileBase(BaseModel):
    name: str

class ResultFile(ResultFileBase):
    id: int
    filename: str
    file_path: str
    file_size: Optional[int] = None
    group_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ResultGroupBase(BaseModel):
    name: str

class ResultGroup(ResultGroupBase):
    id: int
    job_id: int
    individual_file_id: int
    is_active: bool
    created_at: datetime
    result_files: List[ResultFile] = []

    class Config:
        from_attributes = True

class ConversionJobWithDetails(ConversionJob):
    conversion_file: ConversionFile
    result_groups: List[ResultGroup] = []
    creator: User

    class Config:
        from_attributes = True