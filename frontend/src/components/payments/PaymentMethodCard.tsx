import React from 'react';
import { 
  CreditCardIcon,
  BanknotesIcon,
  TrashIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  us_bank_account?: {
    bank_name: string;
    last4: string;
    account_type: string;
  };
  created: number;
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
  onDelete: () => void;
  isDefault?: boolean;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ 
  method, 
  onDelete, 
  isDefault = false 
}) => {
  const formatCardBrand = (brand: string): string => {
    const brandMap: { [key: string]: string } = {
      'visa': 'Visa',
      'mastercard': 'Mastercard',
      'amex': 'American Express',
      'discover': 'Discover',
      'diners': 'Diners Club',
      'jcb': 'JCB',
      'unionpay': 'UnionPay'
    };
    return brandMap[brand.toLowerCase()] || brand.toUpperCase();
  };

  const getCardIcon = (type: string, brand?: string) => {
    if (type === 'card') {
      return <CreditCardIcon className="h-8 w-8 text-gray-600" />;
    } else if (type === 'us_bank_account') {
      return <BanknotesIcon className="h-8 w-8 text-gray-600" />;
    }
    return <CreditCardIcon className="h-8 w-8 text-gray-600" />;
  };

  const getBrandColor = (brand?: string): string => {
    const colors: { [key: string]: string } = {
      'visa': 'text-blue-600',
      'mastercard': 'text-red-600',
      'amex': 'text-green-600',
      'discover': 'text-orange-600'
    };
    return colors[brand?.toLowerCase() || ''] || 'text-gray-600';
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Payment Method Icon */}
          <div className="flex-shrink-0">
            {getCardIcon(method.type, method.card?.brand)}
          </div>

          {/* Payment Method Details */}
          <div className="flex-1">
            {method.type === 'card' && method.card && (
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className={`font-semibold ${getBrandColor(method.card.brand)}`}>
                    {formatCardBrand(method.card.brand)}
                  </h3>
                  {isDefault && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600">**** **** **** {method.card.last4}</p>
                <p className="text-sm text-gray-500">
                  Expires {method.card.exp_month.toString().padStart(2, '0')}/{method.card.exp_year}
                </p>
              </div>
            )}

            {method.type === 'us_bank_account' && method.us_bank_account && (
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-900">
                    {method.us_bank_account.bank_name}
                  </h3>
                  {isDefault && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600">
                  {method.us_bank_account.account_type} ****{method.us_bank_account.last4}
                </p>
                <p className="text-sm text-gray-500">Bank Account</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            Added {new Date(method.created * 1000).toLocaleDateString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodCard;