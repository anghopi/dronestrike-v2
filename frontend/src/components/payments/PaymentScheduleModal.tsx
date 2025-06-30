import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  XMarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface PaymentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentScheduleModal: React.FC<PaymentScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [installments, setInstallments] = useState<number>(6);
  const [frequency, setFrequency] = useState<string>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [step, setStep] = useState<'setup' | 'processing' | 'success'>('setup');
  const [error, setError] = useState<string | null>(null);

  // Calculate installment amount
  const installmentAmount = totalAmount ? (parseFloat(totalAmount) / installments).toFixed(2) : '0.00';

  // Create payment schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const response = await fetch('/api/payments/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(scheduleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Schedule creation failed');
      }

      return response.json();
    },
    onSuccess: () => {
      setStep('success');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    },
    onError: (error: any) => {
      setError(error.message);
      setStep('setup');
    }
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!totalAmount || !startDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(totalAmount) <= 0) {
      setError('Total amount must be greater than 0');
      return;
    }

    if (installments < 1 || installments > 60) {
      setError('Installments must be between 1 and 60');
      return;
    }

    setError(null);
    setStep('processing');

    const scheduleData = {
      total_amount: parseFloat(totalAmount),
      installments,
      frequency,
      start_date: new Date(startDate).toISOString(),
      description: description || `Payment schedule for $${totalAmount}`
    };

    scheduleMutation.mutate(scheduleData);
  };

  const handleClose = () => {
    setStep('setup');
    setError(null);
    setTotalAmount('');
    setInstallments(6);
    setFrequency('monthly');
    setStartDate('');
    setDescription('');
    onClose();
  };

  const getFrequencyLabel = (freq: string): string => {
    switch (freq) {
      case 'weekly': return 'week';
      case 'monthly': return 'month';
      case 'quarterly': return 'quarter';
      default: return 'month';
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create Payment Schedule</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'setup' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Amount *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    max="50000"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Number of Installments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Installments *
                </label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={installments}
                  onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                  placeholder="6"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Between 1 and 60 installments
                </p>
              </div>

              {/* Payment Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="date"
                    required
                    min={today}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Payment schedule description"
                  maxLength={200}
                />
              </div>

              {/* Schedule Summary */}
              {totalAmount && installments && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Schedule Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-medium">${parseFloat(totalAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Number of Payments:</span>
                      <span className="font-medium">{installments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Amount:</span>
                      <span className="font-medium">${installmentAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frequency:</span>
                      <span className="font-medium">Every {getFrequencyLabel(frequency)}</span>
                    </div>
                    {startDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">First Payment:</span>
                        <span className="font-medium">
                          {new Date(startDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </div>
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Creating Payment Schedule</h3>
              <p className="text-gray-600">Please wait while we set up your payment schedule...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Schedule Created!</h3>
              <p className="text-gray-600">Your payment schedule has been successfully created.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentScheduleModal;