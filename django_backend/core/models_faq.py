"""
FAQ Models for DroneStrike v2
Dynamic FAQ system with categories and search capabilities
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinLengthValidator


class FAQCategory(models.Model):
    """FAQ Category model"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'faq_categories'
        ordering = ['sort_order', 'name']
        verbose_name = 'FAQ Category'
        verbose_name_plural = 'FAQ Categories'

    def __str__(self):
        return self.name


class FAQ(models.Model):
    """FAQ model with questions and answers"""
    question = models.CharField(
        max_length=500,
        validators=[MinLengthValidator(10)]
    )
    answer = models.TextField(
        validators=[MinLengthValidator(20)]
    )
    category = models.ForeignKey(
        FAQCategory,
        on_delete=models.CASCADE,
        related_name='faqs'
    )
    keywords = models.CharField(
        max_length=500,
        help_text="Comma-separated keywords for search",
        blank=True
    )
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(
        default=False,
        help_text="Show in featured FAQs section"
    )
    view_count = models.IntegerField(default=0)
    helpful_count = models.IntegerField(default=0)
    not_helpful_count = models.IntegerField(default=0)
    
    # Metadata
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_faqs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'faqs'
        ordering = ['sort_order', '-created_at']
        verbose_name = 'FAQ'
        verbose_name_plural = 'FAQs'

    def __str__(self):
        return self.question[:100]

    @property
    def keyword_list(self):
        """Return keywords as a list"""
        if self.keywords:
            return [kw.strip() for kw in self.keywords.split(',') if kw.strip()]
        return []

    @property
    def helpfulness_ratio(self):
        """Calculate helpfulness ratio"""
        total_votes = self.helpful_count + self.not_helpful_count
        if total_votes == 0:
            return 0
        return (self.helpful_count / total_votes) * 100

    def increment_view_count(self):
        """Increment view count"""
        self.view_count += 1
        self.save(update_fields=['view_count'])

    def mark_helpful(self):
        """Mark as helpful"""
        self.helpful_count += 1
        self.save(update_fields=['helpful_count'])

    def mark_not_helpful(self):
        """Mark as not helpful"""
        self.not_helpful_count += 1
        self.save(update_fields=['not_helpful_count'])


class UserFAQInteraction(models.Model):
    """Track user interactions with FAQs"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    faq = models.ForeignKey(FAQ, on_delete=models.CASCADE)
    action = models.CharField(
        max_length=20,
        choices=[
            ('view', 'Viewed'),
            ('helpful', 'Marked Helpful'),
            ('not_helpful', 'Marked Not Helpful'),
            ('bookmark', 'Bookmarked'),
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_faq_interactions'
        unique_together = ['user', 'faq', 'action']


class FAQFeedback(models.Model):
    """User feedback on FAQs"""
    faq = models.ForeignKey(FAQ, on_delete=models.CASCADE, related_name='feedback')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    feedback_text = models.TextField()
    is_suggestion = models.BooleanField(
        default=False,
        help_text="Is this a suggestion for improvement?"
    )
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'faq_feedback'
        ordering = ['-created_at']


class UserQuestion(models.Model):
    """User submitted questions that may become FAQs"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    question = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        FAQCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('answered', 'Answered'),
            ('converted', 'Converted to FAQ'),
            ('rejected', 'Rejected'),
        ],
        default='pending'
    )
    answer = models.TextField(blank=True)
    answered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='answered_questions'
    )
    answered_at = models.DateTimeField(null=True, blank=True)
    converted_faq = models.ForeignKey(
        FAQ,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_questions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}: {self.question[:50]}"