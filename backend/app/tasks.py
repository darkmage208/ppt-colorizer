from celery import Celery
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .config import settings
from .models import Job, JobStatus, User
from .ppt_processor import PPTProcessor
import traceback

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
    worker_concurrency=4,  # Optimized for 4GB RAM
    task_routes={
        'app.tasks.process_ppt_job': {'queue': 'ppt_processing'},
    },
    task_default_queue='ppt_processing',
    worker_prefetch_multiplier=2,  # Allow pre-fetching for better throughput
    task_acks_late=True,
    worker_disable_rate_limits=True,
    broker_connection_retry_on_startup=True,
    # Memory management
    worker_max_tasks_per_child=50,  # Restart workers after 50 tasks to prevent memory leaks
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
            update_progress(10)
            
            processor.load_txt_data(job.txt_file_path, job.txt_filename)
            update_progress(20)
            
            processor.load_presentation(job.template.file_path)
            update_progress(30)
            
            results = processor.process_presentation_optimized(progress_callback=lambda p: update_progress(30 + int(p * 0.5)))
            update_progress(80)
            
            pptx_key = processor.save_presentation()
            job.output_pptx_path = pptx_key
            update_progress(100)
            
            # pdf_key = processor.convert_to_pdf(pptx_key)
            # job.output_pdf_path = pdf_key
            # update_progress(100)
            
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
                "pdf_path": "pdf_key"
            }
            
        except Exception as e:
            job.status = JobStatus.ERROR
            job.error_message = str(e)
            db.commit()
            return {"error": str(e), "traceback": traceback.format_exc()}
    
    except Exception as e:
        return {"error": f"Task execution failed: {str(e)}", "traceback": traceback.format_exc()}
    
    finally:
        db.close()