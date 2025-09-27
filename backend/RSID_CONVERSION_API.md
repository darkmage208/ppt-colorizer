# RsID Conversion API Documentation

This document describes the Super Admin RsID conversion feature that processes conversion files and individual files to generate output results based on RsID mapping.

## Overview

The RsID conversion system follows this workflow:

1. **Upload conversion file** (single .txt file) containing Name -> RsID mappings
2. **Create a project** and link it to the conversion file
3. **Upload individual files** (multiple .txt files) containing SNP data with output columns
4. **Start processing** to convert individual file data using the conversion mappings
5. **Download results** organized by groups (one group per individual file)

## File Formats

### Conversion File Format (.txt)
```
Name	RsID
401070	rs894369
1KG_1_100177980	.
1KG_1_108681808	.
kgp11789038	rs73161871
kgp11790190	rs6551985,rs116372322
```

### Individual File Format (.txt)
```
SNP	Name	Chr	Position	DXB231374	DXB231396	DXB231387
1:103380393	1	103380393	GG	GG	GG
1:106737318	1	106737318	TT	TT	TT
GSA-rs118081514	6	72337310	TT	TT	TT
```

### Output File Format (.txt)
```
RSID	CHROMOSOME	POSITION	RESULT
rs47	7	11581121	TC
rs70	7	11607706	TT
rs87	7	25699861	GG
```

## API Endpoints

All endpoints require SuperAdmin authentication.

### 1. Upload Conversion File
```http
POST /api/rsid/conversion-file/upload
Content-Type: multipart/form-data

file: [conversion_file.txt]
name: "My Conversion File"
```

**Response:**
```json
{
  "id": 1,
  "name": "My Conversion File",
  "filename": "uuid.txt",
  "file_path": "/path/to/file",
  "file_size": 1024,
  "is_active": true,
  "uploaded_by": 1,
  "created_at": "2024-09-27T10:00:00Z"
}
```

### 2. List Conversion Files
```http
GET /api/rsid/conversion-files?skip=0&limit=100
```

### 3. Create Project
```http
POST /api/rsid/projects
Content-Type: application/json

{
  "name": "My RsID Project",
  "conversion_file_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "name": "My RsID Project",
  "conversion_file_id": 1,
  "status": "PENDING",
  "progress": 0,
  "created_by": 1,
  "created_at": "2024-09-27T10:05:00Z"
}
```

### 4. Upload Individual Files
```http
POST /api/rsid/projects/{project_id}/individual-files/upload
Content-Type: multipart/form-data

file: [individual_file.txt]
name: "Individual 1"
```

**Response:**
```json
{
  "id": 1,
  "name": "Individual 1",
  "filename": "1_uuid.txt",
  "file_path": "/path/to/file",
  "file_size": 2048,
  "project_id": 1,
  "is_active": true,
  "uploaded_by": 1,
  "created_at": "2024-09-27T10:10:00Z"
}
```

### 5. Start Project Processing
```http
POST /api/rsid/projects/{project_id}/process
```

**Response:**
```json
{
  "message": "Project processing started",
  "project_id": 1
}
```

### 6. Get Project Details with Progress
```http
GET /api/rsid/projects/{project_id}
```

**Response:**
```json
{
  "id": 1,
  "name": "My RsID Project",
  "conversion_file_id": 1,
  "status": "COMPLETED",
  "progress": 100,
  "created_by": 1,
  "created_at": "2024-09-27T10:05:00Z",
  "updated_at": "2024-09-27T10:15:00Z",
  "conversion_file": {
    "id": 1,
    "name": "My Conversion File",
    "filename": "uuid.txt"
  },
  "individual_files": [
    {
      "id": 1,
      "name": "Individual 1",
      "filename": "1_uuid.txt"
    }
  ],
  "output_groups": [
    {
      "id": 1,
      "name": "Individual 1",
      "project_id": 1,
      "output_files": [
        {
          "id": 1,
          "name": "DXB231374",
          "filename": "Individual1_DXB231374_20240927_101500.txt"
        }
      ]
    }
  ]
}
```

### 7. List All Projects
```http
GET /api/rsid/projects?skip=0&limit=100
```

### 8. Download Group as ZIP
```http
GET /api/rsid/projects/{project_id}/download-group/{group_id}
```

Downloads all output files in a group as a ZIP file.

### 9. Download Single Output File
```http
GET /api/rsid/output-files/{file_id}/download
```

### 10. Delete Project
```http
DELETE /api/rsid/projects/{project_id}
```

### 11. Delete Output Group
```http
DELETE /api/rsid/output-groups/{group_id}
```

### 12. Delete Single Output File
```http
DELETE /api/rsid/output-files/{file_id}
```

## Processing Logic

### Conversion Process

For each individual file:

1. **Parse Header**: Extract output column names (skip SNP, Name, Chr, Position)
2. **Create Output Files**: One file per output column
3. **Process Each Row**:
   - Skip if OUTPUT value is "--"
   - Look up Name in conversion file to get RsID
   - Skip if RsID is "." or not found
   - Handle multiple RsIDs (comma-separated) as separate rows
   - Write: RSID, CHROMOSOME, POSITION, RESULT

### Example Processing

**Conversion File:**
```
Name	RsID
1:103380393	rs123456
GSA-rs118081514	rs789012,rs345678
```

**Individual File:**
```
SNP	Name	Chr	Position	Sample1	Sample2
variant1	1:103380393	1	103380393	GG	AA
variant2	GSA-rs118081514	6	72337310	TT	CC
variant3	unknown	7	12345	GG	AA
```

**Output Files:**

*Sample1_timestamp.txt:*
```
RSID	CHROMOSOME	POSITION	RESULT
rs123456	1	103380393	GG
rs789012	6	72337310	TT
rs345678	6	72337310	TT
```

*Sample2_timestamp.txt:*
```
RSID	CHROMOSOME	POSITION	RESULT
rs123456	1	103380393	AA
rs789012	6	72337310	CC
rs345678	6	72337310	CC
```

## Features

### File Upload with Progress
- Streaming upload for large files (handles 200MB+ files)
- Real-time progress tracking
- File validation before processing

### Stream Processing
- Memory-efficient processing using line-by-line reading
- Progress updates every 100 rows
- Large file support without memory issues

### Output Organization
- Results grouped by individual file
- Each group contains output files for each column
- Download individual files or entire groups as ZIP

### Storage Management
- Automatic directory creation
- File cleanup on deletion
- Soft delete for database records

### Error Handling
- File format validation
- Processing error tracking
- Automatic cleanup on failures

## Status Values

### Project Status
- `PENDING`: Project created, ready for processing
- `PROCESSING`: Currently processing files
- `COMPLETED`: All files processed successfully
- `ERROR`: Processing failed (check error_message)

## Authentication

All endpoints require SuperAdmin role authentication. Include the JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## Database Schema

The system uses the following tables:
- `rsid_conversion_files`: Stores conversion file information
- `rsid_projects`: Stores project information and status
- `rsid_individual_files`: Stores individual file information
- `rsid_output_groups`: Groups output files by individual
- `rsid_output_files`: Stores output file information

## Error Codes

- `400`: Bad Request (invalid file format, missing files)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (not SuperAdmin)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error (processing failed)

## Example Workflow

```bash
# 1. Upload conversion file
curl -X POST "/api/rsid/conversion-file/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@conversion.txt" \
  -F "name=My Conversion"

# 2. Create project
curl -X POST "/api/rsid/projects" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "conversion_file_id": 1}'

# 3. Upload individual files
curl -X POST "/api/rsid/projects/1/individual-files/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@individual1.txt" \
  -F "name=Individual 1"

# 4. Start processing
curl -X POST "/api/rsid/projects/1/process" \
  -H "Authorization: Bearer <token>"

# 5. Check progress
curl -X GET "/api/rsid/projects/1" \
  -H "Authorization: Bearer <token>"

# 6. Download results
curl -X GET "/api/rsid/projects/1/download-group/1" \
  -H "Authorization: Bearer <token>" \
  -o results.zip
```