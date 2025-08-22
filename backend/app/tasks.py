from celery import Celery
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .config import settings
from .models import Job, JobStatus
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
            processor.load_excel_data(job.excel_data.file_path)
            update_progress(20)
            
            processor.load_txt_data(job.txt_file_path)
            update_progress(40)
            
            processor.load_presentation(job.template.file_path)
            update_progress(60)
            
            results = processor.process_presentation(progress_callback=lambda p: update_progress(60 + int(p * 0.2)))
            update_progress(80)
            
            pptx_key = processor.save_presentation()
            job.output_pptx_path = pptx_key
            update_progress(90)
            
            pdf_key = processor.convert_to_pdf(pptx_key)
            job.output_pdf_path = pdf_key
            update_progress(100)
            
            job.status = JobStatus.DONE
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
    
    except Exception as e:
        return {"error": f"Task execution failed: {str(e)}", "traceback": traceback.format_exc()}
    
    finally:
        db.close()