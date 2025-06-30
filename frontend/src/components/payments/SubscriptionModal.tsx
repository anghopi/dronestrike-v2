import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useMutation } from '@tanstack/react-query';
import { 
  XMarkIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  StarIcon,
  TrophyIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
  popular?: boolean;
  stripe_price_id: string;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 49.99,
    interval: 'month',
    description: 'Perfect for individual users',
    features: [
      '2,000 regular tokens/month',
      '25 mail tokens/month',
      'Basic support',
      'Standard features'
    ],
    stripe_price_id: 'price_basic_monthly'
  },
  {
    id: 'professional',
    name: 'Professional Plan',
    price: 149.99,
    interval: 'month',
    description: 'Best for growing businesses',
    features: [
      '10,000 regular tokens/month',
      '125 mail tokens/month',
      'Priority support',
      'Advanced features',
      'API access'
    ],
    popular: true,
    stripe_price_id: 'price_professional_monthly'
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: 499.99,
    interval: 'month',
    description: 'For large organizations',
    features: [
      '50,000 regular tokens/month',
      '625 mail tokens/month',
      'Dedicated support',
      'All features',
      'Custom integrations',
      'White-label options'
    ],
    stripe_price_id: 'price_enterprise_monthly'
  }
];

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('professional');
  const [discountCode, setDiscountCode] = useState('');
  const [savePaymentMethod, setSavePaymentMethod] = useState(true);
  const [step, setStep] = useState<'select' | 'payment' | 'processing' | 'success'>('select');
  const [error, setError] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  const selectedPlanData = SUBSCRIPTION_PLANS.find(plan => plan.id === selectedPlan);

  // Create subscription mutation
  const subscriptionMutation = useMutation({
    mutationFn: async ({ price_id, payment_method_id, coupon_code }: any) => {
      const response = await fetch('/api/payments/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          price_id,
          payment_method_id,
          coupon_code
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Subscription creation failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 'active') {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        // Payment requires confirmation
        handlePaymentConfirmation(data);
      }
    },
    onError: (error: any) => {
      setError(error.message);
      setStep('payment');
    }
  });

  const handlePaymentConfirmation = async (data: any) => {
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    try {
      const { error } = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: {
          card: cardElement
        }
      });

      if (error) {
        setError(error.message || 'Payment failed');
        setStep('payment');
      } else {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
      setStep('payment');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements || !selectedPlanData) return;

    setError(null);
    setStep('processing');

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setStep('payment');
      return;
    }

    try {
      // Create payment method
      const { error: methodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement
      });

      if (methodError) {
        setError(methodError.message || 'Failed to create payment method');
        setStep('payment');
        return;
      }

      // Create subscription
      subscriptionMutation.mutate({
        price_id: selectedPlanData.stripe_price_id,
        payment_method_id: paymentMethod?.id,
        coupon_code: discountCode || undefined
      });

    } catch (err: any) {
      setError(err.message);
      setStep('payment');
    }
  };

  const handleClose = () => {
    setStep('select');
    setError(null);
    setSelectedPlan('professional');
    setDiscountCode('');
    setSavePaymentMethod(true);
    onClose();
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'basic':
        return <StarIcon className="h-8 w-8 text-blue-500" />;
      case 'professional':
        return <TrophyIcon className="h-8 w-8 text-green-500" />;
      case 'enterprise':
        return <BuildingOfficeIcon className="h-8 w-8 text-purple-500" />;
      default:
        return <StarIcon className="h-8 w-8 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Choose Subscription Plan</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-6">
              {/* Plan Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Your Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative border rounded-lg p-6 cursor-pointer transition-all ${
                        selectedPlan === plan.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${plan.popular ? 'ring-2 ring-green-500' : ''}`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-green-500 text-white px-3 py-1 text-xs">
                            Most Popular
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-4">
                          {getPlanIcon(plan.id)}
                        </div>
                        
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          {plan.name}
                        </h4>
                        
                        <div className="mb-4">
                          <span className="text-3xl font-bold text-gray-900">
                            ${plan.price}
                          </span>
                          <span className="text-gray-600">/{plan.interval}</span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4">
                          {plan.description}
                        </p>
                        
                        <ul className="text-sm text-gray-600 space-y-2">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center">
                              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Code (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Enter discount code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available codes: 5STARGENERAL (50% off forever), INFANTRY (50% off 3 months)
                </p>
              </div>

              {/* Selected Plan Summary */}
              {selectedPlanData && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Plan Summary</h4>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{selectedPlanData.name}</span>
                      <p className="text-sm text-gray-600">{selectedPlanData.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-gray-900">
                        ${selectedPlanData.price}
                      </span>
                      <p className="text-sm text-gray-600">per {selectedPlanData.interval}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('payment')}>
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}

          {step === 'payment' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border rounded-lg p-4">
                  <CardElement
                    options={{
                      style: {
                        base: {
                          fontSize: '16px',
                          color: '#424770',
                          '::placeholder': {
                            color: '#aab7c4',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="save-payment"
                  type="checkbox"
                  checked={savePaymentMethod}
                  onChange={(e) => setSavePaymentMethod(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="save-payment" className="ml-2 text-sm text-gray-700">
                  Save payment method for future billing
                </label>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setStep('select')}>
                  Back
                </Button>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    ${selectedPlanData?.price}/{selectedPlanData?.interval}
                  </p>
                  <Button type="submit" disabled={!stripe}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Start Subscription
                  </Button>
                </div>
              </div>
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Subscription</h3>
              <p className="text-gray-600">Please wait while we set up your subscription...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Subscription Created!</h3>
              <p className="text-gray-600">Your subscription is now active and tokens will be credited monthly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;