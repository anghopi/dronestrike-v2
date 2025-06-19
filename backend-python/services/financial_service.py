"""
Financial calculation service
Preserves Laravel ScheduleService business logic with exact mathematical precision
"""

from typing import List, Dict, Any
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
import math

from models.opportunity import Opportunity, PaymentSchedule
from core.config import settings
from .base import BaseService


class FinancialCalculationService:
    """Financial calculations preserving Laravel business logic"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_monthly_payment(
        self,
        principal: Decimal,
        annual_rate: Decimal,
        term_months: int
    ) -> Decimal:
        """
        Calculate monthly payment using standard amortization formula
        Preserves exact Laravel ScheduleService logic
        """
        if principal <= 0 or term_months <= 0:
            return Decimal('0.00')
        
        # Convert annual rate to monthly
        monthly_rate = annual_rate / 12
        
        if monthly_rate == 0:
            # No interest loan - simple division
            return (principal / term_months).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Standard amortization formula: P * [r(1+r)^n] / [(1+r)^n - 1]
        power = (1 + monthly_rate) ** term_months
        monthly_payment = principal * (monthly_rate * power) / (power - 1)
        
        return Decimal(str(monthly_payment)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def calculate_total_interest(
        self,
        principal: Decimal,
        monthly_payment: Decimal,
        term_months: int
    ) -> Decimal:
        """Calculate total interest over loan term"""
        total_payments = monthly_payment * term_months
        return (total_payments - principal).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def calculate_ltv_ratio(
        self,
        loan_amount: Decimal,
        property_value: Decimal
    ) -> Decimal:
        """Calculate Loan-to-Value ratio"""
        if property_value <= 0:
            return Decimal('0.0000')
        
        ltv = loan_amount / property_value
        return ltv.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    
    def generate_payment_schedule(
        self,
        opportunity_id: int,
        principal: Decimal,
        annual_rate: Decimal,
        term_months: int,
        start_date: date = None
    ) -> List[Dict[str, Any]]:
        """
        Generate complete payment schedule
        Preserves Laravel ScheduleService amortization logic
        """
        if not start_date:
            start_date = date.today().replace(day=1)  # First of current month
        
        monthly_payment = self.calculate_monthly_payment(principal, annual_rate, term_months)
        monthly_rate = annual_rate / 12
        
        schedule = []
        remaining_balance = principal
        current_date = start_date
        
        for payment_num in range(1, term_months + 1):
            # Calculate interest for this period
            interest_amount = (remaining_balance * monthly_rate).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            
            # Calculate principal portion
            if payment_num == term_months:
                # Last payment - pay off remaining balance exactly
                principal_amount = remaining_balance
                payment_amount = principal_amount + interest_amount
            else:
                principal_amount = monthly_payment - interest_amount
                payment_amount = monthly_payment
            
            # Update remaining balance
            remaining_balance -= principal_amount
            
            # Ensure balance doesn't go negative due to rounding
            if remaining_balance < Decimal('0.01'):
                remaining_balance = Decimal('0.00')
            
            schedule.append({
                'opportunity_id': opportunity_id,
                'payment_number': payment_num,
                'due_date': current_date,
                'payment_amount': payment_amount,
                'principal_amount': principal_amount,
                'interest_amount': interest_amount,
                'remaining_balance': remaining_balance
            })
            
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        return schedule
    
    def create_payment_schedule(
        self,
        opportunity: Opportunity,
        start_date: date = None
    ) -> List[PaymentSchedule]:
        """Create and save payment schedule for an opportunity"""
        schedule_data = self.generate_payment_schedule(
            opportunity.id,
            opportunity.requested_loan_amount,
            opportunity.interest_rate,
            opportunity.term_months,
            start_date
        )
        
        payment_schedules = []
        for payment_data in schedule_data:
            payment_schedule = PaymentSchedule(**payment_data)
            self.db.add(payment_schedule)
            payment_schedules.append(payment_schedule)
        
        self.db.commit()
        return payment_schedules
    
    def update_opportunity_financials(self, opportunity: Opportunity) -> Opportunity:
        """Update all financial calculations for an opportunity"""
        # Calculate monthly payment
        opportunity.monthly_payment = self.calculate_monthly_payment(
            opportunity.requested_loan_amount,
            opportunity.interest_rate,
            opportunity.term_months
        )
        
        # Calculate total payments
        opportunity.total_payments = opportunity.monthly_payment * opportunity.term_months
        
        # Calculate total interest
        opportunity.total_interest = opportunity.total_payments - opportunity.requested_loan_amount
        
        self.db.add(opportunity)
        self.db.commit()
        return opportunity
    
    def validate_loan_parameters(
        self,
        loan_amount: Decimal,
        property_value: Decimal,
        annual_rate: Decimal,
        term_months: int
    ) -> Dict[str, Any]:
        """Validate loan parameters against business rules"""
        errors = []
        warnings = []
        
        # LTV validation
        ltv_ratio = self.calculate_ltv_ratio(loan_amount, property_value)
        max_ltv = Decimal(str(settings.DEFAULT_LTV_MAX))
        
        if ltv_ratio > max_ltv:
            errors.append(f"LTV ratio {ltv_ratio:.2%} exceeds maximum {max_ltv:.2%}")
        elif ltv_ratio > (max_ltv * Decimal('0.9')):  # 90% of max
            warnings.append(f"LTV ratio {ltv_ratio:.2%} is high")
        
        # Interest rate validation
        if annual_rate <= 0:
            errors.append("Interest rate must be positive")
        elif annual_rate > Decimal('0.25'):  # 25%
            warnings.append(f"Interest rate {annual_rate:.2%} is high")
        
        # Term validation
        if term_months <= 0:
            errors.append("Term must be positive")
        elif term_months > 360:  # 30 years
            warnings.append(f"Term of {term_months} months is very long")
        
        # Loan amount validation
        if loan_amount <= 0:
            errors.append("Loan amount must be positive")
        elif loan_amount < Decimal('1000'):
            warnings.append("Loan amount is very small")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'ltv_ratio': ltv_ratio
        }
    
    def calculate_roi_projection(
        self,
        loan_amount: Decimal,
        annual_rate: Decimal,
        term_months: int
    ) -> Dict[str, Decimal]:
        """Calculate ROI projections for the lender"""
        monthly_payment = self.calculate_monthly_payment(loan_amount, annual_rate, term_months)
        total_payments = monthly_payment * term_months
        total_interest = total_payments - loan_amount
        
        # Annualized return
        years = Decimal(term_months) / 12
        annualized_return = (total_payments / loan_amount) ** (1 / float(years)) - 1
        
        return {
            'total_interest': total_interest,
            'total_return_pct': (total_interest / loan_amount),
            'annualized_return_pct': Decimal(str(annualized_return)),
            'monthly_cash_flow': monthly_payment
        }