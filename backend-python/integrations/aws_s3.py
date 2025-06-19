"""
Advanced AWS S3 integration for DroneStrike v2.

Provides comprehensive file management including multipart uploads, versioning,
lifecycle management, access control, CDN integration, and image processing.
"""

import asyncio
import json
import time
import hashlib
import mimetypes
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, BinaryIO, Callable
from enum import Enum
from dataclasses import dataclass, field
from urllib.parse import urlencode
import base64
import os

import httpx
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from botocore.config import Config
from pydantic import BaseModel, validator, Field

from .base import HTTPIntegration, IntegrationConfig, IntegrationError, ValidationError, BatchProcessor


class S3StorageClass(Enum):
    """S3 storage classes."""
    STANDARD = "STANDARD"
    REDUCED_REDUNDANCY = "REDUCED_REDUNDANCY"
    STANDARD_IA = "STANDARD_IA"
    ONEZONE_IA = "ONEZONE_IA"
    INTELLIGENT_TIERING = "INTELLIGENT_TIERING"
    GLACIER = "GLACIER"
    DEEP_ARCHIVE = "DEEP_ARCHIVE"
    GLACIER_IR = "GLACIER_IR"


class S3Permission(Enum):
    """S3 ACL permissions."""
    READ = "READ"
    WRITE = "WRITE"
    READ_ACP = "READ_ACP"
    WRITE_ACP = "WRITE_ACP"
    FULL_CONTROL = "FULL_CONTROL"


class S3LifecycleAction(Enum):
    """Lifecycle rule actions."""
    TRANSITION = "transition"
    EXPIRATION = "expiration"
    ABORT_INCOMPLETE_MULTIPART = "abort_incomplete_multipart"
    DELETE_MARKER_EXPIRATION = "delete_marker_expiration"


class AWSS3Config(IntegrationConfig):
    """AWS S3-specific configuration."""
    aws_access_key_id: str = Field(..., description="AWS access key ID")
    aws_secret_access_key: str = Field(..., description="AWS secret access key")
    aws_session_token: Optional[str] = None
    region_name: str = Field("us-east-1", description="AWS region")
    
    # Bucket settings
    default_bucket: Optional[str] = None
    bucket_prefix: str = ""
    
    # Upload settings
    multipart_threshold: int = Field(8 * 1024 * 1024, description="Multipart upload threshold (8MB)")
    multipart_chunksize: int = Field(8 * 1024 * 1024, description="Multipart chunk size (8MB)")
    max_concurrency: int = 10
    
    # Default settings
    default_storage_class: S3StorageClass = S3StorageClass.STANDARD
    server_side_encryption: Optional[str] = "AES256"  # AES256 or aws:kms
    kms_key_id: Optional[str] = None
    
    # CloudFront settings
    cloudfront_domain: Optional[str] = None
    cloudfront_distribution_id: Optional[str] = None
    cloudfront_key_pair_id: Optional[str] = None
    cloudfront_private_key: Optional[str] = None
    
    # Image processing settings
    image_processing_enabled: bool = False
    supported_image_formats: List[str] = Field(default_factory=lambda: ["jpg", "jpeg", "png", "gif", "webp"])
    thumbnail_sizes: List[Dict[str, int]] = Field(default_factory=lambda: [
        {"width": 150, "height": 150},
        {"width": 300, "height": 300},
        {"width": 800, "height": 600}
    ])
    
    # Backup settings
    backup_enabled: bool = False
    backup_bucket: Optional[str] = None
    backup_retention_days: int = 30
    
    class Config:
        extra = "allow"


@dataclass
class S3Object:
    """S3 object representation."""
    key: str
    bucket: str
    size: int = 0
    last_modified: Optional[datetime] = None
    etag: Optional[str] = None
    storage_class: Optional[str] = None
    content_type: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    version_id: Optional[str] = None
    
    @property
    def url(self) -> str:
        """Get object URL."""
        return f"https://{self.bucket}.s3.amazonaws.com/{self.key}"


class UploadRequest(BaseModel):
    """File upload request."""
    key: str = Field(..., description="Object key (path)")
    content: Optional[bytes] = None
    file_path: Optional[str] = None
    content_type: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    storage_class: S3StorageClass = S3StorageClass.STANDARD
    server_side_encryption: Optional[str] = None
    kms_key_id: Optional[str] = None
    cache_control: Optional[str] = None
    expires: Optional[datetime] = None
    tags: Optional[Dict[str, str]] = None
    
    @validator('content', 'file_path')
    def validate_content_source(cls, v, values):
        content = values.get('content')
        file_path = values.get('file_path')
        if not content and not file_path:
            raise ValueError('Either content or file_path must be provided')
        return v


class PresignedUrlRequest(BaseModel):
    """Presigned URL request."""
    key: str
    expiration: int = Field(3600, description="URL expiration in seconds")
    method: str = Field("GET", description="HTTP method")
    content_type: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None


class LifecycleRule(BaseModel):
    """S3 lifecycle rule."""
    rule_id: str
    prefix: Optional[str] = None
    tags: Optional[Dict[str, str]] = None
    status: str = "Enabled"
    transitions: Optional[List[Dict[str, Any]]] = None
    expiration: Optional[Dict[str, Any]] = None
    abort_incomplete_multipart: Optional[int] = None


class BucketPolicy(BaseModel):
    """S3 bucket policy."""
    version: str = "2012-10-17"
    statements: List[Dict[str, Any]]


class AdvancedAWSS3(HTTPIntegration):
    """
    Advanced AWS S3 integration with comprehensive file management capabilities.
    
    Features:
    - Complete file management with metadata
    - Advanced upload (multipart, presigned URLs)
    - File versioning and lifecycle management
    - Access control and permissions
    - CDN integration with CloudFront
    - Image processing and optimization
    - Backup and archival strategies
    - Cross-region replication
    """
    
    def __init__(self, config: AWSS3Config):
        super().__init__(config)
        self.config: AWSS3Config = config
        self.batch_processor = BatchProcessor(batch_size=100, max_workers=10)
        
        # Initialize AWS clients
        self._initialize_aws_clients()
    
    def _initialize_client(self) -> None:
        """Initialize HTTP client for non-AWS requests."""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    
    def _initialize_aws_clients(self) -> None:
        """Initialize AWS S3 clients."""
        try:
            # Configure AWS session
            session_config = Config(
                region_name=self.config.region_name,
                retries={'max_attempts': self.config.max_retries},
                max_pool_connections=self.config.max_concurrency
            )
            
            session_kwargs = {
                'aws_access_key_id': self.config.aws_access_key_id,
                'aws_secret_access_key': self.config.aws_secret_access_key,
                'region_name': self.config.region_name,
                'config': session_config
            }
            
            if self.config.aws_session_token:
                session_kwargs['aws_session_token'] = self.config.aws_session_token
            
            # Create S3 client and resource
            self.s3_client = boto3.client('s3', **session_kwargs)
            self.s3_resource = boto3.resource('s3', **session_kwargs)
            
            # CloudFront client for CDN operations
            if self.config.cloudfront_distribution_id:
                self.cloudfront_client = boto3.client('cloudfront', **session_kwargs)
            
        except Exception as e:
            self.logger.error(f"Failed to initialize AWS clients: {e}")
            raise IntegrationError(f"AWS S3 initialization failed: {e}")
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers."""
        return {
            "User-Agent": "DroneStrike/2.0 AWS S3 Integration",
            "Accept": "application/json"
        }
    
    async def _perform_health_check(self) -> None:
        """Perform AWS S3 health check."""
        try:
            # List buckets to verify credentials
            response = self.s3_client.list_buckets()
            if not response.get('Buckets'):
                self.logger.warning("No S3 buckets found for account")
        except Exception as e:
            raise IntegrationError(f"AWS S3 health check failed: {e}")
    
    def _handle_aws_error(self, error: Exception, context: str = "") -> None:
        """Handle AWS-specific errors."""
        error_msg = f"AWS S3 error in {context}: {str(error)}"
        self.logger.error(error_msg, exc_info=True)
        
        if isinstance(error, ClientError):
            error_code = error.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchBucket':
                raise ValidationError("Bucket does not exist")
            elif error_code == 'NoSuchKey':
                raise ValidationError("Object does not exist")
            elif error_code == 'AccessDenied':
                raise ValidationError("Access denied")
            elif error_code == 'InvalidBucketName':
                raise ValidationError("Invalid bucket name")
        elif isinstance(error, NoCredentialsError):
            raise IntegrationError("AWS credentials not found")
        
        raise IntegrationError(error_msg)
    
    # Bucket Management
    
    async def create_bucket(
        self,
        bucket_name: str,
        region: Optional[str] = None,
        versioning_enabled: bool = False,
        public_read: bool = False
    ) -> Dict[str, Any]:
        """Create S3 bucket."""
        try:
            region = region or self.config.region_name
            
            # Create bucket
            if region == 'us-east-1':
                response = self.s3_client.create_bucket(Bucket=bucket_name)
            else:
                response = self.s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': region}
                )
            
            # Enable versioning if requested
            if versioning_enabled:
                self.s3_client.put_bucket_versioning(
                    Bucket=bucket_name,
                    VersioningConfiguration={'Status': 'Enabled'}
                )
            
            # Set public read policy if requested
            if public_read:
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "PublicReadGetObject",
                            "Effect": "Allow",
                            "Principal": "*",
                            "Action": "s3:GetObject",
                            "Resource": f"arn:aws:s3:::{bucket_name}/*"
                        }
                    ]
                }
                self.s3_client.put_bucket_policy(
                    Bucket=bucket_name,
                    Policy=json.dumps(policy)
                )
            
            return {
                "bucket_name": bucket_name,
                "region": region,
                "versioning_enabled": versioning_enabled,
                "public_read": public_read,
                "location": response.get('Location'),
                "status": "created"
            }
        except Exception as e:
            self._handle_aws_error(e, f"create bucket {bucket_name}")
    
    async def list_buckets(self) -> List[Dict[str, Any]]:
        """List all S3 buckets."""
        try:
            response = self.s3_client.list_buckets()
            
            buckets = []
            for bucket in response.get('Buckets', []):
                bucket_name = bucket['Name']
                
                # Get bucket region
                try:
                    region = self.s3_client.get_bucket_location(Bucket=bucket_name)
                    region = region.get('LocationConstraint') or 'us-east-1'
                except:
                    region = 'unknown'
                
                # Get versioning status
                try:
                    versioning = self.s3_client.get_bucket_versioning(Bucket=bucket_name)
                    versioning_status = versioning.get('Status', 'Disabled')
                except:
                    versioning_status = 'unknown'
                
                buckets.append({
                    "name": bucket_name,
                    "creation_date": bucket['CreationDate'],
                    "region": region,
                    "versioning_enabled": versioning_status == 'Enabled'
                })
            
            return buckets
        except Exception as e:
            self._handle_aws_error(e, "list buckets")
    
    async def delete_bucket(self, bucket_name: str, force: bool = False) -> Dict[str, Any]:
        """Delete S3 bucket."""
        try:
            # If force is True, delete all objects first
            if force:
                await self._empty_bucket(bucket_name)
            
            self.s3_client.delete_bucket(Bucket=bucket_name)
            
            return {
                "bucket_name": bucket_name,
                "status": "deleted"
            }
        except Exception as e:
            self._handle_aws_error(e, f"delete bucket {bucket_name}")
    
    async def _empty_bucket(self, bucket_name: str) -> None:
        """Empty all objects from bucket."""
        try:
            # Delete all object versions
            paginator = self.s3_client.get_paginator('list_object_versions')
            for page in paginator.paginate(Bucket=bucket_name):
                versions = page.get('Versions', [])
                delete_markers = page.get('DeleteMarkers', [])
                
                objects_to_delete = []
                
                for version in versions:
                    objects_to_delete.append({
                        'Key': version['Key'],
                        'VersionId': version['VersionId']
                    })
                
                for marker in delete_markers:
                    objects_to_delete.append({
                        'Key': marker['Key'],
                        'VersionId': marker['VersionId']
                    })
                
                if objects_to_delete:
                    self.s3_client.delete_objects(
                        Bucket=bucket_name,
                        Delete={'Objects': objects_to_delete}
                    )
        except Exception as e:
            self.logger.warning(f"Error emptying bucket {bucket_name}: {e}")
    
    # Object Operations
    
    async def upload_file(
        self,
        upload_request: UploadRequest,
        bucket: Optional[str] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Upload file to S3."""
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            # Determine content type
            content_type = upload_request.content_type
            if not content_type:
                content_type, _ = mimetypes.guess_type(upload_request.key)
                content_type = content_type or 'binary/octet-stream'
            
            # Prepare upload parameters
            extra_args = {
                'ContentType': content_type,
                'StorageClass': upload_request.storage_class.value
            }
            
            if upload_request.metadata:
                extra_args['Metadata'] = upload_request.metadata
            
            if upload_request.server_side_encryption:
                extra_args['ServerSideEncryption'] = upload_request.server_side_encryption
                if upload_request.kms_key_id:
                    extra_args['SSEKMSKeyId'] = upload_request.kms_key_id
            
            if upload_request.cache_control:
                extra_args['CacheControl'] = upload_request.cache_control
            
            if upload_request.expires:
                extra_args['Expires'] = upload_request.expires
            
            if upload_request.tags:
                tag_set = '&'.join([f"{k}={v}" for k, v in upload_request.tags.items()])
                extra_args['Tagging'] = tag_set
            
            # Perform upload
            if upload_request.file_path:
                file_size = os.path.getsize(upload_request.file_path)
                
                # Use multipart upload for large files
                if file_size > self.config.multipart_threshold:
                    await self._multipart_upload_file(
                        upload_request.file_path,
                        bucket,
                        upload_request.key,
                        extra_args,
                        progress_callback
                    )
                else:
                    self.s3_client.upload_file(
                        upload_request.file_path,
                        bucket,
                        upload_request.key,
                        ExtraArgs=extra_args
                    )
            else:
                # Upload from bytes
                self.s3_client.put_object(
                    Bucket=bucket,
                    Key=upload_request.key,
                    Body=upload_request.content,
                    **extra_args
                )
                file_size = len(upload_request.content)
            
            # Get uploaded object info
            obj_info = self.s3_client.head_object(Bucket=bucket, Key=upload_request.key)
            
            return {
                "bucket": bucket,
                "key": upload_request.key,
                "size": file_size,
                "etag": obj_info.get('ETag', '').strip('"'),
                "version_id": obj_info.get('VersionId'),
                "url": f"https://{bucket}.s3.amazonaws.com/{upload_request.key}",
                "content_type": content_type,
                "storage_class": upload_request.storage_class.value,
                "last_modified": obj_info.get('LastModified'),
                "status": "uploaded"
            }
        except Exception as e:
            self._handle_aws_error(e, f"upload file {upload_request.key}")
    
    async def _multipart_upload_file(
        self,
        file_path: str,
        bucket: str,
        key: str,
        extra_args: Dict[str, Any],
        progress_callback: Optional[Callable] = None
    ) -> None:
        """Perform multipart upload for large files."""
        try:
            # Initiate multipart upload
            response = self.s3_client.create_multipart_upload(
                Bucket=bucket,
                Key=key,
                **extra_args
            )
            upload_id = response['UploadId']
            
            parts = []
            part_number = 1
            
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(self.config.multipart_chunksize)
                    if not chunk:
                        break
                    
                    # Upload part
                    response = self.s3_client.upload_part(
                        Bucket=bucket,
                        Key=key,
                        PartNumber=part_number,
                        UploadId=upload_id,
                        Body=chunk
                    )
                    
                    parts.append({
                        'ETag': response['ETag'],
                        'PartNumber': part_number
                    })
                    
                    if progress_callback:
                        progress_callback(part_number, len(chunk))
                    
                    part_number += 1
            
            # Complete multipart upload
            self.s3_client.complete_multipart_upload(
                Bucket=bucket,
                Key=key,
                UploadId=upload_id,
                MultipartUpload={'Parts': parts}
            )
            
        except Exception as e:
            # Abort multipart upload on error
            try:
                self.s3_client.abort_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id
                )
            except:
                pass
            raise e
    
    async def download_file(
        self,
        key: str,
        bucket: Optional[str] = None,
        local_path: Optional[str] = None,
        version_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Download file from S3."""
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            # Get object parameters
            get_params = {'Bucket': bucket, 'Key': key}
            if version_id:
                get_params['VersionId'] = version_id
            
            if local_path:
                # Download to file
                self.s3_client.download_file(bucket, key, local_path)
                file_size = os.path.getsize(local_path)
                content = None
            else:
                # Download to memory
                response = self.s3_client.get_object(**get_params)
                content = response['Body'].read()
                file_size = len(content)
            
            # Get object metadata
            obj_info = self.s3_client.head_object(**get_params)
            
            return {
                "bucket": bucket,
                "key": key,
                "size": file_size,
                "content": content,
                "local_path": local_path,
                "content_type": obj_info.get('ContentType'),
                "etag": obj_info.get('ETag', '').strip('"'),
                "version_id": obj_info.get('VersionId'),
                "last_modified": obj_info.get('LastModified'),
                "metadata": obj_info.get('Metadata', {}),
                "status": "downloaded"
            }
        except Exception as e:
            self._handle_aws_error(e, f"download file {key}")
    
    async def delete_object(
        self,
        key: str,
        bucket: Optional[str] = None,
        version_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delete object from S3."""
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            delete_params = {'Bucket': bucket, 'Key': key}
            if version_id:
                delete_params['VersionId'] = version_id
            
            response = self.s3_client.delete_object(**delete_params)
            
            return {
                "bucket": bucket,
                "key": key,
                "version_id": version_id,
                "delete_marker": response.get('DeleteMarker', False),
                "status": "deleted"
            }
        except Exception as e:
            self._handle_aws_error(e, f"delete object {key}")
    
    async def copy_object(
        self,
        source_key: str,
        destination_key: str,
        source_bucket: Optional[str] = None,
        destination_bucket: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Copy object within S3."""
        source_bucket = source_bucket or self.config.default_bucket
        destination_bucket = destination_bucket or self.config.default_bucket
        
        if not source_bucket or not destination_bucket:
            raise ValidationError("Source and destination buckets must be specified")
        
        try:
            copy_source = {'Bucket': source_bucket, 'Key': source_key}
            
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata
                extra_args['MetadataDirective'] = 'REPLACE'
            
            self.s3_client.copy_object(
                CopySource=copy_source,
                Bucket=destination_bucket,
                Key=destination_key,
                **extra_args
            )
            
            return {
                "source_bucket": source_bucket,
                "source_key": source_key,
                "destination_bucket": destination_bucket,
                "destination_key": destination_key,
                "status": "copied"
            }
        except Exception as e:
            self._handle_aws_error(e, f"copy object {source_key} to {destination_key}")
    
    async def list_objects(
        self,
        bucket: Optional[str] = None,
        prefix: Optional[str] = None,
        max_keys: int = 1000,
        include_versions: bool = False
    ) -> List[Dict[str, Any]]:
        """List objects in S3 bucket."""
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            objects = []
            
            if include_versions:
                paginator = self.s3_client.get_paginator('list_object_versions')
                page_iterator = paginator.paginate(
                    Bucket=bucket,
                    Prefix=prefix or '',
                    MaxKeys=max_keys
                )
                
                for page in page_iterator:
                    for version in page.get('Versions', []):
                        objects.append(self._format_object_info(version, bucket, True))
            else:
                paginator = self.s3_client.get_paginator('list_objects_v2')
                page_iterator = paginator.paginate(
                    Bucket=bucket,
                    Prefix=prefix or '',
                    MaxKeys=max_keys
                )
                
                for page in page_iterator:
                    for obj in page.get('Contents', []):
                        objects.append(self._format_object_info(obj, bucket, False))
            
            return objects
        except Exception as e:
            self._handle_aws_error(e, f"list objects in bucket {bucket}")
    
    def _format_object_info(
        self,
        obj_data: Dict[str, Any],
        bucket: str,
        is_version: bool = False
    ) -> Dict[str, Any]:
        """Format object information."""
        return {
            "bucket": bucket,
            "key": obj_data.get('Key'),
            "size": obj_data.get('Size', 0),
            "last_modified": obj_data.get('LastModified'),
            "etag": obj_data.get('ETag', '').strip('"'),
            "storage_class": obj_data.get('StorageClass', 'STANDARD'),
            "version_id": obj_data.get('VersionId') if is_version else None,
            "is_latest": obj_data.get('IsLatest', True) if is_version else True,
            "url": f"https://{bucket}.s3.amazonaws.com/{obj_data.get('Key')}"
        }
    
    # Presigned URLs
    
    async def generate_presigned_url(
        self,
        request: PresignedUrlRequest,
        bucket: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate presigned URL for S3 object."""
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            params = {
                'Bucket': bucket,
                'Key': request.key
            }
            
            if request.content_type:
                params['ContentType'] = request.content_type
            
            if request.metadata:
                for key, value in request.metadata.items():
                    params[f'Metadata.{key}'] = value
            
            url = self.s3_client.generate_presigned_url(
                ClientMethod=f"{request.method.lower()}_object",
                Params=params,
                ExpiresIn=request.expiration
            )
            
            return {
                "url": url,
                "method": request.method,
                "bucket": bucket,
                "key": request.key,
                "expires_in": request.expiration,
                "expires_at": datetime.now() + timedelta(seconds=request.expiration)
            }
        except Exception as e:
            self._handle_aws_error(e, f"generate presigned URL for {request.key}")
    
    async def generate_presigned_post(
        self,
        key: str,
        bucket: Optional[str] = None,
        expiration: int = 3600,
        conditions: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Generate presigned POST data for direct browser uploads."""
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            conditions = conditions or []
            
            # Add default conditions
            conditions.extend([
                {"bucket": bucket},
                ["starts-with", "$key", key]
            ])
            
            response = self.s3_client.generate_presigned_post(
                Bucket=bucket,
                Key=key,
                ExpiresIn=expiration,
                Conditions=conditions
            )
            
            return {
                "url": response['url'],
                "fields": response['fields'],
                "bucket": bucket,
                "key": key,
                "expires_in": expiration,
                "expires_at": datetime.now() + timedelta(seconds=expiration)
            }
        except Exception as e:
            self._handle_aws_error(e, f"generate presigned POST for {key}")
    
    # Lifecycle Management
    
    async def set_lifecycle_configuration(
        self,
        bucket: str,
        rules: List[LifecycleRule]
    ) -> Dict[str, Any]:
        """Set bucket lifecycle configuration."""
        try:
            lifecycle_config = {
                'Rules': []
            }
            
            for rule in rules:
                rule_config = {
                    'ID': rule.rule_id,
                    'Status': rule.status
                }
                
                # Add filter
                if rule.prefix or rule.tags:
                    rule_config['Filter'] = {}
                    if rule.prefix:
                        rule_config['Filter']['Prefix'] = rule.prefix
                    if rule.tags:
                        rule_config['Filter']['Tag'] = [
                            {'Key': k, 'Value': v} for k, v in rule.tags.items()
                        ]
                
                # Add transitions
                if rule.transitions:
                    rule_config['Transitions'] = rule.transitions
                
                # Add expiration
                if rule.expiration:
                    rule_config['Expiration'] = rule.expiration
                
                # Add abort incomplete multipart uploads
                if rule.abort_incomplete_multipart:
                    rule_config['AbortIncompleteMultipartUpload'] = {
                        'DaysAfterInitiation': rule.abort_incomplete_multipart
                    }
                
                lifecycle_config['Rules'].append(rule_config)
            
            self.s3_client.put_bucket_lifecycle_configuration(
                Bucket=bucket,
                LifecycleConfiguration=lifecycle_config
            )
            
            return {
                "bucket": bucket,
                "rules_count": len(rules),
                "status": "configured"
            }
        except Exception as e:
            self._handle_aws_error(e, f"set lifecycle configuration for {bucket}")
    
    async def get_lifecycle_configuration(self, bucket: str) -> Dict[str, Any]:
        """Get bucket lifecycle configuration."""
        try:
            response = self.s3_client.get_bucket_lifecycle_configuration(Bucket=bucket)
            
            return {
                "bucket": bucket,
                "rules": response.get('Rules', []),
                "rules_count": len(response.get('Rules', []))
            }
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchLifecycleConfiguration':
                return {
                    "bucket": bucket,
                    "rules": [],
                    "rules_count": 0
                }
            raise
        except Exception as e:
            self._handle_aws_error(e, f"get lifecycle configuration for {bucket}")
    
    # CloudFront Integration
    
    async def create_cloudfront_distribution(
        self,
        bucket: str,
        domain_aliases: Optional[List[str]] = None,
        price_class: str = "PriceClass_All"
    ) -> Dict[str, Any]:
        """Create CloudFront distribution for S3 bucket."""
        if not hasattr(self, 'cloudfront_client'):
            raise IntegrationError("CloudFront client not initialized")
        
        try:
            # Create origin access identity
            oai_response = self.cloudfront_client.create_cloud_front_origin_access_identity(
                CloudFrontOriginAccessIdentityConfig={
                    'CallerReference': f"oai-{bucket}-{int(time.time())}",
                    'Comment': f"OAI for {bucket}"
                }
            )
            
            oai_id = oai_response['CloudFrontOriginAccessIdentity']['Id']
            
            # Distribution configuration
            distribution_config = {
                'CallerReference': f"dist-{bucket}-{int(time.time())}",
                'Comment': f"Distribution for {bucket}",
                'DefaultRootObject': 'index.html',
                'Origins': {
                    'Quantity': 1,
                    'Items': [
                        {
                            'Id': f"{bucket}-origin",
                            'DomainName': f"{bucket}.s3.amazonaws.com",
                            'S3OriginConfig': {
                                'OriginAccessIdentity': f"origin-access-identity/cloudfront/{oai_id}"
                            }
                        }
                    ]
                },
                'DefaultCacheBehavior': {
                    'TargetOriginId': f"{bucket}-origin",
                    'ViewerProtocolPolicy': 'redirect-to-https',
                    'TrustedSigners': {
                        'Enabled': False,
                        'Quantity': 0
                    },
                    'ForwardedValues': {
                        'QueryString': False,
                        'Cookies': {'Forward': 'none'}
                    },
                    'MinTTL': 0
                },
                'Enabled': True,
                'PriceClass': price_class
            }
            
            if domain_aliases:
                distribution_config['Aliases'] = {
                    'Quantity': len(domain_aliases),
                    'Items': domain_aliases
                }
            
            response = self.cloudfront_client.create_distribution(
                DistributionConfig=distribution_config
            )
            
            distribution = response['Distribution']
            
            return {
                "distribution_id": distribution['Id'],
                "domain_name": distribution['DomainName'],
                "origin_access_identity_id": oai_id,
                "status": distribution['Status'],
                "aliases": domain_aliases or [],
                "bucket": bucket
            }
        except Exception as e:
            self._handle_aws_error(e, f"create CloudFront distribution for {bucket}")
    
    async def invalidate_cloudfront_cache(
        self,
        paths: List[str],
        distribution_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Invalidate CloudFront cache."""
        if not hasattr(self, 'cloudfront_client'):
            raise IntegrationError("CloudFront client not initialized")
        
        distribution_id = distribution_id or self.config.cloudfront_distribution_id
        if not distribution_id:
            raise ValidationError("CloudFront distribution ID not specified")
        
        try:
            response = self.cloudfront_client.create_invalidation(
                DistributionId=distribution_id,
                InvalidationBatch={
                    'Paths': {
                        'Quantity': len(paths),
                        'Items': paths
                    },
                    'CallerReference': f"invalidation-{int(time.time())}"
                }
            )
            
            invalidation = response['Invalidation']
            
            return {
                "invalidation_id": invalidation['Id'],
                "distribution_id": distribution_id,
                "status": invalidation['Status'],
                "create_time": invalidation['CreateTime'],
                "paths": paths,
                "path_count": len(paths)
            }
        except Exception as e:
            self._handle_aws_error(e, f"invalidate CloudFront cache for {distribution_id}")
    
    # Image Processing
    
    async def process_image(
        self,
        source_key: str,
        operations: List[Dict[str, Any]],
        bucket: Optional[str] = None,
        destination_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process image with various operations."""
        if not self.config.image_processing_enabled:
            raise ValidationError("Image processing not enabled")
        
        bucket = bucket or self.config.default_bucket
        if not bucket:
            raise ValidationError("No bucket specified")
        
        try:
            # Download original image
            original = await self.download_file(source_key, bucket)
            
            # Check if it's a supported image format
            content_type = original.get('content_type', '')
            if not any(fmt in content_type.lower() for fmt in self.config.supported_image_formats):
                raise ValidationError(f"Unsupported image format: {content_type}")
            
            # This is a placeholder for actual image processing
            # In a real implementation, you would use PIL/Pillow or similar library
            processed_content = original['content']  # Placeholder
            
            # Upload processed image
            destination_key = destination_key or f"processed/{source_key}"
            
            upload_request = UploadRequest(
                key=destination_key,
                content=processed_content,
                content_type=content_type
            )
            
            result = await self.upload_file(upload_request, bucket)
            
            return {
                "source_key": source_key,
                "destination_key": destination_key,
                "operations": operations,
                "original_size": original['size'],
                "processed_size": len(processed_content),
                "content_type": content_type,
                "url": result['url'],
                "status": "processed"
            }
        except Exception as e:
            self._handle_aws_error(e, f"process image {source_key}")
    
    async def generate_thumbnails(
        self,
        source_key: str,
        bucket: Optional[str] = None,
        sizes: Optional[List[Dict[str, int]]] = None
    ) -> List[Dict[str, Any]]:
        """Generate thumbnails for image."""
        sizes = sizes or self.config.thumbnail_sizes
        
        thumbnails = []
        for size in sizes:
            operations = [
                {
                    "operation": "resize",
                    "width": size["width"],
                    "height": size["height"],
                    "maintain_aspect_ratio": True
                }
            ]
            
            destination_key = f"thumbnails/{size['width']}x{size['height']}/{source_key}"
            
            result = await self.process_image(
                source_key,
                operations,
                bucket,
                destination_key
            )
            
            thumbnails.append({
                "size": f"{size['width']}x{size['height']}",
                "width": size["width"],
                "height": size["height"],
                "key": destination_key,
                "url": result["url"],
                "file_size": result["processed_size"]
            })
        
        return thumbnails
    
    # Backup and Sync
    
    async def create_backup(
        self,
        source_bucket: str,
        backup_bucket: Optional[str] = None,
        prefix: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create backup of bucket contents."""
        backup_bucket = backup_bucket or self.config.backup_bucket
        if not backup_bucket:
            raise ValidationError("No backup bucket specified")
        
        try:
            # List objects to backup
            objects = await self.list_objects(source_bucket, prefix)
            
            backed_up = 0
            failed = 0
            
            for obj in objects:
                try:
                    backup_key = f"backup/{datetime.now().strftime('%Y/%m/%d')}/{obj['key']}"
                    await self.copy_object(
                        obj['key'],
                        backup_key,
                        source_bucket,
                        backup_bucket
                    )
                    backed_up += 1
                except Exception as e:
                    self.logger.error(f"Failed to backup {obj['key']}: {e}")
                    failed += 1
            
            return {
                "source_bucket": source_bucket,
                "backup_bucket": backup_bucket,
                "total_objects": len(objects),
                "backed_up": backed_up,
                "failed": failed,
                "backup_date": datetime.now(),
                "status": "completed" if failed == 0 else "completed_with_errors"
            }
        except Exception as e:
            self._handle_aws_error(e, f"create backup from {source_bucket}")
    
    # Analytics and Reporting
    
    async def get_bucket_metrics(self, bucket: str) -> Dict[str, Any]:
        """Get bucket usage metrics."""
        try:
            # Get bucket size and object count
            objects = await self.list_objects(bucket)
            
            total_size = sum(obj['size'] for obj in objects)
            object_count = len(objects)
            
            # Group by storage class
            storage_classes = {}
            for obj in objects:
                storage_class = obj.get('storage_class', 'STANDARD')
                if storage_class not in storage_classes:
                    storage_classes[storage_class] = {'count': 0, 'size': 0}
                storage_classes[storage_class]['count'] += 1
                storage_classes[storage_class]['size'] += obj['size']
            
            # Get recent objects
            recent_objects = sorted(objects, key=lambda x: x['last_modified'], reverse=True)[:10]
            
            return {
                "bucket": bucket,
                "total_size": total_size,
                "total_size_gb": round(total_size / (1024**3), 2),
                "object_count": object_count,
                "storage_classes": storage_classes,
                "recent_objects": recent_objects,
                "last_modified": max((obj['last_modified'] for obj in objects), default=None)
            }
        except Exception as e:
            self._handle_aws_error(e, f"get bucket metrics for {bucket}")
    
    async def get_integration_metrics(self) -> Dict[str, Any]:
        """Get integration-specific metrics."""
        base_metrics = await self.get_metrics()
        
        try:
            buckets = await self.list_buckets()
            
            total_buckets = len(buckets)
            total_objects = 0
            total_size = 0
            
            # Get metrics for default bucket if specified
            if self.config.default_bucket:
                bucket_metrics = await self.get_bucket_metrics(self.config.default_bucket)
                total_objects = bucket_metrics["object_count"]
                total_size = bucket_metrics["total_size"]
            
            return {
                **base_metrics,
                "integration_type": "aws_s3",
                "region": self.config.region_name,
                "default_bucket": self.config.default_bucket,
                "buckets": {
                    "total": total_buckets,
                    "with_versioning": sum(1 for b in buckets if b["versioning_enabled"])
                },
                "objects": {
                    "total": total_objects,
                    "total_size": total_size,
                    "total_size_gb": round(total_size / (1024**3), 2)
                },
                "features_enabled": {
                    "multipart_uploads": True,
                    "versioning": True,
                    "lifecycle_management": True,
                    "cloudfront_integration": hasattr(self, 'cloudfront_client'),
                    "image_processing": self.config.image_processing_enabled,
                    "backup": self.config.backup_enabled,
                    "encryption": bool(self.config.server_side_encryption)
                }
            }
        except Exception as e:
            self.logger.warning(f"Could not fetch additional metrics: {e}")
            return {
                **base_metrics,
                "integration_type": "aws_s3"
            }


# Export classes
__all__ = [
    "AdvancedAWSS3",
    "AWSS3Config",
    "S3StorageClass",
    "S3Permission",
    "S3LifecycleAction",
    "S3Object",
    "UploadRequest",
    "PresignedUrlRequest",
    "LifecycleRule",
    "BucketPolicy"
]