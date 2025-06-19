"""Mission management pages implementation."""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, validator, Field
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime, date
import json

from .base import BasePage, PageResponse
from models.mission import Mission
from models.property import Property
from services.mission_service import MissionService


class MissionSearchForm(BaseModel):
    """Mission search form validation."""
    location: Optional[str] = None
    property_type: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = []


class NewMissionForm(BaseModel):
    """New mission creation form validation."""
    # Step 1: Basic Information
    title: str
    description: str
    property_address: str
    property_type: str
    
    # Step 2: Mission Details
    mission_type: str
    scheduled_date: date
    estimated_duration: int  # in minutes
    special_instructions: Optional[str] = None
    
    # Step 3: Pricing
    base_price: float
    additional_services: Optional[List[Dict[str, Any]]] = []
    total_price: Optional[float] = None
    
    # Step 4: Contact Information
    client_name: str
    client_email: str
    client_phone: str
    preferred_contact_method: str
    
    # Step 5: Documentation
    required_documents: Optional[List[str]] = []
    deliverables: Optional[List[str]] = []
    
    @validator('title', 'description', 'property_address', 'client_name')
    def required_fields_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()
    
    @validator('base_price')
    def price_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Price must be greater than zero')
        return v
    
    @validator('estimated_duration')
    def duration_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Duration must be greater than zero')
        return v
    
    @validator('scheduled_date')
    def date_must_be_future(cls, v):
        if v <= date.today():
            raise ValueError('Scheduled date must be in the future')
        return v


class MissionUpdateForm(BaseModel):
    """Mission update form validation."""
    status: Optional[str] = None
    notes: Optional[str] = None
    actual_duration: Optional[int] = None
    completion_photos: Optional[List[str]] = []
    client_feedback: Optional[str] = None
    internal_notes: Optional[str] = None


class SearchMissionsPage(BasePage):
    """Search missions page implementation."""
    
    def __init__(self, db: Session, request: Request, current_user: Optional[Dict] = None):
        super().__init__(db, request, current_user)
        self.mission_service = MissionService(db)
    
    def get_page_data(self) -> PageResponse:
        """Get search missions page data."""
        try:
            # Get filter options
            property_types = self.mission_service.get_available_property_types()
            mission_statuses = self.mission_service.get_available_statuses()
            
            # Get recent missions for display
            recent_missions = self.mission_service.get_recent_missions(limit=20)
            
            return self.create_response(data={
                'title': 'Search Missions - DroneStrike',
                'filter_options': {
                    'property_types': property_types,
                    'statuses': mission_statuses
                },
                'recent_missions': [self._format_mission_for_display(m) for m in recent_missions],
                'search_form': {
                    'location': '',
                    'property_type': '',
                    'date_from': '',
                    'date_to': '',
                    'price_min': '',
                    'price_max': '',
                    'status': '',
                    'tags': []
                }
            })
            
        except Exception as e:
            self.add_error('Failed to load page data')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle mission search form submission."""
        # Validate search form
        search_form = self.validate_form_data(MissionSearchForm, form_data)
        if not search_form:
            return self.create_response(success=False)
        
        try:
            # Perform search
            search_results = self.mission_service.search_missions(
                location=search_form.location,
                property_type=search_form.property_type,
                date_from=search_form.date_from,
                date_to=search_form.date_to,
                price_min=search_form.price_min,
                price_max=search_form.price_max,
                status=search_form.status,
                tags=search_form.tags
            )
            
            return self.create_response(
                success=True,
                data={
                    'search_results': [self._format_mission_for_display(m) for m in search_results],
                    'total_results': len(search_results)
                }
            )
            
        except Exception as e:
            self.add_error('Search failed. Please try again.')
            return self.create_response(success=False)
    
    def _format_mission_for_display(self, mission: Mission) -> Dict[str, Any]:
        """Format mission data for display."""
        return {
            'id': mission.id,
            'title': mission.title,
            'description': mission.description[:200] + '...' if len(mission.description) > 200 else mission.description,
            'property_address': mission.property_address,
            'property_type': mission.property_type,
            'mission_type': mission.mission_type,
            'scheduled_date': mission.scheduled_date.isoformat() if mission.scheduled_date else None,
            'base_price': float(mission.base_price) if mission.base_price else 0,
            'status': mission.status,
            'created_at': mission.created_at.isoformat() if mission.created_at else None,
            'client_name': mission.client_name
        }


class MyMissionsPage(BasePage):
    """My missions page implementation."""
    
    def __init__(self, db: Session, request: Request, current_user: Optional[Dict] = None):
        super().__init__(db, request, current_user)
        self.mission_service = MissionService(db)
    
    def get_page_data(self) -> PageResponse:
        """Get my missions page data."""
        self.require_authentication()
        
        try:
            # Get user's missions
            user_missions = self.mission_service.get_user_missions(self.current_user['id'])
            
            # Group by status
            missions_by_status = {
                'pending': [],
                'scheduled': [],
                'in_progress': [],
                'completed': [],
                'cancelled': []
            }
            
            for mission in user_missions:
                status = mission.status.lower()
                if status in missions_by_status:
                    missions_by_status[status].append(self._format_mission_for_display(mission))
            
            # Get statistics
            stats = {
                'total_missions': len(user_missions),
                'completed_missions': len(missions_by_status['completed']),
                'pending_missions': len(missions_by_status['pending']),
                'total_revenue': sum(float(m.total_price or 0) for m in user_missions if m.status == 'completed')
            }
            
            return self.create_response(data={
                'title': 'My Missions - DroneStrike',
                'missions_by_status': missions_by_status,
                'statistics': stats,
                'recent_activity': self._get_recent_activity()
            })
            
        except Exception as e:
            self.add_error('Failed to load missions')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle mission update form submission."""
        self.require_authentication()
        
        mission_id = form_data.get('mission_id')
        if not mission_id:
            self.add_error('Mission ID is required')
            return self.create_response(success=False)
        
        # Validate update form
        update_form = self.validate_form_data(MissionUpdateForm, form_data)
        if not update_form:
            return self.create_response(success=False)
        
        try:
            # Update mission
            mission = self.mission_service.update_mission(
                mission_id, 
                self.current_user['id'],
                update_form.dict(exclude_unset=True)
            )
            
            if mission:
                # Log activity
                self.log_activity('mission_updated', {
                    'mission_id': mission_id,
                    'updates': update_form.dict(exclude_unset=True)
                })
                
                return self.create_response(
                    success=True,
                    data={'mission': self._format_mission_for_display(mission)},
                    message='Mission updated successfully'
                )
            else:
                self.add_error('Failed to update mission')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('An error occurred while updating the mission')
            return self.create_response(success=False)
    
    def _get_recent_activity(self) -> List[Dict[str, Any]]:
        """Get recent activity for the user."""
        # Implement recent activity logic
        return []
    
    def _format_mission_for_display(self, mission: Mission) -> Dict[str, Any]:
        """Format mission data for display."""
        return {
            'id': mission.id,
            'title': mission.title,
            'description': mission.description,
            'property_address': mission.property_address,
            'property_type': mission.property_type,
            'mission_type': mission.mission_type,
            'scheduled_date': mission.scheduled_date.isoformat() if mission.scheduled_date else None,
            'base_price': float(mission.base_price) if mission.base_price else 0,
            'total_price': float(mission.total_price) if mission.total_price else 0,
            'status': mission.status,
            'created_at': mission.created_at.isoformat() if mission.created_at else None,
            'client_name': mission.client_name,
            'client_email': mission.client_email,
            'client_phone': mission.client_phone,
            'estimated_duration': mission.estimated_duration,
            'actual_duration': mission.actual_duration,
            'special_instructions': mission.special_instructions,
            'required_documents': mission.required_documents,
            'deliverables': mission.deliverables
        }


class NewMissionPage(BasePage):
    """New mission creation page implementation."""
    
    def __init__(self, db: Session, request: Request, current_user: Optional[Dict] = None):
        super().__init__(db, request, current_user)
        self.mission_service = MissionService(db)
    
    def get_page_data(self) -> PageResponse:
        """Get new mission page data."""
        self.require_authentication()
        
        try:
            # Get form options
            property_types = self.mission_service.get_available_property_types()
            mission_types = self.mission_service.get_available_mission_types()
            service_options = self.mission_service.get_additional_services()
            
            return self.create_response(data={
                'title': 'Create New Mission - DroneStrike',
                'form_options': {
                    'property_types': property_types,
                    'mission_types': mission_types,
                    'service_options': service_options,
                    'contact_methods': ['email', 'phone', 'sms']
                },
                'form_steps': [
                    'Basic Information',
                    'Mission Details',
                    'Pricing',
                    'Contact Information',
                    'Documentation',
                    'Review & Submit'
                ],
                'current_step': 1
            })
            
        except Exception as e:
            self.add_error('Failed to load page data')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle new mission form submission."""
        self.require_authentication()
        
        # Check if this is a step validation or final submission
        step = form_data.get('step', 'final')
        
        if step != 'final':
            return self._validate_step(step, form_data)
        
        # Validate complete form
        mission_form = self.validate_form_data(NewMissionForm, form_data)
        if not mission_form:
            return self.create_response(success=False)
        
        try:
            # Calculate total price
            total_price = mission_form.base_price
            if mission_form.additional_services:
                for service in mission_form.additional_services:
                    total_price += service.get('price', 0)
            
            # Create mission data
            mission_data = mission_form.dict()
            mission_data['total_price'] = total_price
            mission_data['user_id'] = self.current_user['id']
            mission_data['status'] = 'pending'
            
            # Create mission
            new_mission = self.mission_service.create_mission(mission_data)
            
            if new_mission:
                # Send confirmation email to client
                self.send_email(
                    to=mission_form.client_email,
                    subject=f'Mission Scheduled: {mission_form.title}',
                    body=self._generate_mission_confirmation_email(new_mission),
                    html=True
                )
                
                # Send SMS if phone provided
                if mission_form.client_phone:
                    self.send_sms(
                        phone=mission_form.client_phone,
                        message=f'Your drone mission "{mission_form.title}" has been scheduled for {mission_form.scheduled_date}. We\'ll contact you soon!'
                    )
                
                # Log mission creation
                self.log_activity('mission_created', {
                    'mission_id': new_mission.id,
                    'title': mission_form.title
                })
                
                return self.create_response(
                    success=True,
                    data={
                        'mission': self._format_mission_for_display(new_mission),
                        'confirmation_number': f'DS-{new_mission.id:06d}'
                    },
                    redirect=f'/missions/{new_mission.id}',
                    message='Mission created successfully!'
                )
            else:
                self.add_error('Failed to create mission')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('An error occurred while creating the mission')
            return self.create_response(success=False)
    
    def _validate_step(self, step: str, form_data: Dict[str, Any]) -> PageResponse:
        """Validate individual form step."""
        step_validators = {
            '1': self._validate_basic_info,
            '2': self._validate_mission_details,
            '3': self._validate_pricing,
            '4': self._validate_contact_info,
            '5': self._validate_documentation
        }
        
        validator = step_validators.get(step)
        if validator:
            return validator(form_data)
        
        return self.create_response(success=True)
    
    def _validate_basic_info(self, form_data: Dict[str, Any]) -> PageResponse:
        """Validate basic information step."""
        required_fields = ['title', 'description', 'property_address', 'property_type']
        for field in required_fields:
            if not form_data.get(field, '').strip():
                self.add_error(f'{field.replace("_", " ").title()} is required')
        
        return self.create_response(success=len(self.errors) == 0)
    
    def _validate_mission_details(self, form_data: Dict[str, Any]) -> PageResponse:
        """Validate mission details step."""
        required_fields = ['mission_type', 'scheduled_date', 'estimated_duration']
        for field in required_fields:
            if not form_data.get(field):
                self.add_error(f'{field.replace("_", " ").title()} is required')
        
        # Validate date is in future
        if form_data.get('scheduled_date'):
            try:
                scheduled_date = datetime.strptime(form_data['scheduled_date'], '%Y-%m-%d').date()
                if scheduled_date <= date.today():
                    self.add_error('Scheduled date must be in the future')
            except ValueError:
                self.add_error('Invalid date format')
        
        return self.create_response(success=len(self.errors) == 0)
    
    def _validate_pricing(self, form_data: Dict[str, Any]) -> PageResponse:
        """Validate pricing step."""
        if not form_data.get('base_price') or float(form_data['base_price']) <= 0:
            self.add_error('Base price must be greater than zero')
        
        return self.create_response(success=len(self.errors) == 0)
    
    def _validate_contact_info(self, form_data: Dict[str, Any]) -> PageResponse:
        """Validate contact information step."""
        required_fields = ['client_name', 'client_email', 'client_phone', 'preferred_contact_method']
        for field in required_fields:
            if not form_data.get(field, '').strip():
                self.add_error(f'{field.replace("_", " ").title()} is required')
        
        return self.create_response(success=len(self.errors) == 0)
    
    def _validate_documentation(self, form_data: Dict[str, Any]) -> PageResponse:
        """Validate documentation step."""
        # Documentation is optional, always pass
        return self.create_response(success=True)
    
    def _generate_mission_confirmation_email(self, mission: Mission) -> str:
        """Generate mission confirmation email content."""
        return f"""
        <h2>Mission Confirmation</h2>
        <p>Dear {mission.client_name},</p>
        <p>Your drone mission has been scheduled successfully!</p>
        
        <h3>Mission Details:</h3>
        <ul>
            <li><strong>Title:</strong> {mission.title}</li>
            <li><strong>Date:</strong> {mission.scheduled_date}</li>
            <li><strong>Location:</strong> {mission.property_address}</li>
            <li><strong>Duration:</strong> {mission.estimated_duration} minutes</li>
            <li><strong>Total Price:</strong> ${mission.total_price}</li>
        </ul>
        
        <p>We will contact you closer to the scheduled date to confirm details.</p>
        <p>Confirmation Number: DS-{mission.id:06d}</p>
        
        <p>Thank you for choosing DroneStrike!</p>
        """
    
    def _format_mission_for_display(self, mission: Mission) -> Dict[str, Any]:
        """Format mission data for display."""
        return {
            'id': mission.id,
            'title': mission.title,
            'description': mission.description,
            'property_address': mission.property_address,
            'property_type': mission.property_type,
            'mission_type': mission.mission_type,
            'scheduled_date': mission.scheduled_date.isoformat() if mission.scheduled_date else None,
            'base_price': float(mission.base_price) if mission.base_price else 0,
            'total_price': float(mission.total_price) if mission.total_price else 0,
            'status': mission.status,
            'client_name': mission.client_name,
            'client_email': mission.client_email,
            'client_phone': mission.client_phone
        }