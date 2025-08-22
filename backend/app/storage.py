import boto3
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO
import uuid
from .config import settings

class R2Storage:
    def __init__(self):
        self.client = boto3.client(
            's3',
            endpoint_url=f'https://{settings.r2_account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name='auto'
        )
        self.bucket_name = settings.r2_bucket_name
        self.public_url = settings.r2_public_url

    def upload_file(self, file_obj: BinaryIO, filename: str, folder: str = "") -> str:
        try:
            unique_filename = f"{uuid.uuid4()}_{filename}"
            key = f"{folder}/{unique_filename}" if folder else unique_filename
            
            self.client.upload_fileobj(file_obj, self.bucket_name, key)
            return key
        except ClientError as e:
            raise Exception(f"Failed to upload file: {str(e)}")

    def download_file(self, key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=key)
            return response['Body'].read()
        except ClientError as e:
            raise Exception(f"Failed to download file: {str(e)}")

    def delete_file(self, key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError as e:
            print(f"Failed to delete file: {str(e)}")
            return False

    def get_file_url(self, key: str) -> str:
        return f"{self.public_url}/{key}"

    def generate_presigned_url(self, key: str, expiration: int = 3600) -> str:
        try:
            response = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            raise Exception(f"Failed to generate presigned URL: {str(e)}")

storage = R2Storage()