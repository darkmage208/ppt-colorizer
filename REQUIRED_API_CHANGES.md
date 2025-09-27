# Required API Changes for Independent File Management

## Overview
To support independent management of conversion files and individual files, the following API changes are needed:

## Individual Files Endpoints

### 1. GET /conversions/individual-files/
**Purpose**: Fetch all individual files (independent of conversion files)
**Response**:
```json
[
  {
    "id": 1,
    "name": "sample_data_1",
    "filename": "sample_data_1.txt",
    "file_path": "path/to/file",
    "file_size": 1024,
    "is_uploaded": true,
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

### 2. POST /conversions/individual-files/
**Purpose**: Upload individual files (no conversion_file_id required)
**Request Body**: FormData
- `name`: string
- `individual_file`: file

**Response**:
```json
{
  "id": 1,
  "name": "sample_data_1",
  "filename": "sample_data_1.txt",
  "file_path": "path/to/file",
  "file_size": 1024,
  "is_uploaded": true,
  "created_at": "2025-01-15T10:00:00Z"
}
```

### 3. DELETE /conversions/individual-files/{file_id}
**Purpose**: Delete an individual file
**Response**: 204 No Content

## Conversion Endpoints

### 4. POST /conversions/start-conversion/
**Purpose**: Start conversion with selected files
**Request Body**:
```json
{
  "conversion_file_id": 1,
  "individual_file_ids": [1, 2, 3, 4]
}
```

**Response**:
```json
{
  "message": "Conversion started successfully",
  "groups_created": [
    {
      "id": 1,
      "name": "Conversion Group 1",
      "status": "pending"
    }
  ]
}
```

## Database Schema Changes

### Individual Files Table
Remove the foreign key relationship to conversion files:
```sql
-- Remove the conversion_file_id column if it exists
ALTER TABLE individual_files DROP COLUMN IF EXISTS conversion_file_id;

-- Ensure the table structure supports independent files
-- The table should have: id, name, filename, file_path, file_size, is_uploaded, created_at, updated_at
```

### Conversion Groups Table
Update to support multiple individual files:
```sql
-- Add a junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS conversion_group_files (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES conversion_groups(id) ON DELETE CASCADE,
    individual_file_id INTEGER REFERENCES individual_files(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Or add a JSON column to store individual file IDs
ALTER TABLE conversion_groups ADD COLUMN IF NOT EXISTS individual_file_ids JSON;
```

## Implementation Notes

1. **Independent Storage**: Individual files should be stored independently of conversion files
2. **Multi-Selection**: The conversion process should support multiple individual files per conversion
3. **File Management**: Users should be able to upload, delete, and manage files independently
4. **Backward Compatibility**: Ensure existing functionality continues to work during migration

## Migration Strategy

1. Update the individual files model to remove conversion file dependency
2. Create new API endpoints as specified above
3. Update the conversion logic to work with multiple selected files
4. Test the new workflow thoroughly
5. Update frontend to use the new endpoints