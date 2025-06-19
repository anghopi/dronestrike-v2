"""Business opportunities management page implementation."""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, validator, EmailStr
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime, date
from enum import Enum

from .base import BasePage, PageResponse
from models.opportunity import Opportunity


class OpportunityStatus(str, Enum):
    """Opportunity status enumeration."""
    LEAD = "lead"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class OpportunitySource(str, Enum):
    """Opportunity source enumeration."""
    WEBSITE = "website"
    REFERRAL = "referral"
    COLD_CALL = "cold_call"
    SOCIAL_MEDIA = "social_media"
    TRADE_SHOW = "trade_show"
    PARTNER = "partner"
    OTHER = "other"


class OpportunityForm(BaseModel):
    """Opportunity creation/update form validation."""
    title: str
    description: Optional[str] = None
    company_name: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    value: float
    probability: int = 50  # percentage
    expected_close_date: date
    status: OpportunityStatus = OpportunityStatus.LEAD
    source: OpportunitySource
    tags: Optional[List[str]] = []
    notes: Optional[str] = None
    
    @validator('title', 'company_name', 'contact_name')
    def required_fields_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()
    
    @validator('value')
    def value_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Opportunity value must be greater than zero')
        return v
    
    @validator('probability')
    def probability_range(cls, v):
        if v < 0 or v > 100:
            raise ValueError('Probability must be between 0 and 100')
        return v
    
    @validator('expected_close_date')
    def close_date_validation(cls, v):
        if v < date.today():
            raise ValueError('Expected close date cannot be in the past')
        return v


class OpportunityUpdateForm(BaseModel):
    """Opportunity update form validation."""
    status: Optional[OpportunityStatus] = None
    probability: Optional[int] = None
    value: Optional[float] = None
    expected_close_date: Optional[date] = None
    notes: Optional[str] = None
    interaction_notes: Optional[str] = None
    
    @validator('probability')
    def probability_range(cls, v):
        if v is not None and (v < 0 or v > 100):
            raise ValueError('Probability must be between 0 and 100')
        return v
    
    @validator('value')
    def value_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Opportunity value must be greater than zero')
        return v


class OpportunityFilterForm(BaseModel):
    """Opportunity filtering form validation."""
    status: Optional[List[OpportunityStatus]] = None
    source: Optional[List[OpportunitySource]] = None
    value_min: Optional[float] = None
    value_max: Optional[float] = None
    probability_min: Optional[int] = None
    probability_max: Optional[int] = None
    close_date_from: Optional[date] = None
    close_date_to: Optional[date] = None
    tags: Optional[List[str]] = None
    search_query: Optional[str] = None


class ActivityForm(BaseModel):
    """Activity logging form validation."""
    opportunity_id: int
    activity_type: str
    subject: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completed: bool = False
    
    @validator('subject')
    def subject_required(cls, v):
        if not v or not v.strip():
            raise ValueError('Subject is required')
        return v.strip()


class OpportunitiesPage(BasePage):
    """Business opportunities management page."""
    
    def get_page_data(self) -> PageResponse:
        """Get opportunities page data."""
        self.require_authentication()
        
        try:
            # Get opportunities with filters
            opportunities = self._get_user_opportunities()
            
            # Get pipeline statistics
            pipeline_stats = self._calculate_pipeline_stats(opportunities)
            
            # Get recent activities
            recent_activities = self._get_recent_activities()
            
            # Get filter options
            filter_options = self._get_filter_options()
            
            return self.create_response(data={
                'title': 'Business Opportunities - DroneStrike',
                'opportunities': [self._format_opportunity_for_display(opp) for opp in opportunities],
                'pipeline_stats': pipeline_stats,
                'recent_activities': recent_activities,
                'filter_options': filter_options,
                'status_colors': {
                    'lead': '#6B7280',
                    'qualified': '#3B82F6',
                    'proposal': '#F59E0B',
                    'negotiation': '#8B5CF6',
                    'closed_won': '#10B981',
                    'closed_lost': '#EF4444'
                },
                'activity_types': [
                    'call', 'email', 'meeting', 'demo', 'proposal', 'follow_up', 'other'
                ]
            })
            
        except Exception as e:
            self.add_error('Failed to load opportunities')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle opportunities form submissions."""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'create_opportunity':
            return self._create_opportunity(form_data)
        elif action == 'update_opportunity':
            return self._update_opportunity(form_data)
        elif action == 'delete_opportunity':
            return self._delete_opportunity(form_data)
        elif action == 'log_activity':
            return self._log_opportunity_activity(form_data)
        elif action == 'filter_opportunities':
            return self._filter_opportunities(form_data)
        elif action == 'export_opportunities':
            return self._export_opportunities(form_data)
        elif action == 'send_proposal':
            return self._send_proposal(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _create_opportunity(self, form_data: Dict[str, Any]) -> PageResponse:
        """Create a new opportunity."""
        opportunity_form = self.validate_form_data(OpportunityForm, form_data)
        if not opportunity_form:
            return self.create_response(success=False)
        
        try:
            # Create opportunity data
            opportunity_data = opportunity_form.dict()
            opportunity_data['user_id'] = self.current_user['id']
            opportunity_data['created_at'] = datetime.utcnow()
            
            # Create opportunity in database
            new_opportunity = self._save_opportunity(opportunity_data)
            
            # Send notification email to contact
            self.send_email(
                to=opportunity_form.contact_email,
                subject=f'Thank you for your interest - {opportunity_form.title}',
                body=self._generate_opportunity_email(new_opportunity),
                html=True
            )
            
            # Log activity
            self.log_activity('opportunity_created', {
                'opportunity_id': new_opportunity['id'],
                'title': opportunity_form.title,
                'value': opportunity_form.value
            })
            
            return self.create_response(
                success=True,
                data={'opportunity': self._format_opportunity_for_display(new_opportunity)},
                message='Opportunity created successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to create opportunity')
            return self.create_response(success=False)
    
    def _update_opportunity(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update an existing opportunity."""
        opportunity_id = form_data.get('opportunity_id')
        if not opportunity_id:
            self.add_error('Opportunity ID is required')
            return self.create_response(success=False)
        
        update_form = self.validate_form_data(OpportunityUpdateForm, form_data)
        if not update_form:
            return self.create_response(success=False)
        
        try:
            # Update opportunity
            updates = update_form.dict(exclude_unset=True)
            updates['updated_at'] = datetime.utcnow()
            updates['updated_by'] = self.current_user['id']
            
            updated_opportunity = self._update_opportunity_data(opportunity_id, updates)
            
            # Log status change if status was updated
            if 'status' in updates:
                self._log_status_change(opportunity_id, updates['status'])
            
            # Log activity
            self.log_activity('opportunity_updated', {
                'opportunity_id': opportunity_id,
                'updates': updates
            })
            
            return self.create_response(
                success=True,
                data={'opportunity': self._format_opportunity_for_display(updated_opportunity)},
                message='Opportunity updated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to update opportunity')
            return self.create_response(success=False)
    
    def _delete_opportunity(self, form_data: Dict[str, Any]) -> PageResponse:
        """Delete an opportunity."""
        opportunity_id = form_data.get('opportunity_id')
        if not opportunity_id:
            self.add_error('Opportunity ID is required')
            return self.create_response(success=False)
        
        try:
            # Soft delete opportunity
            self._soft_delete_opportunity(opportunity_id)
            
            # Log activity
            self.log_activity('opportunity_deleted', {
                'opportunity_id': opportunity_id
            })
            
            return self.create_response(
                success=True,
                data={'opportunity_id': opportunity_id},
                message='Opportunity deleted successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to delete opportunity')
            return self.create_response(success=False)
    
    def _log_opportunity_activity(self, form_data: Dict[str, Any]) -> PageResponse:
        """Log activity for an opportunity."""
        activity_form = self.validate_form_data(ActivityForm, form_data)
        if not activity_form:
            return self.create_response(success=False)
        
        try:
            # Create activity record
            activity_data = activity_form.dict()
            activity_data['user_id'] = self.current_user['id']
            activity_data['created_at'] = datetime.utcnow()
            
            new_activity = self._save_activity(activity_data)
            
            # Update opportunity last contact date
            self._update_opportunity_last_contact(activity_form.opportunity_id)
            
            # Log activity
            self.log_activity('opportunity_activity_logged', {
                'opportunity_id': activity_form.opportunity_id,
                'activity_type': activity_form.activity_type,
                'subject': activity_form.subject
            })
            
            return self.create_response(
                success=True,
                data={'activity': new_activity},
                message='Activity logged successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to log activity')
            return self.create_response(success=False)
    
    def _filter_opportunities(self, form_data: Dict[str, Any]) -> PageResponse:
        """Filter opportunities based on criteria."""
        filter_form = self.validate_form_data(OpportunityFilterForm, form_data)
        if not filter_form:
            return self.create_response(success=False)
        
        try:
            # Apply filters
            filtered_opportunities = self._apply_opportunity_filters(filter_form)
            
            return self.create_response(
                success=True,
                data={
                    'opportunities': [self._format_opportunity_for_display(opp) for opp in filtered_opportunities],
                    'total_count': len(filtered_opportunities)
                }
            )
            
        except Exception as e:
            self.add_error('Failed to filter opportunities')
            return self.create_response(success=False)
    
    def _export_opportunities(self, form_data: Dict[str, Any]) -> PageResponse:
        """Export opportunities to CSV/Excel."""
        export_format = form_data.get('format', 'csv')
        opportunity_ids = form_data.get('opportunity_ids', [])
        
        try:
            # Generate export file
            if export_format == 'csv':
                file_path = self._generate_opportunities_csv(opportunity_ids)
            elif export_format == 'excel':
                file_path = self._generate_opportunities_excel(opportunity_ids)
            else:
                self.add_error('Invalid export format')
                return self.create_response(success=False)
            
            # Log export
            self.log_activity('opportunities_exported', {
                'format': export_format,
                'count': len(opportunity_ids) if opportunity_ids else 'all'
            })
            
            return self.create_response(
                success=True,
                data={'download_url': file_path},
                message='Export generated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to export opportunities')
            return self.create_response(success=False)
    
    def _send_proposal(self, form_data: Dict[str, Any]) -> PageResponse:
        """Send proposal to opportunity contact."""
        opportunity_id = form_data.get('opportunity_id')
        proposal_template = form_data.get('template', 'standard')
        custom_message = form_data.get('message', '')
        
        if not opportunity_id:
            self.add_error('Opportunity ID is required')
            return self.create_response(success=False)
        
        try:
            # Get opportunity details
            opportunity = self._get_opportunity_by_id(opportunity_id)
            if not opportunity:
                self.add_error('Opportunity not found')
                return self.create_response(success=False)
            
            # Generate proposal document
            proposal_doc = self._generate_proposal_document(opportunity, proposal_template)
            
            # Send proposal email
            self.send_email(
                to=opportunity['contact_email'],
                subject=f'Proposal for {opportunity["title"]} - DroneStrike',
                body=self._generate_proposal_email(opportunity, custom_message),
                html=True
                # In real implementation, attach proposal_doc
            )
            
            # Update opportunity status
            self._update_opportunity_data(opportunity_id, {
                'status': OpportunityStatus.PROPOSAL,
                'updated_at': datetime.utcnow()
            })
            
            # Log activity
            self._save_activity({
                'opportunity_id': opportunity_id,
                'activity_type': 'proposal',
                'subject': 'Proposal sent',
                'description': f'Sent {proposal_template} proposal template',
                'user_id': self.current_user['id'],
                'created_at': datetime.utcnow(),
                'completed': True
            })
            
            return self.create_response(
                success=True,
                data={'proposal_doc': proposal_doc},
                message='Proposal sent successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to send proposal')
            return self.create_response(success=False)
    
    def _get_user_opportunities(self) -> List[Dict[str, Any]]:
        """Get opportunities for the current user."""
        # In real implementation, query from database
        return [
            {
                'id': 1,
                'title': 'Real Estate Photography Package',
                'description': 'Aerial photography for luxury home listing',
                'company_name': 'Premier Realty',
                'contact_name': 'Sarah Johnson',
                'contact_email': 'sarah@premierrealty.com',
                'contact_phone': '+1-555-0123',
                'value': 2500.00,
                'probability': 75,
                'expected_close_date': '2024-02-15',
                'status': 'proposal',
                'source': 'website',
                'tags': ['real-estate', 'photography'],
                'created_at': '2024-01-05T10:00:00Z',
                'last_contact': '2024-01-10T14:30:00Z'
            },
            {
                'id': 2,
                'title': 'Construction Site Survey',
                'description': 'Weekly progress monitoring for new development',
                'company_name': 'BuildCorp Construction',
                'contact_name': 'Mike Thompson',
                'contact_email': 'mike@buildcorp.com',
                'contact_phone': '+1-555-0456',
                'value': 8000.00,
                'probability': 50,
                'expected_close_date': '2024-02-28',
                'status': 'qualified',
                'source': 'referral',
                'tags': ['construction', 'survey', 'recurring'],
                'created_at': '2024-01-08T09:15:00Z',
                'last_contact': '2024-01-12T11:00:00Z'
            }
        ]
    
    def _calculate_pipeline_stats(self, opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate pipeline statistics."""
        total_value = sum(opp['value'] for opp in opportunities)
        weighted_value = sum(opp['value'] * (opp['probability'] / 100) for opp in opportunities)
        
        status_counts = {}
        status_values = {}
        
        for opp in opportunities:
            status = opp['status']
            status_counts[status] = status_counts.get(status, 0) + 1
            status_values[status] = status_values.get(status, 0) + opp['value']
        
        return {
            'total_opportunities': len(opportunities),
            'total_value': total_value,
            'weighted_value': weighted_value,
            'average_deal_size': total_value / len(opportunities) if opportunities else 0,
            'status_counts': status_counts,
            'status_values': status_values,
            'conversion_rate': self._calculate_conversion_rate(opportunities)
        }
    
    def _calculate_conversion_rate(self, opportunities: List[Dict[str, Any]]) -> float:
        """Calculate win rate conversion."""
        closed_won = len([opp for opp in opportunities if opp['status'] == 'closed_won'])
        closed_total = len([opp for opp in opportunities if opp['status'] in ['closed_won', 'closed_lost']])
        
        return (closed_won / closed_total * 100) if closed_total > 0 else 0
    
    def _get_recent_activities(self) -> List[Dict[str, Any]]:
        """Get recent opportunity activities."""
        return [
            {
                'id': 1,
                'opportunity_id': 1,
                'opportunity_title': 'Real Estate Photography Package',
                'activity_type': 'call',
                'subject': 'Follow-up call with client',
                'description': 'Discussed project requirements and timeline',
                'user_name': 'John Doe',
                'created_at': '2024-01-10T14:30:00Z',
                'completed': True
            },
            {
                'id': 2,
                'opportunity_id': 2,
                'opportunity_title': 'Construction Site Survey',
                'activity_type': 'email',
                'subject': 'Sent project proposal',
                'description': 'Comprehensive proposal with pricing and timeline',
                'user_name': 'John Doe',
                'created_at': '2024-01-12T11:00:00Z',
                'completed': True
            }
        ]
    
    def _get_filter_options(self) -> Dict[str, List[str]]:
        """Get filter options for the UI."""
        return {
            'statuses': [status.value for status in OpportunityStatus],
            'sources': [source.value for source in OpportunitySource],
            'tags': ['real-estate', 'construction', 'photography', 'survey', 'recurring', 'commercial', 'residential']
        }
    
    def _format_opportunity_for_display(self, opportunity: Dict[str, Any]) -> Dict[str, Any]:
        """Format opportunity data for display."""
        return {
            'id': opportunity['id'],
            'title': opportunity['title'],
            'description': opportunity.get('description', ''),
            'company_name': opportunity['company_name'],
            'contact_name': opportunity['contact_name'],
            'contact_email': opportunity['contact_email'],
            'contact_phone': opportunity.get('contact_phone', ''),
            'value': float(opportunity['value']),
            'probability': opportunity['probability'],
            'weighted_value': float(opportunity['value']) * (opportunity['probability'] / 100),
            'expected_close_date': opportunity['expected_close_date'],
            'status': opportunity['status'],
            'source': opportunity['source'],
            'tags': opportunity.get('tags', []),
            'created_at': opportunity.get('created_at'),
            'last_contact': opportunity.get('last_contact'),
            'days_since_contact': self._calculate_days_since_contact(opportunity.get('last_contact'))
        }
    
    def _calculate_days_since_contact(self, last_contact: Optional[str]) -> Optional[int]:
        """Calculate days since last contact."""
        if not last_contact:
            return None
        
        try:
            last_contact_date = datetime.fromisoformat(last_contact.replace('Z', '+00:00'))
            return (datetime.utcnow().replace(tzinfo=last_contact_date.tzinfo) - last_contact_date).days
        except:
            return None
    
    # Database simulation methods (replace with actual database operations)
    def _save_opportunity(self, opportunity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save opportunity to database."""
        opportunity_data['id'] = self._generate_opportunity_id()
        return opportunity_data
    
    def _update_opportunity_data(self, opportunity_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update opportunity in database."""
        # Simulate database update
        opportunity = self._get_opportunity_by_id(opportunity_id)
        opportunity.update(updates)
        return opportunity
    
    def _get_opportunity_by_id(self, opportunity_id: int) -> Optional[Dict[str, Any]]:
        """Get opportunity by ID."""
        opportunities = self._get_user_opportunities()
        return next((opp for opp in opportunities if opp['id'] == opportunity_id), None)
    
    def _generate_opportunity_id(self) -> int:
        """Generate new opportunity ID."""
        import random
        return random.randint(1000, 9999)
    
    def _generate_opportunity_email(self, opportunity: Dict[str, Any]) -> str:
        """Generate opportunity confirmation email."""
        return f"""
        <h2>Thank you for your interest!</h2>
        <p>Dear {opportunity['contact_name']},</p>
        <p>Thank you for considering DroneStrike for your {opportunity['title']} project.</p>
        <p>We will review your requirements and get back to you within 24 hours with a detailed proposal.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>The DroneStrike Team</p>
        """
    
    def _generate_proposal_email(self, opportunity: Dict[str, Any], custom_message: str) -> str:
        """Generate proposal email."""
        return f"""
        <h2>Proposal for {opportunity['title']}</h2>
        <p>Dear {opportunity['contact_name']},</p>
        <p>Please find attached our proposal for your {opportunity['title']} project.</p>
        {f'<p>{custom_message}</p>' if custom_message else ''}
        <p>We look forward to working with you!</p>
        <p>Best regards,<br>The DroneStrike Team</p>
        """
    
    def _apply_opportunity_filters(self, filters: OpportunityFilterForm) -> List[Dict[str, Any]]:
        """Apply filters to opportunities."""
        opportunities = self._get_user_opportunities()
        
        # Apply status filter
        if filters.status:
            opportunities = [opp for opp in opportunities if opp['status'] in filters.status]
        
        # Apply source filter
        if filters.source:
            opportunities = [opp for opp in opportunities if opp['source'] in filters.source]
        
        # Apply value filters
        if filters.value_min:
            opportunities = [opp for opp in opportunities if opp['value'] >= filters.value_min]
        
        if filters.value_max:
            opportunities = [opp for opp in opportunities if opp['value'] <= filters.value_max]
        
        # Apply probability filters
        if filters.probability_min:
            opportunities = [opp for opp in opportunities if opp['probability'] >= filters.probability_min]
        
        if filters.probability_max:
            opportunities = [opp for opp in opportunities if opp['probability'] <= filters.probability_max]
        
        # Apply search query
        if filters.search_query:
            query = filters.search_query.lower()
            opportunities = [
                opp for opp in opportunities
                if query in opp['title'].lower() or 
                   query in opp['company_name'].lower() or
                   query in opp['contact_name'].lower()
            ]
        
        return opportunities
    
    def _generate_opportunities_csv(self, opportunity_ids: List[int]) -> str:
        """Generate CSV export."""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'ID', 'Title', 'Company', 'Contact', 'Email', 'Value', 'Probability', 
            'Status', 'Source', 'Expected Close', 'Created'
        ])
        
        # Write data
        opportunities = self._get_user_opportunities()
        for opp in opportunities:
            if not opportunity_ids or opp['id'] in opportunity_ids:
                writer.writerow([
                    opp['id'], opp['title'], opp['company_name'], opp['contact_name'],
                    opp['contact_email'], opp['value'], f"{opp['probability']}%",
                    opp['status'], opp['source'], opp['expected_close_date'], opp['created_at']
                ])
        
        # Save to file
        filename = f"opportunities_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        file_path = f"/tmp/{filename}"
        
        with open(file_path, 'w') as f:
            f.write(output.getvalue())
        
        return file_path
    
    def _generate_opportunities_excel(self, opportunity_ids: List[int]) -> str:
        """Generate Excel export."""
        # For now, return CSV
        return self._generate_opportunities_csv(opportunity_ids)
    
    def _save_activity(self, activity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save activity to database."""
        activity_data['id'] = self._generate_activity_id()
        return activity_data
    
    def _generate_activity_id(self) -> int:
        """Generate activity ID."""
        import random
        return random.randint(10000, 99999)
    
    def _update_opportunity_last_contact(self, opportunity_id: int):
        """Update opportunity last contact date."""
        self._update_opportunity_data(opportunity_id, {
            'last_contact': datetime.utcnow().isoformat() + 'Z'
        })
    
    def _log_status_change(self, opportunity_id: int, new_status: str):
        """Log status change activity."""
        self._save_activity({
            'opportunity_id': opportunity_id,
            'activity_type': 'status_change',
            'subject': f'Status changed to {new_status}',
            'description': f'Opportunity status updated to {new_status}',
            'user_id': self.current_user['id'],
            'created_at': datetime.utcnow(),
            'completed': True
        })
    
    def _soft_delete_opportunity(self, opportunity_id: int):
        """Soft delete opportunity."""
        self._update_opportunity_data(opportunity_id, {
            'deleted_at': datetime.utcnow(),
            'deleted_by': self.current_user['id']
        })
    
    def _generate_proposal_document(self, opportunity: Dict[str, Any], template: str) -> str:
        """Generate proposal document."""
        # In real implementation, generate PDF proposal
        return f"proposal_{opportunity['id']}_{datetime.now().strftime('%Y%m%d')}.pdf"