from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, templates, excel_data, jobs, users
from .database import engine
from . import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GABO API",
    description="API for Genetics Analysis and Biosystems Optimization",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(excel_data.router)
app.include_router(jobs.router)
app.include_router(users.router)

@app.get("/")
def root():
    return {"message": "GABO - Genetics Analysis and Biosystems Optimization API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}