"""
Local disk storage implementation specifically for conversion files
This is separate from the main storage system to keep conversion files on disk
"""
import uuid
from pathlib import Path
from typing import BinaryIO
import logging

logger = logging.getLogger(__name__)

class ConversionDiskStorage:
    def __init__(self):
        # Use the same folder structure as VCF implementation
        self.uploads_path = Path("uploads/conversion_files")
        self.individual_files_path = Path("uploads/individual_files")
        self.outputs_path = Path("outputs/conversion_results")
        self.uploads_path.mkdir(exist_ok=True, parents=True)
        self.individual_files_path.mkdir(exist_ok=True, parents=True)
        self.outputs_path.mkdir(exist_ok=True, parents=True)
        logger.info(f"ConversionDiskStorage initialized with uploads: {self.uploads_path.absolute()}, individual_files: {self.individual_files_path.absolute()}, outputs: {self.outputs_path.absolute()}")

    def upload_file(self, file_data: BinaryIO, filename: str, folder: str = "") -> str:
        """
        Upload file to local disk storage
        Returns the absolute file path
        """
        try:
            # Determine base path based on folder type
            if folder == "conversion_results":
                base_path = self.outputs_path
            elif folder == "individual_files":
                base_path = self.individual_files_path
            else:
                base_path = self.uploads_path

            # Generate unique filename to avoid conflicts
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = base_path / unique_filename

            # Reset file pointer and write file
            file_data.seek(0)
            with open(file_path, 'wb') as f:
                if hasattr(file_data, 'read'):
                    content = file_data.read()
                else:
                    content = file_data
                f.write(content)

            # Return absolute path as key (same as database path)
            absolute_path = str(file_path.absolute())
            logger.info(f"Conversion file uploaded to disk storage: {absolute_path}")
            return absolute_path

        except Exception as e:
            logger.error(f"Failed to upload conversion file to disk: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def download_file(self, file_key: str) -> bytes:
        """
        Download file from local disk storage
        Returns file content as bytes
        """
        try:
            # file_key is now an absolute path
            file_path = Path(file_key)

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
            # file_key is now an absolute path
            file_path = Path(file_key)

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
        # file_key is now an absolute path
        file_path = Path(file_key)
        return file_path.exists()

    def get_file_size(self, file_key: str) -> int:
        """
        Get file size in bytes
        """
        # file_key is now an absolute path
        file_path = Path(file_key)
        if file_path.exists():
            return file_path.stat().st_size
        return 0

    def list_files(self, folder: str = "") -> list:
        """
        List files in a folder
        """
        if folder == "conversion_results":
            folder_path = self.outputs_path
        elif folder == "individual_files":
            folder_path = self.individual_files_path
        elif folder == "":
            # List all files from all folders
            files = []
            for base_path in [self.uploads_path, self.individual_files_path, self.outputs_path]:
                if base_path.exists():
                    for file_path in base_path.rglob('*'):
                        if file_path.is_file():
                            files.append(str(file_path.absolute()))
            return files
        else:
            folder_path = self.uploads_path

        if not folder_path.exists():
            return []

        files = []
        for file_path in folder_path.rglob('*'):
            if file_path.is_file():
                files.append(str(file_path.absolute()))

        return files

# Create storage instance for conversion files
conversion_storage = ConversionDiskStorage()