import React, { forwardRef, useState, useEffect } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  onChange?: (value: number | null) => void;
  currency?: string;
  locale?: string;
  allowNegative?: boolean;
  maxValue?: number;
  minValue?: number;
}

const formatCurrency = (
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const parseCurrencyValue = (value: string): number | null => {
  // Remove currency symbols, commas, and spaces
  const cleaned = value.replace(/[^0-9.-]/g, '');
  
  if (cleaned === '' || cleaned === '-') return null;
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ 
    label, 
    error, 
    onChange, 
    currency = 'USD',
    locale = 'en-US',
    allowNegative = false,
    maxValue,
    minValue,
    className, 
    ...props 
  }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Initialize display value from props.value
    useEffect(() => {
      if (props.value !== undefined && props.value !== null) {
        const numValue = typeof props.value === 'string' ? parseFloat(props.value) : Number(props.value);
        if (!isNaN(numValue)) {
          setDisplayValue(isFocused ? numValue.toString() : formatCurrency(numValue, currency, locale));
        }
      }
    }, [props.value, currency, locale, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      if (isFocused) {
        // When focused, allow raw number input
        setDisplayValue(inputValue);
        
        const numericValue = parseCurrencyValue(inputValue);
        
        // Validate against constraints
        if (numericValue !== null) {
          if (!allowNegative && numericValue < 0) return;
          if (maxValue !== undefined && numericValue > maxValue) return;
          if (minValue !== undefined && numericValue < minValue) return;
        }
        
        if (onChange) {
          onChange(numericValue);
        }
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
      const numericValue = parseCurrencyValue(displayValue);
      if (numericValue !== null) {
        setDisplayValue(numericValue.toString());
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      const numericValue = parseCurrencyValue(displayValue);
      
      if (numericValue !== null) {
        setDisplayValue(formatCurrency(numericValue, currency, locale));
      } else {
        setDisplayValue('');
      }
    };

    const getCurrencySymbol = (currency: string, locale: string): string => {
      return (0).toLocaleString(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).replace(/[\d,.\s]/g, '');
    };

    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium">{label}</label>}
        <div className="relative">
          {isFocused && (
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              {getCurrencySymbol(currency, locale)}
            </span>
          )}
          <input
            {...props}
            ref={ref}
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={formatCurrency(0, currency, locale)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-500' : ''
            } ${isFocused ? 'pl-8' : ''} ${className || ''}`}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {maxValue !== undefined && (
          <p className="text-xs text-gray-500">
            Maximum: {formatCurrency(maxValue, currency, locale)}
          </p>
        )}
        {minValue !== undefined && (
          <p className="text-xs text-gray-500">
            Minimum: {formatCurrency(minValue, currency, locale)}
          </p>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';