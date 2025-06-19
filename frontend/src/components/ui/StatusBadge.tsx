import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'completed' | 'failed' | 'warning' | 'new' | 'contacted' | 'qualified';
  size?: 'sm' | 'default' | 'lg';
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'default',
  children,
  pulse = false,
  className
}) => {
  const baseClasses = [
    'inline-flex items-center font-semibold rounded-full border',
    'transition-all duration-200'
  ];

  const statusClasses = {
    active: [
      'bg-olive-green/20 border-olive-green text-olive-green',
      pulse && 'animate-pulse'
    ],
    pending: [
      'bg-yellow-500/20 border-yellow-500 text-yellow-400',
      pulse && 'animate-pulse'
    ],
    completed: [
      'bg-green-500/20 border-green-500 text-green-400'
    ],
    failed: [
      'bg-critical-red/20 border-critical-red text-critical-red'
    ],
    warning: [
      'bg-orange-500/20 border-orange-500 text-orange-400'
    ],
    new: [
      'bg-blue-500/20 border-blue-500 text-blue-400',
      pulse && 'animate-pulse'
    ],
    contacted: [
      'bg-purple-500/20 border-purple-500 text-purple-400'
    ],
    qualified: [
      'bg-emerald-500/20 border-emerald-500 text-emerald-400'
    ]
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    default: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const classes = clsx(
    baseClasses,
    statusClasses[status],
    sizeClasses[size],
    className
  );

  return (
    <span className={classes}>
      {children}
    </span>
  );
};