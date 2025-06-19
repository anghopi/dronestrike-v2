"""Information pages implementation (FAQ, News, etc.)"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime, date
from enum import Enum

from .base import BasePage, PageResponse


class NewsCategory(str, Enum):
    """News category enums"""
    COMPANY = "company"
    PRODUCT = "product"
    INDUSTRY = "industry"
    TECHNOLOGY = "technology"
    REGULATION = "regulation"
    CASE_STUDY = "case_study"


class FAQCategory(str, Enum):
    """FAQ category enumeration"""
    GENERAL = "general"
    SERVICES = "services"
    PRICING = "pricing"
    TECHNICAL = "technical"
    ACCOUNT = "account"
    BILLING = "billing"
    SAFETY = "safety"


class NewsFilterForm(BaseModel):
    """News filtering form validation"""
    category: Optional[List[NewsCategory]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search_query: Optional[str] = None
    tags: Optional[List[str]] = None


class FAQSearchForm(BaseModel):
    """FAQ search form validation"""
    query: str
    category: Optional[FAQCategory] = None
    
    @validator('query')
    def query_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Search query is required')
        return v.strip()


class ContactForm(BaseModel):
    """Contact form validation"""
    name: str
    email: str
    subject: str
    message: str
    inquiry_type: str
    
    @validator('name', 'email', 'subject', 'message')
    def required_fields_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()


class SupportTicketForm(BaseModel):
    """Support ticket form validation"""
    subject: str
    description: str
    priority: str = "normal"
    category: str
    attachments: Optional[List[str]] = []
    
    @validator('subject', 'description', 'category')
    def required_fields_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()


class FAQPage(BasePage):
    """FAQ page implementation"""
    
    def get_page_data(self) -> PageResponse:
        """Get FAQ page data"""
        try:
            # Get FAQ items organized by category
            faq_items = self._get_faq_items()
            faq_by_category = self._organize_faq_by_category(faq_items)
            
            # Get popular FAQs
            popular_faqs = self._get_popular_faqs()
            
            # Get FAQ statistics
            faq_stats = self._get_faq_statistics()
            
            return self.create_response(data={
                'title': 'Frequently Asked Questions - DroneStrike',
                'faq_by_category': faq_by_category,
                'popular_faqs': popular_faqs,
                'faq_stats': faq_stats,
                'categories': [
                    {'id': 'general', 'name': 'General', 'icon': 'info'},
                    {'id': 'services', 'name': 'Services', 'icon': 'drone'},
                    {'id': 'pricing', 'name': 'Pricing', 'icon': 'dollar-sign'},
                    {'id': 'technical', 'name': 'Technical', 'icon': 'settings'},
                    {'id': 'account', 'name': 'Account', 'icon': 'user'},
                    {'id': 'billing', 'name': 'Billing', 'icon': 'credit-card'},
                    {'id': 'safety', 'name': 'Safety', 'icon': 'shield'}
                ],
                'quick_links': [
                    {'title': 'Getting Started Guide', 'url': '/guides/getting-started'},
                    {'title': 'Service Pricing', 'url': '/pricing'},
                    {'title': 'Contact Support', 'url': '/support'},
                    {'title': 'Safety Guidelines', 'url': '/safety'}
                ]
            })
            
        except Exception as e:
            self.add_error('Failed to load FAQ page')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle FAQ form submissions"""
        action = form_data.get('action')
        
        if action == 'search_faq':
            return self._search_faq(form_data)
        elif action == 'submit_feedback':
            return self._submit_faq_feedback(form_data)
        elif action == 'contact_support':
            return self._contact_support(form_data)
        elif action == 'suggest_faq':
            return self._suggest_faq(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _search_faq(self, form_data: Dict[str, Any]) -> PageResponse:
        """Search FAQ items"""
        search_form = self.validate_form_data(FAQSearchForm, form_data)
        if not search_form:
            return self.create_response(success=False)
        
        try:
            # Perform FAQ search
            search_results = self._perform_faq_search(
                search_form.query, 
                search_form.category
            )
            
            # Log search query for analytics
            self._log_faq_search(search_form.query, len(search_results))
            
            return self.create_response(
                success=True,
                data={
                    'search_results': search_results,
                    'query': search_form.query,
                    'total_results': len(search_results)
                }
            )
            
        except Exception as e:
            self.add_error('Failed to search FAQ')
            return self.create_response(success=False)
    
    def _submit_faq_feedback(self, form_data: Dict[str, Any]) -> PageResponse:
        """Submit feedback on FAQ item"""
        faq_id = form_data.get('faq_id')
        helpful = form_data.get('helpful')
        comment = form_data.get('comment', '')
        
        if not faq_id or helpful is None:
            self.add_error('FAQ ID and feedback are required')
            return self.create_response(success=False)
        
        try:
            # Save feedback
            feedback_data = {
                'faq_id': faq_id,
                'helpful': helpful,
                'comment': comment,
                'user_id': self.current_user['id'] if self.current_user else None,
                'created_at': datetime.utcnow()
            }
            
            self._save_faq_feedback(feedback_data)
            
            # Update FAQ helpfulness score
            self._update_faq_helpfulness(faq_id, helpful)
            
            return self.create_response(
                success=True,
                message='Thank you for your feedback!'
            )
            
        except Exception as e:
            self.add_error('Failed to submit feedback')
            return self.create_response(success=False)
    
    def _contact_support(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle contact support form"""
        contact_form = self.validate_form_data(ContactForm, form_data)
        if not contact_form:
            return self.create_response(success=False)
        
        try:
            # Create support ticket
            ticket_data = {
                'name': contact_form.name,
                'email': contact_form.email,
                'subject': contact_form.subject,
                'message': contact_form.message,
                'inquiry_type': contact_form.inquiry_type,
                'status': 'open',
                'created_at': datetime.utcnow()
            }
            
            ticket = self._create_support_ticket(ticket_data)
            
            # Send confirmation email
            self.send_email(
                to=contact_form.email,
                subject=f'Support Request Received - #{ticket["id"]}',
                body=self._generate_support_confirmation_email(ticket),
                html=True
            )
            
            # Notify support team
            self.send_email(
                to='support@dronestrike.com',
                subject=f'New Support Request - {contact_form.subject}',
                body=self._generate_support_notification_email(ticket),
                html=True
            )
            
            return self.create_response(
                success=True,
                data={'ticket_id': ticket['id']},
                message=f'Your support request has been submitted. Ticket ID: #{ticket["id"]}'
            )
            
        except Exception as e:
            self.add_error('Failed to submit support request')
            return self.create_response(success=False)
    
    def _suggest_faq(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle FAQ suggestion"""
        question = form_data.get('question', '').strip()
        email = form_data.get('email', '').strip()
        
        if not question:
            self.add_error('Question is required')
            return self.create_response(success=False)
        
        try:
            # Save FAQ suggestion
            suggestion_data = {
                'question': question,
                'email': email,
                'user_id': self.current_user['id'] if self.current_user else None,
                'status': 'pending',
                'created_at': datetime.utcnow()
            }
            
            self._save_faq_suggestion(suggestion_data)
            
            return self.create_response(
                success=True,
                message='Thank you for your suggestion! We\'ll review it and may add it to our FAQ.'
            )
            
        except Exception as e:
            self.add_error('Failed to submit suggestion')
            return self.create_response(success=False)
    
    def _get_faq_items(self) -> List[Dict[str, Any]]:
        """Get all FAQ items from reference system data"""
        return [
            {
                'id': 1,
                'question': 'How do I apply for a loan?',
                'answer': 'Fill out the form on the right side of this page or call to speak to one of our Loan Officers at 866-PROP-TAX and they will take your application over the phone. This process only takes about 15 minutes.',
                'category': 'general',
                'helpful_count': 245,
                'not_helpful_count': 12,
                'view_count': 850,
                'keywords': ['tax', 'loan', 'apply', 'application'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 2,
                'question': 'How long does it take to get a tax loan?',
                'answer': 'It can take anywhere between 2-12 days. In most cases we will send you the loan documents within a week after receiving your application.',
                'category': 'general',
                'helpful_count': 189,
                'not_helpful_count': 8,
                'view_count': 720,
                'keywords': ['tax', 'loan', 'time', 'processing'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 3,
                'question': 'Do I have to come to your office?',
                'answer': 'No. At your choice, we will either send a mobile notary to you, or we will overnight the documents to you and you can take them to a notary for the signing.',
                'category': 'general',
                'helpful_count': 156,
                'not_helpful_count': 5,
                'view_count': 612,
                'keywords': ['office', 'notary', 'mobile', 'documents'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 4,
                'question': 'In what counties do you make tax loans?',
                'answer': 'We make loans to every county in Texas.',
                'category': 'services',
                'helpful_count': 298,
                'not_helpful_count': 3,
                'view_count': 945,
                'keywords': ['tax', 'loan', 'counties', 'texas', 'location'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 5,
                'question': 'Do you check my credit?',
                'answer': 'We do not check credit, and we do not report your loan to a credit reporting agency. We only verify that you have the ability to make your loan payments by asking your monthly income and expenses to be sure that you can afford the monthly loan payments.',
                'category': 'account',
                'helpful_count': 342,
                'not_helpful_count': 18,
                'view_count': 1120,
                'keywords': ['credit', 'check', 'report', 'income'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 6,
                'question': 'May I pay the loan off early?',
                'answer': 'Yes. There is no prepayment penalty, so you can pay the loan off at any time. For example, if you pay the loan off in 90 days, you would only owe 90 days worth of interest.',
                'category': 'billing',
                'helpful_count': 278,
                'not_helpful_count': 9,
                'view_count': 892,
                'keywords': ['loan', 'early', 'prepayment', 'penalty'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 7,
                'question': 'May I pay more than my normal payment (and pay the loan off early)?',
                'answer': 'Yes. You are only required to make your minimum monthly payment. You can pay more than your normal monthly payment any time you want to. If you send in more, that additional amount will be applied to your principal loan balance and your loan will be paid off ahead of schedule.',
                'category': 'billing',
                'helpful_count': 198,
                'not_helpful_count': 6,
                'view_count': 654,
                'keywords': ['loan', 'payment', 'principal', 'early'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 8,
                'question': 'Will there be a lien against my property?',
                'answer': 'Yes. The county already has a tax lien against everyone\'s property beginning January 1. When we pay your tax bill, the county will transfer that tax lien to our company and that is our security for your payment. When you have paid off your loan, we release the lien by filing a release in the county records.',
                'category': 'safety',
                'helpful_count': 234,
                'not_helpful_count': 21,
                'view_count': 789,
                'keywords': ['property', 'lien', 'security', 'county'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 9,
                'question': 'What happens if I default in paying my tax loan?',
                'answer': 'Under Texas law you will be given notice of the default and the opportunity to cure the default. Foreclosure proceedings could be initiated if the default is not cured. Our policy is to work with you to get caught up on your late or past due payments.',
                'category': 'safety',
                'helpful_count': 167,
                'not_helpful_count': 34,
                'view_count': 567,
                'keywords': ['tax', 'loan', 'default', 'foreclosure'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 10,
                'question': 'What are the costs of getting a tax loan?',
                'answer': 'The closing costs for a loan vary based on the following items: the size of the loan, whether you have a mortgage or not, what type of property you own, the value of your property, etc. The closing costs include all expenses to get the loan such as attorney fees to prepare the loan documents, recording fees, and filing fees with the county.',
                'category': 'pricing',
                'helpful_count': 456,
                'not_helpful_count': 23,
                'view_count': 1234,
                'keywords': ['costs', 'closing', 'attorney', 'fees'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 11,
                'question': 'What is the interest rate?',
                'answer': 'The maximum interest rate allowed by law on a tax loan is 18%. Our average interest rate is lower than that. Please contact one of our Loan Officers for current loan rates.',
                'category': 'pricing',
                'helpful_count': 389,
                'not_helpful_count': 15,
                'view_count': 1156,
                'keywords': ['interest', 'rate', '18%', 'maximum'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 12,
                'question': 'What will be my \'out of pocket\' expenses to get this loan?',
                'answer': 'There are no out-of-pocket expenses. All closing costs are rolled into the loan. You do not have to pay a penny out of your pocket to get the loan. The only out-of-pocket expense is after you have paid off the loan. There is a charge of $110.00 to prepare and file the release of lien.',
                'category': 'pricing',
                'helpful_count': 298,
                'not_helpful_count': 12,
                'view_count': 876,
                'keywords': ['out of pocket', 'expenses', 'closing costs'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 13,
                'question': 'How much will I save by getting a tax loan?',
                'answer': 'Though every county is different, county charges for delinquent tax penalties, interest, attorney fees and court costs can range up to 47% of your taxes in the 1st year and 1% each month every year after. The sooner you obtain a tax loan, the more money you save by avoiding the penalties and interest that the county is charging you.',
                'category': 'pricing',
                'helpful_count': 567,
                'not_helpful_count': 8,
                'view_count': 1456,
                'keywords': ['save', 'penalties', '47%', 'county'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 14,
                'question': 'What are the benefits of a tax loan?',
                'answer': '• Saves money by stopping the penalties, interest and legal costs charged by the county.\n• Prevents foreclosure of the property by the county.\n• No credit reporting.\n• Flexible payment plans to fit your budget.\n• Peace of mind.',
                'category': 'general',
                'helpful_count': 678,
                'not_helpful_count': 5,
                'view_count': 1678,
                'keywords': ['benefits', 'saves', 'prevents', 'flexible'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 15,
                'question': 'What kind of property do you make tax loans on?',
                'answer': 'We make tax loans on all types of real estate including: residential houses, homesteads, rent houses, raw land, commercial buildings, motels, shopping centers, development tracts, duplexes, apartment buildings, farms, ranches, and any other type of real estate.',
                'category': 'services',
                'helpful_count': 234,
                'not_helpful_count': 7,
                'view_count': 756,
                'keywords': ['property', 'residential', 'commercial', 'land'],
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-06-15T14:30:00Z'
            },
            {
                'id': 2,
                'question': 'How much do drone services cost?',
                'answer': 'Our pricing varies based on the type of service, duration, and complexity. Basic aerial photography starts at $200, while complex inspections can range from $500-2000. Contact us for a custom quote.',
                'category': 'pricing',
                'helpful_count': 38,
                'not_helpful_count': 7,
                'view_count': 120,
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-08-01T09:15:00Z'
            },
            {
                'id': 3,
                'question': 'Are your drone operations legal and insured?',
                'answer': 'Yes, we are fully licensed by the FAA with Part 107 certification. We carry comprehensive commercial insurance and follow all federal and local regulations for drone operations.',
                'category': 'safety',
                'helpful_count': 52,
                'not_helpful_count': 1,
                'view_count': 95,
                'created_at': '2023-01-01T10:00:00Z',
                'updated_at': '2023-05-10T16:45:00Z'
            },
            {
                'id': 4,
                'question': 'How do I schedule a drone mission?',
                'answer': 'You can schedule a mission through our online platform by creating an account, selecting your service type, providing location details, and choosing your preferred date and time.',
                'category': 'general',
                'helpful_count': 31,
                'not_helpful_count': 4,
                'view_count': 85,
                'created_at': '2023-02-01T11:30:00Z',
                'updated_at': '2023-07-20T13:20:00Z'
            },
            {
                'id': 5,
                'question': 'What happens if weather conditions are poor?',
                'answer': 'Safety is our top priority. If weather conditions are unsafe for drone operations, we will reschedule your mission at no additional cost. We monitor weather conditions closely and will notify you in advance.',
                'category': 'safety',
                'helpful_count': 28,
                'not_helpful_count': 2,
                'view_count': 70,
                'created_at': '2023-02-15T14:00:00Z',
                'updated_at': '2023-06-30T10:30:00Z'
            },
            {
                'id': 6,
                'question': 'How do I update my billing information?',
                'answer': 'You can update your billing information by logging into your account, navigating to the Billing section, and selecting "Payment Methods" to add, edit, or remove payment options.',
                'category': 'billing',
                'helpful_count': 22,
                'not_helpful_count': 1,
                'view_count': 65,
                'created_at': '2023-03-01T09:45:00Z',
                'updated_at': '2023-08-15T15:10:00Z'
            }
        ]
    
    def _organize_faq_by_category(self, faq_items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Organize FAQ items by category"""
        faq_by_category = {}
        
        for item in faq_items:
            category = item['category']
            if category not in faq_by_category:
                faq_by_category[category] = []
            faq_by_category[category].append(self._format_faq_item(item))
        
        return faq_by_category
    
    def _get_popular_faqs(self) -> List[Dict[str, Any]]:
        """Get most popular FAQ items"""
        all_faqs = self._get_faq_items()
        # Sort by view count and helpfulness
        popular = sorted(all_faqs, key=lambda x: x['view_count'] + x['helpful_count'], reverse=True)
        return [self._format_faq_item(faq) for faq in popular[:5]]
    
    def _get_faq_statistics(self) -> Dict[str, Any]:
        """Get FAQ statistics"""
        all_faqs = self._get_faq_items()
        
        total_views = sum(faq['view_count'] for faq in all_faqs)
        total_helpful = sum(faq['helpful_count'] for faq in all_faqs)
        total_not_helpful = sum(faq['not_helpful_count'] for faq in all_faqs)
        
        return {
            'total_faqs': len(all_faqs),
            'total_views': total_views,
            'average_helpfulness': (total_helpful / (total_helpful + total_not_helpful)) * 100 if (total_helpful + total_not_helpful) > 0 else 0,
            'most_viewed_category': self._get_most_viewed_category(all_faqs),
            'recent_updates': len([faq for faq in all_faqs if self._is_recently_updated(faq['updated_at'])])
        }
    
    def _format_faq_item(self, faq: Dict[str, Any]) -> Dict[str, Any]:
        """Format FAQ item for display."""
        total_votes = faq['helpful_count'] + faq['not_helpful_count']
        helpfulness_score = (faq['helpful_count'] / total_votes * 100) if total_votes > 0 else 0
        
        return {
            'id': faq['id'],
            'question': faq['question'],
            'answer': faq['answer'],
            'category': faq['category'],
            'view_count': faq['view_count'],
            'helpfulness_score': round(helpfulness_score, 1),
            'helpful_count': faq['helpful_count'],
            'not_helpful_count': faq['not_helpful_count'],
            'is_recently_updated': self._is_recently_updated(faq['updated_at']),
            'created_at': faq['created_at'],
            'updated_at': faq['updated_at']
        }
    
    def _perform_faq_search(self, query: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Perform FAQ search."""
        all_faqs = self._get_faq_items()
        results = []
        
        query_lower = query.lower()
        
        for faq in all_faqs:
            # Filter by category if specified
            if category and faq['category'] != category:
                continue
            
            # Search in question and answer
            if (query_lower in faq['question'].lower() or 
                query_lower in faq['answer'].lower()):
                results.append(self._format_faq_item(faq))
        
        # Sort by relevance (simple scoring based on question match vs answer match)
        def relevance_score(faq_item):
            score = 0
            if query_lower in faq_item['question'].lower():
                score += 10
            if query_lower in faq_item['answer'].lower():
                score += 5
            score += faq_item['view_count'] * 0.1  # Boost popular items
            return score
        
        return sorted(results, key=relevance_score, reverse=True)
    
    def _is_recently_updated(self, updated_at: str) -> bool:
        """Check if FAQ was recently updated."""
        try:
            updated_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
            days_ago = (datetime.utcnow().replace(tzinfo=updated_date.tzinfo) - updated_date).days
            return days_ago <= 30
        except:
            return False
    
    def _get_most_viewed_category(self, faq_items: List[Dict[str, Any]]) -> str:
        """Get the most viewed FAQ category"""
        category_views = {}
        
        for faq in faq_items:
            category = faq['category']
            category_views[category] = category_views.get(category, 0) + faq['view_count']
        
        return max(category_views.items(), key=lambda x: x[1])[0] if category_views else 'general'
    
    # Database simulation methods
    def _save_faq_feedback(self, feedback_data: Dict[str, Any]):
        """Save FAQ feedback."""
        # Save feedback to database
        pass
    
    def _update_faq_helpfulness(self, faq_id: int, helpful: bool):
        """Update FAQ helpfulness score"""
        # Update helpfulness counters in database
        pass
    
    def _create_support_ticket(self, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create support ticket"""
        ticket_data['id'] = self._generate_ticket_id()
        return ticket_data
    
    def _save_faq_suggestion(self, suggestion_data: Dict[str, Any]):
        """Save FAQ suggestion"""
        # Save suggestion to database for review
        pass
    
    def _log_faq_search(self, query: str, result_count: int):
        """Log FAQ search for analytics."""
        # Log search query and results for improving FAQ
        pass
    
    def _generate_ticket_id(self) -> int:
        """Generate support ticket ID."""
        import random
        return random.randint(10000, 99999)
    
    def _generate_support_confirmation_email(self, ticket: Dict[str, Any]) -> str:
        """Generate support confirmation email."""
        return f"""
        <h2>Support Request Received</h2>
        <p>Dear {ticket['name']},</p>
        <p>We have received your support request and assigned it ticket ID <strong>#{ticket['id']}</strong>.</p>
        
        <h3>Request Details:</h3>
        <ul>
            <li><strong>Subject:</strong> {ticket['subject']}</li>
            <li><strong>Type:</strong> {ticket['inquiry_type']}</li>
            <li><strong>Submitted:</strong> {ticket['created_at']}</li>
        </ul>
        
        <p>Our support team will review your request and respond within 24 hours during business days.</p>
        <p>Thank you for contacting DroneStrike!</p>
        """
    
    def _generate_support_notification_email(self, ticket: Dict[str, Any]) -> str:
        """Generate support notification email for team."""
        return f"""
        <h2>New Support Request</h2>
        <p><strong>Ticket ID:</strong> #{ticket['id']}</p>
        <p><strong>From:</strong> {ticket['name']} ({ticket['email']})</p>
        <p><strong>Subject:</strong> {ticket['subject']}</p>
        <p><strong>Type:</strong> {ticket['inquiry_type']}</p>
        <p><strong>Message:</strong></p>
        <p>{ticket['message']}</p>
        """


class NewsPage(BasePage):
    """News and updates page implementation."""
    
    def get_page_data(self) -> PageResponse:
        """Get news page data."""
        try:
            # Get latest news articles
            news_articles = self._get_news_articles()
            
            # Get featured articles
            featured_articles = self._get_featured_articles()
            
            # Get news categories with counts
            news_categories = self._get_news_categories()
            
            # Get recent updates
            recent_updates = self._get_recent_updates()
            
            # Get news statistics
            news_stats = self._get_news_statistics()
            
            return self.create_response(data={
                'title': 'News & Updates - DroneStrike',
                'news_articles': [self._format_news_article(article) for article in news_articles],
                'featured_articles': [self._format_news_article(article) for article in featured_articles],
                'news_categories': news_categories,
                'recent_updates': recent_updates,
                'news_stats': news_stats,
                'categories': [
                    {'id': 'company', 'name': 'Company News', 'icon': 'building'},
                    {'id': 'product', 'name': 'Product Updates', 'icon': 'box'},
                    {'id': 'industry', 'name': 'Industry News', 'icon': 'trending-up'},
                    {'id': 'technology', 'name': 'Technology', 'icon': 'cpu'},
                    {'id': 'regulation', 'name': 'Regulations', 'icon': 'file-text'},
                    {'id': 'case_study', 'name': 'Case Studies', 'icon': 'book-open'}
                ]
            })
            
        except Exception as e:
            self.add_error('Failed to load news page')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle news form submissions."""
        action = form_data.get('action')
        
        if action == 'filter_news':
            return self._filter_news(form_data)
        elif action == 'subscribe_newsletter':
            return self._subscribe_newsletter(form_data)
        elif action == 'share_article':
            return self._share_article(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _filter_news(self, form_data: Dict[str, Any]) -> PageResponse:
        """Filter news articles."""
        filter_form = self.validate_form_data(NewsFilterForm, form_data)
        if not filter_form:
            return self.create_response(success=False)
        
        try:
            # Apply filters to news articles
            filtered_articles = self._apply_news_filters(filter_form)
            
            return self.create_response(
                success=True,
                data={
                    'news_articles': [self._format_news_article(article) for article in filtered_articles],
                    'total_count': len(filtered_articles)
                }
            )
            
        except Exception as e:
            self.add_error('Failed to filter news')
            return self.create_response(success=False)
    
    def _subscribe_newsletter(self, form_data: Dict[str, Any]) -> PageResponse:
        """Subscribe to newsletter."""
        email = form_data.get('email', '').strip()
        
        if not email:
            self.add_error('Email address is required')
            return self.create_response(success=False)
        
        try:
            # Add to newsletter subscription
            subscription_data = {
                'email': email,
                'subscribed_at': datetime.utcnow(),
                'source': 'news_page',
                'status': 'active'
            }
            
            self._save_newsletter_subscription(subscription_data)
            
            # Send welcome email
            self.send_email(
                to=email,
                subject='Welcome to DroneStrike Newsletter',
                body='Thank you for subscribing to our newsletter! You\'ll receive the latest updates and industry insights.',
                html=True
            )
            
            return self.create_response(
                success=True,
                message='Successfully subscribed to newsletter!'
            )
            
        except Exception as e:
            self.add_error('Failed to subscribe to newsletter')
            return self.create_response(success=False)
    
    def _share_article(self, form_data: Dict[str, Any]) -> PageResponse:
        """Share news article."""
        article_id = form_data.get('article_id')
        platform = form_data.get('platform')
        
        if not article_id or not platform:
            self.add_error('Article ID and platform are required')
            return self.create_response(success=False)
        
        try:
            # Get article details
            article = self._get_article_by_id(article_id)
            if not article:
                self.add_error('Article not found')
                return self.create_response(success=False)
            
            # Generate share URL
            share_url = self._generate_share_url(article, platform)
            
            # Log share activity
            self._log_article_share(article_id, platform)
            
            return self.create_response(
                success=True,
                data={'share_url': share_url},
                message='Article shared successfully!'
            )
            
        except Exception as e:
            self.add_error('Failed to share article')
            return self.create_response(success=False)
    
    def _get_news_articles(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get news articles."""
        return [
            {
                'id': 1,
                'title': 'DroneStrike Announces New AI-Powered Mission Planning',
                'excerpt': 'Our latest update includes artificial intelligence to optimize drone flight paths and improve mission efficiency.',
                'content': 'We are excited to announce the launch of our new AI-powered mission planning feature...',
                'category': 'product',
                'author': 'DroneStrike Team',
                'author_avatar': '/avatars/team.jpg',
                'published_at': '2024-01-10T09:00:00Z',
                'featured_image': '/news/ai-mission-planning.jpg',
                'tags': ['AI', 'mission-planning', 'product-update'],
                'read_time': 5,
                'view_count': 1250,
                'share_count': 45,
                'is_featured': True,
                'is_breaking': False
            },
            {
                'id': 2,
                'title': 'New FAA Regulations for Commercial Drone Operations',
                'excerpt': 'The Federal Aviation Administration has announced updated regulations that will affect commercial drone operators starting March 2024.',
                'content': 'The FAA has released new guidelines for commercial drone operations...',
                'category': 'regulation',
                'author': 'Regulatory Team',
                'author_avatar': '/avatars/regulatory.jpg',
                'published_at': '2024-01-08T14:30:00Z',
                'featured_image': '/news/faa-regulations.jpg',
                'tags': ['FAA', 'regulations', 'commercial-drones'],
                'read_time': 8,
                'view_count': 890,
                'share_count': 67,
                'is_featured': False,
                'is_breaking': True
            },
            {
                'id': 3,
                'title': 'Case Study: 500-Acre Agricultural Survey in 2 Hours',
                'excerpt': 'Learn how DroneStrike completed a comprehensive agricultural survey for a major farming operation using advanced mapping technology.',
                'content': 'This case study examines our recent project with AgriCorp...',
                'category': 'case_study',
                'author': 'Field Operations',
                'author_avatar': '/avatars/field-ops.jpg',
                'published_at': '2024-01-05T11:15:00Z',
                'featured_image': '/news/agricultural-survey.jpg',
                'tags': ['agriculture', 'mapping', 'case-study'],
                'read_time': 12,
                'view_count': 654,
                'share_count': 28,
                'is_featured': True,
                'is_breaking': False
            },
            {
                'id': 4,
                'title': 'Drone Technology Trends to Watch in 2024',
                'excerpt': 'Industry experts predict significant advances in battery technology, sensor capabilities, and autonomous flight systems.',
                'content': 'The drone industry continues to evolve rapidly...',
                'category': 'technology',
                'author': 'Tech Insights',
                'author_avatar': '/avatars/tech.jpg',
                'published_at': '2024-01-01T10:00:00Z',
                'featured_image': '/news/tech-trends-2024.jpg',
                'tags': ['technology', 'trends', '2024', 'innovation'],
                'read_time': 10,
                'view_count': 1420,
                'share_count': 89,
                'is_featured': False,
                'is_breaking': False
            }
        ]
    
    def _get_featured_articles(self) -> List[Dict[str, Any]]:
        """Get featured news articles."""
        all_articles = self._get_news_articles()
        return [article for article in all_articles if article.get('is_featured', False)]
    
    def _get_news_categories(self) -> List[Dict[str, Any]]:
        """Get news categories with article counts."""
        all_articles = self._get_news_articles()
        category_counts = {}
        
        for article in all_articles:
            category = article['category']
            category_counts[category] = category_counts.get(category, 0) + 1
        
        return [
            {'id': cat, 'name': cat.replace('_', ' ').title(), 'count': count}
            for cat, count in category_counts.items()
        ]
    
    def _get_recent_updates(self) -> List[Dict[str, Any]]:
        """Get recent platform updates."""
        return [
            {
                'id': 1,
                'title': 'Mobile App Update v2.1.0',
                'description': 'Bug fixes and performance improvements',
                'type': 'app_update',
                'date': '2024-01-12T16:00:00Z'
            },
            {
                'id': 2,
                'title': 'New Dashboard Analytics',
                'description': 'Enhanced reporting with real-time metrics',
                'type': 'feature',
                'date': '2024-01-10T10:30:00Z'
            },
            {
                'id': 3,
                'title': 'Scheduled Maintenance',
                'description': 'Platform maintenance on January 15, 2-4 AM EST',
                'type': 'maintenance',
                'date': '2024-01-08T09:00:00Z'
            }
        ]
    
    def _get_news_statistics(self) -> Dict[str, Any]:
        """Get news statistics."""
        all_articles = self._get_news_articles()
        
        total_views = sum(article['view_count'] for article in all_articles)
        total_shares = sum(article['share_count'] for article in all_articles)
        
        return {
            'total_articles': len(all_articles),
            'total_views': total_views,
            'total_shares': total_shares,
            'featured_articles': len([a for a in all_articles if a.get('is_featured', False)]),
            'breaking_news': len([a for a in all_articles if a.get('is_breaking', False)]),
            'most_popular_category': self._get_most_popular_category(all_articles)
        }
    
    def _format_news_article(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """Format news article for display."""
        return {
            'id': article['id'],
            'title': article['title'],
            'excerpt': article['excerpt'],
            'category': article['category'],
            'author': article['author'],
            'author_avatar': article.get('author_avatar'),
            'published_at': article['published_at'],
            'formatted_date': self._format_date(article['published_at']),
            'featured_image': article.get('featured_image'),
            'tags': article.get('tags', []),
            'read_time': article.get('read_time', 5),
            'view_count': article['view_count'],
            'share_count': article['share_count'],
            'is_featured': article.get('is_featured', False),
            'is_breaking': article.get('is_breaking', False),
            'is_recent': self._is_recent_article(article['published_at']),
            'share_urls': self._generate_article_share_urls(article)
        }
    
    def _apply_news_filters(self, filters: NewsFilterForm) -> List[Dict[str, Any]]:
        """Apply filters to news articles."""
        articles = self._get_news_articles()
        
        # Filter by category
        if filters.category:
            articles = [a for a in articles if a['category'] in filters.category]
        
        # Filter by date range
        if filters.date_from or filters.date_to:
            articles = self._filter_by_date_range(articles, filters.date_from, filters.date_to)
        
        # Filter by search query
        if filters.search_query:
            query = filters.search_query.lower()
            articles = [
                a for a in articles
                if query in a['title'].lower() or 
                   query in a['excerpt'].lower() or
                   any(query in tag.lower() for tag in a.get('tags', []))
            ]
        
        # Filter by tags
        if filters.tags:
            articles = [
                a for a in articles
                if any(tag in a.get('tags', []) for tag in filters.tags)
            ]
        
        return articles
    
    def _filter_by_date_range(self, articles: List[Dict[str, Any]], date_from: Optional[date], date_to: Optional[date]) -> List[Dict[str, Any]]:
        """Filter articles by date range."""
        filtered = []
        
        for article in articles:
            try:
                published_date = datetime.fromisoformat(article['published_at'].replace('Z', '+00:00')).date()
                
                if date_from and published_date < date_from:
                    continue
                
                if date_to and published_date > date_to:
                    continue
                
                filtered.append(article)
            except:
                continue
        
        return filtered
    
    def _format_date(self, date_string: str) -> str:
        """Format date for display."""
        try:
            date_obj = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
            return date_obj.strftime('%B %d, %Y')
        except:
            return date_string
    
    def _is_recent_article(self, published_at: str) -> bool:
        """Check if article is recent (within 7 days)."""
        try:
            published_date = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
            days_ago = (datetime.utcnow().replace(tzinfo=published_date.tzinfo) - published_date).days
            return days_ago <= 7
        except:
            return False
    
    def _get_most_popular_category(self, articles: List[Dict[str, Any]]) -> str:
        """Get most popular news category by views."""
        category_views = {}
        
        for article in articles:
            category = article['category']
            category_views[category] = category_views.get(category, 0) + article['view_count']
        
        return max(category_views.items(), key=lambda x: x[1])[0] if category_views else 'company'
    
    def _generate_article_share_urls(self, article: Dict[str, Any]) -> Dict[str, str]:
        """Generate share URLs for different platforms."""
        article_url = f"https://dronestrike.com/news/{article['id']}"
        title = article['title']
        
        return {
            'twitter': f"https://twitter.com/intent/tweet?url={article_url}&text={title}",
            'facebook': f"https://www.facebook.com/sharer/sharer.php?u={article_url}",
            'linkedin': f"https://www.linkedin.com/sharing/share-offsite/?url={article_url}",
            'email': f"mailto:?subject={title}&body=Check out this article: {article_url}"
        }
    
    def _get_article_by_id(self, article_id: int) -> Optional[Dict[str, Any]]:
        """Get article by ID."""
        articles = self._get_news_articles()
        return next((a for a in articles if a['id'] == article_id), None)
    
    def _generate_share_url(self, article: Dict[str, Any], platform: str) -> str:
        """Generate share URL for specific platform."""
        share_urls = self._generate_article_share_urls(article)
        return share_urls.get(platform, '')
    
    # Database simulation methods
    def _save_newsletter_subscription(self, subscription_data: Dict[str, Any]):
        """Save newsletter subscription."""
        # Save subscription to database
        pass
    
    def _log_article_share(self, article_id: int, platform: str):
        """Log article share activity."""
        # Log share activity for analytics
        pass