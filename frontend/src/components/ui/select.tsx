import React, { useState, useRef, useEffect } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue);
    onValueChange?.(newValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === SelectTrigger) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onClick: () => setIsOpen(!isOpen),
              selectedValue
            });
          } else if (child.type === SelectContent) {
            return isOpen ? React.cloneElement(child as React.ReactElement<any>, {
              onValueChange: handleValueChange
            }) : null;
          }
        }
        return child;
      })}
    </div>
  );
};

interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  selectedValue?: string;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ 
  className = '', 
  children,
  onClick,
  selectedValue
}) => {
  const classes = `flex h-11 w-full items-center justify-between rounded-xl border border-gray-600/50 bg-gray-800/40 backdrop-blur-sm px-4 py-3 text-sm font-medium text-white ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-color/50 focus:ring-offset-2 focus:border-brand-color/50 focus:bg-gray-800/60 hover:border-gray-500/50 hover:bg-gray-800/50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all duration-300 ${className}`;
  
  return (
    <div className={classes} onClick={onClick}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === SelectValue) {
          return React.cloneElement(child as React.ReactElement<any>, {
            selectedValue
          });
        }
        return child;
      })}
      <svg
        className="h-4 w-4 text-gray-400 transition-transform duration-200"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6,9 12,15 18,9"></polyline>
      </svg>
    </div>
  );
};

interface SelectValueProps {
  placeholder?: string;
  selectedValue?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, selectedValue }) => {
  return (
    <span className="truncate">
      {selectedValue || placeholder}
    </span>
  );
};

interface SelectContentProps {
  className?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

export const SelectContent: React.FC<SelectContentProps> = ({ 
  className = '', 
  children,
  onValueChange
}) => {
  const classes = `absolute z-50 top-full mt-2 min-w-[12rem] w-full overflow-hidden rounded-xl border border-gray-600/50 bg-gray-800/95 backdrop-blur-md text-white shadow-2xl animate-fadeIn ${className}`;
  
  return (
    <div className={classes}>
      <div className="p-1">
        {React.Children.map(children, child => {
          if (React.isValidElement(child) && child.type === SelectItem) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onSelect: onValueChange
            });
          }
          return child;
        })}
      </div>
    </div>
  );
};

interface SelectItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
}

export const SelectItem: React.FC<SelectItemProps> = ({ 
  value, 
  className = '', 
  children,
  onSelect
}) => {
  const classes = `relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 px-3 text-sm font-medium outline-none hover:bg-gray-700/50 focus:bg-gray-700/50 transition-colors duration-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`;
  
  return (
    <div 
      className={classes}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </div>
  );
};