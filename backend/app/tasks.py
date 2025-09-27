from celery import Celery
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .config import settings
from .models import Job, JobStatus, User, ConversionGroup, ConversionStatus, ConversionResult, IndividualFile, ConversionFile
from .ppt_processor import PPTProcessor
from .storage import storage
import traceback
import io
import pandas as pd
import os

def detect_separator(content: str) -> str:
    """Auto-detect separator (tab vs space) in file content"""
    lines = content.split('\n')
    first_line = lines[0] if lines else ""

    # Try both separators and see which gives more consistent column counts
    tab_split = first_line.split('\t')
    space_split = first_line.split()  # This handles multiple spaces as single separator

    # Count expected columns across multiple lines to be more accurate
    tab_columns = len(tab_split)
    space_columns = len(space_split)

    # Check a few lines to see which separator is more consistent
    if len(lines) > 1:
        for line in lines[1:3]:  # Check up to 2 more lines
            if line.strip():
                tab_test = len(line.split('\t'))
                space_test = len(line.split())

                # If tab count is consistent and > 4, prefer tabs
                if tab_test == tab_columns and tab_columns >= 4:
                    return '\t'
                # If space count is consistent and > 4, prefer spaces
                elif space_test == space_columns and space_columns >= 4:
                    return r'\s+'  # Use regex for multiple spaces

    # Fallback: prefer tabs if they create more columns
    if tab_columns >= 4 and tab_columns > space_columns:
        return '\t'
    elif space_columns >= 4:
        return r'\s+'  # Use regex for multiple spaces

    # Default to tab
    return '\t'

celery_app = Celery(
    "ppt_colorizer",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    worker_concurrency=1,  # Single worker for large file processing (200MB+ files)
    task_routes={
        'app.tasks.process_ppt_job': {'queue': 'ppt_processing'},
        'app.tasks.process_conversion_task': {'queue': 'conversion_processing'},
    },
    task_default_queue='ppt_processing',
    worker_prefetch_multiplier=2,  # Allow pre-fetching for better throughput
    task_acks_late=True,
    worker_disable_rate_limits=True,
    broker_connection_retry_on_startup=True,
    # Memory management
    worker_max_tasks_per_child=5,  # Restart workers very frequently for large file processing
    task_soft_time_limit=1800,  # 30 minutes soft limit
    task_time_limit=2400,  # 40 minutes hard limit
    # Performance optimizations
    worker_pool_restarts=True,
    task_reject_on_worker_lost=True,
)

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@celery_app.task
def process_ppt_job(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": "Job not found"}
        
        job.status = JobStatus.PROCESSING
        job.progress = 0
        db.commit()
        
        processor = PPTProcessor()
        
        def update_progress(progress: int):
            job.progress = progress
            db.commit()
        
        try:
            # Set the Excel template name as patient name
            processor.set_template_name(job.excel_data.name)
            processor.load_excel_data(job.excel_data.file_path)
            update_progress(20)
            
            processor.load_txt_data(job.txt_file_path, job.txt_filename)
            update_progress(40)
            
            processor.load_presentation(job.template.file_path)
            update_progress(60)
            
            results = processor.process_presentation_optimized(progress_callback=lambda p: update_progress(60 + int(p * 0.2)))
            update_progress(80)
            
            pptx_key = processor.save_presentation()
            job.output_pptx_path = pptx_key
            update_progress(100)

            # Try to convert to PDF, set pdf_created flag only if successful
            try:
                pdf_key = processor.convert_to_pdf(pptx_key)
                job.output_pdf_path = pdf_key
                job.pdf_created = True
            except Exception as pdf_error:
                # Log the PDF conversion error but don't fail the entire job
                job.pdf_created = False
                job.output_pdf_path = None
                print(f"PDF conversion failed: {str(pdf_error)}")

            job.status = JobStatus.DONE

            # Increment user's processing count
            user = db.query(User).filter(User.id == job.user_id).first()
            if user:
                user.processing_count = (user.processing_count or 0) + 1

            db.commit()

            return {
                "success": True,
                "results": results,
                "pptx_path": pptx_key,
                "pdf_path": pdf_key
            }
            
        except Exception as e:
            job.status = JobStatus.ERROR
            job.error_message = str(e)
            db.commit()
            return {"error": str(e), "traceback": traceback.format_exc()}

        finally:
            # Explicit memory cleanup
            if 'processor' in locals():
                del processor
            import gc
            gc.collect()

    except Exception as e:
        return {"error": f"Task execution failed: {str(e)}", "traceback": traceback.format_exc()}

    finally:
        db.close()


@celery_app.task
def process_conversion_task(group_id: int, conversion_file_id: int = None):
    """Process genetic data conversion for a conversion group"""
    db = SessionLocal()
    try:
        # Get the conversion group
        group = db.query(ConversionGroup).filter(ConversionGroup.id == group_id).first()
        if not group:
            return {"error": "Conversion group not found"}

        # Update status to processing
        group.status = ConversionStatus.PROCESSING
        group.progress = 0
        db.commit()

        # Get the individual file
        individual_file = db.query(IndividualFile).filter(IndividualFile.id == group.individual_file_id).first()
        if not individual_file:
            group.status = ConversionStatus.ERROR
            group.error_message = "Individual file not found"
            db.commit()
            return {"error": "Individual file not found"}

        # Get the conversion file
        conversion_file = None

        # First, try to use the explicitly passed conversion_file_id (for independent files)
        if conversion_file_id:
            conversion_file = db.query(ConversionFile).filter(ConversionFile.id == conversion_file_id).first()

        # If not provided, try to get it from the individual file relationship (legacy)
        elif individual_file.conversion_file_id:
            conversion_file = db.query(ConversionFile).filter(ConversionFile.id == individual_file.conversion_file_id).first()

        if not conversion_file:
            group.status = ConversionStatus.ERROR
            group.error_message = "Conversion file not found"
            db.commit()
            return {"error": "Conversion file not found"}

        try:
            # Read conversion file (Name -> RsID mapping)
            if not os.path.exists(conversion_file.file_path):
                raise FileNotFoundError(f"Conversion file not found: {conversion_file.file_path}")

            with open(conversion_file.file_path, 'rb') as f:
                conversion_data = f.read()
            conversion_content = conversion_data.decode('utf-8')
            conversion_sep = detect_separator(conversion_content)

            # Handle regex separator for pandas
            if conversion_sep == r'\s+':
                conversion_df = pd.read_csv(io.BytesIO(conversion_data), sep=conversion_sep, engine='python')
            else:
                conversion_df = pd.read_csv(io.BytesIO(conversion_data), sep=conversion_sep)

            # Validate conversion file structure
            if 'Name' not in conversion_df.columns or 'RsID' not in conversion_df.columns:
                raise ValueError("Conversion file must contain 'Name' and 'RsID' columns")

            # Create a lookup dictionary for fast SNP -> RsID conversion
            conversion_lookup = dict(zip(conversion_df['Name'], conversion_df['RsID']))

            # Get logger for this function
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Created conversion lookup with {len(conversion_lookup)} entries")

            # Read individual file
            if not os.path.exists(individual_file.file_path):
                raise FileNotFoundError(f"Individual file not found: {individual_file.file_path}")

            with open(individual_file.file_path, 'rb') as f:
                individual_data = f.read()
            individual_content = individual_data.decode('utf-8')
            individual_sep = detect_separator(individual_content)

            # Handle regex separator for pandas
            if individual_sep == r'\s+':
                individual_df = pd.read_csv(io.BytesIO(individual_data), sep=individual_sep, engine='python')
            else:
                individual_df = pd.read_csv(io.BytesIO(individual_data), sep=individual_sep)

            # Debug: Log detected columns
            logger.info(f"Original columns detected: {list(individual_df.columns)}")

            # Handle different column formats
            if 'SNP Name' in individual_df.columns:
                # Use "SNP Name" column as "Name" for lookup
                individual_df['Name'] = individual_df['SNP Name']
                logger.info(f"Using 'SNP Name' column for conversion lookup")
                logger.info(f"Sample SNP Name value: {individual_df['Name'].iloc[0] if len(individual_df) > 0 else 'N/A'}")

            # Validate individual file structure - handle both formats
            required_cols = ['Chr', 'Position']
            if 'SNP Name' in individual_df.columns:
                required_cols.append('SNP Name')
            else:
                required_cols.extend(['SNP', 'Name'])

            for col in required_cols:
                if col not in individual_df.columns:
                    raise ValueError(f"Individual file must contain '{col}' column")

            # Find OUTPUT columns (everything except metadata columns)
            metadata_cols = ['SNP Name', 'SNP', 'Name', 'Chr', 'Position']
            output_columns = [col for col in individual_df.columns if col not in metadata_cols]
            group.total_outputs = len(output_columns)
            db.commit()

            # Process each OUTPUT column
            for idx, output_col in enumerate(output_columns):
                # Update progress before processing each column
                progress_percent = int((idx / len(output_columns)) * 100)
                group.progress = progress_percent
                group.processed_outputs = idx
                db.commit()

                logger.info(f"Processing output column {idx+1}/{len(output_columns)}: {output_col} ({progress_percent}%)")

                # Process the conversion for this output column using vectorized operations
                # Filter out rows with '--' values first
                filtered_df = individual_df[individual_df[output_col] != '--'].copy()

                # Use the lookup dictionary for fast conversion (lookup by Name column)
                filtered_df['RsID_lookup'] = filtered_df['Name'].map(conversion_lookup)

                # Filter out rows where RsID wasn't found or is '.'
                valid_df = filtered_df[
                    (filtered_df['RsID_lookup'].notna()) &
                    (filtered_df['RsID_lookup'] != '.')
                ].copy()

                # Create result data efficiently
                result_data = []
                if not valid_df.empty:
                    result_data = [{
                        'RSID': row['RsID_lookup'],
                        'CHROMOSOME': row['Chr'],  # Use chromosome number from Chr column
                        'POSITION': row['Position'],
                        'RESULT': row[output_col]
                    } for _, row in valid_df.iterrows()]

                # Create result file if we have data
                if result_data:
                    result_df = pd.DataFrame(result_data)

                    # Convert to tab-separated format
                    output_buffer = io.StringIO()
                    result_df.to_csv(output_buffer, sep='\t', index=False)
                    output_content = output_buffer.getvalue()

                    # Save the result file to local storage
                    outputs_dir = "outputs/conversion_results"
                    os.makedirs(outputs_dir, exist_ok=True)

                    filename = f"{individual_file.name}_{output_col}_converted.txt"
                    # Generate unique filename to avoid conflicts
                    import uuid
                    unique_filename = f"{uuid.uuid4()}_{filename}"
                    file_path = os.path.join(outputs_dir, unique_filename)

                    try:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(output_content)
                        file_key = file_path
                    except PermissionError:
                        logger.error(f"Permission denied writing to {file_path}")
                        raise Exception("Storage permission error")
                    except OSError as e:
                        logger.error(f"OS error writing to {file_path}: {e}")
                        raise Exception(f"Storage error: {str(e)}")

                    # Save result to database
                    conversion_result = ConversionResult(
                        group_id=group.id,
                        output_name=output_col,
                        filename=filename,
                        file_path=file_key,
                        file_size=len(output_content.encode('utf-8')),
                        total_records=len(result_data)
                    )
                    db.add(conversion_result)

            # Mark as completed
            group.status = ConversionStatus.COMPLETED
            group.progress = 100
            group.processed_outputs = len(output_columns)
            db.commit()

            return {
                "success": True,
                "group_id": group.id,
                "total_outputs": len(output_columns),
                "processed_outputs": len(output_columns)
            }

        except Exception as e:
            group.status = ConversionStatus.ERROR
            group.error_message = str(e)
            db.commit()
            return {"error": str(e), "traceback": traceback.format_exc()}

    except Exception as e:
        return {"error": f"Task execution failed: {str(e)}", "traceback": traceback.format_exc()}

    finally:
        db.close()