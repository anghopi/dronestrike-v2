import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  const classes = `flex h-11 w-full rounded-xl border border-gray-600/50 bg-gray-800/40 backdrop-blur-sm px-4 py-3 text-sm font-medium text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-color/50 focus-visible:ring-offset-2 focus-visible:border-brand-color/50 focus-visible:bg-gray-800/60 hover:border-gray-500/50 hover:bg-gray-800/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 ${className}`;
  
  return <input className={classes} {...props} />;
};