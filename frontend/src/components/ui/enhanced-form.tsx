import React, { ReactNode } from 'react';
import { Button } from './button';
import { Card, CardFooter, CardHeader, CardTitle } from './card';
import { ArrowPathIcon as Loader2 } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface EnhancedFormProps {
  title?: string;
  description?: string;
  onSubmit: () => Promise<void> | void;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  footerClassName?: string;
  variant?: 'default' | 'card';
}

export function EnhancedForm({
  title,
  description,
  onSubmit,
  onCancel,
  submitText = 'Submit',
  cancelText = 'Cancel',
  loading = false,
  disabled = false,
  className,
  children,
  footerClassName,
  variant = 'default',
}: EnhancedFormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const formContent = (
    <>
      {(title || description) && variant === 'card' && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      
      <div className={variant === 'card' ? 'px-6' : ''}>
        {(title || description) && variant === 'default' && (
          <div className="mb-6">
            {title && <h2 className="text-2xl font-bold mb-2">{title}</h2>}
            {description && <p className="text-muted-foreground">{description}</p>}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {children}
          
          <div className={cn('flex gap-3 pt-4', footerClassName)}>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                {cancelText}
              </Button>
            )}
            <Button
              type="submit"
              disabled={disabled || loading}
              className="min-w-24"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitText}
            </Button>
          </div>
        </form>
      </div>
      
      {variant === 'card' && (
        <CardFooter className="bg-muted/30">
          <div className="flex gap-3 ml-auto">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                {cancelText}
              </Button>
            )}
            <Button
              type="submit"
              form="enhanced-form"
              disabled={disabled || loading}
              className="min-w-24"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitText}
            </Button>
          </div>
        </CardFooter>
      )}
    </>
  );

  if (variant === 'card') {
    return (
      <Card className={className}>
        {formContent}
      </Card>
    );
  }

  return (
    <div className={className}>
      {formContent}
    </div>
  );
}