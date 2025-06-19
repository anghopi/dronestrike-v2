"""
DroneStrike v2 Business Services
Translated from Laravel ScheduleService with exact mathematical precision
Contains all proven financial calculation algorithms
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date, timedelta
import math
from django.utils import timezone
from django.conf import settings

from .models import Property, Lead, UserProfile


class FinancialCalculationService:
    """
    Financial calculation service (Laravel ScheduleService translation)
    Preserves exact mathematical precision from original Laravel code
    """
    
    # Laravel business constants
    DEFAULT_INTEREST_RATE = Decimal('0.08')  # 8% annual
    DEFAULT_TERM_MONTHS = 24
    MAX_LTV_RATIO = Decimal('0.45')  # 45% maximum LTV
    
    # Token costs (from Token Values.xlsx)
    TOKEN_COSTS = {
        'postcard_send': 1,
        'email_send': 1,
        'sms_send': 2,
        'phone_verification': 5,
        'address_verification': 3,
        'property_lookup': 10,
        'lead_export': 50,
    }
    
    MAIL_TOKEN_COST = Decimal('0.80')  # $0.80 per mail token
    
    @classmethod
    def calculate_monthly_payment(cls, principal, annual_rate, term_months):
        """
        Calculate monthly payment using Laravel PMT formula
        Formula: P * [r(1+r)^n] / [(1+r)^n - 1]
        """
        if principal <= 0 or annual_rate <= 0:
            return Decimal('0.00')
        
        monthly_rate = annual_rate / 12
        if monthly_rate == 0:
            return (principal / term_months).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Laravel PMT calculation
        factor = (1 + monthly_rate) ** term_months
        monthly_payment = principal * (monthly_rate * factor) / (factor - 1)
        
        return monthly_payment.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @classmethod
    def calculate_ltv_ratio(cls, loan_amount, property_value):
        """Calculate loan-to-value ratio (Laravel: round($loanAmount / $propertyValue, 4))"""
        if property_value <= 0:
            return Decimal('0.0000')
        
        ltv = loan_amount / property_value
        return ltv.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    
    @classmethod
    def calculate_max_loan_amount(cls, property_value, max_ltv=None):
        """Calculate maximum loan amount (Laravel: property_value * max_ltv)"""
        if max_ltv is None:
            max_ltv = cls.MAX_LTV_RATIO
        
        max_loan = property_value * max_ltv
        return max_loan.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @classmethod
    def generate_payment_schedule(cls, principal, annual_rate, term_months, first_payment_date=None):
        """
        Generate complete payment schedule (Laravel ScheduleService logic)
        Returns array of payment details for each month
        """
        if not first_payment_date:
            first_payment_date = timezone.now().date() + timedelta(days=30)
        
        monthly_payment = cls.calculate_monthly_payment(principal, annual_rate, term_months)
        monthly_rate = annual_rate / 12
        
        schedule = []
        balance = principal
        
        for payment_num in range(1, term_months + 1):
            # Calculate interest for this period
            interest_payment = (balance * monthly_rate).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            
            # Principal payment is remainder
            principal_payment = monthly_payment - interest_payment
            
            # Handle final payment rounding
            if payment_num == term_months:
                principal_payment = balance  # Pay off remaining balance
                monthly_payment = principal_payment + interest_payment
            
            # Update balance
            balance -= principal_payment
            balance = max(Decimal('0.00'), balance)
            
            # Calculate payment date
            payment_date = first_payment_date.replace(
                year=first_payment_date.year + ((first_payment_date.month + payment_num - 2) // 12),
                month=((first_payment_date.month + payment_num - 2) % 12) + 1
            )
            
            schedule.append({
                'payment_number': payment_num,
                'payment_date': payment_date,
                'payment_amount': monthly_payment,
                'principal': principal_payment,
                'interest': interest_payment,
                'balance': balance,
                'cumulative_interest': sum(p['interest'] for p in schedule) + interest_payment,
            })
        
        return schedule
    
    @classmethod
    def calculate_total_loan_cost(cls, principal, annual_rate, term_months):
        """Calculate total cost of loan (Laravel business logic)"""
        monthly_payment = cls.calculate_monthly_payment(principal, annual_rate, term_months)
        total_payments = monthly_payment * term_months
        total_interest = total_payments - principal
        
        return {
            'monthly_payment': monthly_payment,
            'total_payments': total_payments.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'total_interest': total_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'interest_percentage': (total_interest / principal * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            ) if principal > 0 else Decimal('0.00')
        }
    
    @classmethod
    def assess_loan_risk(cls, property, loan_amount):
        """
        Assess loan risk factors (Laravel business logic)
        Returns risk score and detailed factors
        """
        risk_factors = []
        risk_score = 50  # Base risk score
        
        # Property value analysis
        market_value = property.market_value or property.total_value
        ltv_ratio = cls.calculate_ltv_ratio(loan_amount, market_value)
        
        if ltv_ratio > Decimal('0.45'):
            risk_factors.append('High LTV ratio (>45%)')
            risk_score += 30
        elif ltv_ratio > Decimal('0.35'):
            risk_factors.append('Moderate LTV ratio (35-45%)')
            risk_score += 15
        
        # Tax burden analysis
        if property.ple_amount_due and market_value:
            tax_to_value = property.ple_amount_due / market_value
            if tax_to_value > Decimal('0.20'):
                risk_factors.append('High tax burden (>20% of value)')
                risk_score += 25
            elif tax_to_value > Decimal('0.10'):
                risk_factors.append('Moderate tax burden (10-20% of value)')
                risk_score += 10
        
        # Existing encumbrances
        if property.existing_tax_loan:
            risk_factors.append('Existing tax loan on property')
            risk_score += 20
        
        if property.in_foreclosure:
            risk_factors.append('Property in foreclosure')
            risk_score += 35
        
        # Property condition
        if property.total_value > 0:
            improvement_ratio = property.improvement_value / property.total_value
            if improvement_ratio < Decimal('0.3'):
                risk_factors.append('Low improvement ratio (<30%)')
                risk_score += 15
        
        # Geographic risk (placeholder for future enhancement)
        if property.county.tax_sale_date:
            days_to_sale = (property.county.tax_sale_date - timezone.now().date()).days
            if days_to_sale < 90:
                risk_factors.append('Tax sale within 90 days')
                risk_score += 20
        
        # Cap risk score
        risk_score = min(100, max(0, risk_score))
        
        return {
            'risk_score': risk_score,
            'risk_level': 'Low' if risk_score < 40 else 'Medium' if risk_score < 70 else 'High',
            'risk_factors': risk_factors,
            'ltv_ratio': float(ltv_ratio),
            'recommended_approval': risk_score < 70 and ltv_ratio <= Decimal('0.45')
        }


class TokenService:
    """Token management service (from Token Values.xlsx)"""
    
    @classmethod
    def calculate_token_cost(cls, action_type, quantity=1):
        """Calculate token cost for action"""
        base_cost = FinancialCalculationService.TOKEN_COSTS.get(action_type, 1)
        return base_cost * quantity
    
    @classmethod
    def consume_tokens(cls, user_profile, action_type, quantity=1, reference_object=None):
        """
        Consume tokens and create transaction record
        Returns success status and transaction details
        """
        from .models import TokenTransaction
        
        token_cost = cls.calculate_token_cost(action_type, quantity)
        
        # Determine token type
        token_type = 'mail' if action_type == 'postcard_send' else 'regular'
        
        # Check if user has sufficient tokens
        current_tokens = user_profile.mail_tokens if token_type == 'mail' else user_profile.tokens
        
        if current_tokens < token_cost:
            return {
                'success': False,
                'error': f'Insufficient {token_type} tokens. Need {token_cost}, have {current_tokens}',
                'tokens_needed': token_cost,
                'tokens_available': current_tokens
            }
        
        # Create transaction record
        tokens_before = current_tokens
        tokens_after = current_tokens - token_cost
        
        transaction = TokenTransaction.objects.create(
            user=user_profile.user,
            token_type=token_type,
            transaction_type='consumption',
            action_type=action_type,
            tokens_before=tokens_before,
            tokens_changed=-token_cost,
            tokens_after=tokens_after,
            description=f'{action_type.replace("_", " ").title()} - {quantity} action(s)',
            lead=reference_object if hasattr(reference_object, '_meta') and reference_object._meta.model_name == 'lead' else None,
        )
        
        # Update user tokens
        if token_type == 'mail':
            user_profile.mail_tokens = tokens_after
        else:
            user_profile.tokens = tokens_after
        user_profile.save()
        
        return {
            'success': True,
            'transaction_id': transaction.id,
            'tokens_consumed': token_cost,
            'tokens_remaining': tokens_after,
            'token_type': token_type
        }


class PropertyScoringService:
    """Property investment scoring service (Laravel algorithm)"""
    
    @classmethod
    def calculate_property_score(cls, property):
        """
        Calculate comprehensive property investment score
        Uses Laravel scoring algorithm with enhancements
        """
        score = 50  # Base score
        score_factors = []
        
        # Market value assessment (0-30 points)
        market_value = property.market_value or property.total_value
        if market_value > 100000:
            score += 30
            score_factors.append(('High market value (>$100k)', 30))
        elif market_value > 50000:
            score += 20
            score_factors.append(('Good market value ($50k-$100k)', 20))
        elif market_value > 25000:
            score += 10
            score_factors.append(('Fair market value ($25k-$50k)', 10))
        else:
            score_factors.append(('Low market value (<$25k)', 0))
        
        # Tax burden analysis (-20 to +10 points)
        if property.ple_amount_due and market_value > 0:
            tax_ratio = property.ple_amount_due / market_value
            if tax_ratio < Decimal('0.05'):
                score += 10
                score_factors.append(('Low tax burden (<5%)', 10))
            elif tax_ratio > Decimal('0.20'):
                score -= 20
                score_factors.append(('Very high tax burden (>20%)', -20))
            elif tax_ratio > Decimal('0.10'):
                score -= 10
                score_factors.append(('High tax burden (10-20%)', -10))
        
        # Existing encumbrances (-45 points max)
        if property.existing_tax_loan:
            score -= 15
            score_factors.append(('Existing tax loan', -15))
        
        if property.in_foreclosure:
            score -= 30
            score_factors.append(('In foreclosure', -30))
        
        # Property improvement ratio (0-15 points)
        if property.total_value > 0:
            improvement_ratio = property.improvement_value / property.total_value
            if improvement_ratio > Decimal('0.7'):
                score += 15
                score_factors.append(('Well-improved property (>70%)', 15))
            elif improvement_ratio < Decimal('0.3'):
                score -= 10
                score_factors.append(('Mostly land value (<30%)', -10))
        
        # Property type bonus/penalty
        if property.property_type == 'single_family':
            score += 5
            score_factors.append(('Single family home', 5))
        elif property.property_type == 'land':
            score -= 5
            score_factors.append(('Land only', -5))
        
        # Age and condition assessment
        if property.year_built:
            current_year = datetime.now().year
            age = current_year - property.year_built
            if age < 20:
                score += 5
                score_factors.append(('Newer construction (<20 years)', 5))
            elif age > 80:
                score -= 5
                score_factors.append(('Very old construction (>80 years)', -5))
        
        # Final score capping
        final_score = max(0, min(100, score))
        
        return {
            'score': final_score,
            'grade': cls._get_score_grade(final_score),
            'score_factors': score_factors,
            'market_value': float(market_value),
            'investment_potential': cls._get_investment_potential(final_score),
        }
    
    @classmethod
    def _get_score_grade(cls, score):
        """Convert numeric score to letter grade"""
        if score >= 90:
            return 'A+'
        elif score >= 85:
            return 'A'
        elif score >= 80:
            return 'A-'
        elif score >= 75:
            return 'B+'
        elif score >= 70:
            return 'B'
        elif score >= 65:
            return 'B-'
        elif score >= 60:
            return 'C+'
        elif score >= 55:
            return 'C'
        elif score >= 50:
            return 'C-'
        elif score >= 40:
            return 'D'
        else:
            return 'F'
    
    @classmethod
    def _get_investment_potential(cls, score):
        """Get investment potential description"""
        if score >= 80:
            return 'Excellent investment opportunity'
        elif score >= 70:
            return 'Good investment potential'
        elif score >= 60:
            return 'Fair investment potential'
        elif score >= 50:
            return 'Marginal investment potential'
        else:
            return 'Poor investment potential'


class WorkflowService:
    """DroneStrike workflow management service"""
    
    @classmethod
    def create_opportunity_from_lead(cls, lead, requested_amount):
        """
        Create investment opportunity from qualified lead
        Implements DroneStrike workflow: Lead → Opportunity → TLC
        """
        from .models import Opportunity
        
        if not lead.property:
            raise ValueError("Lead must have associated property to create opportunity")
        
        # Calculate financial metrics
        financial_service = FinancialCalculationService()
        risk_assessment = financial_service.assess_loan_risk(lead.property, requested_amount)
        
        opportunity = Opportunity.objects.create(
            lead=lead,
            property=lead.property,
            user=lead.owner,
            title=f"Investment Opportunity: {lead.property.address1}, {lead.property.city}",
            description=f"Investment opportunity for {lead.first_name} {lead.last_name} on property at {lead.property.address1}, {lead.property.city}",
            requested_loan_amount=requested_amount,
            max_loan_amount=financial_service.calculate_max_loan_amount(
                lead.property.market_value or lead.property.total_value
            ),
            ltv_ratio=financial_service.calculate_ltv_ratio(
                requested_amount, 
                lead.property.market_value or lead.property.total_value
            ),
            risk_score=risk_assessment['risk_score'],
            risk_factors=risk_assessment['risk_factors'],
            status='analyzing' if risk_assessment['recommended_approval'] else 'qualified'
        )
        
        # Update lead workflow stage
        lead.workflow_stage = 'opportunity_created'
        lead.save()
        
        return opportunity
    
    @classmethod
    def advance_workflow_stage(cls, lead):
        """Advance lead through DroneStrike workflow stages"""
        stage_progression = {
            'lead_identified': 'botg_assigned',
            'botg_assigned': 'botg_in_progress',
            'botg_in_progress': 'botg_completed',
            'botg_completed': 'opportunity_created',
            'opportunity_created': 'tlc_loan_originated',
            'tlc_loan_originated': 'tlc_client_onboarded',
            'tlc_client_onboarded': 'loan_servicing',
        }
        
        current_stage = lead.workflow_stage
        next_stage = stage_progression.get(current_stage)
        
        if next_stage:
            lead.workflow_stage = next_stage
            
            # Update timestamps based on stage
            now = timezone.now()
            if next_stage == 'botg_assigned':
                lead.botg_assigned_at = now
            elif next_stage == 'botg_completed':
                lead.botg_completed_at = now
            elif next_stage == 'tlc_loan_originated':
                lead.tlc_sent_at = now
            
            lead.save()
        
        return next_stage or current_stage