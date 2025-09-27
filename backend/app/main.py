from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, templates, excel_data, jobs, users, vcf, rsid
from .database import engine
from . import models
from .config import settings

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GABO API",
    description="API for Genetics Analysis and Biosystems Optimization",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRF-Token",
        "Cache-Control",
    ],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(excel_data.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(vcf.router, prefix="/api")
app.include_router(rsid.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "GABO - Genetics Analysis and Biosystems Optimization API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/debug/cors")
def debug_cors():
    """Debug endpoint to check CORS configuration"""
    return {
        "cors_origins": settings.cors_origins_list,
        "debug": settings.debug,
        "raw_cors_origins": settings.cors_origins
    }