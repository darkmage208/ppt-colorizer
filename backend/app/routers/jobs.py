from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..storage import storage
from ..tasks import process_ppt_job
import io
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/", response_model=List[schemas.JobWithDetails])
def get_jobs(
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "created_at",
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.Job)
    
    # Users can see all completed jobs but only their own incomplete jobs
    # Admins and Superadmins can see all jobs
    if current_user.role == models.UserRole.USER:
        query = query.filter(
            (models.Job.user_id == current_user.id) | 
            (models.Job.status == models.JobStatus.DONE)
        )
    
    # Apply sorting
    if sort_by == "id":
        sort_column = models.Job.id
    elif sort_by == "status":
        sort_column = models.Job.status
    elif sort_by == "updated_at":
        sort_column = models.Job.updated_at
    else:  # Default to created_at
        sort_column = models.Job.created_at
    
    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    
    jobs = query.offset(skip).limit(limit).all()
    return jobs

@router.post("/", response_model=schemas.Job)
async def create_job(
    template_id: int,
    excel_data_id: int,
    txt_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not txt_file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only TXT files are allowed")

    if not auth.check_txt_upload_permission(current_user):
        raise HTTPException(status_code=403, detail="Only admins and superadmins can upload TXT files")

    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    excel_data = db.query(models.ExcelData).filter(models.ExcelData.id == excel_data_id).first()
    if not excel_data:
        raise HTTPException(status_code=404, detail="Excel data not found")

    try:
        # Stream large TXT files efficiently using chunked reading
        file_data = io.BytesIO()
        chunk_size = 1024 * 1024  # 1MB chunks

        while True:
            chunk = await txt_file.read(chunk_size)
            if not chunk:
                break
            file_data.write(chunk)

        file_data.seek(0)  # Reset position to beginning

        txt_file_key = storage.upload_file(file_data, txt_file.filename, "txt_files")

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
    
    # Users can view their own jobs or any completed job
    # Admins and Superadmins can view all jobs
    if (current_user.role == models.UserRole.USER and 
        job.user_id != current_user.id and 
        job.status != models.JobStatus.DONE):
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
    
    if not auth.check_download_permission(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to download files")
    
    # Users can download their own jobs or any completed job
    # Admins and Superadmins can download all jobs  
    if (current_user.role == models.UserRole.USER and 
        job.user_id != current_user.id and 
        job.status != models.JobStatus.DONE):
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    
    if job.status != models.JobStatus.DONE or not job.output_pptx_path:
        raise HTTPException(status_code=400, detail="PPTX file not ready")
    
    logger.info(f"Attempting to download PPTX for job {job_id}: {job.output_pptx_path}")
    logger.info(f"Job details - Template: {job.template.name if job.template else 'None'}, Excel: {job.excel_data.name if job.excel_data else 'None'}, TXT: {job.txt_filename}")
    
    try:
        file_content = storage.download_file(job.output_pptx_path)
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f"attachment; filename=output_{job_id}.pptx"}
        )
    except Exception as e:
        logger.error(f"Failed to download PPTX for job {job_id}: {str(e)}")
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
    
    if not auth.check_download_permission(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to download files")
    
    # Users can download their own jobs or any completed job
    # Admins and Superadmins can download all jobs
    if (current_user.role == models.UserRole.USER and 
        job.user_id != current_user.id and 
        job.status != models.JobStatus.DONE):
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

@router.get("/debug/job-details/{job_id}")
def debug_job_details(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    """Debug endpoint to show job details including file paths"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        'job_id': job.id,
        'status': job.status.value,
        'txt_filename': job.txt_filename,
        'txt_file_path': job.txt_file_path,
        'output_pptx_path': job.output_pptx_path,
        'output_pdf_path': job.output_pdf_path,
        'template': {
            'id': job.template.id if job.template else None,
            'name': job.template.name if job.template else None,
            'filename': job.template.filename if job.template else None,
            'file_path': job.template.file_path if job.template else None,
        },
        'excel_data': {
            'id': job.excel_data.id if job.excel_data else None,
            'name': job.excel_data.name if job.excel_data else None,
            'filename': job.excel_data.filename if job.excel_data else None,
            'file_path': job.excel_data.file_path if job.excel_data else None,
        },
        'user_id': job.user_id,
        'created_at': job.created_at.isoformat() if job.created_at else None,
        'updated_at': job.updated_at.isoformat() if job.updated_at else None
    }

@router.get("/debug/r2-files")
def debug_r2_files(
    current_user: models.User = Depends(auth.require_admin)
):
    """Debug endpoint to list files in R2 storage"""
    try:
        response = storage.client.list_objects_v2(Bucket=storage.bucket_name, MaxKeys=50)
        if 'Contents' in response:
            files = [
                {
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'storage_class': obj.get('StorageClass', 'STANDARD')
                }
                for obj in response['Contents']
            ]
            return {
                'total_files': len(files),
                'files': files,
                'bucket': storage.bucket_name
            }
        else:
            return {
                'total_files': 0,
                'files': [],
                'bucket': storage.bucket_name
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list R2 files: {str(e)}")

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Allow users to delete their own jobs, admins and superadmins can delete any job
    if current_user.role == models.UserRole.USER and job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")
    
    if job.output_pptx_path:
        storage.delete_file(job.output_pptx_path)
    if job.output_pdf_path:
        storage.delete_file(job.output_pdf_path)
    if job.txt_file_path:
        storage.delete_file(job.txt_file_path)
    
    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}