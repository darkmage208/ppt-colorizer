from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import zipfile
import io
from datetime import datetime

from ..database import get_db
from ..auth import require_superadmin
from ..models import (
    User, RsidConversionFile, RsidIndividualFile, RsidProject,
    RsidOutputGroup, RsidOutputFile, RsidProjectStatus
)
from ..schemas import (
    RsidConversionFile as RsidConversionFileSchema,
    RsidIndividualFile as RsidIndividualFileSchema,
    RsidProject as RsidProjectSchema,
    RsidProjectCreate,
    RsidProjectWithDetails,
    RsidOutputGroup as RsidOutputGroupSchema,
    RsidOutputFile as RsidOutputFileSchema
)
from ..config import settings
from ..rsid_processor import RsidProcessor

router = APIRouter(tags=["rsid"])

# Create directories for uploads and outputs
RSID_CONVERSION_DIR = "uploads/rsid_conversion"
RSID_INDIVIDUAL_DIR = "uploads/rsid_individual"
RSID_OUTPUT_DIR = "outputs/rsid_results"

for directory in [RSID_CONVERSION_DIR, RSID_INDIVIDUAL_DIR, RSID_OUTPUT_DIR]:
    os.makedirs(directory, exist_ok=True)

@router.post("/rsid/conversion-file/upload", response_model=RsidConversionFileSchema)
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
    file_path = os.path.join(RSID_CONVERSION_DIR, unique_filename)

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
        db_conversion_file = RsidConversionFile(
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

@router.get("/rsid/conversion-files", response_model=List[RsidConversionFileSchema])
def list_conversion_files(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all conversion files (SuperAdmin only)"""
    files = db.query(RsidConversionFile).filter(
        RsidConversionFile.is_active == True
    ).offset(skip).limit(limit).all()
    return files

@router.post("/rsid/projects", response_model=RsidProjectSchema)
def create_project(
    project_data: RsidProjectCreate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Create a new RsID conversion project (SuperAdmin only)"""

    # Verify conversion file exists
    conversion_file = db.query(RsidConversionFile).filter(
        RsidConversionFile.id == project_data.conversion_file_id,
        RsidConversionFile.is_active == True
    ).first()

    if not conversion_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion file not found"
        )

    # Create project
    project = RsidProject(
        name=project_data.name,
        conversion_file_id=project_data.conversion_file_id,
        created_by=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return project

@router.post("/rsid/projects/{project_id}/individual-files/upload", response_model=RsidIndividualFileSchema)
async def upload_individual_file(
    project_id: int,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Upload an individual file to a project (SuperAdmin only)"""

    # Verify project exists
    project = db.query(RsidProject).filter(RsidProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Validate file extension
    if not file.filename.lower().endswith('.txt'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only TXT files are allowed for individual files"
        )

    # Generate unique filename
    unique_filename = f"{project_id}_{uuid.uuid4()}.txt"
    file_path = os.path.join(RSID_INDIVIDUAL_DIR, unique_filename)

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
        db_individual_file = RsidIndividualFile(
            name=name or file.filename,
            filename=unique_filename,
            file_path=file_path,
            file_size=file_size,
            project_id=project_id,
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

@router.post("/rsid/projects/{project_id}/process")
def start_project_processing(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Start processing a project (SuperAdmin only)"""

    # Verify project exists
    project = db.query(RsidProject).filter(RsidProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Check if project is already processing
    if project.status in [RsidProjectStatus.PROCESSING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project is already being processed"
        )

    # Check if project has individual files
    individual_files = db.query(RsidIndividualFile).filter(
        RsidIndividualFile.project_id == project_id,
        RsidIndividualFile.is_active == True
    ).all()

    if not individual_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no individual files to process"
        )

    # Start processing in background
    background_tasks.add_task(process_rsid_project, project_id)

    return {"message": "Project processing started", "project_id": project_id}

@router.get("/rsid/projects", response_model=List[RsidProjectWithDetails])
def list_projects(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all projects with details (SuperAdmin only)"""
    projects = db.query(RsidProject).order_by(
        RsidProject.created_at.desc()
    ).offset(skip).limit(limit).all()
    return projects

@router.get("/rsid/projects/{project_id}", response_model=RsidProjectWithDetails)
def get_project(
    project_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get project details with progress (SuperAdmin only)"""
    project = db.query(RsidProject).filter(RsidProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    return project

@router.get("/rsid/projects/{project_id}/download-group/{group_id}")
def download_group_as_zip(
    project_id: int,
    group_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Download all files in a group as ZIP (SuperAdmin only)"""

    # Verify group exists and belongs to project
    group = db.query(RsidOutputGroup).filter(
        RsidOutputGroup.id == group_id,
        RsidOutputGroup.project_id == project_id,
        RsidOutputGroup.is_active == True
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output group not found"
        )

    # Get all output files in the group
    output_files = db.query(RsidOutputFile).filter(
        RsidOutputFile.group_id == group_id,
        RsidOutputFile.is_active == True
    ).all()

    if not output_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No output files found in group"
        )

    # Create ZIP file in memory
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for output_file in output_files:
            if os.path.exists(output_file.file_path):
                zip_file.write(output_file.file_path, output_file.filename)

    zip_buffer.seek(0)

    # Return ZIP file as streaming response
    return StreamingResponse(
        io.BytesIO(zip_buffer.read()),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={group.name}_results.zip"}
    )

@router.get("/rsid/output-files/{file_id}/download")
def download_output_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Download a single output file (SuperAdmin only)"""

    output_file = db.query(RsidOutputFile).filter(
        RsidOutputFile.id == file_id,
        RsidOutputFile.is_active == True
    ).first()

    if not output_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output file not found"
        )

    if not os.path.exists(output_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )

    return FileResponse(
        output_file.file_path,
        filename=output_file.filename,
        media_type='text/plain'
    )

@router.delete("/rsid/projects/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a project and all associated files (SuperAdmin only)"""

    project = db.query(RsidProject).filter(RsidProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    try:
        # Delete individual files from disk
        individual_files = db.query(RsidIndividualFile).filter(
            RsidIndividualFile.project_id == project_id
        ).all()

        for individual_file in individual_files:
            if os.path.exists(individual_file.file_path):
                os.remove(individual_file.file_path)

        # Delete output files from disk
        output_groups = db.query(RsidOutputGroup).filter(
            RsidOutputGroup.project_id == project_id
        ).all()

        for group in output_groups:
            output_files = db.query(RsidOutputFile).filter(
                RsidOutputFile.group_id == group.id
            ).all()

            for output_file in output_files:
                if os.path.exists(output_file.file_path):
                    os.remove(output_file.file_path)

        # Delete from database (cascade will handle related records)
        db.delete(project)
        db.commit()

        return {"message": "Project deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )

@router.delete("/rsid/output-groups/{group_id}")
def delete_output_group(
    group_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete an output group and all its files (SuperAdmin only)"""

    group = db.query(RsidOutputGroup).filter(
        RsidOutputGroup.id == group_id,
        RsidOutputGroup.is_active == True
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output group not found"
        )

    try:
        # Delete output files from disk
        output_files = db.query(RsidOutputFile).filter(
            RsidOutputFile.group_id == group_id
        ).all()

        for output_file in output_files:
            if os.path.exists(output_file.file_path):
                os.remove(output_file.file_path)

        # Mark group as inactive (soft delete)
        group.is_active = False

        # Mark all files in group as inactive
        for output_file in output_files:
            output_file.is_active = False

        db.commit()

        return {"message": "Output group deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete output group: {str(e)}"
        )

@router.delete("/rsid/output-files/{file_id}")
def delete_output_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a single output file (SuperAdmin only)"""

    output_file = db.query(RsidOutputFile).filter(
        RsidOutputFile.id == file_id,
        RsidOutputFile.is_active == True
    ).first()

    if not output_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output file not found"
        )

    try:
        # Delete file from disk
        if os.path.exists(output_file.file_path):
            os.remove(output_file.file_path)

        # Mark as inactive (soft delete)
        output_file.is_active = False
        db.commit()

        return {"message": "Output file deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete output file: {str(e)}"
        )

def process_rsid_project(project_id: int):
    """Background task to process RsID conversion project"""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        project = db.query(RsidProject).filter(RsidProject.id == project_id).first()
        if not project:
            return

        # Update status to processing
        project.status = RsidProjectStatus.PROCESSING
        db.commit()

        # Get conversion file
        conversion_file = project.conversion_file
        if not conversion_file or not os.path.exists(conversion_file.file_path):
            raise Exception("Conversion file not found")

        # Get individual files
        individual_files = db.query(RsidIndividualFile).filter(
            RsidIndividualFile.project_id == project_id,
            RsidIndividualFile.is_active == True
        ).all()

        if not individual_files:
            raise Exception("No individual files found")

        # Prepare individual files data
        individual_files_data = [
            {
                'file_path': ind_file.file_path,
                'name': ind_file.name
            }
            for ind_file in individual_files
            if os.path.exists(ind_file.file_path)
        ]

        # Create output directory for this project
        project_output_dir = os.path.join(RSID_OUTPUT_DIR, f"project_{project_id}")

        # Process project
        processor = RsidProcessor()
        success, output_groups_data = processor.process_project(
            project_id,
            conversion_file.file_path,
            individual_files_data,
            project_output_dir,
            db
        )

        if success:
            # Create output groups and files in database
            for group_data in output_groups_data:
                # Create output group
                output_group = RsidOutputGroup(
                    name=group_data['individual_name'],
                    project_id=project_id
                )
                db.add(output_group)
                db.commit()
                db.refresh(output_group)

                # Create output files
                for file_info in group_data['output_files']:
                    output_file = RsidOutputFile(
                        name=file_info['name'],
                        filename=file_info['filename'],
                        file_path=file_info['file_path'],
                        file_size=file_info.get('file_size', 0),
                        group_id=output_group.id
                    )
                    db.add(output_file)

                db.commit()

            # Update project status
            project.status = RsidProjectStatus.COMPLETED
            project.progress = 100
            db.commit()

        else:
            raise Exception("Processing failed")

    except Exception as e:
        # Update project with error
        project = db.query(RsidProject).filter(RsidProject.id == project_id).first()
        if project:
            project.status = RsidProjectStatus.ERROR
            project.error_message = str(e)
            db.commit()

    finally:
        db.close()