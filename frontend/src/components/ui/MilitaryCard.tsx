import React from 'react';
import { clsx } from 'clsx';

interface MilitaryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient';
  padding?: 'none' | 'sm' | 'default' | 'lg';
  hover?: boolean;
}

export const MilitaryCard: React.FC<MilitaryCardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'default',
  hover = false,
  ...props
}) => {
  const baseClasses = [
    'bg-navy-blue-dark border border-gray-700 rounded-lg',
    'transition-all duration-200'
  ];

  const variantClasses = {
    default: [],
    elevated: [
      'shadow-xl shadow-black/30',
      hover && 'hover:shadow-2xl hover:shadow-black/40'
    ],
    bordered: [
      'border-2 border-brand-color/30',
      hover && 'hover:border-brand-color/60'
    ],
    gradient: [
      'bg-gradient-to-br from-navy-blue-dark via-navy-blue to-navy-blue-dark',
      'border-gradient border-brand-color/20'
    ]
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    default: 'p-6',
    lg: 'p-8'
  };

  const hoverClasses = hover ? [
    'cursor-pointer',
    'hover:transform hover:scale-[1.02]',
    'hover:bg-navy-blue/80'
  ] : [];

  const classes = clsx(
    baseClasses,
    variantClasses[variant],
    paddingClasses[padding],
    hoverClasses,
    className
  );

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};