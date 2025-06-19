"""
Property and location models
Translated from Django Property model with Laravel business logic
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, 
    ForeignKey, Text, Date, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from decimal import Decimal
import enum

from .base import BaseModel


class PropertyType(str, enum.Enum):
    """Property type classifications"""
    SINGLE_FAMILY = "single_family"
    MULTI_FAMILY = "multi_family"
    CONDO = "condo"
    TOWNHOUSE = "townhouse"
    COMMERCIAL = "commercial"
    LAND = "land"
    MOBILE_HOME = "mobile_home"


class PropertyDisposition(str, enum.Enum):
    """Property disposition status"""
    ACTIVE = "active"
    SOLD = "sold"
    FORECLOSURE = "foreclosure"
    PENDING = "pending"
    WITHDRAWN = "withdrawn"


class County(BaseModel):
    """County information for property location"""
    __tablename__ = "counties"
    
    name = Column(String(100), nullable=False)
    state = Column(String(2), nullable=False)
    fips_code = Column(String(5), unique=True, nullable=False)
    
    # Tax lien specific data
    tax_sale_date = Column(Date, nullable=True)
    redemption_period_months = Column(Integer, default=24)
    interest_rate = Column(Numeric(5, 4), default=Decimal('0.08'))
    
    # Relationships
    properties = relationship("Property", back_populates="county")
    
    __table_args__ = (
        Index('ix_county_name_state', 'name', 'state'),
    )
    
    def __repr__(self):
        return f"<County(name='{self.name}', state='{self.state}')>"


class Property(BaseModel):
    """Property model with Laravel business logic for valuation"""
    __tablename__ = "properties"
    
    # County Relationship
    county_id = Column(Integer, ForeignKey("counties.id"), nullable=False)
    
    # Address Information
    address1 = Column(String(255), nullable=False)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(2), nullable=False)
    zip_code = Column(String(10), nullable=False)
    
    # Original address tracking (for correction detection)
    original_address1 = Column(String(255), nullable=False)
    original_city = Column(String(100), nullable=False)
    original_state = Column(String(2), nullable=False)
    original_zip = Column(String(10), nullable=False)
    address1_corrected = Column(Boolean, default=False)
    
    # Geographic Coordinates
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    place_id = Column(String(255), nullable=True) 
    
    # Property Values (Laravel: improvement_value + land_value = total_value)
    improvement_value = Column(Numeric(12, 2), default=Decimal('0.00'), nullable=False)
    land_value = Column(Numeric(12, 2), default=Decimal('0.00'), nullable=False)
    total_value = Column(Numeric(12, 2), default=Decimal('0.00'), nullable=False)
    market_value = Column(Numeric(12, 2), nullable=True)
    
    # Property Details
    property_type = Column(String(20), nullable=False)  # Store enum value as string
    disposition = Column(String(20), default='active')
    square_feet = Column(Integer, nullable=True)
    bedrooms = Column(Integer, nullable=True)
    bathrooms = Column(Numeric(3, 1), nullable=True)
    year_built = Column(Integer, nullable=True)
    lot_size = Column(Numeric(10, 2), nullable=True)
    
    # Tax Information (Panacea PLE System Integration)
    account_number = Column(String(100), nullable=False)
    tax_url = Column(String(500), nullable=True)
    cad_url = Column(String(500), nullable=True)
    
    # PLE System Data
    ple_property_id = Column(Integer, nullable=True)
    ple_amount_due = Column(Numeric(12, 2), nullable=True)
    ple_amount_tax = Column(Numeric(12, 2), nullable=True)
    ple_lawsuit_no = Column(String(100), nullable=True)
    ple_date = Column(Date, nullable=True)
    ple_rate = Column(Numeric(5, 4), nullable=True)
    ple_apr = Column(Numeric(5, 4), nullable=True)
    ple_pmt = Column(Numeric(10, 2), nullable=True)
    ple_boc_repay = Column(String(255), nullable=True)
    ple_county = Column(String(100), nullable=True)
    ple_purl = Column(String(500), nullable=True)
    ple_code = Column(String(50), nullable=True)
    ple_obligation = Column(Text, nullable=True)
    ple_if_paid_by = Column(Date, nullable=True)
    
    # Existing loans and encumbrances
    existing_tax_loan = Column(Boolean, default=False)
    existing_tax_loan_amount = Column(Numeric(12, 2), nullable=True)
    existing_tax_loan_lender = Column(String(255), nullable=True)
    
    # Foreclosure status
    in_foreclosure = Column(Boolean, default=False)
    last_known_lawsuit_date = Column(Date, nullable=True)
    last_known_lawsuit_no = Column(String(100), nullable=True)
    
    # Payment tracking
    last_payment = Column(Numeric(12, 2), nullable=True)
    last_payment_date = Column(Date, nullable=True)
    last_payer = Column(String(255), nullable=True)
    
    # Additional property details
    term = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    street = Column(String(255), nullable=True)
    exemptions = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    county = relationship("County", back_populates="properties")
    leads = relationship("Lead", back_populates="property_record")
    opportunities = relationship("Opportunity", back_populates="property")
    missions = relationship("Mission", back_populates="property_record")
    
    # Database Indexes
    __table_args__ = (
        Index('ix_property_county_city', 'county_id', 'city'),
        Index('ix_property_account_number', 'account_number'),
        Index('ix_property_total_value', 'total_value'),
        Index('ix_property_ple_amount_due', 'ple_amount_due'),
        Index('ix_property_coordinates', 'latitude', 'longitude'),
    )
    
    def __repr__(self):
        return f"<Property(address='{self.address1}, {self.city}, {self.state}')>"
    
    @property
    def full_address(self) -> str:
        """Full formatted address"""
        parts = [self.address1]
        if self.address2:
            parts.append(self.address2)
        parts.append(f"{self.city}, {self.state} {self.zip_code}")
        return ", ".join(parts)
    
    def calculate_total_value(self) -> Decimal:
        """Calculate total value (Laravel business rule)"""
        return self.improvement_value + self.land_value
    
    def update_values(self, improvement_value: Decimal, land_value: Decimal):
        """Update property values and recalculate total"""
        self.improvement_value = improvement_value
        self.land_value = land_value
        self.total_value = self.calculate_total_value()