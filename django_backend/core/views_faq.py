"""
FAQ Views for DroneStrike v2
REST API views for FAQ system with search, categories, and interactions
"""

from django.db.models import Q, Count, Sum
from django.utils import timezone
from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models_faq import FAQ, FAQCategory, UserFAQInteraction, FAQFeedback, UserQuestion
from .serializers_faq import (
    FAQListSerializer, FAQDetailSerializer, FAQCreateUpdateSerializer,
    FAQCategorySerializer, UserFAQInteractionSerializer, FAQFeedbackSerializer,
    UserQuestionSerializer, UserQuestionCreateSerializer, FAQSearchSerializer,
    FAQStatsSerializer
)


class FAQPagination(PageNumberPagination):
    """Custom pagination for FAQs"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class FAQCategoryViewSet(viewsets.ModelViewSet):
    """FAQ Category management"""
    queryset = FAQCategory.objects.filter(is_active=True)
    serializer_class = FAQCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering = ['sort_order', 'name']

    @action(detail=True, methods=['get'])
    def faqs(self, request, pk=None):
        """Get all FAQs for a specific category"""
        category = self.get_object()
        faqs = FAQ.objects.filter(category=category, is_active=True).order_by('sort_order', '-created_at')
        
        page = self.paginate_queryset(faqs)
        if page is not None:
            serializer = FAQListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = FAQListSerializer(faqs, many=True, context={'request': request})
        return Response(serializer.data)


class FAQViewSet(viewsets.ModelViewSet):
    """FAQ management with search and interaction tracking"""
    queryset = FAQ.objects.filter(is_active=True)
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = FAQPagination
    ordering = ['sort_order', '-created_at']

    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'update' or self.action == 'partial_update':
            return FAQCreateUpdateSerializer
        elif self.action == 'retrieve':
            return FAQDetailSerializer
        return FAQListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            try:
                queryset = queryset.filter(category_id=int(category))
            except (ValueError, TypeError):
                pass

        # Filter by featured
        featured_only = self.request.query_params.get('featured_only')
        if featured_only and featured_only.lower() == 'true':
            queryset = queryset.filter(is_featured=True)

        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(question__icontains=search) |
                Q(answer__icontains=search) |
                Q(keywords__icontains=search)
            )

        return queryset.order_by('sort_order', '-created_at')

    def retrieve(self, request, *args, **kwargs):
        """Retrieve FAQ and track view"""
        instance = self.get_object()
        
        # Increment view count
        instance.increment_view_count()
        
        # Track user interaction
        if request.user.is_authenticated:
            UserFAQInteraction.objects.get_or_create(
                user=request.user,
                faq=instance,
                action='view',
                defaults={'created_at': timezone.now()}
            )
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def search(self, request):
        """Advanced FAQ search"""
        serializer = FAQSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        queryset = self.get_queryset()

        # Apply search filters
        if data.get('query'):
            query = data['query']
            queryset = queryset.filter(
                Q(question__icontains=query) |
                Q(answer__icontains=query) |
                Q(keywords__icontains=query)
            )

        if data.get('category'):
            queryset = queryset.filter(category_id=data['category'])

        if data.get('featured_only'):
            queryset = queryset.filter(is_featured=True)

        # Limit results
        limit = data.get('limit', 20)
        queryset = queryset[:limit]

        faq_serializer = FAQListSerializer(queryset, many=True, context={'request': request})
        return Response({
            'count': queryset.count(),
            'results': faq_serializer.data
        })

    @action(detail=True, methods=['post'])
    def mark_helpful(self, request, pk=None):
        """Mark FAQ as helpful"""
        faq = self.get_object()
        faq.mark_helpful()
        
        # Track user interaction
        UserFAQInteraction.objects.get_or_create(
            user=request.user,
            faq=faq,
            action='helpful'
        )
        
        return Response({
            'success': True,
            'helpful_count': faq.helpful_count,
            'helpfulness_ratio': faq.helpfulness_ratio
        })

    @action(detail=True, methods=['post'])
    def mark_not_helpful(self, request, pk=None):
        """Mark FAQ as not helpful"""
        faq = self.get_object()
        faq.mark_not_helpful()
        
        # Track user interaction
        UserFAQInteraction.objects.get_or_create(
            user=request.user,
            faq=faq,
            action='not_helpful'
        )
        
        return Response({
            'success': True,
            'not_helpful_count': faq.not_helpful_count,
            'helpfulness_ratio': faq.helpfulness_ratio
        })

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured FAQs"""
        featured_faqs = self.get_queryset().filter(is_featured=True)[:10]
        serializer = FAQListSerializer(featured_faqs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Get most popular FAQs by view count"""
        popular_faqs = self.get_queryset().order_by('-view_count')[:10]
        serializer = FAQListSerializer(popular_faqs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recently added FAQs"""
        recent_faqs = self.get_queryset().order_by('-created_at')[:10]
        serializer = FAQListSerializer(recent_faqs, many=True, context={'request': request})
        return Response(serializer.data)


class FAQFeedbackViewSet(viewsets.ModelViewSet):
    """FAQ Feedback management"""
    queryset = FAQFeedback.objects.all()
    serializer_class = FAQFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Users can see their own feedback, admins can see all
        if not self.request.user.is_staff:
            queryset = queryset.filter(user=self.request.user)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def by_faq(self, request):
        """Get feedback for a specific FAQ"""
        faq_id = request.query_params.get('faq_id')
        if not faq_id:
            return Response({'error': 'faq_id parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        feedback = self.get_queryset().filter(faq_id=faq_id)
        serializer = self.get_serializer(feedback, many=True)
        return Response(serializer.data)


class UserQuestionViewSet(viewsets.ModelViewSet):
    """User Questions management"""
    queryset = UserQuestion.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserQuestionCreateSerializer
        return UserQuestionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Users can see their own questions, admins can see all
        if not self.request.user.is_staff:
            queryset = queryset.filter(user=self.request.user)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def answer(self, request, pk=None):
        """Answer a user question (admin only)"""
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        question = self.get_object()
        answer_text = request.data.get('answer')
        
        if not answer_text:
            return Response({'error': 'Answer text required'}, status=status.HTTP_400_BAD_REQUEST)

        question.answer = answer_text
        question.answered_by = request.user
        question.answered_at = timezone.now()
        question.status = 'answered'
        question.save()

        serializer = self.get_serializer(question)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def convert_to_faq(self, request, pk=None):
        """Convert user question to FAQ (admin only)"""
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        question = self.get_object()
        
        if not question.answer:
            return Response({'error': 'Question must be answered first'}, status=status.HTTP_400_BAD_REQUEST)

        # Create FAQ from question
        faq_data = {
            'question': question.question,
            'answer': question.answer,
            'category': question.category,
            'created_by': request.user
        }

        faq = FAQ.objects.create(**faq_data)
        
        # Update question status
        question.status = 'converted'
        question.converted_faq = faq
        question.save()

        return Response({
            'success': True,
            'faq_id': faq.id,
            'message': 'Question converted to FAQ successfully'
        })


class FAQStatsView(generics.GenericAPIView):
    """FAQ Statistics for admin dashboard"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get comprehensive FAQ statistics"""
        # Basic counts
        total_faqs = FAQ.objects.count()
        active_faqs = FAQ.objects.filter(is_active=True).count()
        featured_faqs = FAQ.objects.filter(is_featured=True).count()
        total_categories = FAQCategory.objects.filter(is_active=True).count()
        total_views = FAQ.objects.aggregate(total=Sum('view_count'))['total'] or 0

        # Most viewed FAQ
        most_viewed_faq = FAQ.objects.filter(is_active=True).order_by('-view_count').first()
        
        # Most helpful FAQ
        most_helpful_faq = FAQ.objects.filter(is_active=True).order_by('-helpful_count').first()

        # Recent user questions
        recent_questions = UserQuestion.objects.filter(status='pending').order_by('-created_at')[:5]

        # Category breakdown
        category_breakdown = {}
        for category in FAQCategory.objects.filter(is_active=True):
            category_breakdown[category.name] = category.faqs.filter(is_active=True).count()

        stats_data = {
            'total_faqs': total_faqs,
            'active_faqs': active_faqs,
            'featured_faqs': featured_faqs,
            'total_categories': total_categories,
            'total_views': total_views,
            'most_viewed_faq': FAQListSerializer(most_viewed_faq).data if most_viewed_faq else None,
            'most_helpful_faq': FAQListSerializer(most_helpful_faq).data if most_helpful_faq else None,
            'recent_questions': UserQuestionSerializer(recent_questions, many=True).data,
            'category_breakdown': category_breakdown
        }

        return Response(stats_data)