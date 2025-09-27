from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..tasks import process_conversion_task
import io
import logging
import os
import uuid

logger = logging.getLogger(__name__)

# Create upload and output directories if they don't exist
CONVERSION_UPLOAD_DIR = "uploads/conversion_files"
INDIVIDUAL_UPLOAD_DIR = "uploads/individual_files"
CONVERSION_OUTPUT_DIR = "outputs/conversion_results"
os.makedirs(CONVERSION_UPLOAD_DIR, exist_ok=True)
os.makedirs(INDIVIDUAL_UPLOAD_DIR, exist_ok=True)
os.makedirs(CONVERSION_OUTPUT_DIR, exist_ok=True)

def detect_separator(content: str) -> str:
    """Auto-detect separator (tab vs space) in file content"""
    first_line = content.split('\n')[0] if content else ""

    # Count occurrences of tabs and spaces
    tab_count = first_line.count('\t')
    space_count = first_line.count(' ')

    # If tabs exist and create multiple columns, prefer tabs
    if tab_count > 0:
        tab_split = first_line.split('\t')
        if len(tab_split) >= 4:  # Should have at least SNP, Name, Chr, Position
            return '\t'

    # If spaces exist and create multiple columns, use spaces
    if space_count > 0:
        space_split = first_line.split(' ')
        if len(space_split) >= 4:  # Should have at least SNP, Name, Chr, Position
            return ' '

    # Default to tab
    return '\t'

router = APIRouter(prefix="/conversions", tags=["conversions"])

@router.get("/debug/storage-status")
def check_storage_status(
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Debug endpoint to check storage directory status"""
    import stat

    directories = [
        CONVERSION_UPLOAD_DIR,
        INDIVIDUAL_UPLOAD_DIR,
        CONVERSION_OUTPUT_DIR
    ]

    status = {}
    for directory in directories:
        try:
            exists = os.path.exists(directory)
            status[directory] = {
                "exists": exists,
                "writable": os.access(directory, os.W_OK) if exists else False,
                "readable": os.access(directory, os.R_OK) if exists else False,
                "permissions": oct(stat.S_IMODE(os.lstat(directory).st_mode)) if exists else None,
                "absolute_path": os.path.abspath(directory)
            }
        except Exception as e:
            status[directory] = {"error": str(e)}

    return {"storage_status": status, "current_working_directory": os.getcwd()}

@router.post("/conversion-files/", response_model=schemas.ConversionFile)
async def upload_conversion_file(
    name: str = Form(...),
    conversion_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Upload a conversion file (Name -> RsID mapping)"""
    if not conversion_file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only TXT files are allowed")

    try:
        # Read file content for validation
        file_content = await conversion_file.read()

        # Basic validation - check if file has Name and RsID columns
        content_str = file_content.decode('utf-8')
        lines = content_str.strip().split('\n')
        if len(lines) < 2:
            raise HTTPException(status_code=400, detail="File must contain header and data rows")

        header = lines[0].strip().split('\t')
        if len(header) < 2 or 'Name' not in header or 'RsID' not in header:
            raise HTTPException(status_code=400, detail="File must contain 'Name' and 'RsID' columns")

        # Save file to local storage
        uploads_dir = CONVERSION_UPLOAD_DIR

        # Generate unique filename to avoid conflicts
        unique_filename = f"{uuid.uuid4()}_{conversion_file.filename}"
        file_path = os.path.join(uploads_dir, unique_filename)

        try:
            with open(file_path, 'wb') as f:
                f.write(file_content)
            file_key = file_path
        except PermissionError:
            logger.error(f"Permission denied writing to {file_path}")
            raise HTTPException(status_code=500, detail="Storage permission error")
        except OSError as e:
            logger.error(f"OS error writing to {file_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

        # Save to database
        db_conversion_file = models.ConversionFile(
            name=name,
            filename=conversion_file.filename,
            file_path=file_key,
            file_size=len(file_content),
            uploaded_by=current_user.id
        )
        db.add(db_conversion_file)
        db.commit()
        db.refresh(db_conversion_file)

        return db_conversion_file

    except Exception as e:
        logger.error(f"Failed to upload conversion file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload conversion file: {str(e)}")

@router.get("/conversion-files/", response_model=List[schemas.ConversionFileWithDetails])
def get_conversion_files(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Get all conversion files"""
    conversion_files = db.query(models.ConversionFile)\
        .filter(models.ConversionFile.is_active == True)\
        .offset(skip)\
        .limit(limit)\
        .all()
    return conversion_files

@router.delete("/conversion-files/{file_id}")
def delete_conversion_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Delete a conversion file"""
    conversion_file = db.query(models.ConversionFile)\
        .filter(models.ConversionFile.id == file_id)\
        .first()

    if not conversion_file:
        raise HTTPException(status_code=404, detail="Conversion file not found")

    try:
        # Delete file from storage
        if conversion_file.file_path:
            try:
                if os.path.exists(conversion_file.file_path):
                    os.remove(conversion_file.file_path)
            except Exception as e:
                logger.warning(f"Could not delete file {conversion_file.file_path}: {e}")

        # Mark as inactive instead of hard delete to preserve referential integrity
        conversion_file.is_active = False
        db.commit()

        return {"message": "Conversion file deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete conversion file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete conversion file: {str(e)}")

# Independent Individual Files Endpoints
@router.get("/individual-files/", response_model=List[schemas.IndividualFile])
def get_all_individual_files(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Get all individual files (independent of conversion files)"""
    individual_files = db.query(models.IndividualFile)\
        .filter(models.IndividualFile.is_uploaded == True)\
        .order_by(models.IndividualFile.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return individual_files

@router.post("/individual-files/", response_model=schemas.IndividualFile)
async def upload_independent_individual_file(
    name: str = Form(...),
    individual_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Upload individual files (no conversion_file_id required)"""
    if not individual_file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only TXT files are allowed")

    db_individual_file = None
    try:
        # Create individual file record first (without conversion_file_id)
        db_individual_file = models.IndividualFile(
            conversion_file_id=None,  # Independent file
            name=name,
            filename=individual_file.filename,
            file_path="",  # Will be updated after upload
            file_size=0,   # Will be updated after upload
            upload_progress=0,
            is_uploaded=False,
            uploaded_by=current_user.id
        )
        db.add(db_individual_file)
        db.commit()
        db.refresh(db_individual_file)

        # Stream upload with progress tracking
        file_data = io.BytesIO()
        chunk_size = 1024 * 1024  # 1MB chunks
        total_size = 0

        while True:
            chunk = await individual_file.read(chunk_size)
            if not chunk:
                break
            file_data.write(chunk)
            total_size += len(chunk)

            # Update progress
            progress = min(100, int((total_size / (total_size + 1)) * 100))
            db_individual_file.upload_progress = progress
            db.commit()

        file_data.seek(0)

        # Basic validation - check for required columns
        content_str = file_data.read().decode('utf-8')
        file_data.seek(0)

        lines = content_str.strip().split('\n')
        if len(lines) < 2:
            raise HTTPException(status_code=400, detail="File must contain header and data rows")

        # Auto-detect separator
        header_line = lines[0].strip()
        separator = detect_separator(content_str)
        header = header_line.split(separator)

        logger.info(f"Independent file header analysis: {header}")

        # Check for required columns
        required_cols = ['Chr', 'Position']
        snp_name_found = False

        if 'SNP Name' in header:
            snp_name_found = True
        elif 'SNP' in header and 'Name' in header:
            snp_name_found = True

        if not snp_name_found:
            raise HTTPException(status_code=400, detail="File must contain either 'SNP Name' column or separate 'SNP' and 'Name' columns")

        for col in required_cols:
            if col not in header:
                raise HTTPException(status_code=400, detail=f"File must contain '{col}' column")

        # Save file to local storage
        uploads_dir = INDIVIDUAL_UPLOAD_DIR

        # Generate unique filename to avoid conflicts
        unique_filename = f"{uuid.uuid4()}_{individual_file.filename}"
        file_path = os.path.join(uploads_dir, unique_filename)

        try:
            with open(file_path, 'wb') as f:
                f.write(file_data.getvalue())
            file_key = file_path
        except PermissionError:
            logger.error(f"Permission denied writing to {file_path}")
            raise HTTPException(status_code=500, detail="Storage permission error")
        except OSError as e:
            logger.error(f"OS error writing to {file_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

        # Update database record
        db_individual_file.file_path = file_key
        db_individual_file.file_size = total_size
        db_individual_file.upload_progress = 100
        db_individual_file.is_uploaded = True
        db.commit()

        return db_individual_file

    except HTTPException as he:
        logger.error(f"HTTPException during independent upload: {he.detail}")
        if db_individual_file and hasattr(db_individual_file, 'id') and db_individual_file.id:
            try:
                db.delete(db_individual_file)
                db.commit()
            except Exception as cleanup_error:
                logger.error(f"Error during cleanup: {str(cleanup_error)}")
        raise he
    except Exception as e:
        logger.error(f"Failed to upload independent individual file: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        if db_individual_file and hasattr(db_individual_file, 'id') and db_individual_file.id:
            try:
                db.delete(db_individual_file)
                db.commit()
            except Exception as cleanup_error:
                logger.error(f"Error during cleanup: {str(cleanup_error)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload individual file: {str(e)}")

@router.delete("/individual-files/{file_id}")
def delete_individual_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Delete an individual file"""
    individual_file = db.query(models.IndividualFile)\
        .filter(models.IndividualFile.id == file_id)\
        .first()

    if not individual_file:
        raise HTTPException(status_code=404, detail="Individual file not found")

    try:
        # Delete file from storage
        if individual_file.file_path:
            try:
                if os.path.exists(individual_file.file_path):
                    os.remove(individual_file.file_path)
            except Exception as e:
                logger.warning(f"Could not delete file {individual_file.file_path}: {e}")

        # Delete from database
        db.delete(individual_file)
        db.commit()

        return {"message": "Individual file deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete individual file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete individual file: {str(e)}")

# Legacy endpoint for backward compatibility
@router.post("/individual-files-legacy/", response_model=schemas.IndividualFile)
async def upload_individual_file(
    conversion_file_id: int = Form(...),
    name: str = Form(...),
    individual_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Upload an individual data file with progress tracking"""
    if not individual_file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only TXT files are allowed")

    # Check if conversion file exists
    conversion_file = db.query(models.ConversionFile)\
        .filter(models.ConversionFile.id == conversion_file_id)\
        .first()
    if not conversion_file:
        raise HTTPException(status_code=404, detail="Conversion file not found")

    db_individual_file = None
    try:
        # Create individual file record first
        db_individual_file = models.IndividualFile(
            conversion_file_id=conversion_file_id,
            name=name,
            filename=individual_file.filename,
            file_path="",  # Will be updated after upload
            file_size=0,   # Will be updated after upload
            upload_progress=0,
            is_uploaded=False,
            uploaded_by=current_user.id
        )
        db.add(db_individual_file)
        db.commit()
        db.refresh(db_individual_file)

        # Stream upload with progress tracking
        file_data = io.BytesIO()
        chunk_size = 1024 * 1024  # 1MB chunks
        total_size = 0

        while True:
            chunk = await individual_file.read(chunk_size)
            if not chunk:
                break
            file_data.write(chunk)
            total_size += len(chunk)

            # Update progress (simplified - in real implementation you'd need WebSocket or polling)
            progress = min(100, int((total_size / (total_size + 1)) * 100))
            db_individual_file.upload_progress = progress
            db.commit()

        file_data.seek(0)

        # Basic validation - check for required columns
        content_str = file_data.read().decode('utf-8')
        file_data.seek(0)

        lines = content_str.strip().split('\n')
        if len(lines) < 2:
            raise HTTPException(status_code=400, detail="File must contain header and data rows")

        # Auto-detect separator (tabs vs spaces)
        header_line = lines[0].strip()
        tab_count = header_line.count('\t')
        space_count = header_line.count(' ')
        tab_split_len = len(header_line.split('\t'))
        space_split_len = len(header_line.split(' '))

        separator = detect_separator(content_str)
        header = header_line.split(separator)

        logger.info(f"Header analysis: tabs={tab_count} (splits to {tab_split_len}), spaces={space_count} (splits to {space_split_len})")
        logger.info(f"Detected separator: '{separator}' (ord={ord(separator)})")
        logger.info(f"Detected headers: {header}")
        logger.info(f"Raw header line: '{header_line}'")

        # Check for required columns, allowing "SNP Name" as a substitute for separate "SNP" and "Name"
        required_cols = ['Chr', 'Position']
        snp_name_found = False

        # Check if we have either separate SNP+Name or combined "SNP Name"
        if 'SNP Name' in header:
            snp_name_found = True
            logger.info(f"Found 'SNP Name' column, will split during processing")
        elif 'SNP' in header and 'Name' in header:
            snp_name_found = True
            logger.info(f"Found separate 'SNP' and 'Name' columns")

        if not snp_name_found:
            logger.error(f"Missing SNP identification columns in headers: {header}")
            raise HTTPException(status_code=400, detail="File must contain either 'SNP Name' column or separate 'SNP' and 'Name' columns")

        # Check other required columns
        for col in required_cols:
            if col not in header:
                logger.error(f"Missing column '{col}' in headers: {header}")
                raise HTTPException(status_code=400, detail=f"File must contain '{col}' column")

        # Save file to local storage
        uploads_dir = INDIVIDUAL_UPLOAD_DIR

        # Generate unique filename to avoid conflicts
        unique_filename = f"{uuid.uuid4()}_{individual_file.filename}"
        file_path = os.path.join(uploads_dir, unique_filename)

        try:
            with open(file_path, 'wb') as f:
                f.write(file_data.getvalue())
            file_key = file_path
        except PermissionError:
            logger.error(f"Permission denied writing to {file_path}")
            raise HTTPException(status_code=500, detail="Storage permission error")
        except OSError as e:
            logger.error(f"OS error writing to {file_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

        # Update database record
        db_individual_file.file_path = file_key
        db_individual_file.file_size = total_size
        db_individual_file.upload_progress = 100
        db_individual_file.is_uploaded = True
        db.commit()

        return db_individual_file

    except HTTPException as he:
        logger.error(f"HTTPException during upload: {he.detail}")
        # Clean up failed record
        if db_individual_file and hasattr(db_individual_file, 'id') and db_individual_file.id:
            try:
                db.delete(db_individual_file)
                db.commit()
            except Exception as cleanup_error:
                logger.error(f"Error during cleanup: {str(cleanup_error)}")
        raise he
    except Exception as e:
        logger.error(f"Failed to upload individual file: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        # Clean up failed record
        if db_individual_file and hasattr(db_individual_file, 'id') and db_individual_file.id:
            try:
                db.delete(db_individual_file)
                db.commit()
            except Exception as cleanup_error:
                logger.error(f"Error during cleanup: {str(cleanup_error)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload individual file: {str(e)}")

@router.get("/individual-files/{conversion_file_id}", response_model=List[schemas.IndividualFile])
def get_individual_files(
    conversion_file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Get all individual files for a conversion file"""
    individual_files = db.query(models.IndividualFile)\
        .filter(models.IndividualFile.conversion_file_id == conversion_file_id)\
        .all()
    return individual_files

@router.post("/start-conversion/")
async def start_conversion(
    request: schemas.StartConversionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Start conversion with selected files"""
    # Check if conversion file exists
    conversion_file = db.query(models.ConversionFile)\
        .filter(models.ConversionFile.id == request.conversion_file_id)\
        .first()
    if not conversion_file:
        raise HTTPException(status_code=404, detail="Conversion file not found")

    # Validate individual files exist and are uploaded
    individual_files = db.query(models.IndividualFile)\
        .filter(
            models.IndividualFile.id.in_(request.individual_file_ids),
            models.IndividualFile.is_uploaded == True
        )\
        .all()

    if len(individual_files) != len(request.individual_file_ids):
        raise HTTPException(status_code=400, detail="One or more individual files not found or not uploaded")

    if not individual_files:
        raise HTTPException(status_code=400, detail="No individual files selected")

    try:
        groups_created = []

        # Get existing group count for numbering
        existing_groups_count = db.query(models.ConversionGroup).count()

        # Start processing for each selected individual file
        for idx, individual_file in enumerate(individual_files):
            # Create conversion group with numbered name
            group_number = existing_groups_count + idx + 1
            conversion_group = models.ConversionGroup(
                individual_file_id=individual_file.id,
                name=f"Conversion Group #{group_number}",
                status=models.ConversionStatus.PENDING
            )
            db.add(conversion_group)
            db.commit()
            db.refresh(conversion_group)

            groups_created.append({
                "id": conversion_group.id,
                "name": conversion_group.name,
                "status": conversion_group.status.value
            })

            # Queue processing task with conversion file ID
            process_conversion_task.delay(conversion_group.id, request.conversion_file_id)

        return {
            "message": "Conversion started successfully",
            "groups_created": groups_created
        }

    except Exception as e:
        logger.error(f"Failed to start conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start conversion: {str(e)}")

# Legacy endpoint for backward compatibility
@router.post("/start-conversion/{conversion_file_id}")
async def start_conversion_legacy(
    conversion_file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Start the conversion process for all uploaded individual files (legacy)"""
    # Check if conversion file exists
    conversion_file = db.query(models.ConversionFile)\
        .filter(models.ConversionFile.id == conversion_file_id)\
        .first()
    if not conversion_file:
        raise HTTPException(status_code=404, detail="Conversion file not found")

    # Get all uploaded individual files
    individual_files = db.query(models.IndividualFile)\
        .filter(
            models.IndividualFile.conversion_file_id == conversion_file_id,
            models.IndividualFile.is_uploaded == True
        )\
        .all()

    if not individual_files:
        raise HTTPException(status_code=400, detail="No individual files uploaded yet")

    try:
        # Start processing for each individual file
        for individual_file in individual_files:
            # Create conversion group
            conversion_group = models.ConversionGroup(
                individual_file_id=individual_file.id,
                name=f"Conversion_{individual_file.name}",
                status=models.ConversionStatus.PENDING
            )
            db.add(conversion_group)
            db.commit()
            db.refresh(conversion_group)

            # Queue processing task with conversion file ID
            process_conversion_task.delay(conversion_group.id, conversion_file_id)

        return {"message": f"Started conversion for {len(individual_files)} individual files"}

    except Exception as e:
        logger.error(f"Failed to start conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start conversion: {str(e)}")

@router.get("/groups/", response_model=List[schemas.ConversionGroupWithDetails])
def get_conversion_groups(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Get all conversion groups with results"""
    from sqlalchemy.orm import joinedload
    groups = db.query(models.ConversionGroup)\
        .options(joinedload(models.ConversionGroup.individual_file))\
        .options(joinedload(models.ConversionGroup.results))\
        .order_by(models.ConversionGroup.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return groups

@router.get("/groups/{group_id}/download/{result_id}")
def download_result_file(
    group_id: int,
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Download a specific result file"""
    result = db.query(models.ConversionResult)\
        .filter(
            models.ConversionResult.id == result_id,
            models.ConversionResult.group_id == group_id
        )\
        .first()

    if not result:
        raise HTTPException(status_code=404, detail="Result file not found")

    try:
        if not os.path.exists(result.file_path):
            raise HTTPException(status_code=404, detail="File not found")

        def iterfile():
            with open(result.file_path, 'rb') as f:
                yield from f

        return StreamingResponse(
            iterfile(),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={result.filename}"}
        )
    except Exception as e:
        logger.error(f"Failed to download result file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@router.delete("/groups/{group_id}")
def delete_conversion_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Delete a conversion group and all its results"""
    group = db.query(models.ConversionGroup)\
        .filter(models.ConversionGroup.id == group_id)\
        .first()

    if not group:
        raise HTTPException(status_code=404, detail="Conversion group not found")

    try:
        # Delete result files from storage
        for result in group.results:
            try:
                if os.path.exists(result.file_path):
                    os.remove(result.file_path)
            except Exception as e:
                logger.warning(f"Could not delete file {result.file_path}: {e}")

        # Delete from database (cascade will handle results)
        db.delete(group)
        db.commit()

        return {"message": "Conversion group deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete conversion group: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete conversion group: {str(e)}")

@router.delete("/results/{result_id}")
def delete_result_file(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    """Delete a specific result file"""
    result = db.query(models.ConversionResult)\
        .filter(models.ConversionResult.id == result_id)\
        .first()

    if not result:
        raise HTTPException(status_code=404, detail="Result file not found")

    try:
        # Delete file from storage
        try:
            if os.path.exists(result.file_path):
                os.remove(result.file_path)
        except Exception as e:
            logger.warning(f"Could not delete file {result.file_path}: {e}")

        # Delete from database
        db.delete(result)
        db.commit()

        return {"message": "Result file deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete result file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete result file: {str(e)}")