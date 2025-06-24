"""
Stripe configuration and token pricing based on Token Values.xlsx
"""

# Token Pricing Structure from Excel
TOKEN_PRICING = {
    'regular_token_price': 0.001,  # $0.001 per regular token
    'mail_token_price': 0.80,     # $0.80 per mail token
    
    # Feature costs in tokens
    'feature_costs': {
        'sms_text': {'regular_tokens': 8.0, 'mail_tokens': 0.0, 'actual_cost': 0.007, 'total_cost': 0.008},
        'phone_minutes': {'regular_tokens': 100.0, 'mail_tokens': 0.0, 'actual_cost': 0.0095, 'total_cost': 0.10},
        'phone_per_line_monthly': {'regular_tokens': 0.0, 'mail_tokens': 0.0, 'actual_cost': 0.80, 'total_cost': 0},
        'emails': {'regular_tokens': 0.0, 'mail_tokens': 0.0, 'actual_cost': 0.0, 'total_cost': 0},
        'leads': {'regular_tokens': 0.0, 'mail_tokens': 0.0, 'actual_cost': 0.0, 'total_cost': 0},
        'skip_trace': {'regular_tokens': 800.0, 'mail_tokens': 0.0, 'actual_cost': 0.55, 'total_cost': 0.80},
        'mail_out': {'regular_tokens': 1.0, 'mail_tokens': 1.0, 'actual_cost': 0.37, 'total_cost': 0.80},
    },
    
    # Token packages
    'packages': [
        {
            'name': 'Standard Package',
            'regular_tokens': 25000,
            'mail_tokens': 0,
            'price': 25.00,
            'description': '25,000 regular tokens for general use'
        },
        {
            'name': 'Mail Token Package - Small',
            'regular_tokens': 0,
            'mail_tokens': 10,
            'price': 8.00,
            'description': '10 mail tokens for direct mail campaigns'
        },
        {
            'name': 'Mail Token Package - Medium',
            'regular_tokens': 0,
            'mail_tokens': 50,
            'price': 40.00,
            'description': '50 mail tokens for direct mail campaigns'
        },
        {
            'name': 'Mail Token Package - Large',
            'regular_tokens': 0,
            'mail_tokens': 100,
            'price': 80.00,
            'description': '100 mail tokens for direct mail campaigns'
        },
        {
            'name': 'Combined Package - Starter',
            'regular_tokens': 10000,
            'mail_tokens': 25,
            'price': 30.00,
            'description': '10,000 regular tokens + 25 mail tokens'
        },
        {
            'name': 'Combined Package - Professional',
            'regular_tokens': 50000,
            'mail_tokens': 100,
            'price': 130.00,
            'description': '50,000 regular tokens + 100 mail tokens'
        }
    ],
    
    # Lead packages
    'lead_packages': [
        {
            'name': 'Basic Leads',
            'price_per_lead': 1.50,
            'minimum_leads': 10,
            'description': 'Basic lead data',
            'includes': ['lead_data']
        },
        {
            'name': 'Lead + Skip + Mail',
            'price_per_lead': 1.50,
            'minimum_leads': 10,
            'description': 'Lead data + Skip Trace + 1 Mail Token + 200 Regular Tokens',
            'includes': ['lead_data', 'skip_trace', 'mail_token', 'regular_tokens'],
            'tokens_included': {'regular': 200, 'mail': 1},
            'actual_value': 1.80
        },
        {
            'name': 'Lead + Skip Only',
            'price_per_lead': 1.00,
            'minimum_leads': 10,
            'description': 'Lead data + Skip Trace + 200 Regular Tokens',
            'includes': ['lead_data', 'skip_trace', 'regular_tokens'],
            'tokens_included': {'regular': 200, 'mail': 0},
            'actual_value': 1.00
        }
    ],
    
    # Subscription plans
    'subscriptions': [
        {
            'name': 'DroneStrike Professional',
            'price_monthly': 799.00,
            'description': 'Full access to DroneStrike platform',
            'features': [
                'Unlimited lead management',
                'BOTG mission coordination',
                'TLC loan origination integration',
                'Advanced analytics and reporting',
                'Priority support'
            ],
            'stripe_price_id': None  # To be set when creating in Stripe
        }
    ],
    
    # Beta discounts
    'beta_discounts': {
        'five_star_general': {
            'discount_percent': 50,
            'applies_to': 'subscription',
            'duration': 'forever',
            'description': '50% off monthly subscription for life + referral code'
        },
        'infantry': {
            'discount_percent': 50,
            'applies_to': 'subscription',
            'duration': '3_months',
            'description': '50% off first 3 months (first 200 subscribers only)',
            'max_subscribers': 200
        }
    }
}

# Stripe Product IDs (to be created in Stripe dashboard)
STRIPE_PRODUCTS = {
    'regular_tokens': None,
    'mail_tokens': None,
    'subscription': None,
    'lead_packages': None
}