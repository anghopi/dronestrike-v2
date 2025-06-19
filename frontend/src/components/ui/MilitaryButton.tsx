import React from 'react';
import { clsx } from 'clsx';

interface MilitaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'default' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

const LoadingSpinner = () => (
  <svg 
    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle 
      className="opacity-25" 
      cx="12" 
      cy="12" 
      r="10" 
      stroke="currentColor" 
      strokeWidth="4"
    />
    <path 
      className="opacity-75" 
      fill="currentColor" 
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export const MilitaryButton: React.FC<MilitaryButtonProps> = ({
  variant = 'primary',
  size = 'default',
  isLoading = false,
  loadingText = 'Loading...',
  className,
  disabled,
  children,
  ...props
}) => {
  const baseClasses = [
    'inline-flex items-center justify-center font-semibold border transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'hover:shadow-lg active:scale-95'
  ];

  const variantClasses = {
    primary: [
      'bg-gradient-to-r from-brand-color to-blue-600',
      'border-brand-color text-white',
      'hover:from-blue-600 hover:to-brand-color',
      'focus:ring-brand-color',
      'shadow-lg shadow-brand-color/25'
    ],
    secondary: [
      'bg-gradient-to-r from-gray-700 to-gray-600',
      'border-gray-600 text-white',
      'hover:from-gray-600 hover:to-gray-500',
      'focus:ring-gray-500'
    ],
    success: [
      'bg-gradient-to-r from-olive-green to-green-600',
      'border-olive-green text-white',
      'hover:from-green-600 hover:to-olive-green',
      'focus:ring-olive-green',
      'shadow-lg shadow-olive-green/25'
    ],
    danger: [
      'bg-gradient-to-r from-critical-red to-red-600',
      'border-critical-red text-white',
      'hover:from-red-600 hover:to-critical-red',
      'focus:ring-critical-red',
      'shadow-lg shadow-critical-red/25'
    ],
    warning: [
      'bg-gradient-to-r from-yellow-500 to-orange-500',
      'border-yellow-500 text-white',
      'hover:from-orange-500 hover:to-yellow-500',
      'focus:ring-yellow-500',
      'shadow-lg shadow-yellow-500/25'
    ]
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    default: 'px-4 py-2 text-base rounded-lg',
    lg: 'px-6 py-3 text-lg rounded-xl'
  };

  const classes = clsx(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <LoadingSpinner />}
      {isLoading ? loadingText : children}
    </button>
  );
};