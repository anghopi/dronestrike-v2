"""
FAQ Serializers for DroneStrike v2
REST API serializers for FAQ system
"""

from rest_framework import serializers
from .models_faq import FAQ, FAQCategory, UserFAQInteraction, FAQFeedback, UserQuestion


class FAQCategorySerializer(serializers.ModelSerializer):
    """FAQ Category serializer"""
    faq_count = serializers.SerializerMethodField()

    class Meta:
        model = FAQCategory
        fields = [
            'id', 'name', 'description', 'sort_order', 
            'is_active', 'faq_count', 'created_at', 'updated_at'
        ]

    def get_faq_count(self, obj):
        return obj.faqs.filter(is_active=True).count()


class FAQListSerializer(serializers.ModelSerializer):
    """FAQ list serializer (minimal fields)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    keyword_list = serializers.ReadOnlyField()
    helpfulness_ratio = serializers.ReadOnlyField()

    class Meta:
        model = FAQ
        fields = [
            'id', 'question', 'answer', 'category', 'category_name',
            'keyword_list', 'sort_order', 'is_active', 'is_featured',
            'view_count', 'helpful_count', 'not_helpful_count',
            'helpfulness_ratio', 'created_at', 'updated_at'
        ]


class FAQDetailSerializer(serializers.ModelSerializer):
    """FAQ detail serializer (full fields)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    keyword_list = serializers.ReadOnlyField()
    helpfulness_ratio = serializers.ReadOnlyField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = FAQ
        fields = [
            'id', 'question', 'answer', 'category', 'category_name',
            'keywords', 'keyword_list', 'sort_order', 'is_active', 'is_featured',
            'view_count', 'helpful_count', 'not_helpful_count',
            'helpfulness_ratio', 'created_by', 'created_by_username',
            'created_at', 'updated_at'
        ]


class FAQCreateUpdateSerializer(serializers.ModelSerializer):
    """FAQ create/update serializer"""
    
    class Meta:
        model = FAQ
        fields = [
            'question', 'answer', 'category', 'keywords',
            'sort_order', 'is_active', 'is_featured'
        ]

    def validate_question(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Question must be at least 10 characters long.")
        return value.strip()

    def validate_answer(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError("Answer must be at least 20 characters long.")
        return value.strip()


class UserFAQInteractionSerializer(serializers.ModelSerializer):
    """User FAQ interaction serializer"""
    
    class Meta:
        model = UserFAQInteraction
        fields = ['id', 'user', 'faq', 'action', 'created_at']
        read_only_fields = ['user']


class FAQFeedbackSerializer(serializers.ModelSerializer):
    """FAQ feedback serializer"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = FAQFeedback
        fields = [
            'id', 'faq', 'user', 'user_username', 'feedback_text',
            'is_suggestion', 'is_resolved', 'created_at'
        ]
        read_only_fields = ['user']


class UserQuestionSerializer(serializers.ModelSerializer):
    """User question serializer"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    answered_by_username = serializers.CharField(source='answered_by.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = UserQuestion
        fields = [
            'id', 'user', 'user_username', 'question', 'description',
            'category', 'category_name', 'status', 'answer',
            'answered_by', 'answered_by_username', 'answered_at',
            'converted_faq', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'answered_by', 'answered_at']


class UserQuestionCreateSerializer(serializers.ModelSerializer):
    """User question creation serializer"""
    
    class Meta:
        model = UserQuestion
        fields = ['question', 'description', 'category']

    def validate_question(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Question must be at least 10 characters long.")
        return value.strip()


class FAQSearchSerializer(serializers.Serializer):
    """FAQ search request serializer"""
    query = serializers.CharField(max_length=200, required=False, allow_blank=True)
    category = serializers.IntegerField(required=False, allow_null=True)
    featured_only = serializers.BooleanField(default=False)
    limit = serializers.IntegerField(default=20, min_value=1, max_value=100)


class FAQStatsSerializer(serializers.Serializer):
    """FAQ statistics serializer"""
    total_faqs = serializers.IntegerField()
    active_faqs = serializers.IntegerField()
    featured_faqs = serializers.IntegerField()
    total_categories = serializers.IntegerField()
    total_views = serializers.IntegerField()
    most_viewed_faq = FAQListSerializer()
    most_helpful_faq = FAQListSerializer()
    recent_questions = UserQuestionSerializer(many=True)
    category_breakdown = serializers.DictField()