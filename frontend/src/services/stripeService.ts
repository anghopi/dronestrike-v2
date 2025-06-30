/**
 * Stripe Payment Integration Service
 * Handles token purchases and subscription management
 */

import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_live_9ohVxPbSmbSPGClKT0uksXFn00iU2rtutT');

export interface TokenPackage {
  name: string;
  regular_tokens: number;
  mail_tokens: number;
  price: number;
  description: string;
}

export interface LeadPackage {
  name: string;
  price_per_lead: number;
  minimum_leads: number;
  description: string;
  includes: string[];
  tokens_included?: {
    regular: number;
    mail: number;
  };
  actual_value?: number;
}

export interface SubscriptionPlan {
  name: string;
  price_monthly: number;
  description: string;
  features: string[];
  stripe_price_id?: string;
}

export interface TokenBalance {
  regular_tokens: number;
  mail_tokens: number;
  profile_tokens?: number;
  profile_mail_tokens?: number;
}

export interface PurchaseIntent {
  client_secret: string;
  purchase_id?: number;
  amount: number;
  package?: TokenPackage;
}

export interface PurchaseHistory {
  purchases: Array<{
    id: number;
    type: string;
    package_name: string;
    regular_tokens: number;
    mail_tokens: number;
    total_price: string;
    payment_status: string;
    created_at: string;
  }>;
  transactions: Array<{
    id: number;
    type: string;
    token_type: string;
    transaction_type: string;
    tokens_changed: number;
    description: string;
    created_at: string;
  }>;
}

class StripeService {
  private baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  /**
   * Get available token packages
   */
  async getTokenPackages(): Promise<{
    regular_token_price: number;
    mail_token_price: number;
    packages: TokenPackage[];
    lead_packages: LeadPackage[];
    subscriptions: SubscriptionPlan[];
    feature_costs: Record<string, any>;
  }> {
    const response = await fetch(`${this.baseUrl}/api/dev/stripe/packages/`);
    if (!response.ok) {
      throw new Error('Failed to fetch token packages');
    }
    return response.json();
  }

  /**
   * Get user's current token balance
   */
  async getTokenBalance(): Promise<TokenBalance> {
    const response = await fetch(`${this.baseUrl}/api/dev/stripe/balance/`);
    if (!response.ok) {
      throw new Error('Failed to fetch token balance');
    }
    return response.json();
  }

  /**
   * Create a payment intent for token purchase
   */
  async createPurchaseIntent(packageName: string, customAmount?: number): Promise<PurchaseIntent> {
    const response = await fetch(`${this.baseUrl}/api/dev/stripe/purchase-intent/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_name: packageName,
        custom_amount: customAmount,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create purchase intent');
    }
    return response.json();
  }

  /**
   * Create a subscription intent
   */
  async createSubscriptionIntent(planName: string, discountCode?: string): Promise<{
    subscription_id: string;
    client_secret: string;
    plan: SubscriptionPlan;
    discount_applied: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/api/tokens/subscribe/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        plan_name: planName,
        discount_code: discountCode,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create subscription intent');
    }
    return response.json();
  }

  /**
   * Process token package purchase with Stripe
   */
  async purchaseTokenPackage(packageName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Create payment intent
      const purchaseIntent = await this.createPurchaseIntent(packageName);

      // Redirect to Stripe Checkout or handle Payment Intent
      const { error } = await stripe.confirmPayment({
        clientSecret: purchaseIntent.client_secret,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });

      if (error) {
        console.error('Payment failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Purchase failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Purchase failed' 
      };
    }
  }

  /**
   * Process subscription purchase with Stripe
   */
  async purchaseSubscription(
    planName: string, 
    discountCode?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Create subscription intent
      const subscriptionIntent = await this.createSubscriptionIntent(planName, discountCode);

      // Confirm subscription payment
      const { error } = await stripe.confirmPayment({
        clientSecret: subscriptionIntent.client_secret,
        confirmParams: {
          return_url: `${window.location.origin}/subscription-success`,
        },
      });

      if (error) {
        console.error('Subscription failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Subscription failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Subscription failed' 
      };
    }
  }

  /**
   * Get user's purchase history
   */
  async getPurchaseHistory(): Promise<PurchaseHistory> {
    const response = await fetch(`${this.baseUrl}/api/tokens/history/`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch purchase history');
    }
    return response.json();
  }

  /**
   * Create Stripe Checkout Session (alternative to Payment Intent)
   */
  async createCheckoutSession(packageName: string): Promise<{ checkout_url: string }> {
    const response = await fetch(`${this.baseUrl}/api/stripe/checkout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        package_name: packageName,
        success_url: `${window.location.origin}/payment-success`,
        cancel_url: `${window.location.origin}/payment-cancelled`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }
    return response.json();
  }

  /**
   * Apply discount code validation
   */
  async validateDiscountCode(code: string): Promise<{
    valid: boolean;
    discount_percent?: number;
    description?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stripe/validate-discount/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        return { valid: false, error: 'Invalid discount code' };
      }

      return response.json();
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;