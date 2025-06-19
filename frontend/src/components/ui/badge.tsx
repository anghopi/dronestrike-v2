import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ 
  variant = 'default', 
  className = '', 
  children 
}) => {
  const baseClasses = 'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-color/50 focus:ring-offset-2 backdrop-blur-sm shadow-sm';
  
  const variants = {
    default: 'border-brand-color/30 bg-gradient-to-r from-brand-color/80 to-brand-color text-white hover:from-brand-color hover:to-brand-color-light hover:shadow-md',
    secondary: 'border-gray-600/30 bg-gray-800/40 text-gray-300 hover:bg-gray-700/60 hover:text-white hover:border-gray-500/50',
    destructive: 'border-red-500/30 bg-gradient-to-r from-red-600/80 to-red-700 text-white hover:from-red-600 hover:to-red-800 hover:shadow-md',
    outline: 'text-white border-gray-600/50 bg-gray-800/20 hover:bg-gray-700/30 hover:border-gray-500/50'
  };

  const classes = `${baseClasses} ${variants[variant]} ${className}`;

  return (
    <div className={classes}>
      {children}
    </div>
  );
};