"""
Simple FastAPI server for DroneStrike v2
Basic authentication and API endpoints
"""

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import math
import random

# Initialize FastAPI app
app = FastAPI(
    title="DroneStrike v2 API",
    description="Real Estate CRM & Operations Command Center",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Pydantic models
class UserLogin(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    username: str
    email: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None

# Core DroneStrike Data Models
class Property(BaseModel):
    id: int
    account_number: str
    address_1: str
    city: str
    state: str
    zipcode: str
    county: str
    lat: float
    lng: float
    property_type: str
    market_value: float
    assessed_value: float
    tax_amount: float
    created_at: str

class Lead(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone_cell: Optional[str] = None
    lead_status: str
    created_at: str
    updated_at: str

class Prospect(BaseModel):
    id: int
    lead_id: int
    property_id: int
    status: str
    created_by: int
    created_at: str
    updated_at: str

class Mission(BaseModel):
    id: int
    prospect_id: int
    user_id: int  # soldier assigned
    status: str
    priority: str
    notes: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class Opportunity(BaseModel):
    id: int
    prospect_id: int
    assignee_id: int
    opportunity_type: str  # LOAN, PURCHASE, LISTING
    amount: float
    status: str
    created_at: str
    updated_at: str

class HeatMapPin(BaseModel):
    lat: float
    lng: float
    weight: int

# File-based storage for demo
USERS_FILE = "users.json"
PROPERTIES_FILE = "properties.json"
LEADS_FILE = "leads.json"
PROSPECTS_FILE = "prospects.json"
MISSIONS_FILE = "missions.json"
OPPORTUNITIES_FILE = "opportunities.json"

def load_data(filename):
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            return json.load(f)
    return {}

def save_data(filename, data):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

def load_users():
    return load_data(USERS_FILE)

def save_users(users):
    save_data(USERS_FILE, users)

def get_next_id(data_dict):
    if not data_dict:
        return 1
    return max(int(k) for k in data_dict.keys()) + 1

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    users = load_users()
    
    # Handle demo admin user
    if username == "admin":
        return User(
            username="admin",
            email="admin@dronestrike.com",
            firstName="Admin",
            lastName="User",
            company="DroneStrike",
            phone=None
        )
    
    if username not in users:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**{k: v for k, v in users[username].items() if k != "password"})

# Routes
@app.get("/")
async def root():
    return {"message": "DroneStrike v2 API - Real Estate CRM & Operations Command Center"}

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.post("/api/v1/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    print(f"Login attempt for user: '{user_data.username}' with password: '{user_data.password}'")
    users = load_users()
    
    # Check if user exists and password is correct
    if user_data.username in users:
        user = users[user_data.username]
        if verify_password(user_data.password, user["password"]):
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": user_data.username}, expires_delta=access_token_expires
            )
            return {"access_token": access_token, "token_type": "bearer"}
    
    # Check default demo credentials
    print(f"Checking admin credentials: username==admin? {user_data.username == 'admin'}, password==admin? {user_data.password == 'admin'}")
    if user_data.username == "admin" and user_data.password == "admin":
        print("Admin login successful!")
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": "admin"}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    
    print("Login failed - credentials don't match")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password"
    )

@app.post("/api/v1/auth/register", response_model=User)
async def register(user_data: UserRegister):
    print(f"Registration attempt for user: '{user_data.username}' with email: '{user_data.email}'")
    users = load_users()
    
    # Check if user already exists
    if user_data.username in users or any(u.get("email") == user_data.email for u in users.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Hash password and save user
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.dict()
    user_dict["password"] = hashed_password
    user_dict["created_at"] = datetime.utcnow().isoformat()
    
    users[user_data.username] = user_dict
    save_users(users)
    
    # Return user without password
    return User(**{k: v for k, v in user_dict.items() if k != "password"})

@app.get("/api/v1/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Mock data endpoints for frontend compatibility based on original DroneStrike
@app.get("/api/properties/investment_opportunities/")
async def get_investment_opportunities():
    return {"results": [], "count": 0}

@app.get("/api/dashboard/stats/")
async def get_dashboard_stats():
    return {
        "total_properties": 150,
        "active_leads": 45,
        "pending_deals": 12,
        "monthly_revenue": 125000,
        "active_missions": 23,
        "completed_missions": 178,
        "opportunities": 67,
        "loans_funded": 12
    }

@app.get("/api/properties/")
async def get_properties():
    return {"results": [], "count": 0}

@app.get("/api/workflow/pipelines/")
async def get_pipelines():
    return {"results": [], "count": 0}

# Core DroneStrike endpoints
@app.get("/api/admin/missions")
async def get_missions():
    missions_data = load_data(MISSIONS_FILE)
    prospects_data = load_data(PROSPECTS_FILE)
    properties_data = load_data(PROPERTIES_FILE)
    leads_data = load_data(LEADS_FILE)
    users_data = load_users()
    
    # Create sample missions if none exist
    if not missions_data:
        missions_data = {
            "1": {
                "id": 1,
                "prospect_id": 1,
                "user_id": 1,
                "status": "NEW",
                "priority": "HIGH",
                "notes": "Initial property assessment required",
                "created_at": "2025-06-19T10:00:00Z",
                "completed_at": None
            },
            "2": {
                "id": 2,
                "prospect_id": 2,
                "user_id": 2,
                "status": "ACCEPTED",
                "priority": "MEDIUM",
                "notes": "Follow-up visit scheduled",
                "created_at": "2025-06-19T09:30:00Z",
                "completed_at": None
            }
        }
        save_data(MISSIONS_FILE, missions_data)
    
    # Build mission results with related data
    results = []
    for mission_id, mission in missions_data.items():
        # Get prospect data
        prospect = prospects_data.get(str(mission["prospect_id"]))
        if not prospect:
            continue
            
        # Get property data
        property_data = properties_data.get(str(prospect["property_id"]))
        
        # Get lead data
        lead_data = leads_data.get(str(prospect["lead_id"]))
        
        # Get soldier name
        soldier_name = "Unknown Soldier"
        if mission["user_id"] == 1:
            soldier_name = "John Smith"
        elif mission["user_id"] == 2:
            soldier_name = "Jane Doe"
        
        result = {
            "id": mission["id"],
            "prospect_id": mission["prospect_id"],
            "soldier_id": mission["user_id"],
            "soldier_name": soldier_name,
            "status": mission["status"],
            "priority": mission["priority"],
            "notes": mission["notes"],
            "created_at": mission["created_at"],
            "completed_at": mission["completed_at"]
        }
        
        if property_data:
            result["property_address"] = f"{property_data['address_1']}, {property_data['city']}, {property_data['state']} {property_data['zipcode']}"
            result["property"] = property_data
        
        if lead_data:
            result["lead_name"] = f"{lead_data['first_name']} {lead_data['last_name']}"
            result["lead"] = lead_data
            
        results.append(result)
    
    return {
        "results": results,
        "count": len(results)
    }

@app.post("/api/admin/missions")
async def create_mission(mission_data: dict):
    missions_data = load_data(MISSIONS_FILE)
    mission_id = get_next_id(missions_data)
    
    new_mission = {
        "id": mission_id,
        "prospect_id": mission_data["prospect_id"],
        "user_id": mission_data["user_id"],
        "status": "NEW",
        "priority": mission_data.get("priority", "MEDIUM"),
        "notes": mission_data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
        "completed_at": None
    }
    
    missions_data[str(mission_id)] = new_mission
    save_data(MISSIONS_FILE, missions_data)
    
    return {"id": mission_id, "message": "Mission created successfully", **new_mission}

@app.patch("/api/admin/missions/{mission_id}")
async def update_mission(mission_id: int, mission_data: dict):
    missions_data = load_data(MISSIONS_FILE)
    
    if str(mission_id) not in missions_data:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    mission = missions_data[str(mission_id)]
    
    # Update fields
    if "status" in mission_data:
        mission["status"] = mission_data["status"]
        if mission_data["status"] in ["COMPLETED", "DECLINED"]:
            mission["completed_at"] = datetime.utcnow().isoformat()
    
    if "notes" in mission_data:
        mission["notes"] = mission_data["notes"]
    
    if "priority" in mission_data:
        mission["priority"] = mission_data["priority"]
    
    missions_data[str(mission_id)] = mission
    save_data(MISSIONS_FILE, missions_data)
    
    return {"message": "Mission updated successfully", **mission}

@app.get("/api/admin/prospects")
async def get_prospects():
    return {
        "results": [
            {
                "id": 101,
                "lead_name": "Bob Johnson",
                "property_address": "123 Main St, City, ST 12345",
                "lead_status": "NEW",
                "property_type": "SINGLE_FAMILY",
                "created_at": "2025-06-19T08:00:00Z"
            }
        ],
        "count": 1
    }

@app.get("/api/admin/opportunities")
async def get_opportunities():
    opportunities_data = load_data(OPPORTUNITIES_FILE)
    prospects_data = load_data(PROSPECTS_FILE)
    properties_data = load_data(PROPERTIES_FILE)
    leads_data = load_data(LEADS_FILE)
    
    # Create sample opportunities if none exist
    if not opportunities_data:
        opportunities_data = {
            "1": {
                "id": 1,
                "prospect_id": 1,
                "assignee_id": 1,
                "opportunity_type": "LOAN",
                "amount": 75000,
                "status": "PROCESSING",
                "created_at": "2025-06-18T14:30:00Z",
                "updated_at": "2025-06-19T10:15:00Z"
            },
            "2": {
                "id": 2,
                "prospect_id": 2,
                "assignee_id": 1,
                "opportunity_type": "PURCHASE",
                "amount": 98000,
                "status": "NEW",
                "created_at": "2025-06-19T11:00:00Z",
                "updated_at": "2025-06-19T11:00:00Z"
            }
        }
        save_data(OPPORTUNITIES_FILE, opportunities_data)
    
    # Build opportunity results
    results = []
    for opp_id, opp in opportunities_data.items():
        # Get prospect data
        prospect = prospects_data.get(str(opp["prospect_id"]))
        if not prospect:
            continue
            
        # Get property and lead data
        property_data = properties_data.get(str(prospect["property_id"]))
        lead_data = leads_data.get(str(prospect["lead_id"]))
        
        result = {
            "id": opp["id"],
            "prospect_id": opp["prospect_id"],
            "type": opp["opportunity_type"],
            "amount": opp["amount"],
            "status": opp["status"],
            "assignee": "Loan Officer Smith" if opp["assignee_id"] == 1 else "Officer Johnson",
            "assignee_id": opp["assignee_id"],
            "created_at": opp["created_at"],
            "updated_at": opp["updated_at"]
        }
        
        if property_data:
            result["property"] = property_data
            result["property_address"] = f"{property_data['address_1']}, {property_data['city']}, {property_data['state']}"
        
        if lead_data:
            result["lead"] = lead_data
            result["lead_name"] = f"{lead_data['first_name']} {lead_data['last_name']}"
            
        results.append(result)
    
    return {
        "results": results,
        "count": len(results)
    }

@app.post("/api/admin/opportunities")
async def create_opportunity(opp_data: dict):
    opportunities_data = load_data(OPPORTUNITIES_FILE)
    opp_id = get_next_id(opportunities_data)
    
    new_opportunity = {
        "id": opp_id,
        "prospect_id": opp_data["prospect_id"],
        "assignee_id": opp_data.get("assignee_id", 1),
        "opportunity_type": opp_data["opportunity_type"],
        "amount": opp_data["amount"],
        "status": "NEW",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    opportunities_data[str(opp_id)] = new_opportunity
    save_data(OPPORTUNITIES_FILE, opportunities_data)
    
    return {"id": opp_id, "message": "Opportunity created successfully", **new_opportunity}

@app.patch("/api/admin/opportunities/{opp_id}")
async def update_opportunity(opp_id: int, opp_data: dict):
    opportunities_data = load_data(OPPORTUNITIES_FILE)
    
    if str(opp_id) not in opportunities_data:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    opportunity = opportunities_data[str(opp_id)]
    
    # Update fields
    if "status" in opp_data:
        opportunity["status"] = opp_data["status"]
    if "amount" in opp_data:
        opportunity["amount"] = opp_data["amount"]
    if "assignee_id" in opp_data:
        opportunity["assignee_id"] = opp_data["assignee_id"]
    
    opportunity["updated_at"] = datetime.utcnow().isoformat()
    
    opportunities_data[str(opp_id)] = opportunity
    save_data(OPPORTUNITIES_FILE, opportunities_data)
    
    return {"message": "Opportunity updated successfully", **opportunity}

@app.get("/api/targets/")
async def get_targets():
    return {
        "results": [
            {
                "id": 301,
                "name": "High Value Properties",
                "lead_score": 85,
                "property_value": 125000,
                "status": "ACTIVE",
                "county": "Sample County"
            }
        ],
        "count": 1
    }

@app.get("/api/admin/users/soldiers")
async def get_soldiers():
    return {
        "results": [
            {
                "id": 1,
                "first_name": "John",
                "last_name": "Smith",
                "email": "john.smith@dronestrike.com",
                "status": "ACTIVE",
                "role": "SOLDIER"
            },
            {
                "id": 2,
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.doe@dronestrike.com",
                "status": "ACTIVE",
                "role": "SOLDIER"
            }
        ],
        "count": 2
    }

@app.get("/api/leads/")
async def get_leads():
    leads_data = load_data(LEADS_FILE)
    prospects_data = load_data(PROSPECTS_FILE)
    properties_data = load_data(PROPERTIES_FILE)
    
    # If no leads exist, create sample data
    if not leads_data:
        leads_data = {
            "1": {
                "id": 1,
                "first_name": "John",
                "last_name": "Smith",
                "email": "john.smith@email.com",
                "phone_cell": "(555) 123-4567",
                "lead_status": "qualified",
                "created_at": "2025-06-18T10:30:00Z",
                "updated_at": "2025-06-19T14:15:00Z"
            },
            "2": {
                "id": 2,
                "first_name": "Sarah",
                "last_name": "Johnson",
                "email": "sarah.j@email.com",
                "phone_cell": "(555) 987-6543",
                "lead_status": "contacted",
                "created_at": "2025-06-19T08:45:00Z",
                "updated_at": "2025-06-19T16:20:00Z"
            }
        }
        save_data(LEADS_FILE, leads_data)
    
    # Create sample properties if needed - generate realistic data for heat map
    if not properties_data:
        # Generate sample property data with coordinates for heat map
        sample_properties = {}
        random.seed(42)  # For consistent data
        
        for i in range(1, 501):  # Generate 500 properties
            # Create clusters around different areas in San Antonio
            cluster_centers = [
                (29.282045, -98.602588),  # Downtown
                (29.319502, -98.479980),  # North Side
                (29.244676, -98.714142),  # West Side
                (29.396912, -98.497314),  # Airport Area
                (29.162147, -98.583007),  # South Side
            ]
            
            center = random.choice(cluster_centers)
            # Add some randomness around cluster center
            lat_offset = random.uniform(-0.05, 0.05)
            lng_offset = random.uniform(-0.05, 0.05)
            
            sample_properties[str(i)] = {
                "id": i,
                "account_number": f"SAT-{i:06d}",
                "address_1": f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Elm', 'Cedar', 'First', 'Second', 'Third', 'Commerce', 'Market'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln'])}",
                "city": "San Antonio",
                "state": "TX",
                "zipcode": f"782{random.randint(10, 99)}",
                "county": "Bexar",
                "lat": round(center[0] + lat_offset, 6),
                "lng": round(center[1] + lng_offset, 6),
                "property_type": random.choice(["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial"]),
                "market_value": random.randint(50000, 500000),
                "assessed_value": random.randint(40000, 400000),
                "tax_amount": random.randint(1000, 25000),
                "property_value": random.randint(50000, 500000),  # For heat map compatibility
                "tax_amount_due": random.randint(1000, 25000),    # For heat map compatibility
                "address": f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Elm', 'Cedar', 'First', 'Second', 'Third', 'Commerce', 'Market'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln'])}",  # Simplified address
                "zip_code": f"782{random.randint(10, 99)}",       # Alternative zip field
                "is_active": random.choice([True, True, True, False]),  # 75% active
                "in_foreclosure": random.choice([True, False, False, False]),  # 25% foreclosure
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-12-01T00:00:00Z"
            }
        
        properties_data = sample_properties
        save_data(PROPERTIES_FILE, properties_data)
    
    # Create sample prospects if needed
    if not prospects_data:
        prospects_data = {
            "1": {
                "id": 1,
                "lead_id": 1,
                "property_id": 1,
                "status": "active",
                "created_by": 1,
                "created_at": "2025-06-18T10:30:00Z",
                "updated_at": "2025-06-19T14:15:00Z"
            },
            "2": {
                "id": 2,
                "lead_id": 2,
                "property_id": 2,
                "status": "active",
                "created_by": 1,
                "created_at": "2025-06-19T08:45:00Z",
                "updated_at": "2025-06-19T16:20:00Z"
            }
        }
        save_data(PROSPECTS_FILE, prospects_data)
    
    # Build lead results with related data
    results = []
    for lead_id, lead in leads_data.items():
        # Find prospect for this lead
        prospect = None
        property_data = None
        for p_id, p in prospects_data.items():
            if p["lead_id"] == lead["id"]:
                prospect = p
                # Find property for this prospect
                property_data = properties_data.get(str(p["property_id"]))
                break
        
        result = {
            "id": lead["id"],
            "full_name": f"{lead['first_name']} {lead['last_name']}",
            "email": lead["email"],
            "phone": lead["phone_cell"],
            "workflow_stage": lead["lead_status"],
            "lead_score": 85 if lead["lead_status"] == "qualified" else 72,
            "created_at": lead["created_at"],
            "last_contact": lead["updated_at"],
            "notes": "Active lead in system"
        }
        
        if property_data:
            result["property"] = {
                "full_address": f"{property_data['address_1']}, {property_data['city']}, {property_data['state']} {property_data['zipcode']}",
                "estimated_value": property_data["market_value"],
                "property_type": property_data["property_type"]
            }
        
        results.append(result)
    
    return {
        "results": results,
        "count": len(results),
        "total_pages": 1,
        "current_page": 1
    }

@app.post("/api/leads/")
async def create_lead(lead_data: dict):
    return {
        "id": 999,
        "message": "Lead created successfully",
        **lead_data
    }

@app.get("/api/v1/leads")
async def get_leads_v1(current_user: User = Depends(get_current_user)):
    # Mock leads data for v1 endpoint
    return {
        "leads": [
            {
                "id": 1,
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "(555) 123-4567",
                "status": "new",
                "created_at": "2024-01-15T10:30:00Z"
            },
            {
                "id": 2,
                "name": "Jane Smith",
                "email": "jane@example.com",
                "phone": "(555) 987-6543",
                "status": "contacted",
                "created_at": "2024-01-14T14:20:00Z"
            }
        ],
        "total": 2
    }

@app.get("/api/v1/tokens")
async def get_tokens(current_user: User = Depends(get_current_user)):
    # Mock token data
    return {
        "balance": 10000,
        "mailerTokens": 500,
        "usage": {
            "sms": 50,
            "phone": 12,
            "mailer": 25
        },
        "packages": [
            {"name": "Scout Pack", "tokens": 5000, "price": 50},
            {"name": "Tactical Pack", "tokens": 15000, "price": 120},
            {"name": "Strike Pack", "tokens": 30000, "price": 200},
            {"name": "Arsenal Pack", "tokens": 60000, "price": 350}
        ]
    }

# Additional endpoints for full functionality
@app.get("/api/communications/")
async def get_communications():
    return {
        "results": [
            {
                "id": 1,
                "type": "email",
                "subject": "Welcome to DroneStrike",
                "recipient": "john.smith@email.com",
                "status": "sent",
                "sent_at": "2025-06-19T10:30:00Z"
            }
        ],
        "count": 1
    }

@app.get("/api/documents/")
async def get_documents():
    return {
        "results": [
            {
                "id": 1,
                "name": "Property Analysis Report",
                "type": "PDF",
                "size": "2.4 MB",
                "uploaded_at": "2025-06-19T09:15:00Z",
                "uploaded_by": "admin"
            }
        ],
        "count": 1
    }

@app.post("/api/documents/upload/")
async def upload_document():
    return {
        "id": 999,
        "message": "Document uploaded successfully",
        "url": "/documents/999.pdf"
    }

@app.get("/api/marketing/campaigns/")
async def get_marketing_campaigns():
    return {
        "results": [
            {
                "id": 1,
                "name": "Q2 Lead Generation",
                "type": "email",
                "status": "active",
                "sent": 1250,
                "opened": 385,
                "clicked": 97,
                "created_at": "2025-06-15T00:00:00Z"
            }
        ],
        "count": 1
    }

@app.get("/api/tokens/usage/")
async def get_token_usage():
    return {
        "total_tokens": 10000,
        "used_tokens": 3420,
        "remaining_tokens": 6580,
        "mail_tokens": 500,
        "used_mail_tokens": 167,
        "usage_history": [
            {
                "date": "2025-06-19",
                "tokens_used": 45,
                "operation": "Lead Analysis"
            }
        ]
    }

@app.get("/api/import/scheduled/")
async def get_scheduled_imports():
    return {
        "results": [
            {
                "id": 1,
                "name": "County Tax Records",
                "schedule": "Daily at 2:00 AM",
                "last_run": "2025-06-19T02:00:00Z",
                "status": "completed",
                "records_processed": 1547
            }
        ],
        "count": 1
    }

@app.get("/api/admin/pins")
async def get_heat_map_pins(
    region_lat: float = Query(..., description="Center latitude"),
    region_lng: float = Query(..., description="Center longitude"),
    region_lat_delta: float = Query(..., description="Latitude range"),
    region_lng_delta: float = Query(..., description="Longitude range"),
    zoom_level: int = Query(10, description="Map zoom level"),
    current_user: User = Depends(get_current_user)
) -> List[HeatMapPin]:
    """Get aggregated property data for heat map visualization"""
    properties_data = load_data(PROPERTIES_FILE)
    
    # Define grid dimension based on zoom level for performance
    dimension = min(450, max(50, zoom_level * 45))
    
    # Calculate bounds
    lat_min = region_lat - region_lat_delta
    lat_max = region_lat + region_lat_delta
    lng_min = region_lng - region_lng_delta
    lng_max = region_lng + region_lng_delta
    
    # Create sectors dictionary to aggregate properties
    sectors = {}
    
    for prop_id, prop in properties_data.items():
        # Only include active properties within bounds
        if not prop.get('is_active', True):
            continue
            
        prop_lat = float(prop['lat'])
        prop_lng = float(prop['lng'])
        
        # Check if property is within bounds
        if not (lat_min <= prop_lat <= lat_max and lng_min <= prop_lng <= lng_max):
            continue
        
        # Calculate sector coordinates
        if region_lat_delta > 0 and region_lng_delta > 0:
            sector_y = int(dimension * (prop_lat - region_lat) / (region_lat_delta * 2))
            sector_x = int(dimension * (prop_lng - region_lng) / (region_lng_delta * 2))
        else:
            sector_y = 0
            sector_x = 0
        
        sector_key = f"{sector_x},{sector_y}"
        
        if sector_key not in sectors:
            # Calculate sector center coordinates
            sector_lat = region_lat + (sector_y * region_lat_delta * 2 / dimension)
            sector_lng = region_lng + (sector_x * region_lng_delta * 2 / dimension)
            
            sectors[sector_key] = {
                'lat': sector_lat,
                'lng': sector_lng,
                'weight': 0
            }
        
        sectors[sector_key]['weight'] += 1
    
    # Convert to list and filter out empty sectors
    pins = []
    for sector_data in sectors.values():
        if sector_data['weight'] > 0:
            pins.append(HeatMapPin(
                lat=round(sector_data['lat'], 6),
                lng=round(sector_data['lng'], 6),
                weight=sector_data['weight']
            ))
    
    return pins

@app.get("/api/admin/properties")
async def get_properties(
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lng_min: Optional[float] = Query(None),
    lng_max: Optional[float] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(get_current_user)
):
    """Get properties with optional geographic filtering"""
    properties_data = load_data(PROPERTIES_FILE)
    
    filtered_properties = []
    count = 0
    
    for prop_id, prop in properties_data.items():
        if count >= limit:
            break
            
        # Apply geographic filters if provided
        if lat_min is not None and prop['lat'] < lat_min:
            continue
        if lat_max is not None and prop['lat'] > lat_max:
            continue
        if lng_min is not None and prop['lng'] < lng_min:
            continue
        if lng_max is not None and prop['lng'] > lng_max:
            continue
            
        filtered_properties.append(prop)
        count += 1
    
    return {
        "properties": filtered_properties,
        "total": len(filtered_properties),
        "limit": limit
    }

@app.get("/api/mapview/data/")
async def get_map_data():
    return {
        "properties": [
            {
                "id": 1,
                "lat": 39.7817,
                "lng": -89.6501,
                "address": "123 Main St, Springfield, IL",
                "value": 125000,
                "status": "target"
            }
        ],
        "count": 1
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)