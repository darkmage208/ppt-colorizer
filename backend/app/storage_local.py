"""
Local file storage implementation for development
This replaces Cloudflare R2 with local file system storage
"""
import os
import shutil
import tempfile
from pathlib import Path
from typing import BinaryIO, Optional
import logging

logger = logging.getLogger(__name__)

class LocalStorage:
    def __init__(self):
        self.base_path = Path("./local_storage")
        self.base_path.mkdir(exist_ok=True)
        logger.info(f"LocalStorage initialized with base path: {self.base_path.absolute()}")

    def upload_file(self, file_data: BinaryIO, filename: str, folder: str = "") -> str:
        """
        Upload file to local storage
        Returns the file key (path relative to base)
        """
        # Create folder if it doesn't exist
        folder_path = self.base_path / folder
        folder_path.mkdir(parents=True, exist_ok=True)

        # Create file path
        file_path = folder_path / filename

        # Write file
        file_data.seek(0)  # Reset file pointer
        with open(file_path, 'wb') as f:
            if hasattr(file_data, 'read'):
                content = file_data.read()
            else:
                content = file_data
            f.write(content)

        # Return relative path as key
        relative_path = file_path.relative_to(self.base_path)
        key = str(relative_path).replace(os.sep, '/')
        logger.info(f"File uploaded to local storage: {key}")
        return key

    def download_file(self, file_key: str) -> bytes:
        """
        Download file from local storage
        Returns file content as bytes
        """
        file_path = self.base_path / file_key.replace('/', os.sep)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_key}")

        with open(file_path, 'rb') as f:
            content = f.read()

        logger.info(f"File downloaded from local storage: {file_key}")
        return content

    def delete_file(self, file_key: str) -> bool:
        """
        Delete file from local storage
        Returns True if successful
        """
        file_path = self.base_path / file_key.replace('/', os.sep)

        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"File deleted from local storage: {file_key}")
                return True
            else:
                logger.warning(f"File not found for deletion: {file_key}")
                return False
        except Exception as e:
            logger.error(f"Error deleting file {file_key}: {e}")
            return False

    def file_exists(self, file_key: str) -> bool:
        """
        Check if file exists in local storage
        """
        file_path = self.base_path / file_key.replace('/', os.sep)
        return file_path.exists()

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

# Create storage instance
local_storage = LocalStorage()