"""
Document Management Serializers
DRF serializers for all document-related models
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Document, DocumentFolder, DocumentTemplate, DocumentPermission,
    DocumentStatusHistory, DocumentActivity, DocumentAttachment,
    DocumentComment, DocumentFolderPermission
)


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for document relations"""
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']
        read_only_fields = ['id', 'username', 'first_name', 'last_name', 'email']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Add full name for frontend convenience
        data['full_name'] = instance.get_full_name() or instance.username
        return data


class DocumentFolderSerializer(serializers.ModelSerializer):
    """Document folder serializer"""
    created_by = UserBasicSerializer(read_only=True)
    document_count = serializers.ReadOnlyField()
    full_path = serializers.ReadOnlyField()
    
    class Meta:
        model = DocumentFolder
        fields = [
            'id', 'name', 'description', 'parent', 'created_by',
            'is_shared', 'document_count', 'full_path',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class DocumentPermissionSerializer(serializers.ModelSerializer):
    """Document permission serializer"""
    user = UserBasicSerializer(read_only=True)
    granted_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = DocumentPermission
        fields = [
            'id', 'user', 'permission_level', 'can_view', 'can_edit',
            'can_delete', 'can_share', 'can_download', 'granted_by',
            'granted_at', 'expires_at'
        ]
        read_only_fields = ['id', 'granted_by', 'granted_at']


class DocumentAttachmentSerializer(serializers.ModelSerializer):
    """Document attachment serializer"""
    uploaded_by = UserBasicSerializer(read_only=True)
    file_url = serializers.ReadOnlyField()
    
    class Meta:
        model = DocumentAttachment
        fields = [
            'id', 'name', 'file_path', 'file_size', 'file_type',
            'mime_type', 'uploaded_by', 'file_url', 'created_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at']


class DocumentActivitySerializer(serializers.ModelSerializer):
    """Document activity serializer"""
    user = UserBasicSerializer(read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = DocumentActivity
        fields = [
            'id', 'activity_type', 'description', 'user', 'user_name',
            'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']


class DocumentStatusHistorySerializer(serializers.ModelSerializer):
    """Document status history serializer"""
    changed_by = UserBasicSerializer(read_only=True)
    approved_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = DocumentStatusHistory
        fields = [
            'id', 'previous_status', 'new_status', 'changed_by',
            'change_reason', 'workflow_step', 'approval_required',
            'approved_by', 'created_at'
        ]
        read_only_fields = ['id', 'changed_by', 'created_at']


class DocumentCommentSerializer(serializers.ModelSerializer):
    """Document comment serializer"""
    user = UserBasicSerializer(read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    resolved_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = DocumentComment
        fields = [
            'id', 'content', 'user', 'user_name', 'parent_comment',
            'page_number', 'position_x', 'position_y', 'is_resolved',
            'resolved_by', 'resolved_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class DocumentTemplateSerializer(serializers.ModelSerializer):
    """Document template serializer"""
    
    class Meta:
        model = DocumentTemplate
        fields = [
            'id', 'name', 'description', 'template_type', 'document',
            'variables', 'is_active', 'usage_count', 'last_used_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'usage_count', 'last_used_at', 'created_at', 'updated_at']


class DocumentSerializer(serializers.ModelSerializer):
    """Main document serializer"""
    created_by = UserBasicSerializer(read_only=True)
    last_modified_by = UserBasicSerializer(read_only=True)
    folder = DocumentFolderSerializer(read_only=True)
    folder_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    
    # Related data
    permissions = DocumentPermissionSerializer(many=True, read_only=True)
    attachments = DocumentAttachmentSerializer(many=True, read_only=True)
    activities = DocumentActivitySerializer(many=True, read_only=True)
    status_history = DocumentStatusHistorySerializer(many=True, read_only=True)
    comments = DocumentCommentSerializer(many=True, read_only=True)
    
    # Computed fields
    file_url = serializers.ReadOnlyField()
    latest_version = serializers.ReadOnlyField()
    
    class Meta:
        model = Document
        fields = [
            'id', 'name', 'filename', 'file_path', 'file_size', 'file_type',
            'mime_type', 'checksum', 'document_type', 'status', 'folder',
            'folder_id', 'folder_name', 'tags', 'version', 'latest_version',
            'parent_document', 'version_notes', 'is_latest_version',
            'is_template', 'template_variables', 'is_shared', 'is_favorite',
            'is_merged', 'metadata', 'created_by', 'last_modified_by',
            'created_at', 'updated_at', 'last_accessed_at', 'file_url',
            'permissions', 'attachments', 'activities', 'status_history', 'comments'
        ]
        read_only_fields = [
            'id', 'file_path', 'file_size', 'file_type', 'mime_type', 'checksum',
            'version', 'is_latest_version', 'created_by', 'last_modified_by',
            'created_at', 'updated_at', 'last_accessed_at'
        ]

    def create(self, validated_data):
        # Handle folder_id
        folder_id = validated_data.pop('folder_id', None)
        if folder_id:
            try:
                folder = DocumentFolder.objects.get(id=folder_id)
                validated_data['folder'] = folder
            except DocumentFolder.DoesNotExist:
                pass
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Handle folder_id
        folder_id = validated_data.pop('folder_id', None)
        if folder_id:
            try:
                folder = DocumentFolder.objects.get(id=folder_id)
                validated_data['folder'] = folder
            except DocumentFolder.DoesNotExist:
                pass
        elif folder_id is None:
            validated_data['folder'] = None
        
        return super().update(instance, validated_data)


class DocumentCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for document creation"""
    folder_id = serializers.UUIDField(required=False, allow_null=True)
    
    class Meta:
        model = Document
        fields = [
            'name', 'document_type', 'folder_id', 'tags', 'is_template',
            'template_variables', 'metadata'
        ]

    def create(self, validated_data):
        # Handle folder_id
        folder_id = validated_data.pop('folder_id', None)
        if folder_id:
            try:
                folder = DocumentFolder.objects.get(id=folder_id)
                validated_data['folder'] = folder
            except DocumentFolder.DoesNotExist:
                pass
        
        return super().create(validated_data)


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for document listing"""
    created_by = serializers.CharField(source='created_by.get_full_name', read_only=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    file_url = serializers.ReadOnlyField()
    
    class Meta:
        model = Document
        fields = [
            'id', 'name', 'filename', 'document_type', 'status', 'folder_name',
            'tags', 'version', 'is_latest_version', 'is_template', 'is_shared',
            'is_favorite', 'file_size', 'file_type', 'created_by', 'created_at',
            'updated_at', 'file_url'
        ]


class DocumentStatsSerializer(serializers.Serializer):
    """Serializer for document statistics"""
    total_documents = serializers.IntegerField()
    total_size = serializers.IntegerField()
    documents_by_type = serializers.DictField()
    documents_by_status = serializers.DictField()
    recent_activity_count = serializers.IntegerField()
    shared_documents_count = serializers.IntegerField()
    template_documents_count = serializers.IntegerField()


class DocumentUploadSerializer(serializers.Serializer):
    """Serializer for document upload"""
    file = serializers.FileField()
    name = serializers.CharField(required=False, allow_blank=True)
    document_type = serializers.ChoiceField(
        choices=Document.DOCUMENT_TYPE_CHOICES,
        default='other'
    )
    folder_id = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list
    )
    is_template = serializers.BooleanField(default=False)
    metadata = serializers.DictField(required=False, default=dict)