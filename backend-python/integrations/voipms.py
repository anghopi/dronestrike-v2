"""
Advanced VoIP.ms integration for DroneStrike v2.

Provides comprehensive VoIP services including voice calls, SMS, phone number management,
call routing, voicemail, call recording, and real-time monitoring.
"""

import asyncio
import json
import time
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Callable
from enum import Enum
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from pydantic import BaseModel, validator, Field

from .base import HTTPIntegration, IntegrationConfig, IntegrationError, ValidationError, WebhookHandler, BatchProcessor


class VoipMSCallStatus(Enum):
    """Call status types."""
    RINGING = "ringing"
    ANSWERED = "answered"
    BUSY = "busy"
    NO_ANSWER = "no_answer"
    FAILED = "failed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VoipMSSMSStatus(Enum):
    """SMS status types."""
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    PENDING = "pending"
    QUEUED = "queued"


class VoipMSCallType(Enum):
    """Call types."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"
    LOCAL = "local"
    TOLL_FREE = "toll_free"
    INTERNATIONAL = "international"


class VoipMSRecordingFormat(Enum):
    """Recording formats."""
    WAV = "wav"
    MP3 = "mp3"
    GSM = "gsm"


class VoipMSConfig(IntegrationConfig):
    """VoIP.ms-specific configuration."""
    base_url: str = "https://voip.ms/api/v1/rest.php"
    username: str = Field(..., description="VoIP.ms username")
    password: str = Field(..., description="VoIP.ms password")
    
    # Default settings
    default_caller_id: Optional[str] = None
    default_area_code: Optional[str] = None
    recording_enabled: bool = False
    recording_format: VoipMSRecordingFormat = VoipMSRecordingFormat.MP3
    
    # Webhook settings
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    
    # Rate limits
    calls_per_minute: int = 30
    sms_per_minute: int = 60
    
    class Config:
        extra = "allow"


@dataclass
class PhoneNumber:
    """Phone number representation."""
    number: str
    formatted: str
    country_code: str
    area_code: str
    local_number: str
    
    @classmethod
    def parse(cls, number: str) -> 'PhoneNumber':
        """Parse phone number string."""
        # Remove all non-digit characters
        digits = ''.join(filter(str.isdigit, number))
        
        if len(digits) == 10:  # US number without country code
            digits = '1' + digits
        
        if len(digits) == 11 and digits.startswith('1'):
            country_code = '1'
            area_code = digits[1:4]
            local_number = digits[4:]
            formatted = f"+1 ({area_code}) {local_number[:3]}-{local_number[3:]}"
        else:
            country_code = digits[:2] if len(digits) > 10 else "1"
            area_code = ""
            local_number = digits[len(country_code):]
            formatted = f"+{country_code} {local_number}"
        
        return cls(
            number=digits,
            formatted=formatted,
            country_code=country_code,
            area_code=area_code,
            local_number=local_number
        )


class CallRequest(BaseModel):
    """Call request parameters."""
    to: str = Field(..., description="Destination phone number")
    from_: str = Field(..., alias="from", description="Caller ID number")
    timeout: int = Field(30, description="Ring timeout in seconds")
    caller_id_name: Optional[str] = None
    record: bool = False
    whisper_message: Optional[str] = None
    
    @validator('to', 'from_')
    def validate_phone_number(cls, v):
        try:
            PhoneNumber.parse(v)
            return v
        except Exception:
            raise ValueError(f'Invalid phone number format: {v}')


class SMSRequest(BaseModel):
    """SMS request parameters."""
    to: str = Field(..., description="Destination phone number")
    from_: str = Field(..., alias="from", description="Source phone number")
    message: str = Field(..., max_length=160, description="SMS message content")
    unicode: bool = Field(False, description="Enable Unicode support")
    flash: bool = Field(False, description="Send as flash SMS")
    
    @validator('to', 'from_')
    def validate_phone_number(cls, v):
        try:
            PhoneNumber.parse(v)
            return v
        except Exception:
            raise ValueError(f'Invalid phone number format: {v}')


class CallRouting(BaseModel):
    """Call routing configuration."""
    rule_name: str
    pattern: str
    destination: str
    priority: int = Field(1, ge=1, le=100)
    enabled: bool = True
    time_conditions: Optional[Dict[str, Any]] = None


class VoicemailSettings(BaseModel):
    """Voicemail configuration."""
    enabled: bool = True
    email_notification: bool = True
    email_address: Optional[str] = None
    delete_after_email: bool = False
    greeting_message: Optional[str] = None
    max_message_length: int = Field(300, ge=30, le=600)


class ConferenceSettings(BaseModel):
    """Conference call configuration."""
    room_number: str
    pin_required: bool = True
    admin_pin: Optional[str] = None
    user_pin: Optional[str] = None
    max_participants: int = Field(10, ge=2, le=50)
    recording_enabled: bool = False
    mute_on_entry: bool = False


class AdvancedVoipMS(HTTPIntegration):
    """
    Advanced VoIP.ms integration with comprehensive telephony capabilities.
    
    Features:
    - Complete API wrapper with all endpoints
    - Voice call management (initiate, transfer, conference)
    - SMS sending/receiving with delivery tracking
    - Phone number provisioning and management
    - Call routing and forwarding rules
    - Voicemail management
    - Call recording and transcription
    - Real-time call status monitoring
    - Webhook handling for events
    """
    
    def __init__(self, config: VoipMSConfig):
        super().__init__(config)
        self.config: VoipMSConfig = config
        self.batch_processor = BatchProcessor(batch_size=50, max_workers=10)
        self.webhook_handler = None
        
        if config.webhook_secret:
            self.webhook_handler = VoipMSWebhookHandler(config.webhook_secret)
    
    def _initialize_client(self) -> None:
        """Initialize VoIP.ms HTTP client."""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            headers=self._get_default_headers(),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=50)
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for VoIP.ms requests."""
        return {
            "User-Agent": "DroneStrike/2.0 VoipMS Integration",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
    
    async def _perform_health_check(self) -> None:
        """Perform VoIP.ms API health check."""
        try:
            await self.get_account_info()
        except Exception as e:
            raise IntegrationError(f"VoIP.ms health check failed: {e}")
    
    def _get_auth_params(self) -> Dict[str, str]:
        """Get authentication parameters."""
        return {
            "api_username": self.config.username,
            "api_password": self.config.password
        }
    
    async def _make_voipms_request(
        self,
        method: str,
        params: Dict[str, Any],
        use_cache: bool = False
    ) -> Dict[str, Any]:
        """Make VoIP.ms API request."""
        # Add authentication
        all_params = {**self._get_auth_params(), **params, "method": method}
        
        try:
            response = await self._make_request(
                "POST", 
                self.config.base_url,
                data=all_params,
                use_cache=use_cache
            )
            
            # Check for API errors
            if response.get("status") != "success":
                error_msg = response.get("error", "Unknown API error")
                raise IntegrationError(f"VoIP.ms API error: {error_msg}")
            
            return response
            
        except Exception as e:
            self._handle_error(e, f"VoIP.ms API call: {method}")
    
    # Account Management
    
    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information and balance."""
        response = await self._make_voipms_request("getBalance", {}, use_cache=True)
        
        return {
            "balance": float(response.get("balance", 0)),
            "currency": response.get("currency", "USD"),
            "account_type": response.get("type", "prepaid"),
            "status": response.get("status")
        }
    
    async def get_transaction_history(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get account transaction history."""
        params = {"limit": limit}
        
        if date_from:
            params["date_from"] = date_from.strftime("%Y-%m-%d")
        if date_to:
            params["date_to"] = date_to.strftime("%Y-%m-%d")
        
        response = await self._make_voipms_request("getTransactions", params)
        
        transactions = []
        for tx in response.get("transactions", []):
            transactions.append({
                "id": tx.get("id"),
                "date": datetime.strptime(tx.get("date"), "%Y-%m-%d %H:%M:%S"),
                "description": tx.get("description"),
                "amount": float(tx.get("amount", 0)),
                "type": tx.get("type"),
                "balance_after": float(tx.get("balance", 0))
            })
        
        return transactions
    
    # Phone Number Management
    
    async def get_dids(self, state: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available phone numbers (DIDs)."""
        params = {}
        if state:
            params["state"] = state
        
        response = await self._make_voipms_request("getDIDsInfo", params, use_cache=True)
        
        dids = []
        for did in response.get("dids", []):
            dids.append({
                "did": did.get("did"),
                "description": did.get("routing"),
                "monthly_cost": float(did.get("monthly", 0)),
                "setup_cost": float(did.get("setup", 0)),
                "area_code": did.get("did", "")[:3] if did.get("did") else "",
                "state": did.get("location"),
                "status": did.get("status", "active")
            })
        
        return dids
    
    async def search_available_numbers(
        self,
        area_code: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Search for available phone numbers in area code."""
        params = {
            "type": "did",
            "query": area_code,
            "limit": limit
        }
        
        response = await self._make_voipms_request("getDIDsUSA", params)
        
        numbers = []
        for num in response.get("dids", []):
            numbers.append({
                "number": num.get("did"),
                "formatted": PhoneNumber.parse(num.get("did", "")).formatted,
                "area_code": area_code,
                "monthly_cost": float(num.get("monthly", 0)),
                "setup_cost": float(num.get("setup", 0)),
                "availability": "available"
            })
        
        return numbers
    
    async def order_phone_number(
        self,
        did: str,
        routing: Optional[str] = None
    ) -> Dict[str, Any]:
        """Order a phone number."""
        params = {
            "did": did,
            "routing": routing or self.config.default_caller_id or did,
            "pop": "1",  # Default POP
            "dialtime": "60",
            "cnam": "1"
        }
        
        response = await self._make_voipms_request("orderDID", params)
        
        return {
            "did": did,
            "status": "ordered",
            "routing": routing,
            "order_id": response.get("order_id"),
            "monthly_cost": response.get("monthly_cost"),
            "message": response.get("message", "Number ordered successfully")
        }
    
    async def cancel_phone_number(self, did: str) -> Dict[str, Any]:
        """Cancel a phone number."""
        params = {"did": did}
        
        response = await self._make_voipms_request("cancelDID", params)
        
        return {
            "did": did,
            "status": "cancelled",
            "message": response.get("message", "Number cancelled successfully")
        }
    
    # Call Management
    
    async def make_call(
        self,
        to: str,
        from_: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Initiate an outbound call."""
        call_request = CallRequest(to=to, from_=from_, **kwargs)
        
        params = {
            "dst": call_request.to,
            "src": call_request.from_,
            "timeout": call_request.timeout
        }
        
        if call_request.caller_id_name:
            params["callerid"] = call_request.caller_id_name
        
        if call_request.record:
            params["record"] = "1"
        
        if call_request.whisper_message:
            params["whisper"] = call_request.whisper_message
        
        response = await self._make_voipms_request("sendCall", params)
        
        return {
            "call_id": response.get("call_id"),
            "status": VoipMSCallStatus.RINGING.value,
            "to": call_request.to,
            "from": call_request.from_,
            "timestamp": datetime.now(),
            "estimated_cost": response.get("cost"),
            "message": response.get("message", "Call initiated")
        }
    
    async def hangup_call(self, call_id: str) -> Dict[str, Any]:
        """Hangup an active call."""
        params = {"call_id": call_id}
        
        response = await self._make_voipms_request("hangupCall", params)
        
        return {
            "call_id": call_id,
            "status": VoipMSCallStatus.CANCELLED.value,
            "message": response.get("message", "Call hung up")
        }
    
    async def transfer_call(
        self,
        call_id: str,
        destination: str,
        type_: str = "blind"
    ) -> Dict[str, Any]:
        """Transfer an active call."""
        params = {
            "call_id": call_id,
            "destination": destination,
            "type": type_  # blind or attended
        }
        
        response = await self._make_voipms_request("transferCall", params)
        
        return {
            "call_id": call_id,
            "destination": destination,
            "transfer_type": type_,
            "status": "transferred",
            "message": response.get("message", "Call transferred")
        }
    
    async def get_call_status(self, call_id: str) -> Dict[str, Any]:
        """Get status of a specific call."""
        params = {"call_id": call_id}
        
        response = await self._make_voipms_request("getCallStatus", params)
        
        call_data = response.get("call", {})
        
        return {
            "call_id": call_id,
            "status": call_data.get("status"),
            "duration": int(call_data.get("duration", 0)),
            "cost": float(call_data.get("cost", 0)),
            "start_time": call_data.get("start_time"),
            "end_time": call_data.get("end_time"),
            "caller_id": call_data.get("callerid"),
            "destination": call_data.get("destination")
        }
    
    async def get_call_history(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        did: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get call history/CDR records."""
        params = {"limit": limit}
        
        if date_from:
            params["date_from"] = date_from.strftime("%Y-%m-%d")
        if date_to:
            params["date_to"] = date_to.strftime("%Y-%m-%d")
        if did:
            params["did"] = did
        
        response = await self._make_voipms_request("getCDR", params)
        
        calls = []
        for call in response.get("cdr", []):
            calls.append({
                "call_id": call.get("uniqueid"),
                "date": datetime.strptime(call.get("date"), "%Y-%m-%d %H:%M:%S"),
                "caller_id": call.get("callerid"),
                "destination": call.get("destination"),
                "disposition": call.get("disposition"),
                "duration": int(call.get("seconds", 0)),
                "cost": float(call.get("rate", 0)) * int(call.get("seconds", 0)) / 60,
                "type": VoipMSCallType.INBOUND.value if call.get("disposition") == "ANSWERED" else VoipMSCallType.OUTBOUND.value,
                "recording_url": call.get("recording")
            })
        
        return calls
    
    # SMS Management
    
    async def send_sms(
        self,
        to: str,
        from_: str,
        message: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Send SMS message."""
        sms_request = SMSRequest(to=to, from_=from_, message=message, **kwargs)
        
        params = {
            "did": sms_request.from_,
            "dst": sms_request.to,
            "message": sms_request.message
        }
        
        if sms_request.unicode:
            params["unicode"] = "1"
        
        if sms_request.flash:
            params["flash"] = "1"
        
        response = await self._make_voipms_request("sendSMS", params)
        
        return {
            "sms_id": response.get("sms"),
            "to": sms_request.to,
            "from": sms_request.from_,
            "message": sms_request.message,
            "status": VoipMSSMSStatus.SENT.value,
            "timestamp": datetime.now(),
            "cost": float(response.get("cost", 0)),
            "message_count": len(sms_request.message) // 160 + 1
        }
    
    async def get_sms_history(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        did: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get SMS history."""
        params = {"limit": limit}
        
        if date_from:
            params["date_from"] = date_from.strftime("%Y-%m-%d")
        if date_to:
            params["date_to"] = date_to.strftime("%Y-%m-%d")
        if did:
            params["did"] = did
        
        response = await self._make_voipms_request("getSMS", params)
        
        messages = []
        for sms in response.get("sms", []):
            messages.append({
                "sms_id": sms.get("id"),
                "date": datetime.strptime(sms.get("date"), "%Y-%m-%d %H:%M:%S"),
                "did": sms.get("did"),
                "contact": sms.get("contact"),
                "message": sms.get("message"),
                "type": sms.get("type"),  # 1=received, 0=sent
                "status": VoipMSSMSStatus.DELIVERED.value
            })
        
        return messages
    
    async def get_sms_status(self, sms_id: str) -> Dict[str, Any]:
        """Get SMS delivery status."""
        params = {"sms": sms_id}
        
        response = await self._make_voipms_request("getSMSStatus", params)
        
        status_data = response.get("status", {})
        
        return {
            "sms_id": sms_id,
            "status": status_data.get("status"),
            "delivered_at": status_data.get("delivered_time"),
            "error_message": status_data.get("error"),
            "cost": float(status_data.get("cost", 0))
        }
    
    async def batch_send_sms(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Send multiple SMS messages in batch."""
        async def send_single_sms(msg_data: Dict[str, str]) -> Dict[str, Any]:
            try:
                return await self.send_sms(
                    to=msg_data["to"],
                    from_=msg_data["from"],
                    message=msg_data["message"],
                    **kwargs
                )
            except Exception as e:
                return {
                    "error": str(e),
                    "to": msg_data["to"],
                    "message": msg_data["message"]
                }
        
        return await self.batch_processor.process_batch(messages, send_single_sms)
    
    # Call Routing Management
    
    async def create_call_route(self, routing: CallRouting) -> Dict[str, Any]:
        """Create call routing rule."""
        params = {
            "name": routing.rule_name,
            "pattern": routing.pattern,
            "destination": routing.destination,
            "priority": routing.priority,
            "enabled": "1" if routing.enabled else "0"
        }
        
        if routing.time_conditions:
            params.update(routing.time_conditions)
        
        response = await self._make_voipms_request("createRoute", params)
        
        return {
            "route_id": response.get("route_id"),
            "name": routing.rule_name,
            "status": "created",
            "message": response.get("message", "Route created successfully")
        }
    
    async def update_call_route(
        self,
        route_id: str,
        routing: CallRouting
    ) -> Dict[str, Any]:
        """Update call routing rule."""
        params = {
            "route_id": route_id,
            "name": routing.rule_name,
            "pattern": routing.pattern,
            "destination": routing.destination,
            "priority": routing.priority,
            "enabled": "1" if routing.enabled else "0"
        }
        
        response = await self._make_voipms_request("updateRoute", params)
        
        return {
            "route_id": route_id,
            "status": "updated",
            "message": response.get("message", "Route updated successfully")
        }
    
    async def delete_call_route(self, route_id: str) -> Dict[str, Any]:
        """Delete call routing rule."""
        params = {"route_id": route_id}
        
        response = await self._make_voipms_request("deleteRoute", params)
        
        return {
            "route_id": route_id,
            "status": "deleted",
            "message": response.get("message", "Route deleted successfully")
        }
    
    async def get_call_routes(self) -> List[Dict[str, Any]]:
        """Get all call routing rules."""
        response = await self._make_voipms_request("getRoutes", {}, use_cache=True)
        
        routes = []
        for route in response.get("routes", []):
            routes.append({
                "route_id": route.get("id"),
                "name": route.get("name"),
                "pattern": route.get("pattern"),
                "destination": route.get("destination"),
                "priority": int(route.get("priority", 1)),
                "enabled": route.get("enabled") == "1",
                "created_date": route.get("created"),
                "modified_date": route.get("modified")
            })
        
        return routes
    
    # Voicemail Management
    
    async def configure_voicemail(
        self,
        did: str,
        settings: VoicemailSettings
    ) -> Dict[str, Any]:
        """Configure voicemail for a DID."""
        params = {
            "did": did,
            "enabled": "1" if settings.enabled else "0",
            "email_notification": "1" if settings.email_notification else "0",
            "delete_after_email": "1" if settings.delete_after_email else "0",
            "max_length": settings.max_message_length
        }
        
        if settings.email_address:
            params["email"] = settings.email_address
        
        if settings.greeting_message:
            params["greeting"] = settings.greeting_message
        
        response = await self._make_voipms_request("setVoicemail", params)
        
        return {
            "did": did,
            "status": "configured",
            "message": response.get("message", "Voicemail configured successfully")
        }
    
    async def get_voicemail_messages(
        self,
        did: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get voicemail messages for a DID."""
        params = {
            "did": did,
            "limit": limit
        }
        
        response = await self._make_voipms_request("getVoicemails", params)
        
        messages = []
        for vm in response.get("voicemails", []):
            messages.append({
                "message_id": vm.get("id"),
                "did": did,
                "caller_id": vm.get("callerid"),
                "date": datetime.strptime(vm.get("date"), "%Y-%m-%d %H:%M:%S"),
                "duration": int(vm.get("duration", 0)),
                "file_url": vm.get("file"),
                "transcription": vm.get("transcription"),
                "listened": vm.get("listened") == "1"
            })
        
        return messages
    
    async def delete_voicemail(
        self,
        did: str,
        message_id: str
    ) -> Dict[str, Any]:
        """Delete voicemail message."""
        params = {
            "did": did,
            "message_id": message_id
        }
        
        response = await self._make_voipms_request("deleteVoicemail", params)
        
        return {
            "message_id": message_id,
            "status": "deleted",
            "message": response.get("message", "Voicemail deleted successfully")
        }
    
    # Conference Management
    
    async def create_conference(
        self,
        settings: ConferenceSettings
    ) -> Dict[str, Any]:
        """Create conference room."""
        params = {
            "room": settings.room_number,
            "pin_required": "1" if settings.pin_required else "0",
            "max_users": settings.max_participants,
            "record": "1" if settings.recording_enabled else "0",
            "mute_on_entry": "1" if settings.mute_on_entry else "0"
        }
        
        if settings.admin_pin:
            params["admin_pin"] = settings.admin_pin
        
        if settings.user_pin:
            params["user_pin"] = settings.user_pin
        
        response = await self._make_voipms_request("createConference", params)
        
        return {
            "room_number": settings.room_number,
            "conference_id": response.get("conference_id"),
            "status": "created",
            "dial_in_number": response.get("dial_in"),
            "message": response.get("message", "Conference created successfully")
        }
    
    async def get_conference_participants(
        self,
        room_number: str
    ) -> List[Dict[str, Any]]:
        """Get active conference participants."""
        params = {"room": room_number}
        
        response = await self._make_voipms_request("getConferenceParticipants", params)
        
        participants = []
        for participant in response.get("participants", []):
            participants.append({
                "participant_id": participant.get("id"),
                "caller_id": participant.get("callerid"),
                "joined_at": datetime.strptime(participant.get("joined"), "%Y-%m-%d %H:%M:%S"),
                "muted": participant.get("muted") == "1",
                "admin": participant.get("admin") == "1",
                "duration": int(participant.get("duration", 0))
            })
        
        return participants
    
    async def mute_conference_participant(
        self,
        room_number: str,
        participant_id: str,
        mute: bool = True
    ) -> Dict[str, Any]:
        """Mute/unmute conference participant."""
        params = {
            "room": room_number,
            "participant": participant_id,
            "action": "mute" if mute else "unmute"
        }
        
        response = await self._make_voipms_request("controlConference", params)
        
        return {
            "participant_id": participant_id,
            "action": "muted" if mute else "unmuted",
            "message": response.get("message", f"Participant {'muted' if mute else 'unmuted'}")
        }
    
    async def kick_conference_participant(
        self,
        room_number: str,
        participant_id: str
    ) -> Dict[str, Any]:
        """Remove participant from conference."""
        params = {
            "room": room_number,
            "participant": participant_id,
            "action": "kick"
        }
        
        response = await self._make_voipms_request("controlConference", params)
        
        return {
            "participant_id": participant_id,
            "action": "removed",
            "message": response.get("message", "Participant removed from conference")
        }
    
    # Call Recording Management
    
    async def get_call_recordings(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        did: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get call recordings."""
        params = {"limit": limit}
        
        if date_from:
            params["date_from"] = date_from.strftime("%Y-%m-%d")
        if date_to:
            params["date_to"] = date_to.strftime("%Y-%m-%d")
        if did:
            params["did"] = did
        
        response = await self._make_voipms_request("getRecordings", params)
        
        recordings = []
        for recording in response.get("recordings", []):
            recordings.append({
                "recording_id": recording.get("id"),
                "call_id": recording.get("uniqueid"),
                "date": datetime.strptime(recording.get("date"), "%Y-%m-%d %H:%M:%S"),
                "caller_id": recording.get("callerid"),
                "destination": recording.get("destination"),
                "duration": int(recording.get("duration", 0)),
                "file_url": recording.get("file"),
                "file_size": int(recording.get("size", 0)),
                "format": recording.get("format", "mp3"),
                "download_url": recording.get("download")
            })
        
        return recordings
    
    async def download_recording(
        self,
        recording_id: str,
        save_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Download call recording file."""
        params = {"recording_id": recording_id}
        
        response = await self._make_voipms_request("getRecordingFile", params)
        
        file_url = response.get("file_url")
        if not file_url:
            raise IntegrationError("Recording file URL not available")
        
        # Download file
        async with self.client.stream("GET", file_url) as r:
            r.raise_for_status()
            
            if save_path:
                with open(save_path, "wb") as f:
                    async for chunk in r.aiter_bytes():
                        f.write(chunk)
                
                return {
                    "recording_id": recording_id,
                    "file_path": save_path,
                    "status": "downloaded"
                }
            else:
                content = await r.aread()
                return {
                    "recording_id": recording_id,
                    "content": content,
                    "content_type": r.headers.get("content-type"),
                    "size": len(content)
                }
    
    async def delete_recording(self, recording_id: str) -> Dict[str, Any]:
        """Delete call recording."""
        params = {"recording_id": recording_id}
        
        response = await self._make_voipms_request("deleteRecording", params)
        
        return {
            "recording_id": recording_id,
            "status": "deleted",
            "message": response.get("message", "Recording deleted successfully")
        }
    
    # Real-time Monitoring
    
    async def get_active_calls(self) -> List[Dict[str, Any]]:
        """Get currently active calls."""
        response = await self._make_voipms_request("getActiveCalls", {})
        
        active_calls = []
        for call in response.get("calls", []):
            active_calls.append({
                "call_id": call.get("uniqueid"),
                "caller_id": call.get("callerid"),
                "destination": call.get("destination"),
                "status": call.get("status"),
                "start_time": datetime.strptime(call.get("start"), "%Y-%m-%d %H:%M:%S"),
                "duration": int(call.get("duration", 0)),
                "channel": call.get("channel"),
                "recording": call.get("recording") == "1"
            })
        
        return active_calls
    
    async def get_system_status(self) -> Dict[str, Any]:
        """Get VoIP.ms system status."""
        response = await self._make_voipms_request("getServerInfo", {}, use_cache=True)
        
        return {
            "server_time": response.get("server_time"),
            "server_load": response.get("load"),
            "active_calls": int(response.get("active_calls", 0)),
            "system_status": response.get("status", "online"),
            "maintenance_mode": response.get("maintenance") == "1"
        }
    
    # Analytics and Reporting
    
    async def get_usage_statistics(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get usage statistics and analytics."""
        if not date_from:
            date_from = datetime.now() - timedelta(days=30)
        if not date_to:
            date_to = datetime.now()
        
        # Get call history for analytics
        calls = await self.get_call_history(date_from, date_to, limit=1000)
        sms_history = await self.get_sms_history(date_from, date_to, limit=1000)
        
        # Calculate metrics
        total_calls = len(calls)
        total_sms = len(sms_history)
        total_duration = sum(call["duration"] for call in calls)
        total_cost = sum(call["cost"] for call in calls)
        
        # Call type breakdown
        inbound_calls = len([c for c in calls if c["type"] == VoipMSCallType.INBOUND.value])
        outbound_calls = len([c for c in calls if c["type"] == VoipMSCallType.OUTBOUND.value])
        
        # Average metrics
        avg_call_duration = total_duration / total_calls if total_calls > 0 else 0
        avg_cost_per_call = total_cost / total_calls if total_calls > 0 else 0
        
        return {
            "period": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "days": (date_to - date_from).days
            },
            "calls": {
                "total": total_calls,
                "inbound": inbound_calls,
                "outbound": outbound_calls,
                "total_duration": total_duration,
                "avg_duration": round(avg_call_duration, 2),
                "total_cost": round(total_cost, 2),
                "avg_cost": round(avg_cost_per_call, 4)
            },
            "sms": {
                "total": total_sms,
                "sent": len([s for s in sms_history if s["type"] == "0"]),
                "received": len([s for s in sms_history if s["type"] == "1"])
            },
            "daily_averages": {
                "calls_per_day": round(total_calls / max(1, (date_to - date_from).days), 2),
                "sms_per_day": round(total_sms / max(1, (date_to - date_from).days), 2),
                "cost_per_day": round(total_cost / max(1, (date_to - date_from).days), 2)
            }
        }
    
    async def get_integration_metrics(self) -> Dict[str, Any]:
        """Get integration-specific metrics."""
        base_metrics = await self.get_metrics()
        
        try:
            account_info = await self.get_account_info()
            active_calls = await self.get_active_calls()
            
            return {
                **base_metrics,
                "integration_type": "voipms",
                "account_balance": account_info.get("balance", 0),
                "active_calls_count": len(active_calls),
                "features_enabled": {
                    "voice_calls": True,
                    "sms": True,
                    "recording": self.config.recording_enabled,
                    "voicemail": True,
                    "conferencing": True,
                    "webhooks": self.webhook_handler is not None
                }
            }
        except Exception as e:
            self.logger.warning(f"Could not fetch additional metrics: {e}")
            return {
                **base_metrics,
                "integration_type": "voipms"
            }


class VoipMSWebhookHandler(WebhookHandler):
    """Handle VoIP.ms webhooks for real-time events."""
    
    async def process_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Process VoIP.ms webhook events."""
        self.logger.info(f"Processing VoIP.ms webhook: {event_type}")
        
        if event_type == "call_start":
            await self._handle_call_start(data)
        elif event_type == "call_end":
            await self._handle_call_end(data)
        elif event_type == "sms_received":
            await self._handle_sms_received(data)
        elif event_type == "voicemail_received":
            await self._handle_voicemail_received(data)
        elif event_type == "recording_ready":
            await self._handle_recording_ready(data)
        else:
            self.logger.warning(f"Unknown webhook event type: {event_type}")
    
    async def _handle_call_start(self, data: Dict[str, Any]) -> None:
        """Handle call start event."""
        self.logger.info(f"Call started: {data.get('call_id')} from {data.get('caller_id')}")
        # Implement call start handling logic
        
    async def _handle_call_end(self, data: Dict[str, Any]) -> None:
        """Handle call end event."""
        self.logger.info(f"Call ended: {data.get('call_id')} duration: {data.get('duration')}")
        # Implement call end handling logic
        
    async def _handle_sms_received(self, data: Dict[str, Any]) -> None:
        """Handle SMS received event."""
        self.logger.info(f"SMS received on {data.get('did')} from {data.get('from')}")
        # Implement SMS handling logic
        
    async def _handle_voicemail_received(self, data: Dict[str, Any]) -> None:
        """Handle voicemail received event."""
        self.logger.info(f"Voicemail received on {data.get('did')}")
        # Implement voicemail handling logic
        
    async def _handle_recording_ready(self, data: Dict[str, Any]) -> None:
        """Handle recording ready event."""
        self.logger.info(f"Recording ready: {data.get('recording_id')}")
        # Implement recording ready handling logic


# Export classes
__all__ = [
    "AdvancedVoipMS",
    "VoipMSConfig",
    "VoipMSWebhookHandler",
    "VoipMSCallStatus",
    "VoipMSSMSStatus",
    "VoipMSCallType",
    "VoipMSRecordingFormat",
    "PhoneNumber",
    "CallRequest",
    "SMSRequest",
    "CallRouting",
    "VoicemailSettings",
    "ConferenceSettings"
]