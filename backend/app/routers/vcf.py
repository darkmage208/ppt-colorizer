from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from datetime import datetime
import asyncio
from ..database import get_db
from ..auth import require_superadmin
from ..models import User, VcfFile, VcfConversion, ConversionStatus
from ..schemas import VcfFile as VcfFileSchema, VcfConversion as VcfConversionSchema, VcfConversionWithDetails
from ..config import settings
from ..vcf_processor import VcfProcessor

router = APIRouter(tags=["vcf"])

# Create VCF upload directory if it doesn't exist
VCF_UPLOAD_DIR = "uploads/vcf_files"
TXT_OUTPUT_DIR = "outputs/txt_files"
os.makedirs(VCF_UPLOAD_DIR, exist_ok=True)
os.makedirs(TXT_OUTPUT_DIR, exist_ok=True)

@router.post("/vcf/upload", response_model=VcfFileSchema)
async def upload_vcf_file(
    file: UploadFile = File(...),
    name: str = None,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Upload a VCF file (SuperAdmin only)"""

    # Validate file extension
    if not file.filename.lower().endswith(('.vcf', '.vcf.gz')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only VCF files (.vcf, .vcf.gz) are allowed"
        )

    # Generate unique filename
    file_extension = ".vcf.gz" if file.filename.lower().endswith('.vcf.gz') else ".vcf"
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(VCF_UPLOAD_DIR, unique_filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        file_size = len(content)

        # Create database record
        db_vcf_file = VcfFile(
            name=name or file.filename,
            filename=unique_filename,
            file_path=file_path,
            file_size=file_size,
            uploaded_by=current_user.id
        )
        db.add(db_vcf_file)
        db.commit()
        db.refresh(db_vcf_file)

        return db_vcf_file

    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )

@router.get("/vcf/files", response_model=List[VcfFileSchema])
def list_vcf_files(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all VCF files (SuperAdmin only)"""
    vcf_files = db.query(VcfFile).filter(VcfFile.is_active == True).offset(skip).limit(limit).all()
    return vcf_files

@router.delete("/vcf/files/{file_id}")
def delete_vcf_file(
    file_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a VCF file and its associated files (SuperAdmin only)"""
    vcf_file = db.query(VcfFile).filter(VcfFile.id == file_id, VcfFile.is_active == True).first()

    if not vcf_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VCF file not found"
        )

    # Delete physical file
    if os.path.exists(vcf_file.file_path):
        os.remove(vcf_file.file_path)

    # Delete associated conversion files
    conversions = db.query(VcfConversion).filter(VcfConversion.vcf_file_id == file_id).all()
    for conversion in conversions:
        if conversion.txt_file_path and os.path.exists(conversion.txt_file_path):
            os.remove(conversion.txt_file_path)

    # Mark as inactive (soft delete)
    vcf_file.is_active = False
    db.commit()

    return {"message": "VCF file deleted successfully"}

@router.post("/vcf/{file_id}/convert", response_model=VcfConversionSchema)
def start_vcf_conversion(
    file_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Start VCF to TXT conversion (SuperAdmin only)"""
    vcf_file = db.query(VcfFile).filter(VcfFile.id == file_id, VcfFile.is_active == True).first()

    if not vcf_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VCF file not found"
        )

    # Check if there's already a running conversion for this file
    existing_conversion = db.query(VcfConversion).filter(
        VcfConversion.vcf_file_id == file_id,
        VcfConversion.status.in_([ConversionStatus.PENDING, ConversionStatus.PROCESSING])
    ).first()

    if existing_conversion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversion already in progress for this file"
        )

    # Create conversion record
    conversion = VcfConversion(
        vcf_file_id=file_id,
        user_id=current_user.id,
        status=ConversionStatus.PENDING
    )
    db.add(conversion)
    db.commit()
    db.refresh(conversion)

    # Start conversion in background
    background_tasks.add_task(process_vcf_conversion, conversion.id)

    return conversion

@router.get("/vcf/conversions", response_model=List[VcfConversionWithDetails])
def list_conversions(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all VCF conversions sorted by creation date (SuperAdmin only)"""
    conversions = db.query(VcfConversion).order_by(VcfConversion.created_at.desc()).offset(skip).limit(limit).all()
    return conversions

@router.get("/vcf/conversions/{conversion_id}", response_model=VcfConversionWithDetails)
def get_conversion_status(
    conversion_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Get conversion status and progress (SuperAdmin only)"""
    conversion = db.query(VcfConversion).filter(VcfConversion.id == conversion_id).first()

    if not conversion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion not found"
        )

    return conversion

@router.get("/vcf/conversions/{conversion_id}/download")
def download_txt_file(
    conversion_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Download the converted TXT file (SuperAdmin only)"""
    conversion = db.query(VcfConversion).filter(VcfConversion.id == conversion_id).first()

    if not conversion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion not found"
        )

    if conversion.status != ConversionStatus.COMPLETED or not conversion.txt_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversion not completed or file not available"
        )

    if not os.path.exists(conversion.txt_file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Converted file not found on disk"
        )

    return FileResponse(
        conversion.txt_file_path,
        filename=conversion.txt_filename,
        media_type='text/plain'
    )

@router.delete("/vcf/conversions/{conversion_id}")
def delete_conversion(
    conversion_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a VCF conversion and its associated TXT file (SuperAdmin only)"""
    conversion = db.query(VcfConversion).filter(VcfConversion.id == conversion_id).first()

    if not conversion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversion not found"
        )

    # Delete the associated TXT file if it exists
    if conversion.txt_file_path and os.path.exists(conversion.txt_file_path):
        try:
            os.remove(conversion.txt_file_path)
        except OSError as e:
            # Log the error but don't fail the deletion
            print(f"Warning: Could not delete TXT file {conversion.txt_file_path}: {str(e)}")

    # Delete the conversion record from database
    db.delete(conversion)
    db.commit()

    return {"message": "Conversion deleted successfully"}

def process_vcf_conversion(conversion_id: int):
    """Background task to process VCF conversion"""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        conversion = db.query(VcfConversion).filter(VcfConversion.id == conversion_id).first()
        if not conversion:
            return

        # Update status to processing
        conversion.status = ConversionStatus.PROCESSING
        db.commit()

        # Get VCF file
        vcf_file = conversion.vcf_file

        # Generate output filename with better naming
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        clean_name = vcf_file.name.replace('.vcf', '').replace('.gz', '')
        txt_filename = f"{clean_name}_converted_{timestamp}.txt"
        txt_file_path = os.path.join(TXT_OUTPUT_DIR, txt_filename)

        # Process VCF file
        processor = VcfProcessor()
        processor.convert_vcf_to_txt(
            vcf_file.file_path,
            txt_file_path,
            conversion_id=conversion_id,
            db_session=db
        )

        # Update conversion record
        conversion.txt_filename = txt_filename
        conversion.txt_file_path = txt_file_path
        conversion.status = ConversionStatus.COMPLETED
        conversion.progress = 100
        db.commit()

    except Exception as e:
        # Update conversion with error
        conversion = db.query(VcfConversion).filter(VcfConversion.id == conversion_id).first()
        if conversion:
            conversion.status = ConversionStatus.ERROR
            conversion.error_message = str(e)
            db.commit()

    finally:
        db.close()