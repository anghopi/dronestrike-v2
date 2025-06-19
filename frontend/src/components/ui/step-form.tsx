import React, { ReactNode } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { 
  CheckCircleIcon as CheckCircle, 
  CircleStackIcon as Circle, 
  ArrowPathIcon as Loader2 
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
  content: ReactNode;
}

interface StepFormProps {
  steps: StepConfig[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: () => Promise<void> | void;
  onCancel?: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  loading?: boolean;
  className?: string;
  completedSteps?: number[];
}

export function StepForm({
  steps,
  currentStep,
  onStepChange,
  onSubmit,
  onCancel,
  canGoNext = true,
  canGoPrevious = true,
  loading = false,
  className,
  completedSteps = [],
}: StepFormProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepConfig = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onSubmit();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.includes(stepIndex)) return 'completed';
    if (stepIndex === currentStep) return 'current';
    if (stepIndex < currentStep) return 'completed';
    return 'upcoming';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Step Progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Step {currentStep + 1} of {steps.length}
          </h2>
          <Badge variant="outline">
            {completedSteps.length} / {steps.length} completed
          </Badge>
        </div>
        
        <div className="flex items-center space-x-4 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const isClickable = index <= currentStep || completedSteps.includes(index);
            
            return (
              <div key={step.id} className="flex items-center space-x-2 min-w-0">
                <button
                  onClick={() => isClickable && onStepChange(index)}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center space-x-2 rounded-lg p-3 transition-colors min-w-0',
                    status === 'current' && 'bg-primary text-primary-foreground',
                    status === 'completed' && 'bg-green-100 text-green-800',
                    status === 'upcoming' && 'bg-muted text-muted-foreground',
                    isClickable && 'hover:bg-opacity-80 cursor-pointer'
                  )}
                >
                  <div className="flex-shrink-0">
                    {status === 'completed' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Circle 
                        className={cn(
                          'h-5 w-5',
                          status === 'current' && 'fill-current'
                        )} 
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{step.title}</p>
                    {step.optional && (
                      <p className="text-xs opacity-75">Optional</p>
                    )}
                  </div>
                </button>
                
                {index < steps.length - 1 && (
                  <div className="w-8 h-px bg-border flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStepConfig.title}
            {currentStepConfig.optional && (
              <Badge variant="secondary">Optional</Badge>
            )}
          </CardTitle>
          {currentStepConfig.description && (
            <p className="text-muted-foreground">{currentStepConfig.description}</p>
          )}
        </CardHeader>
        <CardContent>
          {currentStepConfig.content}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div>
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!canGoPrevious || loading}
            >
              Previous
            </Button>
          )}
        </div>
        
        <div className="flex gap-3">
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
          
          <Button
            onClick={handleNext}
            disabled={!canGoNext || loading}
            className="min-w-24"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLastStep ? 'Complete' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}