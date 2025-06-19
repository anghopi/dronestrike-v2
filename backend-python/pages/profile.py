"""User profile and billing management pages implementation."""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, validator, EmailStr
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime, date
from enum import Enum
import re

from .base import BasePage, PageResponse


class PaymentMethod(str, Enum):
    """Payment method enumeration."""
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_ACCOUNT = "bank_account"
    PAYPAL = "paypal"
    STRIPE = "stripe"


class BillingCycle(str, Enum):
    """Billing cycle enumeration."""
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class NotificationPreference(str, Enum):
    """Notification preference enumeration."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    NONE = "none"


class ProfileForm(BaseModel):
    """User profile form validation."""
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = 'en'
    bio: Optional[str] = None
    website: Optional[str] = None
    
    @validator('first_name', 'last_name')
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()
    
    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?1?\d{9,15}$', v):
            raise ValueError('Invalid phone number format')
        return v
    
    @validator('website')
    def validate_website(cls, v):
        if v and not re.match(r'^https?://', v):
            v = f'https://{v}'
        return v


class PasswordUpdateForm(BaseModel):
    """Password update form validation."""
    current_password: str
    new_password: str
    confirm_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v


class NotificationSettingsForm(BaseModel):
    """Notification settings form validation."""
    email_notifications: bool = True
    sms_notifications: bool = False
    push_notifications: bool = True
    mission_updates: NotificationPreference = NotificationPreference.EMAIL
    payment_reminders: NotificationPreference = NotificationPreference.EMAIL
    marketing_emails: bool = True
    system_alerts: NotificationPreference = NotificationPreference.EMAIL
    weekly_reports: bool = True


class PaymentMethodForm(BaseModel):
    """Payment method form validation."""
    payment_type: PaymentMethod
    card_number: Optional[str] = None
    expiry_month: Optional[int] = None
    expiry_year: Optional[int] = None
    cvv: Optional[str] = None
    cardholder_name: Optional[str] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    billing_country: Optional[str] = None
    is_default: bool = False
    
    @validator('card_number')
    def validate_card_number(cls, v, values):
        if values.get('payment_type') in [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD]:
            if not v:
                raise ValueError('Card number is required')
            # Remove spaces and validate
            v = re.sub(r'\s+', '', v)
            if not re.match(r'^\d{13,19}$', v):
                raise ValueError('Invalid card number')
        return v
    
    @validator('expiry_month')
    def validate_expiry_month(cls, v, values):
        if values.get('payment_type') in [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD]:
            if not v or v < 1 or v > 12:
                raise ValueError('Invalid expiry month')
        return v
    
    @validator('expiry_year')
    def validate_expiry_year(cls, v, values):
        if values.get('payment_type') in [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD]:
            current_year = datetime.now().year
            if not v or v < current_year or v > current_year + 20:
                raise ValueError('Invalid expiry year')
        return v


class BillingSettingsForm(BaseModel):
    """Billing settings form validation."""
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    auto_pay: bool = True
    billing_email: Optional[EmailStr] = None
    tax_id: Optional[str] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    billing_country: Optional[str] = None


class ProfilePage(BasePage):
    """User profile management page."""
    
    def get_page_data(self) -> PageResponse:
        """Get profile page data."""
        self.require_authentication()
        
        try:
            # Get user profile data
            profile_data = self._get_user_profile()
            
            # Get notification settings
            notification_settings = self._get_notification_settings()
            
            # Get account statistics
            account_stats = self._get_account_statistics()
            
            # Get recent activity
            recent_activity = self._get_recent_profile_activity()
            
            return self.create_response(data={
                'title': 'User Profile - DroneStrike',
                'profile': profile_data,
                'notification_settings': notification_settings,
                'account_stats': account_stats,
                'recent_activity': recent_activity,
                'available_timezones': self._get_available_timezones(),
                'available_languages': self._get_available_languages(),
                'countries': self._get_countries(),
                'states': self._get_states()
            })
            
        except Exception as e:
            self.add_error('Failed to load profile page')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle profile form submissions."""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'update_profile':
            return self._update_profile(form_data)
        elif action == 'update_password':
            return self._update_password(form_data)
        elif action == 'update_notifications':
            return self._update_notification_settings(form_data)
        elif action == 'upload_avatar':
            return self._upload_avatar(form_data)
        elif action == 'delete_account':
            return self._delete_account(form_data)
        elif action == 'export_data':
            return self._export_user_data(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _update_profile(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update user profile."""
        profile_form = self.validate_form_data(ProfileForm, form_data)
        if not profile_form:
            return self.create_response(success=False)
        
        try:
            # Check if email is already taken by another user
            if profile_form.email != self.current_user['email']:
                if self._email_exists(profile_form.email):
                    self.add_error('Email address is already in use')
                    return self.create_response(success=False)
            
            # Update user profile
            profile_updates = profile_form.dict()
            profile_updates['updated_at'] = datetime.utcnow()
            
            updated_profile = self._save_user_profile(self.current_user['id'], profile_updates)
            
            # Log activity
            self.log_activity('profile_updated', {
                'user_id': self.current_user['id'],
                'updated_fields': list(profile_updates.keys())
            })
            
            return self.create_response(
                success=True,
                data={'profile': updated_profile},
                message='Profile updated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to update profile')
            return self.create_response(success=False)
    
    def _update_password(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update user password."""
        password_form = self.validate_form_data(PasswordUpdateForm, form_data)
        if not password_form:
            return self.create_response(success=False)
        
        try:
            # Verify current password
            if not self.auth_service.verify_password(
                self.current_user['id'], 
                password_form.current_password
            ):
                self.add_error('Current password is incorrect')
                return self.create_response(success=False)
            
            # Update password
            success = self.auth_service.update_password(
                self.current_user['id'],
                password_form.new_password
            )
            
            if success:
                # Log activity
                self.log_activity('password_updated', {
                    'user_id': self.current_user['id']
                })
                
                # Send security notification
                self.send_email(
                    to=self.current_user['email'],
                    subject='Password Changed - DroneStrike',
                    body='Your account password has been successfully changed.',
                    html=True
                )
                
                return self.create_response(
                    success=True,
                    message='Password updated successfully'
                )
            else:
                self.add_error('Failed to update password')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('Failed to update password')
            return self.create_response(success=False)
    
    def _update_notification_settings(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update notification settings."""
        settings_form = self.validate_form_data(NotificationSettingsForm, form_data)
        if not settings_form:
            return self.create_response(success=False)
        
        try:
            # Update notification settings
            settings_data = settings_form.dict()
            settings_data['user_id'] = self.current_user['id']
            settings_data['updated_at'] = datetime.utcnow()
            
            updated_settings = self._save_notification_settings(settings_data)
            
            # Log activity
            self.log_activity('notification_settings_updated', {
                'user_id': self.current_user['id'],
                'settings': settings_data
            })
            
            return self.create_response(
                success=True,
                data={'settings': updated_settings},
                message='Notification settings updated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to update notification settings')
            return self.create_response(success=False)
    
    def _upload_avatar(self, form_data: Dict[str, Any]) -> PageResponse:
        """Upload user avatar."""
        try:
            # Handle file upload
            avatar_path = self.handle_file_upload('avatar')
            
            if avatar_path:
                # Update user avatar
                self._update_user_avatar(self.current_user['id'], avatar_path)
                
                # Log activity
                self.log_activity('avatar_updated', {
                    'user_id': self.current_user['id'],
                    'avatar_path': avatar_path
                })
                
                return self.create_response(
                    success=True,
                    data={'avatar_url': avatar_path},
                    message='Avatar updated successfully'
                )
            else:
                self.add_error('Failed to upload avatar')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('Failed to upload avatar')
            return self.create_response(success=False)
    
    def _delete_account(self, form_data: Dict[str, Any]) -> PageResponse:
        """Delete user account."""
        password = form_data.get('password')
        confirmation = form_data.get('confirmation')
        
        if not password:
            self.add_error('Password is required to delete account')
            return self.create_response(success=False)
        
        if confirmation != 'DELETE':
            self.add_error('Please type DELETE to confirm account deletion')
            return self.create_response(success=False)
        
        try:
            # Verify password
            if not self.auth_service.verify_password(self.current_user['id'], password):
                self.add_error('Incorrect password')
                return self.create_response(success=False)
            
            # Soft delete account
            self._soft_delete_user_account(self.current_user['id'])
            
            # Send farewell email
            self.send_email(
                to=self.current_user['email'],
                subject='Account Deleted - DroneStrike',
                body='Your DroneStrike account has been successfully deleted.',
                html=True
            )
            
            # Log activity
            self.log_activity('account_deleted', {
                'user_id': self.current_user['id']
            })
            
            return self.create_response(
                success=True,
                redirect='/login',
                message='Account deleted successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to delete account')
            return self.create_response(success=False)
    
    def _export_user_data(self, form_data: Dict[str, Any]) -> PageResponse:
        """Export user data."""
        try:
            # Generate user data export
            export_file = self._generate_user_data_export(self.current_user['id'])
            
            # Log activity
            self.log_activity('data_exported', {
                'user_id': self.current_user['id']
            })
            
            return self.create_response(
                success=True,
                data={'download_url': export_file},
                message='User data export generated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to export user data')
            return self.create_response(success=False)
    
    def _get_user_profile(self) -> Dict[str, Any]:
        """Get user profile data."""
        return {
            'id': self.current_user['id'],
            'first_name': self.current_user.get('first_name', ''),
            'last_name': self.current_user.get('last_name', ''),
            'email': self.current_user.get('email', ''),
            'phone': self.current_user.get('phone', ''),
            'company': self.current_user.get('company', ''),
            'title': self.current_user.get('title', ''),
            'address': self.current_user.get('address', ''),
            'city': self.current_user.get('city', ''),
            'state': self.current_user.get('state', ''),
            'zip_code': self.current_user.get('zip_code', ''),
            'country': self.current_user.get('country', ''),
            'timezone': self.current_user.get('timezone', 'UTC'),
            'language': self.current_user.get('language', 'en'),
            'bio': self.current_user.get('bio', ''),
            'website': self.current_user.get('website', ''),
            'avatar_url': self.current_user.get('avatar_url', ''),
            'created_at': self.current_user.get('created_at', ''),
            'last_login': self.current_user.get('last_login', ''),
            'email_verified': self.current_user.get('email_verified', False),
            'phone_verified': self.current_user.get('phone_verified', False)
        }
    
    def _get_notification_settings(self) -> Dict[str, Any]:
        """Get notification settings."""
        return {
            'email_notifications': True,
            'sms_notifications': False,
            'push_notifications': True,
            'mission_updates': 'email',
            'payment_reminders': 'email',
            'marketing_emails': True,
            'system_alerts': 'email',
            'weekly_reports': True
        }
    
    def _get_account_statistics(self) -> Dict[str, Any]:
        """Get account statistics."""
        return {
            'total_missions': 25,
            'completed_missions': 23,
            'total_revenue': 15750.00,
            'member_since': '2023-06-15',
            'last_mission': '2024-01-10',
            'profile_completion': 85,
            'verification_status': {
                'email': True,
                'phone': False,
                'identity': False
            }
        }
    
    def _get_recent_profile_activity(self) -> List[Dict[str, Any]]:
        """Get recent profile activity."""
        return [
            {
                'id': 1,
                'type': 'profile_update',
                'description': 'Updated contact information',
                'timestamp': '2024-01-08T14:30:00Z'
            },
            {
                'id': 2,
                'type': 'password_change',
                'description': 'Changed account password',
                'timestamp': '2024-01-05T09:15:00Z'
            },
            {
                'id': 3,
                'type': 'email_verification',
                'description': 'Verified email address',
                'timestamp': '2024-01-01T10:00:00Z'
            }
        ]
    
    def _get_available_timezones(self) -> List[str]:
        """Get available timezones."""
        return [
            'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 
            'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'
        ]
    
    def _get_available_languages(self) -> List[Dict[str, str]]:
        """Get available languages."""
        return [
            {'code': 'en', 'name': 'English'},
            {'code': 'es', 'name': 'Spanish'},
            {'code': 'fr', 'name': 'French'},
            {'code': 'de', 'name': 'German'}
        ]
    
    def _get_countries(self) -> List[str]:
        """Get countries list."""
        return ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France']
    
    def _get_states(self) -> List[str]:
        """Get states list."""
        return ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA']
    
    # Database simulation methods
    def _email_exists(self, email: str) -> bool:
        """Check if email exists."""
        # Check database for existing email
        return False
    
    def _save_user_profile(self, user_id: int, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save user profile."""
        # Update user profile in database
        return self._get_user_profile()
    
    def _save_notification_settings(self, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save notification settings."""
        # Update notification settings in database
        return settings_data
    
    def _update_user_avatar(self, user_id: int, avatar_path: str):
        """Update user avatar."""
        # Update avatar path in database
        pass
    
    def _soft_delete_user_account(self, user_id: int):
        """Soft delete user account."""
        # Mark account as deleted in database
        pass
    
    def _generate_user_data_export(self, user_id: int) -> str:
        """Generate user data export file."""
        # Generate comprehensive data export
        filename = f"user_data_export_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        return f"/tmp/{filename}"


class BillingPage(BasePage):
    """Billing management page."""
    
    def get_page_data(self) -> PageResponse:
        """Get billing page data."""
        self.require_authentication()
        
        try:
            # Get payment methods
            payment_methods = self._get_user_payment_methods()
            
            # Get billing settings
            billing_settings = self._get_billing_settings()
            
            # Get current subscription
            subscription = self._get_current_subscription()
            
            # Get billing statistics
            billing_stats = self._get_billing_statistics()
            
            # Get available plans
            available_plans = self._get_available_plans()
            
            return self.create_response(data={
                'title': 'Billing & Payments - DroneStrike',
                'payment_methods': payment_methods,
                'billing_settings': billing_settings,
                'subscription': subscription,
                'billing_stats': billing_stats,
                'available_plans': available_plans,
                'payment_types': [t.value for t in PaymentMethod],
                'billing_cycles': [c.value for c in BillingCycle]
            })
            
        except Exception as e:
            self.add_error('Failed to load billing page')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle billing form submissions."""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'add_payment_method':
            return self._add_payment_method(form_data)
        elif action == 'update_payment_method':
            return self._update_payment_method(form_data)
        elif action == 'delete_payment_method':
            return self._delete_payment_method(form_data)
        elif action == 'set_default_payment':
            return self._set_default_payment_method(form_data)
        elif action == 'update_billing_settings':
            return self._update_billing_settings(form_data)
        elif action == 'change_subscription':
            return self._change_subscription(form_data)
        elif action == 'cancel_subscription':
            return self._cancel_subscription(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _add_payment_method(self, form_data: Dict[str, Any]) -> PageResponse:
        """Add new payment method."""
        payment_form = self.validate_form_data(PaymentMethodForm, form_data)
        if not payment_form:
            return self.create_response(success=False)
        
        try:
            # Process payment method with payment processor
            payment_token = self._process_payment_method_with_stripe(payment_form)
            
            if not payment_token:
                self.add_error('Failed to process payment method')
                return self.create_response(success=False)
            
            # Save payment method
            payment_data = payment_form.dict()
            payment_data['user_id'] = self.current_user['id']
            payment_data['payment_token'] = payment_token
            payment_data['created_at'] = datetime.utcnow()
            
            # Mask sensitive data for storage
            if payment_data['card_number']:
                payment_data['card_last_four'] = payment_data['card_number'][-4:]
                payment_data['card_number'] = None  # Don't store full card number
            
            new_payment_method = self._save_payment_method(payment_data)
            
            # Set as default if it's the first payment method
            if payment_form.is_default or not self._user_has_payment_methods():
                self._set_default_payment(new_payment_method['id'])
            
            # Log activity
            self.log_activity('payment_method_added', {
                'user_id': self.current_user['id'],
                'payment_type': payment_form.payment_type,
                'is_default': payment_form.is_default
            })
            
            return self.create_response(
                success=True,
                data={'payment_method': self._format_payment_method(new_payment_method)},
                message='Payment method added successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to add payment method')
            return self.create_response(success=False)
    
    def _update_billing_settings(self, form_data: Dict[str, Any]) -> PageResponse:
        """Update billing settings."""
        settings_form = self.validate_form_data(BillingSettingsForm, form_data)
        if not settings_form:
            return self.create_response(success=False)
        
        try:
            # Update billing settings
            settings_data = settings_form.dict()
            settings_data['user_id'] = self.current_user['id']
            settings_data['updated_at'] = datetime.utcnow()
            
            updated_settings = self._save_billing_settings(settings_data)
            
            # Log activity
            self.log_activity('billing_settings_updated', {
                'user_id': self.current_user['id'],
                'settings': settings_data
            })
            
            return self.create_response(
                success=True,
                data={'settings': updated_settings},
                message='Billing settings updated successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to update billing settings')
            return self.create_response(success=False)
    
    def _change_subscription(self, form_data: Dict[str, Any]) -> PageResponse:
        """Change subscription plan."""
        new_plan_id = form_data.get('plan_id')
        billing_cycle = form_data.get('billing_cycle', 'monthly')
        
        if not new_plan_id:
            self.add_error('Plan ID is required')
            return self.create_response(success=False)
        
        try:
            # Get plan details
            plan = self._get_plan_by_id(new_plan_id)
            if not plan:
                self.add_error('Plan not found')
                return self.create_response(success=False)
            
            # Process subscription change
            subscription_result = self._process_subscription_change(
                self.current_user['id'],
                new_plan_id,
                billing_cycle
            )
            
            if subscription_result['success']:
                # Log activity
                self.log_activity('subscription_changed', {
                    'user_id': self.current_user['id'],
                    'old_plan': subscription_result.get('old_plan'),
                    'new_plan': new_plan_id,
                    'billing_cycle': billing_cycle
                })
                
                # Send confirmation email
                self.send_email(
                    to=self.current_user['email'],
                    subject='Subscription Updated - DroneStrike',
                    body=f'Your subscription has been updated to {plan["name"]}',
                    html=True
                )
                
                return self.create_response(
                    success=True,
                    data={'subscription': subscription_result['subscription']},
                    message='Subscription updated successfully'
                )
            else:
                self.add_error('Failed to update subscription')
                return self.create_response(success=False)
                
        except Exception as e:
            self.add_error('Failed to change subscription')
            return self.create_response(success=False)
    
    def _get_user_payment_methods(self) -> List[Dict[str, Any]]:
        """Get user payment methods."""
        return [
            {
                'id': 1,
                'payment_type': 'credit_card',
                'card_last_four': '4242',
                'card_brand': 'Visa',
                'expiry_month': 12,
                'expiry_year': 2025,
                'cardholder_name': 'John Doe',
                'is_default': True,
                'is_expired': False,
                'created_at': '2023-06-15T10:00:00Z'
            },
            {
                'id': 2,
                'payment_type': 'paypal',
                'email': 'john@example.com',
                'is_default': False,
                'created_at': '2023-08-01T14:30:00Z'
            }
        ]
    
    def _get_billing_settings(self) -> Dict[str, Any]:
        """Get billing settings."""
        return {
            'billing_cycle': 'monthly',
            'auto_pay': True,
            'billing_email': self.current_user['email'],
            'tax_id': '',
            'billing_address': '123 Main St',
            'billing_city': 'New York',
            'billing_state': 'NY',
            'billing_zip': '10001',
            'billing_country': 'United States'
        }
    
    def _get_current_subscription(self) -> Dict[str, Any]:
        """Get current subscription."""
        return {
            'id': 1,
            'plan_id': 'pro',
            'plan_name': 'Professional',
            'billing_cycle': 'monthly',
            'amount': 99.00,
            'status': 'active',
            'current_period_start': '2024-01-01T00:00:00Z',
            'current_period_end': '2024-02-01T00:00:00Z',
            'next_billing_date': '2024-02-01T00:00:00Z',
            'auto_renew': True,
            'trial_end': None,
            'created_at': '2023-06-15T10:00:00Z'
        }
    
    def _get_billing_statistics(self) -> Dict[str, Any]:
        """Get billing statistics."""
        return {
            'total_spent': 1188.00,
            'current_month_charges': 99.00,
            'average_monthly': 99.00,
            'next_payment_amount': 99.00,
            'next_payment_date': '2024-02-01',
            'payment_methods_count': 2,
            'successful_payments': 12,
            'failed_payments': 0
        }
    
    def _get_available_plans(self) -> List[Dict[str, Any]]:
        """Get available subscription plans."""
        return [
            {
                'id': 'basic',
                'name': 'Basic',
                'description': 'Perfect for getting started',
                'monthly_price': 29.00,
                'yearly_price': 290.00,
                'features': ['5 missions per month', 'Basic support', 'Standard analytics'],
                'popular': False
            },
            {
                'id': 'pro',
                'name': 'Professional',
                'description': 'For growing businesses',
                'monthly_price': 99.00,
                'yearly_price': 990.00,
                'features': ['Unlimited missions', 'Priority support', 'Advanced analytics', 'Team collaboration'],
                'popular': True
            },
            {
                'id': 'enterprise',
                'name': 'Enterprise',
                'description': 'For large organizations',
                'monthly_price': 299.00,
                'yearly_price': 2990.00,
                'features': ['Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
                'popular': False
            }
        ]
    
    def _format_payment_method(self, payment_method: Dict[str, Any]) -> Dict[str, Any]:
        """Format payment method for display."""
        formatted = {
            'id': payment_method['id'],
            'payment_type': payment_method['payment_type'],
            'is_default': payment_method.get('is_default', False),
            'created_at': payment_method.get('created_at')
        }
        
        if payment_method['payment_type'] in ['credit_card', 'debit_card']:
            formatted.update({
                'card_last_four': payment_method.get('card_last_four'),
                'card_brand': payment_method.get('card_brand'),
                'expiry_month': payment_method.get('expiry_month'),
                'expiry_year': payment_method.get('expiry_year'),
                'cardholder_name': payment_method.get('cardholder_name'),
                'is_expired': self._is_card_expired(
                    payment_method.get('expiry_month'),
                    payment_method.get('expiry_year')
                )
            })
        elif payment_method['payment_type'] == 'paypal':
            formatted['email'] = payment_method.get('email')
        
        return formatted
    
    def _is_card_expired(self, expiry_month: int, expiry_year: int) -> bool:
        """Check if card is expired."""
        if not expiry_month or not expiry_year:
            return True
        
        from datetime import date
        today = date.today()
        expiry_date = date(expiry_year, expiry_month, 1)
        
        return expiry_date < today
    
    # Payment processing simulation methods
    def _process_payment_method_with_stripe(self, payment_form: PaymentMethodForm) -> Optional[str]:
        """Process payment method with Stripe."""
        # Simulate Stripe payment method creation
        import random
        return f"pm_{random.randint(100000, 999999)}"
    
    def _process_subscription_change(self, user_id: int, plan_id: str, billing_cycle: str) -> Dict[str, Any]:
        """Process subscription change."""
        # Simulate subscription update
        return {
            'success': True,
            'subscription': {
                'id': 1,
                'plan_id': plan_id,
                'billing_cycle': billing_cycle,
                'status': 'active'
            },
            'old_plan': 'basic'
        }
    
    # Database simulation methods
    def _save_payment_method(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save payment method."""
        payment_data['id'] = self._generate_payment_method_id()
        return payment_data
    
    def _save_billing_settings(self, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save billing settings."""
        return settings_data
    
    def _user_has_payment_methods(self) -> bool:
        """Check if user has payment methods."""
        return len(self._get_user_payment_methods()) > 0
    
    def _set_default_payment(self, payment_method_id: int):
        """Set default payment method."""
        # Update database to set default payment method
        pass
    
    def _get_plan_by_id(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Get plan by ID."""
        plans = self._get_available_plans()
        return next((p for p in plans if p['id'] == plan_id), None)
    
    def _generate_payment_method_id(self) -> int:
        """Generate payment method ID."""
        import random
        return random.randint(1000, 9999)


class PaymentHistoryPage(BasePage):
    """Payment history page."""
    
    def get_page_data(self) -> PageResponse:
        """Get payment history page data."""
        self.require_authentication()
        
        try:
            # Get payment history
            payments = self._get_payment_history()
            
            # Get payment statistics
            payment_stats = self._get_payment_statistics()
            
            # Get invoices
            invoices = self._get_user_invoices()
            
            return self.create_response(data={
                'title': 'Payment History - DroneStrike',
                'payments': payments,
                'payment_stats': payment_stats,
                'invoices': invoices
            })
            
        except Exception as e:
            self.add_error('Failed to load payment history')
            return self.create_response(success=False)
    
    def handle_form_submission(self, form_data: Dict[str, Any]) -> PageResponse:
        """Handle payment history form submissions."""
        self.require_authentication()
        
        action = form_data.get('action')
        
        if action == 'download_invoice':
            return self._download_invoice(form_data)
        elif action == 'export_payments':
            return self._export_payment_history(form_data)
        else:
            self.add_error('Invalid action')
            return self.create_response(success=False)
    
    def _download_invoice(self, form_data: Dict[str, Any]) -> PageResponse:
        """Download invoice PDF."""
        invoice_id = form_data.get('invoice_id')
        
        if not invoice_id:
            self.add_error('Invoice ID is required')
            return self.create_response(success=False)
        
        try:
            # Generate invoice PDF
            invoice_path = self._generate_invoice_pdf(invoice_id)
            
            return self.create_response(
                success=True,
                data={'download_url': invoice_path},
                message='Invoice downloaded successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to download invoice')
            return self.create_response(success=False)
    
    def _export_payment_history(self, form_data: Dict[str, Any]) -> PageResponse:
        """Export payment history."""
        export_format = form_data.get('format', 'csv')
        date_from = form_data.get('date_from')
        date_to = form_data.get('date_to')
        
        try:
            # Generate export file
            if export_format == 'csv':
                file_path = self._generate_payment_history_csv(date_from, date_to)
            elif export_format == 'pdf':
                file_path = self._generate_payment_history_pdf(date_from, date_to)
            else:
                self.add_error('Invalid export format')
                return self.create_response(success=False)
            
            return self.create_response(
                success=True,
                data={'download_url': file_path},
                message='Payment history exported successfully'
            )
            
        except Exception as e:
            self.add_error('Failed to export payment history')
            return self.create_response(success=False)
    
    def _get_payment_history(self) -> List[Dict[str, Any]]:
        """Get payment history."""
        return [
            {
                'id': 1,
                'amount': 99.00,
                'currency': 'USD',
                'status': 'succeeded',
                'description': 'Professional Plan - Monthly',
                'payment_method': 'Visa ****4242',
                'created_at': '2024-01-01T12:00:00Z',
                'invoice_id': 'inv_001',
                'receipt_url': '/receipts/001.pdf'
            },
            {
                'id': 2,
                'amount': 99.00,
                'currency': 'USD',
                'status': 'succeeded',
                'description': 'Professional Plan - Monthly',
                'payment_method': 'Visa ****4242',
                'created_at': '2023-12-01T12:00:00Z',
                'invoice_id': 'inv_002',
                'receipt_url': '/receipts/002.pdf'
            }
        ]
    
    def _get_payment_statistics(self) -> Dict[str, Any]:
        """Get payment statistics."""
        return {
            'total_payments': 12,
            'successful_payments': 12,
            'failed_payments': 0,
            'total_amount': 1188.00,
            'average_payment': 99.00,
            'last_payment_date': '2024-01-01',
            'next_payment_date': '2024-02-01'
        }
    
    def _get_user_invoices(self) -> List[Dict[str, Any]]:
        """Get user invoices."""
        return [
            {
                'id': 'inv_001',
                'invoice_number': 'DS-2024-001',
                'amount': 99.00,
                'currency': 'USD',
                'status': 'paid',
                'issued_date': '2024-01-01',
                'due_date': '2024-01-01',
                'paid_date': '2024-01-01',
                'description': 'Professional Plan - January 2024',
                'pdf_url': '/invoices/inv_001.pdf'
            }
        ]
    
    def _generate_invoice_pdf(self, invoice_id: str) -> str:
        """Generate invoice PDF."""
        # Generate PDF invoice
        return f"/tmp/invoice_{invoice_id}.pdf"
    
    def _generate_payment_history_csv(self, date_from: Optional[str], date_to: Optional[str]) -> str:
        """Generate payment history CSV."""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['Date', 'Amount', 'Status', 'Description', 'Payment Method', 'Invoice'])
        
        # Write data
        payments = self._get_payment_history()
        for payment in payments:
            writer.writerow([
                payment['created_at'][:10],
                f"${payment['amount']:.2f}",
                payment['status'],
                payment['description'],
                payment['payment_method'],
                payment['invoice_id']
            ])
        
        # Save to file
        filename = f"payment_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        file_path = f"/tmp/{filename}"
        
        with open(file_path, 'w') as f:
            f.write(output.getvalue())
        
        return file_path
    
    def _generate_payment_history_pdf(self, date_from: Optional[str], date_to: Optional[str]) -> str:
        """Generate payment history PDF"""
        filename = f"payment_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return f"/tmp/{filename}"