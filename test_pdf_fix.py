#!/usr/bin/env python3

import requests
import time
import tempfile
import sys

# Configuration
API_BASE = "http://localhost:8000"
USERNAME = "admin"
PASSWORD = "admin123"

def login():
    """Login and get access token"""
    response = requests.post(f"{API_BASE}/auth/token", data={
        "username": USERNAME,
        "password": PASSWORD
    })
    
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.text}")
        sys.exit(1)

def create_test_job(token):
    """Create a test job"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a test TXT file
    txt_content = "RSID,RESULT\nrs12345,AA\nrs67890,AG\n"
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(txt_content)
        txt_path = f.name
    
    # Submit job
    with open(txt_path, 'rb') as txt_file:
        files = {"txt_file": txt_file}
        
        response = requests.post(f"{API_BASE}/jobs/?template_id=5&excel_data_id=1", 
                               headers=headers, 
                               files=files)
    
    if response.status_code == 200:
        job = response.json()
        print(f"Job created: {job['id']}")
        return job['id']
    else:
        print(f"Failed to create job: {response.text}")
        return None

def monitor_job(token, job_id):
    """Monitor job progress"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Monitoring job progress...")
    while True:
        response = requests.get(f"{API_BASE}/jobs/{job_id}", headers=headers)
        
        if response.status_code == 200:
            job = response.json()
            status = job["status"]
            progress = job.get("progress", 0)
            
            print(f"Status: {status}, Progress: {progress}%")
            
            if status == "done":
                print("Job completed successfully!")
                print(f"PPTX path: {job.get('output_pptx_path')}")
                print(f"PDF path: {job.get('output_pdf_path')}")
                return True
            elif status == "error":
                print(f"Job failed: {job.get('error_message')}")
                return False
        else:
            print(f"Error checking job: {response.text}")
            return False
        
        time.sleep(5)

def test_pdf_download(token, job_id):
    """Test PDF download"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"Testing PDF download for job {job_id}...")
    response = requests.get(f"{API_BASE}/jobs/{job_id}/download-pdf", headers=headers)
    
    if response.status_code == 200:
        pdf_data = response.content
        print(f"PDF downloaded successfully: {len(pdf_data)} bytes")
        
        # Check PDF header
        if pdf_data.startswith(b'%PDF-'):
            print("PDF header is valid")
            return True
        else:
            print(f"Invalid PDF header: {pdf_data[:20]}")
            return False
    else:
        print(f"PDF download failed: {response.status_code} - {response.text}")
        return False

if __name__ == "__main__":
    print("Testing PDF export fix...")
    
    # Login
    token = login()
    print("Logged in successfully")
    
    # Create test job
    job_id = create_test_job(token)
    if not job_id:
        sys.exit(1)
    
    # Monitor job
    if monitor_job(token, job_id):
        # Test PDF download
        if test_pdf_download(token, job_id):
            print("✅ PDF export is working correctly!")
        else:
            print("❌ PDF download failed")
    else:
        print("❌ Job failed")