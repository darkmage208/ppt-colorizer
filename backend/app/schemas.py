from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .models import UserRole, JobStatus

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
    pass

class Job(JobBase):
    id: int
    user_id: int
    txt_filename: str
    txt_file_path: str
    status: JobStatus
    output_pptx_path: Optional[str] = None
    output_pdf_path: Optional[str] = None
    error_message: Optional[str] = None
    progress: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class JobWithDetails(Job):
    user: User
    template: Template
    excel_data: ExcelData
    
    class Config:
        from_attributes = True