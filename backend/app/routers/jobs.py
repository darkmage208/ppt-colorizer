from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..storage import storage
from ..tasks import process_ppt_job
import io

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/", response_model=List[schemas.JobWithDetails])
def get_jobs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.Job)
    
    if current_user.role != models.UserRole.ADMIN:
        query = query.filter(models.Job.user_id == current_user.id)
    
    jobs = query.offset(skip).limit(limit).all()
    return jobs

@router.post("/", response_model=schemas.Job)
def create_job(
    template_id: int,
    excel_data_id: int,
    txt_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not txt_file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only TXT files are allowed")
    
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    excel_data = db.query(models.ExcelData).filter(models.ExcelData.id == excel_data_id).first()
    if not excel_data:
        raise HTTPException(status_code=404, detail="Excel data not found")
    
    try:
        txt_file_key = storage.upload_file(txt_file.file, txt_file.filename, "txt_files")
        
        db_job = models.Job(
            user_id=current_user.id,
            template_id=template_id,
            excel_data_id=excel_data_id,
            txt_filename=txt_file.filename,
            txt_file_path=txt_file_key
        )
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        
        process_ppt_job.delay(db_job.id)
        
        return db_job
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

@router.get("/{job_id}", response_model=schemas.JobWithDetails)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if current_user.role != models.UserRole.ADMIN and job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this job")
    
    return job

@router.get("/{job_id}/download-pptx")
def download_pptx(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if current_user.role != models.UserRole.ADMIN and job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    
    if job.status != models.JobStatus.DONE or not job.output_pptx_path:
        raise HTTPException(status_code=400, detail="PPTX file not ready")
    
    try:
        file_content = storage.download_file(job.output_pptx_path)
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f"attachment; filename=output_{job_id}.pptx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@router.get("/{job_id}/download-pdf")
def download_pdf(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if current_user.role != models.UserRole.ADMIN and job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    
    if job.status != models.JobStatus.DONE or not job.output_pdf_path:
        raise HTTPException(status_code=400, detail="PDF file not ready")
    
    try:
        file_content = storage.download_file(job.output_pdf_path)
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=output_{job_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.output_pptx_path:
        storage.delete_file(job.output_pptx_path)
    if job.output_pdf_path:
        storage.delete_file(job.output_pdf_path)
    if job.txt_file_path:
        storage.delete_file(job.txt_file_path)
    
    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}