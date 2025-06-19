# DroneStrike API Endpoints Summary
This document provides a comprehensive overview of all the API endpoints created for the DroneStrike v2 backend system.

The DroneStrike API consists of 10 main modules that provide complete functionality:

1. **Authentication APIs** - User authentication, registration, password management, 2FA
2. **User Management APIs** - Profile management, user administration
3. **Mission Management APIs** - Mission operations, tracking, assignment
4. **Task Management APIs** - Kanban boards, task CRUD, time tracking
5. **Opportunity Management APIs** - Sales pipeline, proposals, revenue tracking
6. **Communication APIs** - Email management, templates, campaigns
7. **Marketing APIs** - Campaign creation, analytics, audience management
8. **Integration APIs** - Third-party integrations, webhooks, sync management
9. **Admin APIs** - System administration, user management, analytics
10. **File Management APIs** - Upload, download, sharing, document management

## API Module Details

### 1. Authentication APIs (`/api/auth/`)
**Improved Features:**
- User registration with email verification
- Secure login with optional 2FA
- Password reset with email tokens
- JWT token management (access + refresh)
- OAuth2 compatibility
- Account security features

**Key Endpoints:**
- `POST /register` - User registration
- `POST /login` - User authentication  
- `POST /forgot-password` - Password reset request
- `POST /reset-password` - Password reset with token
- `POST /2fa/setup` - Setup two-factor authentication
- `POST /2fa/verify` - Verify and enable 2FA
- `POST /refresh` - Refresh access tokens
- `GET /me` - Get current user info
- `POST /logout` - User logout
- `POST /logout-all` - Logout from all devices

### 2. Task Management APIs (`/api/tasks/`)

**Features:**
- Kanban board functionality
- Task creation, assignment, and tracking
- Time logging and progress tracking
- Comments and collaboration
- Bulk operations
- Task analytics

**Key Endpoints:**
- `POST /` - Create new task
- `GET /` - Get tasks with filtering
- `GET /kanban` - Get kanban board view
- `PUT /{task_id}` - Update task
- `POST /time-logs` - Log time on task
- `POST /comments` - Add task comment
- `POST /bulk/update` - Bulk update tasks
- `GET /stats/overview` - Task statistics
- `GET /my-tasks` - Get user's assigned tasks
- `GET /overdue` - Get overdue tasks

### 3. Communications APIs (`/api/communications/`)

**Features:**
- Email composition and sending
- Template management
- Email campaigns
- Contact and list management
- Email tracking (opens, clicks)
- Analytics and reporting

**Key Endpoints:**
- `POST /emails` - Create and send email
- `GET /emails` - Get emails with filtering
- `POST /templates` - Create email template
- `GET /templates` - Get email templates
- `POST /campaigns` - Create email campaign
- `POST /campaigns/{id}/send` - Send campaign
- `POST /contacts` - Create contact
- `POST /contacts/import` - Import contacts from CSV
- `POST /lists` - Create contact list
- `GET /stats/overview` - Email statistics

### 4. Marketing APIs (`/api/marketing/`)

**Features:**
- Multi-channel campaign management
- Ad group and ad creation
- Audience targeting
- Landing page management
- UTM tracking
- A/B testing
- Marketing automation
- Performance analytics

**Key Endpoints:**
- `POST /campaigns` - Create marketing campaign
- `GET /campaigns` - Get campaigns with filtering
- `POST /ad-groups` - Create ad group
- `POST /ads` - Create advertisement
- `POST /audiences` - Create target audience
- `POST /landing-pages` - Create landing page
- `POST /utm/generate` - Generate UTM tracking URL
- `POST /automation` - Create marketing automation
- `GET /stats/overview` - Marketing statistics
- `GET /campaigns/{id}/performance` - Campaign performance

### 5. Integrations APIs (`/api/integrations/`)

**Features:**
- Third-party service connections
- OAuth and API key authentication
- Data synchronization
- Webhook management
- Integration monitoring
- Provider-specific configurations

**Key Endpoints:**
- `POST /` - Create integration
- `GET /` - Get integrations
- `POST /{id}/test` - Test integration connection
- `POST /{id}/sync` - Trigger manual sync
- `POST /connect/oauth` - OAuth connection
- `POST /connect/api-key` - API key connection
- `POST /webhooks` - Create webhook
- `GET /webhooks` - Get webhooks
- `POST /sync-configs` - Create sync configuration
- `GET /stats/overview` - Integration statistics
- `GET /providers` - Get supported providers

### 6. Admin APIs (`/api/admin/`)

**Features:**
- User management and administration
- System monitoring and statistics
- Token management
- Audit logging
- System configuration
- Data export and backup
- Maintenance mode

**Key Endpoints:**
- `POST /users` - Create user (admin)
- `GET /users` - Get all users with filtering
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user
- `POST /users/{id}/impersonate` - Impersonate user
- `POST /users/bulk-action` - Bulk user operations
- `POST /tokens/adjust` - Adjust user tokens
- `GET /stats/overview` - System statistics
- `GET /audit-logs` - Get audit logs
- `GET /system-logs` - Get system logs
- `POST /maintenance` - Set maintenance mode
- `POST /backup` - Create system backup

### 7. Files APIs (`/api/files/`)

**Features:**
- File upload and storage
- File organization (folders)
- File sharing and permissions
- Public download links
- File previews and thumbnails
- Bulk operations
- Storage analytics

**Key Endpoints:**
- `POST /upload` - Upload single file
- `POST /upload/multiple` - Upload multiple files
- `GET /` - Get files with filtering
- `GET /{id}` - Get file details
- `PUT /{id}` - Update file metadata
- `DELETE /{id}` - Delete file
- `GET /{id}/download` - Download file
- `GET /{id}/preview` - Preview file
- `POST /folders` - Create folder
- `POST /share` - Share file with user
- `POST /links` - Create public download link
- `GET /stats` - File storage statistics
- `POST /bulk/delete` - Bulk delete files

### 8. User Management APIs (Enhanced)

**Additional endpoints beyond authentication:**
- Profile management
- Billing and subscription management
- User preferences and settings
- Activity tracking

### 9. Mission Management APIs (Enhanced)

**Additional mission-specific functionality:**
- Mission planning and scheduling
- Resource allocation
- Mission status tracking
- Reporting and analytics

### 10. Opportunity Management APIs (Enhanced)

**CRM and sales functionality:**
- Lead management
- Deal pipeline
- Proposal generation
- Revenue tracking

## API Architecture Features

### Security
- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting capabilities
- Input validation and sanitization
- HTTPS enforcement
- CORS configuration

### Data Validation
- Pydantic models for request/response validation
- Custom validators for business logic
- Comprehensive error handling
- Type safety with Python typing

### Performance
- Pagination for large datasets
- Filtering and search capabilities
- Background task processing
- Bulk operations for efficiency
- Database query optimization

### Documentation
- OpenAPI/Swagger documentation
- Comprehensive endpoint descriptions
- Request/response examples
- Error code documentation

### Integration
- Seamless integration with page classes
- Database abstraction layer
- Service layer architecture
- Event-driven architecture support

## Request/Response Patterns

### Standard Response Format
```json
{
  "success": true,
  "data": {...},
  "errors": null,
  "message": "Operation completed successfully"
}
```

### Error Response Format
```json
{
  "detail": "Error description",
  "status_code": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Pagination Format
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "has_next": true,
  "has_prev": false
}
```

## Authentication Flow

1. **Registration**: `POST /api/auth/register`
2. **Email Verification**: Click email link → `POST /api/auth/verify-email`
3. **Login**: `POST /api/auth/login` → Returns access + refresh tokens
4. **API Access**: Include `Authorization: Bearer <access_token>` header
5. **Token Refresh**: `POST /api/auth/refresh` when access token expires

## Rate Limiting

- Authentication endpoints: 5 requests/minute
- File upload endpoints: 10 requests/minute
- General endpoints: 100 requests/minute
- Admin endpoints: 50 requests/minute

## File Upload Limits

- Single file: 100MB maximum
- Multiple files: 10 files per request
- Supported formats: PDF, DOC, DOCX, images, videos, archives
- Virus scanning enabled
- Automatic thumbnail generation for images

## Webhook System

- Real-time event notifications
- Secure webhook signatures
- Retry mechanisms for failed deliveries
- Comprehensive logging and monitoring
- Support for multiple event types

## Integration Capabilities

### Supported Providers
- **Email**: Gmail, Outlook, SendGrid
- **Calendar**: Google Calendar, Outlook Calendar
- **CRM**: Salesforce, HubSpot, Pipedrive
- **Payment**: Stripe, PayPal
- **Storage**: AWS S3, Google Drive, Dropbox
- **Communication**: Slack, Microsoft Teams
- **Analytics**: Google Analytics, Mixpanel

## Deployment Considerations

### Environment Variables
- Database connections
- JWT secrets
- Third-party API keys
- Email service configuration
- File storage settings

### Scaling
- Horizontal scaling support
- Database connection pooling
- Redis for caching and sessions
- Celery for background tasks
- Load balancer configuration

### Monitoring
- Health check endpoints
- Metrics collection
- Error tracking
- Performance monitoring
- Audit trail logging

This comprehensive API system provides all the functionality needed for the DroneStrike platform, with proper security, scalability, and maintainability considerations built in.