# DroneStrike v2 Backend - Production Deployment Guide

##System Requirements

### Minimum Requirements
- **Python**: 3.11+
- **PostgreSQL**: 15+
- **Redis**: 7+
- **Memory**: 4GB RAM
- **Storage**: 20GB SSD
- **CPU**: 2 cores

### Production Requirements
- **Memory**: 16GB+ RAM
- **Storage**: 100GB+ SSD
- **CPU**: 8+ cores
- **Network**: 1Gbps+
- **Load Balancer**: Nginx/HAProxy
- **Container Runtime**: Docker 20.10+

## Quick Start

### 1. Environment Setup

```bash
# Clone and navigate to project
cd backend-python

# Copy environment template
cp .env.example .env.production

# Edit configuration
nano .env.production
```

### 2. Database Setup

```bash
# Initialize database
python -m cli.main db migrate up

# Create admin user
python -m cli.main users create \
  --email admin@yourdomain.com \
  --role admin \
  --first-name Admin \
  --last-name User
```

### 3. Start Services

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.production.yml up -d
```

### 4. Verify Installation

```bash
# Check system status
python -m cli.main status

# Run health checks
python -m cli.main maintenance health

# Verify CLI tools
python -m cli.main help-commands
```

## 🛠️ CLI Management Tools

### Database Management

```bash
# Database information
python -m cli.main db info

# Run migrations
python -m cli.main db migrate up
python -m cli.main db migrate down --revision abc123

# Create backup
python -m cli.main db backup --compress --include-data

# Restore from backup
python -m cli.main db restore backup_20240101_120000.sql

# Optimize performance
python -m cli.main db optimize

# Real-time monitoring
python -m cli.main db monitor
```

### User Management

```bash
# Create user
python -m cli.main users create \
  --email user@example.com \
  --role agent \
  --first-name John \
  --last-name Doe

# List users with filters
python -m cli.main users list --role admin --active-only --limit 50

# Bulk import from CSV
python -m cli.main users bulk-import users.csv --dry-run
python -m cli.main users bulk-import users.csv --send-welcome

# User statistics
python -m cli.main users stats

# Deactivate user
python -m cli.main users deactivate user@example.com --reason "Policy violation"

# Change user role
python -m cli.main users change-role user@example.com admin
```

### System Maintenance

```bash
# Comprehensive health check
python -m cli.main maintenance health --verbose

# Clean up old data
python -m cli.main maintenance cleanup --days 30 --confirm

# Log management
python -m cli.main maintenance logs --rotate --compress

# Cache management
python -m cli.main maintenance cache clear --pattern "user:*"

# Performance optimization
python -m cli.main maintenance optimize --full
```

### Backup & Restore

```bash
# Create full system backup
python -m cli.main backup create --full --encrypt --upload-s3

# List available backups
python -m cli.main backup list --remote

# Restore from backup
python -m cli.main backup restore backup_20240101_120000.tar.gz --verify

# Schedule automated backups
python -m cli.main backup schedule --daily --time "02:00" --retention 30
```

### Development Tools

```bash
# Seed development data
python -m cli.main dev seed --users 100 --leads 500 --missions 50

# Interactive shell
python -m cli.main dev shell

# Generate mock data
python -m cli.main dev mock --type leads --count 1000 --output leads.csv

# Reset development environment
python -m cli.main dev reset --confirm
```

### Testing & Validation

```bash
# Run test suites
python -m cli.main test run --coverage --verbose

# Integration tests
python -m cli.main test integration --endpoint-tests --database-tests

# Performance tests
python -m cli.main test performance --load-test --duration 300

# Validate data integrity
python -m cli.main test validate --data-quality --consistency-checks
```

### Monitoring & Metrics

```bash
# Real-time dashboard
python -m cli.main monitor dashboard

# Export metrics
python -m cli.main monitor metrics --format prometheus --output metrics.txt

# Alert management
python -m cli.main monitor alerts list
python -m cli.main monitor alerts add --name high_cpu --threshold 80

# Performance analysis
python -m cli.main monitor performance --analyze --report
```

## ⚙️ Background Task System

### Task Categories

**Email Tasks**
- Welcome emails
- Password reset notifications
- Bulk email campaigns
- Bounce processing

**Communication Tasks**
- SMS/Voice message delivery
- Webhook processing
- Integration synchronization

**Data Processing Tasks**
- CSV import/export
- Data quality analysis
- Report generation
- Duplicate cleanup

**Maintenance Tasks**
- Automated backups
- Log rotation
- Cache cleanup
- Health monitoring

### Celery Workers

```bash
# Start workers
celery -A tasks.celery_app worker --loglevel=info --concurrency=4

# Start scheduler
celery -A tasks.celery_app beat --loglevel=info

# Monitor tasks
celery -A tasks.celery_app flower --port=5555

# Worker management
celery -A tasks.celery_app control shutdown
celery -A tasks.celery_app inspect active
celery -A tasks.celery_app purge
```

### Task Configuration

```python
# Custom task example
from tasks.celery_app import celery_app

@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,)
)
def custom_task(self, data):
    # Task implementation
    pass
```

## 🚢 Production Deployment

### Docker Deployment

```bash
# Build production image
docker build -f Dockerfile.production -t dronestrike/backend:2.0.0 .

# Run with Docker Compose
docker-compose -f docker-compose.production.yml up -d

# Scale services
docker-compose -f docker-compose.production.yml up -d --scale app=3 --scale celery-worker=2
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace dronestrike

# Apply configurations
kubectl apply -f kubernetes/

# Check deployment status
kubectl get pods -n dronestrike
kubectl get services -n dronestrike

# Scale deployment
kubectl scale deployment dronestrike-backend --replicas=5 -n dronestrike
```

### Blue-Green Deployment

```bash
# Automated blue-green deployment
./deploy/blue-green-deploy.sh deploy

# Check deployment status
./deploy/blue-green-deploy.sh status

# Rollback if needed
./deploy/blue-green-deploy.sh rollback green
```

## 📊 Monitoring & Observability

### Health Checks

```bash
# Application health
curl http://localhost:8000/health

# Database health
curl http://localhost:8000/health/db

# Detailed health report
curl http://localhost:8000/health/detailed
```

### Metrics & Logging

**Prometheus Metrics**: `http://localhost:8000/metrics`

**Grafana Dashboards**: `http://localhost:3000`

**Centralized Logging**: Structured JSON logs with correlation IDs

**Error Tracking**: Sentry integration for error monitoring

### Performance Monitoring

```bash
# Real-time performance monitoring
python -m cli.main monitor dashboard

# Performance analysis
python -m cli.main monitor performance --analyze

# Resource usage
python -m cli.main monitor system --cpu --memory --disk
```

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-factor authentication support
- Session management with Redis

### Data Protection
- Encryption at rest and in transit
- PII data encryption
- Secure password hashing (bcrypt)
- API rate limiting

### Security Headers
- OWASP security headers
- Content Security Policy (CSP)
- CORS configuration
- SSL/TLS enforcement

### Input Validation
- XSS prevention
- SQL injection protection
- Input sanitization
- File upload validation

## Performance Optimization

### Database Optimization

```bash
# Optimize database performance
python -m cli.main db optimize

# Analyze slow queries
python -m cli.main monitor db --slow-queries

# Index optimization
python -m cli.main db analyze-indexes
```

### Caching Strategy

```bash
# Cache management
python -m cli.main maintenance cache status
python -m cli.main maintenance cache clear --pattern "user:*"
python -m cli.main maintenance cache warm --preload
```

### Connection Pooling
- PostgreSQL connection pooling
- Redis connection pooling
- HTTP client connection reuse

### Async Processing
- FastAPI async endpoints
- Async database operations
- Background task processing

##  Configuration Management

### Environment Variables

```bash
# Core settings
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# External services
MAILGUN_API_KEY=your-key
AWS_ACCESS_KEY_ID=your-key
STRIPE_SECRET_KEY=your-key

# Performance settings
UVICORN_WORKERS=4
DATABASE_POOL_SIZE=20
CELERY_WORKER_CONCURRENCY=4
```

### Feature Flags

```python
# Configuration
FEATURE_FLAGS = {
    'advanced_analytics': True,
    'real_time_tracking': True,
    'automated_communications': True,
    'payment_processing': True,
    'a_b_testing': True
}
```

## Troubleshooting

### Common Issues
**Database Connection Issues**
```bash
# Check database connectivity
python -c "
import asyncio
from core.database import engine
from sqlalchemy import text

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT 1'))
        print('Database OK' if result.scalar() == 1 else 'Database Error')

asyncio.run(check())
"
```

**Redis Connection Issues**
```bash
# Check Redis connectivity
python -c "
import redis
import os
r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
print('Redis OK' if r.ping() else 'Redis Error')
"
```

**Task Queue Issues**
```bash
# Check Celery status
celery -A tasks.celery_app inspect ping
celery -A tasks.celery_app inspect active
```

### Log Analysis

```bash
# View application logs
tail -f logs/app.log | jq '.'

# View error logs
tail -f logs/error.log | jq 'select(.level=="ERROR")'

# View task logs
tail -f logs/celery.log | jq 'select(.task_name)'
```

### Performance Issues

```bash
# Monitor system resources
python -m cli.main monitor system --realtime

# Analyze slow queries
python -m cli.main db monitor --slow-queries

# Profile application performance
python -m cli.main test performance --profile
```

## Additional Resources
- [API Documentation](./API_ENDPOINTS_SUMMARY.md)
- [Database Schema](./docs/database-schema.md)
- [Security Guidelines](./docs/security.md)
- [Performance Tuning](./docs/performance.md)
- [Deployment Guide](./docs/deployment.md)
