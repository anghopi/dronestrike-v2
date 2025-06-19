# DroneStrike v2 - FastAPI Backend

A comprehensive Python backend for the DroneStrike application, built with FastAPI and designed for military-grade real estate investment operations.

## Features

- **FastAPI Framework** - Modern, fast web framework for building APIs
- **SQLAlchemy ORM** - Powerful database abstraction layer
- **JWT Authentication** - Secure token-based authentication
- **PostgreSQL Database** - Robust relational database
- **Redis Integration** - Caching and session management
- **Comprehensive Models** - Users, Properties, Leads, Missions, Opportunities
- **Financial Calculations** - Preserves Laravel business logic for loan calculations
- **Token System** - Credit-based system for actions and communications
- **BOTG Integration** - Boots on the Ground mission management
- **Role-Based Access** - Multi-tier user permissions
- **API Documentation** - Auto-generated OpenAPI/Swagger docs

##Project Structure

```
backend-python/
├── api/                    # API route handlers
│   ├── auth/              # Authentication endpoints
│   ├── users/             # User management
│   ├── properties/        # Property management
│   ├── leads/             # Lead management
│   ├── missions/          # BOTG mission operations
│   ├── opportunities/     # Investment opportunities
│   ├── tokens/            # Token system
│   └── analytics/         # Analytics & reporting
├── core/                   # Core configuration
│   ├── config.py          # Application settings
│   ├── database.py        # Database configuration
│   └── security.py        # Authentication utilities
├── models/                 # Database models
│   ├── user.py            # User and company models
│   ├── property.py        # Property and location models
│   ├── lead.py            # Lead management models
│   ├── mission.py         # Mission models
│   ├── opportunity.py     # Investment opportunity models
│   └── token.py           # Token system models
├── services/               # Business logic services
│   ├── auth_service.py    # Authentication service
│   ├── financial_service.py  # Financial calculations
│   ├── token_service.py   # Token management
│   └── mission_service.py # Mission operations
├── migrations/             # Database migrations
├── tests/                  # Test suite
├── static/                 # Static files
├── uploads/                # File uploads
├── main.py                 # FastAPI application
├── requirements.txt        # Python dependencies
└── alembic.ini            # Database migration config
```

##Installation & Setup

### Prerequisites

- Python 3.9+
- PostgreSQL 12+
- Redis 6+

### 1. Clone and Setup Environment

```bash
cd /Users/angelinaopinca/Drone_Strike/dronestrike-v2/backend-python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb dronestrike_v2

# Initialize Alembic
alembic init migrations

# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

### 4. Run the Application

```bash
# Development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

##  Database Models

### Core Entities

- **User** - Authentication, roles, token balances
- **Company** - Organization management
- **Property** - Real estate properties with PLE integration
- **County** - Location and tax information
- **Lead** - Property owners and contact information
- **Mission** - BOTG field operations
- **Opportunity** - Investment opportunities with financial calculations
- **TokenTransaction** - Credit system for actions

### Key Features
- **Financial Calculations** - Preserves exact Laravel ScheduleService logic
- **Workflow Integration** - Lead → BOTG → Opportunity → TLC pipeline
- **Token System** - Pay-per-action model with mail tokens
- **Role-Based Access** - Admin, Officer, Soldier, Agent, User roles
- **Geographic Data** - Lat/lng coordinates and Google Places integration

## Authentication

### User Roles

- **Admin** - Full system access
- **Five Star General** - Admin with 50% lifetime discount
- **Officer** - Loan officers with approval powers
- **Agent** - Standard agents
- **Soldier** - BOTG field operatives
- **Beta Infantry** - 50% discount for first 3 months
- **User** - Basic access

### Token System

- **Regular Tokens** - General system actions
- **Mail Tokens** - Physical mail sending ($0.80 each)
- **Action Costs** - Configurable token costs per action type

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Current user info

### Leads
- `GET /api/v1/leads/` - List leads with filtering
- `POST /api/v1/leads/` - Create new lead
- `PUT /api/v1/leads/{id}` - Update lead
- `POST /api/v1/leads/{id}/score` - Update AI score
- `POST /api/v1/leads/{id}/workflow` - Advance workflow stage

### Users
- `GET /api/v1/users/` - List users (admin)
- `GET /api/v1/users/me` - Current user profile
- `PUT /api/v1/users/me` - Update profile

### Tokens
- `GET /api/v1/tokens/balance` - Token balance
- `GET /api/v1/tokens/` - Transaction history
- `POST /api/v1/tokens/purchase` - Purchase tokens

## Financial Calculations

The financial service preserves exact Laravel business logic:

- **Monthly Payment Calculation** - Standard amortization formula
- **LTV Ratio Validation** - Maximum 75% loan-to-value
- **Payment Schedule Generation** - Complete amortization schedule
- **Interest Calculations** - Precise decimal handling
- **Risk Assessment** - Configurable risk scoring

## BOTG Mission System

- **Mission Types** - Property assessment, documentation, inspections
- **Status Tracking** - Pending → Assigned → In Progress → Completed
- **GPS Integration** - Start/end location tracking
- **Quality Scoring** - 0-100 mission quality assessment
- **Document Upload** - Photos and reports with metadata

## Token Economics

Based on Token Values.xlsx:
- Default 10,000 tokens for new users
- Mail tokens at $0.80 each
- Configurable action costs
- Subscription credits
- Role-based discounts

## Development

### Running Tests

```bash
pytest tests/ -v
```

### Code Formatting

```bash
black .
isort .
```

### Type Checking

```bash
mypy .
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Downgrade
alembic downgrade -1
```

## Deployment
### Docker Deployment

```bash
# Build image
docker build -t dronestrike-backend .

# Run container
docker run -p 8000:8000 --env-file .env dronestrike-backend
```

### Environment Variables

See `.env.example` for all configuration options including:
- Database URLs
- API keys (Stripe, Twilio, Google Maps)
- Security settings
- Feature flags

## API Documentation

When running in development mode, visit:
- **Swagger UI**: http://localhost:8000/api/v1/docs
- **ReDoc**: http://localhost:8000/api/v1/redoc

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS configuration
- Rate limiting
- Input validation with Pydantic
- SQL injection prevention with SQLAlchemy

## Architecture

- **Clean Architecture** - Separation of concerns
- **Service Layer** - Business logic abstraction
- **Repository Pattern** - Data access abstraction
- **Dependency Injection** - FastAPI's built-in DI
- **Error Handling** - Comprehensive exception handling

For questions or issues, contact the development team or refer to the project documentation.