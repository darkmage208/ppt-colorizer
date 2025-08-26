from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..storage import storage

router = APIRouter(prefix="/excel-data", tags=["excel-data"])

@router.get("/", response_model=List[schemas.ExcelData])
def get_excel_data(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    excel_data = db.query(models.ExcelData).filter(models.ExcelData.is_active == True).offset(skip).limit(limit).all()
    return excel_data

@router.post("/", response_model=schemas.ExcelData)
def create_excel_data(
    name: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed")
    
    if not auth.check_excel_upload_permission(current_user):
        raise HTTPException(status_code=403, detail="Only superadmins can upload Excel data files")
    
    try:
        file_key = storage.upload_file(file.file, file.filename, "excel_data")
        
        existing_data = db.query(models.ExcelData).filter(
            models.ExcelData.name == name,
            models.ExcelData.is_active == True
        ).first()
        
        version = 1
        if existing_data:
            existing_data.is_active = False
            version = existing_data.version + 1
        
        db_excel_data = models.ExcelData(
            name=name,
            filename=file.filename,
            file_path=file_key,
            version=version,
            uploaded_by=current_user.id
        )
        db.add(db_excel_data)
        db.commit()
        db.refresh(db_excel_data)
        return db_excel_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload Excel data: {str(e)}")

@router.get("/{excel_data_id}", response_model=schemas.ExcelData)
def get_excel_data_by_id(
    excel_data_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    excel_data = db.query(models.ExcelData).filter(models.ExcelData.id == excel_data_id).first()
    if excel_data is None:
        raise HTTPException(status_code=404, detail="Excel data not found")
    return excel_data

@router.delete("/{excel_data_id}")
def delete_excel_data(
    excel_data_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    excel_data = db.query(models.ExcelData).filter(models.ExcelData.id == excel_data_id).first()
    if excel_data is None:
        raise HTTPException(status_code=404, detail="Excel data not found")
    
    excel_data.is_active = False
    db.commit()
    return {"message": "Excel data deleted successfully"}