/**
 * Financial Calculation Service
 * Translated from Laravel ScheduleService.php with exact mathematical precision
 */

export interface PaymentScheduleEntry {
  periodNumber: number;
  dueDate: Date;
  beginningBalance: number;
  paymentDue: number;
  principalDue: number;
  interestDue: number;
  endingBalance: number;
}

export interface AmortizationSchedule {
  loanAmount: number;
  rate: number;
  payment: number;
  term: number;
  schedule: PaymentScheduleEntry[];
  totalInterest: number;
  totalPayments: number;
}

export interface LoanCalculationInput {
  loanAmount: number;
  annualRate: number; // Annual interest rate (e.g., 0.085 for 8.5%)
  termMonths: number;
  paymentAmount?: number; // If not provided, will calculate standard payment
  firstPaymentDate?: Date;
  oddDaysAmount?: number; // For odd days interest calculation
}

export class FinancialCalculationService {
  
  /**
   * Calculate standard monthly payment for a loan
   * Formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
   */
  static calculateMonthlyPayment(loanAmount: number, annualRate: number, termMonths: number): number {
    if (annualRate === 0) {
      return loanAmount / termMonths;
    }
    
    const monthlyRate = annualRate / 12;
    const factor = Math.pow(1 + monthlyRate, termMonths);
    const payment = loanAmount * (monthlyRate * factor) / (factor - 1);
    
    return Math.round(payment * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Generate complete amortization schedule
   * Translated from Laravel ScheduleService::calculateSchedule()
   */
  static generateAmortizationSchedule(input: LoanCalculationInput): AmortizationSchedule {
    const { loanAmount, annualRate, termMonths, firstPaymentDate } = input;
    const monthlyRate = annualRate / 12;
    
    // Calculate payment if not provided
    const payment = input.paymentAmount || this.calculateMonthlyPayment(loanAmount, annualRate, termMonths);
    
    const schedule: PaymentScheduleEntry[] = [];
    let endingBalance = loanAmount;
    let totalInterest = 0;
    let currentDate = firstPaymentDate || new Date();
    
    for (let periodNumber = 1; periodNumber <= termMonths; periodNumber++) {
      const beginningBalance = endingBalance;
      const interestDue = Math.round(beginningBalance * monthlyRate * 100) / 100;
      let principalDue = Math.round((payment - interestDue) * 100) / 100;
      
      // Handle final payment or if remaining balance is less than principal
      const isLastPeriod = periodNumber === termMonths;
      if (beginningBalance < principalDue || isLastPeriod) {
        principalDue = beginningBalance;
      }
      
      const paymentDue = Math.round((principalDue + interestDue) * 100) / 100;
      endingBalance = Math.round((beginningBalance - principalDue) * 100) / 100;
      
      schedule.push({
        periodNumber,
        dueDate: new Date(currentDate),
        beginningBalance,
        paymentDue,
        principalDue,
        interestDue,
        endingBalance,
      });
      
      totalInterest += interestDue;
      
      // Move to next month
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
      
      // Break if loan is paid off
      if (endingBalance <= 0) break;
    }
    
    return {
      loanAmount,
      rate: annualRate,
      payment,
      term: termMonths,
      schedule,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayments: Math.round((schedule.length * payment) * 100) / 100,
    };
  }

  /**
   * Calculate APR using binary search algorithm
   * Translated from Laravel ScheduleService::calculateApr()
   */
  static calculateAPR(
    termMonths: number,
    loanAmount: number,
    paymentAmount: number,
    deferredDays: number = 0,
    oddDaysAmount: number = 0
  ): number {
    let low = 0.0000;
    let high = 100.0000;
    let medium = 50.0000;
    
    // Binary search for APR (maximum 100 iterations)
    for (let i = 0; i < 100; i++) {
      const discountedPaymentsSumAmount = this.calculateDiscountedPayments(
        termMonths,
        paymentAmount,
        medium / 100,
        deferredDays
      );
      
      const difference = loanAmount - discountedPaymentsSumAmount - oddDaysAmount;
      
      if (Math.abs(difference) <= 0.10) {
        return Math.round(medium / 100 * 10000) / 10000; // Return as decimal with 4 decimal places
      }
      
      if (difference > 0.10) {
        high = medium;
        medium = (low + high) / 2;
      } else {
        low = medium;
        medium = (low + high) / 2;
      }
    }
    
    return Math.round(medium / 100 * 10000) / 10000;
  }

  /**
   * Calculate discounted payments for APR calculation
   * Helper method for binary search APR algorithm
   */
  private static calculateDiscountedPayments(
    termMonths: number,
    paymentAmount: number,
    annualRate: number,
    deferredDays: number
  ): number {
    const monthlyRate = annualRate / 12;
    let discountedSum = 0;
    
    for (let period = 1; period <= termMonths; period++) {
      const daysToPayment = (period - 1) * 30 + deferredDays; // Approximate 30 days per month
      const discountFactor = Math.pow(1 + monthlyRate, -daysToPayment / 30);
      discountedSum += paymentAmount * discountFactor;
    }
    
    return discountedSum;
  }

  /**
   * Calculate loan-to-value ratio
   * From Laravel Property model
   */
  static calculateLTV(loanAmount: number, propertyValue: number): number {
    if (propertyValue === 0) return 0;
    return Math.round((loanAmount / propertyValue) * 10000) / 10000; // 4 decimal precision
  }

  /**
   * Calculate maximum loan amount based on LTV limit
   */
  static calculateMaxLoanAmount(propertyValue: number, maxLTV: number): number {
    return Math.round(propertyValue * maxLTV * 100) / 100;
  }

  /**
   * Calculate required down payment
   * From Laravel loan origination logic
   */
  static calculateDownPayment(
    purchasePrice: number,
    loanAmount: number,
    fees: number = 0
  ): number {
    const totalLoanWithFees = loanAmount + fees;
    const downPayment = purchasePrice - totalLoanWithFees;
    return Math.max(0, Math.round(downPayment * 100) / 100);
  }

  /**
   * Calculate payoff amount for a given date
   * From Laravel Loan::getPayoffAmount()
   */
  static calculatePayoffAmount(
    principalBalance: number,
    interestBalance: number,
    currentDue: number = 0,
    pastDue: number = 0,
    fees: number = 0
  ): number {
    const payoffAmount = principalBalance + interestBalance + currentDue + pastDue + fees;
    return Math.round(payoffAmount * 100) / 100;
  }

  /**
   * Calculate daily interest for odd days
   */
  static calculateDailyInterest(balance: number, annualRate: number, days: number): number {
    const dailyRate = annualRate / 365;
    return Math.round(balance * dailyRate * days * 100) / 100;
  }

  /**
   * Calculate late fees based on payment date
   */
  static calculateLateFee(
    paymentAmount: number,
    daysLate: number,
    lateFeeRate: number = 0.05, // 5% default
    maxLateFee: number = 25.00
  ): number {
    if (daysLate <= 15) return 0; // Grace period
    
    const calculatedFee = paymentAmount * lateFeeRate;
    return Math.min(calculatedFee, maxLateFee);
  }

  /**
   * Validate loan parameters
   */
  static validateLoanParameters(input: LoanCalculationInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (input.loanAmount <= 0) {
      errors.push('Loan amount must be greater than zero');
    }
    
    if (input.annualRate < 0 || input.annualRate > 1) {
      errors.push('Annual rate must be between 0 and 1 (e.g., 0.085 for 8.5%)');
    }
    
    if (input.termMonths <= 0 || input.termMonths > 480) { // Max 40 years
      errors.push('Term must be between 1 and 480 months');
    }
    
    if (input.paymentAmount && input.paymentAmount <= 0) {
      errors.push('Payment amount must be greater than zero if specified');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format percentage
   */
  static formatPercentage(rate: number, decimals: number = 3): string {
    return `${(rate * 100).toFixed(decimals)}%`;
  }
}