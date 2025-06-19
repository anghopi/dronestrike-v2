"""
Advanced Security Utilities
Production-ready security functions with comprehensive protection and key management.
"""

import hashlib
import hmac
import secrets
import string
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
import bcrypt
import jwt
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os
from email_validator import validate_email, EmailNotValidError
import ipaddress
from user_agents import parse as parse_user_agent

from core.config import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)

class SecurityManager:
    """Comprehensive security manager with advanced protection features."""
    
    def __init__(self):
        self.secret_key = settings.SECRET_KEY.encode()
        self.algorithm = 'HS256'
        self.password_pepper = settings.PASSWORD_PEPPER.encode() if hasattr(settings, 'PASSWORD_PEPPER') else b''
        
        # Initialize encryption
        self._setup_encryption()
        
        # Security patterns
        self.suspicious_patterns = [
            r'<script.*?>.*?</script>',
            r'javascript:',
            r'onload\s*=',
            r'onerror\s*=',
            r'eval\s*\(',
            r'document\.cookie',
            r'window\.location',
            r'<iframe.*?>',
            r'<object.*?>',
            r'<embed.*?>'
        ]
        
        # Rate limiting storage (in production, use Redis)
        self._rate_limit_storage = {}
        
        # Failed login attempts storage
        self._failed_attempts = {}
    
    def _setup_encryption(self):
        """Setup encryption keys and ciphers."""
        try:
            # Main encryption key
            if hasattr(settings, 'ENCRYPTION_KEY'):
                self.fernet = Fernet(settings.ENCRYPTION_KEY.encode())
            else:
                # Generate new key if not provided
                key = Fernet.generate_key()
                self.fernet = Fernet(key)
                logger.warning("Using generated encryption key - set ENCRYPTION_KEY in production")
            
            # RSA key pair for asymmetric encryption
            self._setup_rsa_keys()
            
        except Exception as e:
            logger.error(f"Failed to setup encryption: {e}")
            raise
    
    def _setup_rsa_keys(self):
        """Setup RSA key pair for asymmetric encryption."""
        try:
            # Check if keys exist
            private_key_path = os.path.join(settings.BASE_DIR, 'keys', 'private_key.pem')
            public_key_path = os.path.join(settings.BASE_DIR, 'keys', 'public_key.pem')
            
            os.makedirs(os.path.dirname(private_key_path), exist_ok=True)
            
            if os.path.exists(private_key_path) and os.path.exists(public_key_path):
                # Load existing keys
                with open(private_key_path, 'rb') as f:
                    self.private_key = serialization.load_pem_private_key(
                        f.read(),
                        password=None,
                        backend=default_backend()
                    )
                
                with open(public_key_path, 'rb') as f:
                    self.public_key = serialization.load_pem_public_key(
                        f.read(),
                        backend=default_backend()
                    )
            else:
                # Generate new keys
                self.private_key = rsa.generate_private_key(
                    public_exponent=65537,
                    key_size=2048,
                    backend=default_backend()
                )
                self.public_key = self.private_key.public_key()
                
                # Save keys
                with open(private_key_path, 'wb') as f:
                    f.write(self.private_key.private_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PrivateFormat.PKCS8,
                        encryption_algorithm=serialization.NoEncryption()
                    ))
                
                with open(public_key_path, 'wb') as f:
                    f.write(self.public_key.public_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PublicFormat.SubjectPublicKeyInfo
                    ))
                
                # Set appropriate permissions
                os.chmod(private_key_path, 0o600)
                os.chmod(public_key_path, 0o644)
                
        except Exception as e:
            logger.error(f"Failed to setup RSA keys: {e}")
            # Continue without RSA encryption
            self.private_key = None
            self.public_key = None
    
    # Password Security
    def hash_password(self, password: str) -> str:
        """Hash password with bcrypt and pepper."""
        try:
            # Add pepper before hashing
            peppered_password = password.encode('utf-8') + self.password_pepper
            
            # Generate salt and hash
            salt = bcrypt.gensalt(rounds=12)
            hashed = bcrypt.hashpw(peppered_password, salt)
            
            return hashed.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Password hashing failed: {e}")
            raise
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        try:
            peppered_password = password.encode('utf-8') + self.password_pepper
            return bcrypt.checkpw(peppered_password, hashed_password.encode('utf-8'))
            
        except Exception as e:
            logger.error(f"Password verification failed: {e}")
            return False
    
    def generate_password(self, length: int = 16, include_symbols: bool = True) -> str:
        """Generate cryptographically secure password."""
        characters = string.ascii_letters + string.digits
        if include_symbols:
            characters += "!@#$%^&*"
        
        password = ''.join(secrets.choice(characters) for _ in range(length))
        
        # Ensure password meets complexity requirements
        if not self.validate_password_strength(password):
            return self.generate_password(length, include_symbols)
        
        return password
    
    def validate_password_strength(self, password: str) -> Dict[str, Any]:
        """Validate password strength with detailed feedback."""
        issues = []
        score = 0
        
        # Length check
        if len(password) < 8:
            issues.append("Password must be at least 8 characters long")
        elif len(password) >= 12:
            score += 2
        else:
            score += 1
        
        # Character variety checks
        if not re.search(r'[a-z]', password):
            issues.append("Password must contain lowercase letters")
        else:
            score += 1
        
        if not re.search(r'[A-Z]', password):
            issues.append("Password must contain uppercase letters")
        else:
            score += 1
        
        if not re.search(r'\d', password):
            issues.append("Password must contain numbers")
        else:
            score += 1
        
        if not re.search(r'[!@#$%^&*(),.?\":{}|<>]', password):
            issues.append("Password should contain special characters")
        else:
            score += 2
        
        # Common patterns
        if re.search(r'(.)\1{2,}', password):
            issues.append("Password should not contain repeated characters")
            score -= 1
        
        if re.search(r'(012|123|234|345|456|567|678|789|890)', password):
            issues.append("Password should not contain sequential numbers")
            score -= 1
        
        if re.search(r'(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)', password.lower()):
            issues.append("Password should not contain sequential letters")
            score -= 1
        
        # Common passwords check (simplified)
        common_passwords = [
            'password', '123456', 'password123', 'admin', 'qwerty',
            'letmein', 'welcome', 'monkey', '1234567890'
        ]
        if password.lower() in common_passwords:
            issues.append("Password is too common")
            score = 0
        
        # Determine strength
        if score >= 7:
            strength = "Very Strong"
        elif score >= 5:
            strength = "Strong"
        elif score >= 3:
            strength = "Moderate"
        elif score >= 1:
            strength = "Weak"
        else:
            strength = "Very Weak"
        
        return {
            'valid': len(issues) == 0,
            'strength': strength,
            'score': score,
            'issues': issues
        }
    
    # JWT Token Management
    def create_jwt_token(self, payload: Dict[str, Any], expires_in: int = 3600) -> str:
        """Create JWT token with expiration."""
        try:
            # Add standard claims
            now = datetime.utcnow()
            payload.update({
                'iat': now,
                'exp': now + timedelta(seconds=expires_in),
                'iss': settings.APP_NAME,
            })
            
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            return token
            
        except Exception as e:
            logger.error(f"JWT creation failed: {e}")
            raise
    
    def verify_jwt_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            raise ValueError("Token expired")
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            raise ValueError("Invalid token")
    
    def create_refresh_token(self, user_id: int) -> str:
        """Create long-lived refresh token."""
        payload = {
            'user_id': user_id,
            'type': 'refresh',
            'jti': secrets.token_urlsafe(32)  # Unique token ID
        }
        
        return self.create_jwt_token(payload, expires_in=86400 * 30)  # 30 days
    
    def create_access_token(self, user_id: int, role: str, permissions: List[str] = None) -> str:
        """Create short-lived access token."""
        payload = {
            'user_id': user_id,
            'role': role,
            'permissions': permissions or [],
            'type': 'access'
        }
        
        return self.create_jwt_token(payload, expires_in=3600)  # 1 hour
    
    # Data Encryption
    def encrypt_data(self, data: Union[str, bytes]) -> str:
        """Encrypt data using Fernet."""
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            encrypted = self.fernet.encrypt(data)
            return base64.urlsafe_b64encode(encrypted).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Data encryption failed: {e}")
            raise
    
    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt data using Fernet."""
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode('utf-8'))
            decrypted = self.fernet.decrypt(encrypted_bytes)
            return decrypted.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Data decryption failed: {e}")
            raise
    
    def encrypt_with_rsa(self, data: Union[str, bytes]) -> Optional[str]:
        """Encrypt data with RSA public key."""
        if not self.public_key:
            logger.warning("RSA public key not available")
            return None
        
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            encrypted = self.public_key.encrypt(
                data,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            return base64.urlsafe_b64encode(encrypted).decode('utf-8')
            
        except Exception as e:
            logger.error(f"RSA encryption failed: {e}")
            return None
    
    def decrypt_with_rsa(self, encrypted_data: str) -> Optional[str]:
        """Decrypt data with RSA private key."""
        if not self.private_key:
            logger.warning("RSA private key not available")
            return None
        
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode('utf-8'))
            
            decrypted = self.private_key.decrypt(
                encrypted_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            return decrypted.decode('utf-8')
            
        except Exception as e:
            logger.error(f"RSA decryption failed: {e}")
            return None
    
    # Input Validation and Sanitization
    def validate_email(self, email: str) -> bool:
        """Validate email address format."""
        try:
            valid = validate_email(email)
            return True
        except EmailNotValidError:
            return False
    
    def sanitize_input(self, input_data: str) -> str:
        """Sanitize user input to prevent XSS and injection attacks."""
        if not isinstance(input_data, str):
            return str(input_data)
        
        # Remove suspicious patterns
        sanitized = input_data
        for pattern in self.suspicious_patterns:
            sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
        
        # HTML entity encoding for special characters
        html_entities = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '&': '&amp;'
        }
        
        for char, entity in html_entities.items():
            sanitized = sanitized.replace(char, entity)
        
        return sanitized.strip()
    
    def validate_sql_input(self, input_data: str) -> bool:
        """Check for SQL injection patterns."""
        sql_patterns = [
            r'\bunion\b', r'\bselect\b', r'\binsert\b', r'\bupdate\b',
            r'\bdelete\b', r'\bdrop\b', r'\bcreate\b', r'\balter\b',
            r'\bexec\b', r'\bexecute\b', r'--', r'/\*', r'\*/',
            r'\bor\b.*=.*\bor\b', r'\band\b.*=.*\band\b'
        ]
        
        for pattern in sql_patterns:
            if re.search(pattern, input_data.lower()):
                logger.warning(f"Potential SQL injection detected: {pattern}")
                return False
        
        return True
    
    # Rate Limiting
    def check_rate_limit(self, identifier: str, limit: int, window: int) -> bool:
        """Check if identifier exceeds rate limit."""
        now = datetime.utcnow()
        
        if identifier not in self._rate_limit_storage:
            self._rate_limit_storage[identifier] = []
        
        # Clean old requests
        cutoff = now - timedelta(seconds=window)
        self._rate_limit_storage[identifier] = [
            req_time for req_time in self._rate_limit_storage[identifier]
            if req_time > cutoff
        ]
        
        # Check limit
        if len(self._rate_limit_storage[identifier]) >= limit:
            return False
        
        # Add current request
        self._rate_limit_storage[identifier].append(now)
        return True
    
    def track_failed_login(self, identifier: str) -> int:
        """Track failed login attempts."""
        now = datetime.utcnow()
        
        if identifier not in self._failed_attempts:
            self._failed_attempts[identifier] = []
        
        # Clean old attempts (last hour)
        cutoff = now - timedelta(hours=1)
        self._failed_attempts[identifier] = [
            attempt_time for attempt_time in self._failed_attempts[identifier]
            if attempt_time > cutoff
        ]
        
        # Add current attempt
        self._failed_attempts[identifier].append(now)
        
        return len(self._failed_attempts[identifier])
    
    def clear_failed_logins(self, identifier: str):
        """Clear failed login attempts after successful login."""
        if identifier in self._failed_attempts:
            del self._failed_attempts[identifier]
    
    def is_account_locked(self, identifier: str, max_attempts: int = 5) -> bool:
        """Check if account is locked due to failed attempts."""
        if identifier not in self._failed_attempts:
            return False
        
        return len(self._failed_attempts[identifier]) >= max_attempts
    
    # Security Headers and CSRF
    def generate_csrf_token(self, user_id: int) -> str:
        """Generate CSRF token."""
        payload = {
            'user_id': user_id,
            'type': 'csrf',
            'random': secrets.token_urlsafe(16)
        }
        
        return self.create_jwt_token(payload, expires_in=3600)
    
    def verify_csrf_token(self, token: str, user_id: int) -> bool:
        """Verify CSRF token."""
        try:
            payload = self.verify_jwt_token(token)
            return (
                payload.get('type') == 'csrf' and
                payload.get('user_id') == user_id
            )
        except:
            return False
    
    def get_security_headers(self) -> Dict[str, str]:
        """Get security headers for HTTP responses."""
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none'"
            ),
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        }
    
    # IP and User Agent Analysis
    def is_suspicious_ip(self, ip_address: str) -> bool:
        """Check if IP address is suspicious."""
        try:
            ip = ipaddress.ip_address(ip_address)
            
            # Check for private/local addresses
            if ip.is_private or ip.is_loopback:
                return False
            
            # Check against known bad IP ranges (simplified)
            # In production, use threat intelligence feeds
            suspicious_ranges = [
                '10.0.0.0/8',
                '172.16.0.0/12',
                '192.168.0.0/16'
            ]
            
            for range_str in suspicious_ranges:
                if ip in ipaddress.ip_network(range_str):
                    return True
            
            return False
            
        except ValueError:
            # Invalid IP address
            return True
    
    def analyze_user_agent(self, user_agent_string: str) -> Dict[str, Any]:
        """Analyze user agent for suspicious patterns."""
        try:
            user_agent = parse_user_agent(user_agent_string)
            
            # Check for bot patterns
            bot_patterns = [
                'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
                'python-requests', 'postman', 'insomnia'
            ]
            
            is_bot = any(pattern in user_agent_string.lower() for pattern in bot_patterns)
            
            return {
                'browser': user_agent.browser.family,
                'browser_version': user_agent.browser.version_string,
                'os': user_agent.os.family,
                'os_version': user_agent.os.version_string,
                'device': user_agent.device.family,
                'is_mobile': user_agent.is_mobile,
                'is_tablet': user_agent.is_tablet,
                'is_pc': user_agent.is_pc,
                'is_bot': is_bot,
                'is_suspicious': is_bot or user_agent_string == ''
            }
            
        except Exception as e:
            logger.warning(f"User agent analysis failed: {e}")
            return {
                'is_suspicious': True,
                'error': str(e)
            }
    
    # Secure Random Generation
    def generate_secure_token(self, length: int = 32) -> str:
        """Generate cryptographically secure random token."""
        return secrets.token_urlsafe(length)
    
    def generate_api_key(self) -> str:
        """Generate API key with prefix."""
        prefix = "ds_"  # DroneStrike prefix
        random_part = secrets.token_urlsafe(32)
        return f"{prefix}{random_part}"
    
    def generate_otp(self, length: int = 6) -> str:
        """Generate numeric OTP."""
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    
    # HMAC Signatures
    def create_signature(self, data: str, secret: Optional[str] = None) -> str:
        """Create HMAC signature for data."""
        secret_key = secret.encode() if secret else self.secret_key
        signature = hmac.new(
            secret_key,
            data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_signature(self, data: str, signature: str, secret: Optional[str] = None) -> bool:
        """Verify HMAC signature."""
        expected_signature = self.create_signature(data, secret)
        return hmac.compare_digest(signature, expected_signature)
    
    # File Security
    def is_safe_filename(self, filename: str) -> bool:
        """Check if filename is safe."""
        # Remove path components
        filename = os.path.basename(filename)
        
        # Check for dangerous patterns
        dangerous_patterns = [
            '..', '/', '\\', ':', '*', '?', '"', '<', '>', '|',
            'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3',
            'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6',
            'LPT7', 'LPT8', 'LPT9'
        ]
        
        for pattern in dangerous_patterns:
            if pattern in filename.upper():
                return False
        
        # Check length
        if len(filename) > 255:
            return False
        
        # Check for empty or dot-only names
        if not filename or filename.strip('.') == '':
            return False
        
        return True
    
    def get_safe_filename(self, filename: str) -> str:
        """Get safe version of filename."""
        if self.is_safe_filename(filename):
            return filename
        
        # Sanitize filename
        safe_filename = re.sub(r'[^\w\-_\.]', '_', filename)
        safe_filename = safe_filename[:255]  # Limit length
        
        if not safe_filename or safe_filename.strip('.') == '':
            safe_filename = f"file_{secrets.token_urlsafe(8)}"
        
        return safe_filename