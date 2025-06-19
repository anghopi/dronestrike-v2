import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', children }) => {
  const classes = `rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ className = '', children }) => {
  const classes = `flex flex-col space-y-1.5 p-6 ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<CardProps> = ({ className = '', children }) => {
  const classes = `text-2xl font-semibold leading-none tracking-tight ${className}`;
  
  return (
    <h3 className={classes}>
      {children}
    </h3>
  );
};

export const CardContent: React.FC<CardProps> = ({ className = '', children }) => {
  const classes = `p-6 pt-0 ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ className = '', children }) => {
  const classes = `flex items-center p-6 pt-0 ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};