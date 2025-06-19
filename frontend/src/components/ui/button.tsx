import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className = '',
  variant = 'default',
  size = 'default',
  children,
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-color/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background backdrop-blur-sm';
  
  const variants = {
    default: 'bg-gradient-to-r from-brand-color to-brand-color-light text-white hover:from-brand-color-hover hover:to-brand-color hover:shadow-lg hover:shadow-brand-color/25 border border-brand-color/30',
    destructive: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 hover:shadow-lg hover:shadow-red-600/25 border border-red-500/30',
    outline: 'border border-gray-600/50 bg-gray-800/30 text-white hover:bg-gray-700/50 hover:border-gray-500/50 hover:shadow-md',
    secondary: 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60 hover:text-white border border-gray-600/30 hover:border-gray-500/50',
    ghost: 'text-gray-300 hover:bg-gray-700/30 hover:text-white',
    link: 'text-brand-color hover:text-brand-color-light underline-offset-4 hover:underline'
  };

  const sizes = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3 text-xs',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10'
  };

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button 
      className={classes} 
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};