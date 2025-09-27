"""
Local disk storage implementation specifically for conversion files
This is separate from the main storage system to keep conversion files on disk
"""
import os
import uuid
from pathlib import Path
from typing import BinaryIO
import logging

logger = logging.getLogger(__name__)

class ConversionDiskStorage:
    def __init__(self):
        # Create storage directory in the project root
        self.base_path = Path("/app/conversion_storage")
        self.base_path.mkdir(exist_ok=True, parents=True)
        logger.info(f"ConversionDiskStorage initialized with base path: {self.base_path.absolute()}")

    def upload_file(self, file_data: BinaryIO, filename: str, folder: str = "") -> str:
        """
        Upload file to local disk storage
        Returns the file key (path relative to base)
        """
        try:
            # Create folder if it doesn't exist
            folder_path = self.base_path / folder
            folder_path.mkdir(parents=True, exist_ok=True)

            # Generate unique filename to avoid conflicts
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = folder_path / unique_filename

            # Reset file pointer and write file
            file_data.seek(0)
            with open(file_path, 'wb') as f:
                if hasattr(file_data, 'read'):
                    content = file_data.read()
                else:
                    content = file_data
                f.write(content)

            # Return relative path as key
            relative_path = file_path.relative_to(self.base_path)
            key = str(relative_path).replace(os.sep, '/')
            logger.info(f"Conversion file uploaded to disk storage: {key}")
            return key

        except Exception as e:
            logger.error(f"Failed to upload conversion file to disk: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def download_file(self, file_key: str) -> bytes:
        """
        Download file from local disk storage
        Returns file content as bytes
        """
        try:
            file_path = self.base_path / file_key.replace('/', os.sep)

            if not file_path.exists():
                raise FileNotFoundError(f"Conversion file not found: {file_key}")

            with open(file_path, 'rb') as f:
                content = f.read()

            logger.info(f"Conversion file downloaded from disk storage: {file_key}")
            return content

        except Exception as e:
            logger.error(f"Failed to download conversion file from disk: {str(e)}")
            raise Exception(f"Failed to download file: {str(e)}")

    def delete_file(self, file_key: str) -> bool:
        """
        Delete file from local disk storage
        Returns True if successful
        """
        try:
            file_path = self.base_path / file_key.replace('/', os.sep)

            if file_path.exists():
                file_path.unlink()
                logger.info(f"Conversion file deleted from disk storage: {file_key}")
                return True
            else:
                logger.warning(f"Conversion file not found for deletion: {file_key}")
                return False

        except Exception as e:
            logger.error(f"Error deleting conversion file {file_key}: {e}")
            return False

    def file_exists(self, file_key: str) -> bool:
        """
        Check if file exists in local disk storage
        """
        file_path = self.base_path / file_key.replace('/', os.sep)
        return file_path.exists()

    def get_file_size(self, file_key: str) -> int:
        """
        Get file size in bytes
        """
        file_path = self.base_path / file_key.replace('/', os.sep)
        if file_path.exists():
            return file_path.stat().st_size
        return 0

    def list_files(self, folder: str = "") -> list:
        """
        List files in a folder
        """
        folder_path = self.base_path / folder if folder else self.base_path

        if not folder_path.exists():
            return []

        files = []
        for file_path in folder_path.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(self.base_path)
                key = str(relative_path).replace(os.sep, '/')
                files.append(key)

        return files

# Create storage instance for conversion files
conversion_storage = ConversionDiskStorage()