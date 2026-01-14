from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func as sql_func
from pydantic import BaseModel
from .. import schemas, models, auth
from ..database import get_db
from ..storage import storage
from ..tasks import process_ppt_job
import io
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


# Paginated response schema
class PaginatedJobsResponse(BaseModel):
    items: List[schemas.JobWithDetails]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True


@router.get("/", response_model=PaginatedJobsResponse)
def get_jobs(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    order: str = Query("desc", description="Sort order (asc/desc)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Base query with eager loading to avoid N+1 queries
    query = db.query(models.Job).options(
        selectinload(models.Job.user),
        selectinload(models.Job.template),
        selectinload(models.Job.excel_data),
        selectinload(models.Job.permissions)
    )

    # Filter by user role and permissions
    if current_user.role == models.UserRole.USER:
        # Users can only see jobs they own or have explicit permission to access
        permitted_job_ids = db.query(models.JobPermission.job_id).filter(
            models.JobPermission.user_id == current_user.id
        ).subquery()
        query = query.filter(
            (models.Job.user_id == current_user.id) |
            (models.Job.id.in_(permitted_job_ids))
        )
    # Admins and Superadmins can see all jobs (no additional filtering)

    # Apply status filter if provided
    if status and status != 'all':
        try:
            status_enum = models.JobStatus(status)
            query = query.filter(models.Job.status == status_enum)
        except ValueError:
            pass  # Invalid status, ignore filter

    # Get total count for pagination (without eager loading for efficiency)
    count_query = db.query(sql_func.count(models.Job.id))
    if current_user.role == models.UserRole.USER:
        permitted_job_ids = db.query(models.JobPermission.job_id).filter(
            models.JobPermission.user_id == current_user.id
        ).subquery()
        count_query = count_query.filter(
            (models.Job.user_id == current_user.id) |
            (models.Job.id.in_(permitted_job_ids))
        )
    if status and status != 'all':
        try:
            status_enum = models.JobStatus(status)
            count_query = count_query.filter(models.Job.status == status_enum)
        except ValueError:
            pass
    total = count_query.scalar()

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

    # Apply pagination
    skip = (page - 1) * page_size
    jobs = query.offset(skip).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedJobsResponse(
        items=jobs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("/", response_model=schemas.Job)
async def create_job(
    template_id: int = Form(...),
    excel_data_id: int = Form(...),
    user_emails: str = Form("[]"),
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
        # Parse user emails
        with open("/tmp/debug_job_creation.log", "a") as f:
            f.write(f"Raw user_emails received: {user_emails}\n")

        try:
            emails_list = json.loads(user_emails)
            logger.info(f"Parsed user emails: {emails_list}")
            print(f"DEBUG: Parsed user emails: {emails_list}")  # Extra debugging
            with open("/tmp/debug_job_creation.log", "a") as f:
                f.write(f"Parsed emails_list: {emails_list}\n")
        except json.JSONDecodeError:
            emails_list = []
            logger.warning(f"Failed to parse user_emails: {user_emails}")
            print(f"DEBUG: Failed to parse user_emails: {user_emails}")  # Extra debugging
            with open("/tmp/debug_job_creation.log", "a") as f:
                f.write(f"Failed to parse user_emails: {user_emails}\n")

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

        # Create job permissions for specified users
        logger.info(f"Creating job permissions for {len(emails_list)} emails")
        for email in emails_list:
            user = auth.get_user_by_email(db, email)
            if user:
                logger.info(f"Creating permission for user {user.username} ({email})")
                job_permission = models.JobPermission(
                    job_id=db_job.id,
                    user_id=user.id
                )
                db.add(job_permission)
            else:
                logger.warning(f"User with email {email} not found")

        db.commit()

        process_ppt_job.delay(db_job.id)

        return db_job

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

def check_job_access(job: models.Job, user: models.User, db: Session) -> bool:
    """Check if user has access to the job"""
    # Job owner always has access
    if job.user_id == user.id:
        return True

    # Admins and superadmins have access to all jobs
    if user.role in [models.UserRole.ADMIN, models.UserRole.SUPERADMIN]:
        return True

    # Check if user has explicit permission
    permission = db.query(models.JobPermission).filter(
        models.JobPermission.job_id == job.id,
        models.JobPermission.user_id == user.id
    ).first()

    return permission is not None

@router.get("/{job_id}", response_model=schemas.JobWithDetails)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not check_job_access(job, current_user, db):
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

    if not check_job_access(job, current_user, db):
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

    if not check_job_access(job, current_user, db):
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


@router.post("/test-user-emails")
async def test_user_emails(
    user_emails: str = Form("[]"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Test endpoint to debug user email parsing"""
    try:
        emails_list = json.loads(user_emails)
        logger.info(f"Raw user_emails: {user_emails}")
        logger.info(f"Parsed emails_list: {emails_list}")

        results = []
        for email in emails_list:
            user = auth.get_user_by_email(db, email)
            if user:
                results.append(f"Found user: {user.username} ({email})")
            else:
                results.append(f"User not found: {email}")

        return {
            "raw_input": user_emails,
            "parsed_emails": emails_list,
            "results": results
        }
    except Exception as e:
        return {"error": str(e)}

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