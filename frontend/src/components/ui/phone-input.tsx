import React, { forwardRef, useState } from 'react';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  onChange?: (value: string) => void;
  format?: 'US' | 'international';
}

const formatPhoneNumber = (value: string, format: 'US' | 'international' = 'US'): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  if (format === 'US') {
    // US format: (123) 456-7890
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  } else {
    // International format: +1 234 567 8900
    if (digits.length === 0) return '';
    if (digits.length <= 1) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 1)} ${digits.slice(1)}`;
    if (digits.length <= 7) return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`;
    return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }
};

const validatePhoneNumber = (value: string, format: 'US' | 'international' = 'US'): boolean => {
  const digits = value.replace(/\D/g, '');
  
  if (format === 'US') {
    return digits.length === 10;
  } else {
    return digits.length >= 10 && digits.length <= 15;
  }
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, onChange, format = 'US', className, ...props }, ref) => {
    const [formattedValue, setFormattedValue] = useState(
      props.value ? formatPhoneNumber(String(props.value), format) : ''
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formatted = formatPhoneNumber(rawValue, format);
      
      setFormattedValue(formatted);
      
      if (onChange) {
        // Return the raw digits for form handling
        const digits = rawValue.replace(/\D/g, '');
        onChange(digits);
      }
    };

    const isValid = formattedValue ? validatePhoneNumber(formattedValue, format) : true;

    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium">{label}</label>}
        <input
          {...props}
          ref={ref}
          type="tel"
          value={formattedValue}
          onChange={handleChange}
          placeholder={format === 'US' ? '(123) 456-7890' : '+1 234 567 8900'}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
            error ? 'border-red-500' : ''
          } ${!isValid && formattedValue ? 'border-yellow-500' : ''} ${className || ''}`}
        />
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {!isValid && formattedValue && !error && (
          <p className="text-sm text-yellow-600">
            {format === 'US' 
              ? 'Please enter a valid 10-digit phone number' 
              : 'Please enter a valid phone number'
            }
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';