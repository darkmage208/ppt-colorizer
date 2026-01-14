from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
import os
import uuid
import zipfile
import io
from datetime import datetime

from ..database import get_db
from ..auth import require_superadmin
from ..models import (
    User, ConversionFile, IndividualFile, ConversionJob, ConversionJobFile,
    ResultGroup, ResultFile, ConversionJobStatus
)
from ..schemas import (
    ConversionFile as ConversionFileSchema,
    IndividualFile as IndividualFileSchema,
    ConversionJob as ConversionJobSchema,
    ConversionJobCreate,
    ConversionJobWithDetails,
    ResultGroup as ResultGroupSchema,
    ResultFile as ResultFileSchema
)
from ..config import settings
from ..rsid_processor import RsidProcessor

router = APIRouter(tags=["rsid"])

# Create directories for uploads and outputs
CONVERSION_FILES_DIR = "uploads/conversion_files"
INDIVIDUAL_FILES_DIR = "uploads/individual_files"
RESULTS_DIR = "outputs/rsid_results"

for directory in [CONVERSION_FILES_DIR, INDIVIDUAL_FILES_DIR, RESULTS_DIR]:
    os.makedirs(directory, exist_ok=True)

# === CONVERSION FILES ENDPOINTS (Independent) ===

@router.post("/conversion-files/upload", response_model=ConversionFileSchema)
async def upload_conversion_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Upload a conversion file (Name -> RsID mapping) - SuperAdmin only"""

    # Validate file extension
    if not file.filename.lower().endswith('.txt'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only TXT files are allowed for conversion files"
        )

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}.txt"
    file_path = os.path.join(CONVERSION_FILES_DIR, unique_filename)

    try:
        # Stream file to disk with progress tracking
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                buffer.write(chunk)
                file_size += len(chunk)

        # Validate file format
        processor = RsidProcessor()
        validation_result = processor.validate_conversion_file(file_path)

        if not validation_result['valid']:
            # Clean up invalid file
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid conversion file: {validation_result['error']}"
            )

        # Create database record
        db_conversion_file = ConversionFile(
            name=name,
            filename=unique_filename,
            file_path=file_path,
            file_size=file_size,
            uploaded_by=current_user.id
        )
        db.add(db_conversion_file)
        db.commit()
        db.refresh(db_conversion_file)

        return db_conversion_file

    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload conversion file: {str(e)}"
        )

@router.get("/conversion-files", response_model=List[ConversionFileSchema])
def list_conversion_files(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all conversion files (SuperAdmin only)"""
    files = db.query(ConversionFile).filter(
        ConversionFile.is_active == True
    ).offset(skip).limit(limit).all()
    return files

@router.delete("/conversion-files/{file_id}")
def delete_conversion_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a conversion file (SuperAdmin only)"""

    conversion_file = db.query(ConversionFile).filter(
        ConversionFile.id == file_id,
        ConversionFile.is_active == True
    ).first()

    if not conversion_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion file not found"
        )

    try:
        # Delete file from disk
        if os.path.exists(conversion_file.file_path):
            os.remove(conversion_file.file_path)

        # Mark as inactive (soft delete)
        conversion_file.is_active = False
        db.commit()

        return {"message": "Conversion file deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversion file: {str(e)}"
        )

# === INDIVIDUAL FILES ENDPOINTS (Independent) ===

@router.post("/individual-files/upload", response_model=IndividualFileSchema)
async def upload_individual_file(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Upload an individual file - SuperAdmin only"""

    # Validate file extension
    if not file.filename.lower().endswith('.txt'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only TXT files are allowed for individual files"
        )

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}.txt"
    file_path = os.path.join(INDIVIDUAL_FILES_DIR, unique_filename)

    try:
        # Stream file to disk with progress tracking
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                buffer.write(chunk)
                file_size += len(chunk)

        # Validate file format
        processor = RsidProcessor()
        validation_result = processor.validate_individual_file(file_path)

        if not validation_result['valid']:
            # Clean up invalid file
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid individual file: {validation_result['error']}"
            )

        # Create database record
        db_individual_file = IndividualFile(
            name=name or file.filename,
            filename=unique_filename,
            file_path=file_path,
            file_size=file_size,
            uploaded_by=current_user.id
        )
        db.add(db_individual_file)
        db.commit()
        db.refresh(db_individual_file)

        return db_individual_file

    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload individual file: {str(e)}"
        )

@router.get("/individual-files", response_model=List[IndividualFileSchema])
def list_individual_files(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all individual files (SuperAdmin only)"""
    files = db.query(IndividualFile).filter(
        IndividualFile.is_active == True
    ).offset(skip).limit(limit).all()
    return files

@router.delete("/individual-files/{file_id}")
def delete_individual_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete an individual file (SuperAdmin only)"""

    individual_file = db.query(IndividualFile).filter(
        IndividualFile.id == file_id,
        IndividualFile.is_active == True
    ).first()

    if not individual_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Individual file not found"
        )

    try:
        # Delete file from disk
        if os.path.exists(individual_file.file_path):
            os.remove(individual_file.file_path)

        # Mark as inactive (soft delete)
        individual_file.is_active = False
        db.commit()

        return {"message": "Individual file deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete individual file: {str(e)}"
        )

# === CONVERSION JOBS ENDPOINTS ===

@router.post("/conversion-jobs", response_model=ConversionJobSchema)
def create_conversion_job(
    job_data: ConversionJobCreate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Create a new conversion job (SuperAdmin only)"""

    # Verify conversion file exists
    conversion_file = db.query(ConversionFile).filter(
        ConversionFile.id == job_data.conversion_file_id,
        ConversionFile.is_active == True
    ).first()

    if not conversion_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion file not found"
        )

    # Verify individual files exist
    individual_files = db.query(IndividualFile).filter(
        IndividualFile.id.in_(job_data.individual_file_ids),
        IndividualFile.is_active == True
    ).all()

    if len(individual_files) != len(job_data.individual_file_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more individual files not found"
        )

    # Create conversion job
    job = ConversionJob(
        name=job_data.name,
        conversion_file_id=job_data.conversion_file_id,
        total_files=len(job_data.individual_file_ids),
        created_by=current_user.id
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Link individual files to job
    for individual_file_id in job_data.individual_file_ids:
        job_file = ConversionJobFile(
            job_id=job.id,
            individual_file_id=individual_file_id
        )
        db.add(job_file)

    db.commit()

    return job

@router.post("/conversion-jobs/{job_id}/process")
def start_job_processing(
    job_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Start processing a conversion job (SuperAdmin only)"""

    # Verify job exists
    job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion job not found"
        )

    # Check if job is already processing
    if job.status in [ConversionJobStatus.PROCESSING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job is already being processed"
        )

    # Start processing in background
    background_tasks.add_task(process_conversion_job, job_id)

    return {"message": "Job processing started", "job_id": job_id}

@router.get("/conversion-jobs", response_model=List[ConversionJobWithDetails])
def list_conversion_jobs(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all conversion jobs with details (SuperAdmin only)"""
    # Use eager loading to avoid N+1 queries
    jobs = db.query(ConversionJob).options(
        selectinload(ConversionJob.conversion_file),
        selectinload(ConversionJob.creator),
        selectinload(ConversionJob.result_groups).selectinload(ResultGroup.result_files)
    ).order_by(
        ConversionJob.created_at.desc()
    ).offset(skip).limit(limit).all()
    return jobs

@router.get("/conversion-jobs/{job_id}", response_model=ConversionJobWithDetails)
def get_conversion_job(
    job_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get conversion job details with progress (SuperAdmin only)"""
    # Use eager loading to avoid N+1 queries
    job = db.query(ConversionJob).options(
        selectinload(ConversionJob.conversion_file),
        selectinload(ConversionJob.creator),
        selectinload(ConversionJob.result_groups).selectinload(ResultGroup.result_files)
    ).filter(ConversionJob.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion job not found"
        )

    return job

@router.delete("/conversion-jobs/{job_id}")
def delete_conversion_job(
    job_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a conversion job and all associated results (SuperAdmin only)"""

    job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion job not found"
        )

    try:
        # Delete result files from disk
        result_groups = db.query(ResultGroup).filter(
            ResultGroup.job_id == job_id
        ).all()

        for group in result_groups:
            result_files = db.query(ResultFile).filter(
                ResultFile.group_id == group.id
            ).all()

            for result_file in result_files:
                if os.path.exists(result_file.file_path):
                    os.remove(result_file.file_path)

        # Delete from database (cascade will handle related records)
        db.delete(job)
        db.commit()

        return {"message": "Conversion job deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversion job: {str(e)}"
        )

# === RESULT GROUPS ENDPOINTS ===

@router.get("/result-groups", response_model=List[ResultGroupSchema])
def list_all_result_groups(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all result groups across all jobs (SuperAdmin only)"""
    # Use eager loading to avoid N+1 queries
    groups = db.query(ResultGroup).options(
        selectinload(ResultGroup.result_files)
    ).filter(
        ResultGroup.is_active == True
    ).order_by(ResultGroup.created_at.desc()).offset(skip).limit(limit).all()
    return groups

@router.get("/result-groups/{group_id}", response_model=ResultGroupSchema)
def get_result_group(
    group_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get a specific result group with its files (SuperAdmin only)"""
    # Use eager loading to avoid N+1 queries
    group = db.query(ResultGroup).options(
        selectinload(ResultGroup.result_files)
    ).filter(
        ResultGroup.id == group_id,
        ResultGroup.is_active == True
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result group not found"
        )

    return group

@router.get("/conversion-jobs/{job_id}/result-groups", response_model=List[ResultGroupSchema])
def list_result_groups(
    job_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List result groups for a job (SuperAdmin only)"""
    # Use eager loading to avoid N+1 queries
    groups = db.query(ResultGroup).options(
        selectinload(ResultGroup.result_files)
    ).filter(
        ResultGroup.job_id == job_id,
        ResultGroup.is_active == True
    ).all()
    return groups

@router.get("/result-groups/{group_id}/download")
def download_group_as_zip(
    group_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Download all files in a result group as ZIP (SuperAdmin only)"""

    # Verify group exists
    group = db.query(ResultGroup).filter(
        ResultGroup.id == group_id,
        ResultGroup.is_active == True
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result group not found"
        )

    # Get all result files in the group
    result_files = db.query(ResultFile).filter(
        ResultFile.group_id == group_id,
        ResultFile.is_active == True
    ).all()

    if not result_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No result files found in group"
        )

    # Create ZIP file in memory
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for result_file in result_files:
            if os.path.exists(result_file.file_path):
                zip_file.write(result_file.file_path, result_file.filename)

    zip_buffer.seek(0)

    # Return ZIP file as streaming response
    return StreamingResponse(
        io.BytesIO(zip_buffer.read()),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={group.name}_results.zip"}
    )

@router.delete("/result-groups/{group_id}")
def delete_result_group(
    group_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a result group and all its files (SuperAdmin only)"""

    group = db.query(ResultGroup).filter(
        ResultGroup.id == group_id,
        ResultGroup.is_active == True
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result group not found"
        )

    try:
        # Delete result files from disk
        result_files = db.query(ResultFile).filter(
            ResultFile.group_id == group_id
        ).all()

        for result_file in result_files:
            if os.path.exists(result_file.file_path):
                os.remove(result_file.file_path)

        # Mark group as inactive (soft delete)
        group.is_active = False

        # Mark all files in group as inactive
        for result_file in result_files:
            result_file.is_active = False

        db.commit()

        return {"message": "Result group deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete result group: {str(e)}"
        )

# === RESULT FILES ENDPOINTS ===

@router.get("/result-files/{file_id}/download")
def download_result_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Download a single result file (SuperAdmin only)"""

    result_file = db.query(ResultFile).filter(
        ResultFile.id == file_id,
        ResultFile.is_active == True
    ).first()

    if not result_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result file not found"
        )

    if not os.path.exists(result_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )

    return FileResponse(
        result_file.file_path,
        filename=result_file.filename,
        media_type='text/plain'
    )

@router.delete("/result-files/{file_id}")
def delete_result_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a single result file (SuperAdmin only)"""

    result_file = db.query(ResultFile).filter(
        ResultFile.id == file_id,
        ResultFile.is_active == True
    ).first()

    if not result_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result file not found"
        )

    try:
        # Delete file from disk
        if os.path.exists(result_file.file_path):
            os.remove(result_file.file_path)

        # Mark as inactive (soft delete)
        result_file.is_active = False
        db.commit()

        return {"message": "Result file deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete result file: {str(e)}"
        )

@router.get("/result-files/{file_id}/content")
def get_result_file_content(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get the text content of a result file for preview (SuperAdmin only)"""

    result_file = db.query(ResultFile).filter(
        ResultFile.id == file_id,
        ResultFile.is_active == True
    ).first()

    if not result_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result file not found"
        )

    if not os.path.exists(result_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result file not found on disk"
        )

    try:
        with open(result_file.file_path, 'r', encoding='utf-8') as file:
            content = file.read()

        return {
            "file_id": result_file.id,
            "filename": result_file.filename,
            "content": content,
            "file_size": result_file.file_size,
            "group_id": result_file.group_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read result file: {str(e)}"
        )

def process_conversion_job(job_id: int):
    """Background task to process conversion job"""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
        if not job:
            return

        # Update status to processing
        job.status = ConversionJobStatus.PROCESSING
        db.commit()

        # Get conversion file
        conversion_file = job.conversion_file
        if not conversion_file or not os.path.exists(conversion_file.file_path):
            raise Exception("Conversion file not found")

        # Get individual files
        job_files = db.query(ConversionJobFile).filter(
            ConversionJobFile.job_id == job_id
        ).all()

        individual_files = [
            jf.individual_file for jf in job_files
            if jf.individual_file.is_active and os.path.exists(jf.individual_file.file_path)
        ]

        if not individual_files:
            raise Exception("No individual files found")

        # Prepare individual files data
        individual_files_data = [
            {
                'id': ind_file.id,
                'file_path': ind_file.file_path,
                'name': ind_file.name
            }
            for ind_file in individual_files
        ]

        # Use results directory directly (no job subdirectory)
        output_base_dir = RESULTS_DIR

        # Process job
        processor = RsidProcessor()
        success, result_groups_data = processor.process_job(
            job_id,
            conversion_file.file_path,
            individual_files_data,
            output_base_dir,
            db
        )

        if success:
            processed_count = 0
            # Create result groups and files in database
            for group_data in result_groups_data:
                # Create result group with individual_file_name + date + time
                current_datetime = datetime.now().strftime("%Y%m%d%H%M%S")
                group_name = f"{group_data['individual_name']}_{current_datetime}"

                result_group = ResultGroup(
                    name=group_name,
                    job_id=job_id,
                    individual_file_id=group_data['individual_file_id']
                )
                db.add(result_group)
                db.commit()
                db.refresh(result_group)

                # Create result files
                for file_info in group_data['result_files']:
                    result_file = ResultFile(
                        name=file_info['name'],
                        filename=file_info['filename'],
                        file_path=file_info['file_path'],
                        file_size=file_info.get('file_size', 0),
                        group_id=result_group.id
                    )
                    db.add(result_file)

                processed_count += 1
                # Update processed files count only (progress is handled by processor)
                job.processed_files = processed_count

                db.commit()

            # Update job status
            job.status = ConversionJobStatus.COMPLETED
            job.progress = 100
            db.commit()

        else:
            raise Exception("Processing failed")

    except Exception as e:
        # Update job with error
        job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
        if job:
            job.status = ConversionJobStatus.ERROR
            job.error_message = str(e)
            db.commit()

    finally:
        db.close()