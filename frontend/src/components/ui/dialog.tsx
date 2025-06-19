import React, { useState, createContext, useContext } from 'react';

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open: controlledOpen, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg md:w-full">
            {React.Children.map(children, child => {
              if (React.isValidElement(child) && child.type !== DialogTrigger) {
                return child;
              }
              return null;
            })}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, asChild = false }) => {
  const context = useContext(DialogContext);
  
  if (!context) {
    throw new Error('DialogTrigger must be used within a Dialog');
  }

  const { setOpen } = context;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: () => setOpen(true)
    });
  }

  return (
    <button onClick={() => setOpen(true)}>
      {children}
    </button>
  );
};

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

export const DialogContent: React.FC<DialogContentProps> = ({ className = '', children }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export const DialogHeader: React.FC<DialogContentProps> = ({ className = '', children }) => {
  const classes = `flex flex-col space-y-1.5 text-center sm:text-left ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};

export const DialogTitle: React.FC<DialogContentProps> = ({ className = '', children }) => {
  const classes = `text-lg font-semibold leading-none tracking-tight ${className}`;
  
  return (
    <h2 className={classes}>
      {children}
    </h2>
  );
};