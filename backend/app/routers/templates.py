from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..storage import storage

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get("/", response_model=List[schemas.Template])
def get_templates(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    templates = db.query(models.Template).filter(models.Template.is_active == True).offset(skip).limit(limit).all()
    return templates

@router.post("/", response_model=schemas.Template)
def create_template(
    name: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not file.filename.endswith('.pptx'):
        raise HTTPException(status_code=400, detail="Only PPTX files are allowed")
    
    if not auth.check_template_upload_permission(current_user):
        raise HTTPException(status_code=403, detail="Only superadmins can upload PowerPoint templates")
    
    try:
        file_key = storage.upload_file(file.file, file.filename, "templates")
        
        existing_template = db.query(models.Template).filter(
            models.Template.name == name,
            models.Template.is_active == True
        ).first()
        
        version = 1
        if existing_template:
            existing_template.is_active = False
            version = existing_template.version + 1
        
        db_template = models.Template(
            name=name,
            filename=file.filename,
            file_path=file_key,
            version=version,
            uploaded_by=current_user.id
        )
        db.add(db_template)
        db.commit()
        db.refresh(db_template)
        return db_template
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload template: {str(e)}")

@router.get("/{template_id}", response_model=schemas.Template)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.is_active = False
    db.commit()
    return {"message": "Template deleted successfully"}