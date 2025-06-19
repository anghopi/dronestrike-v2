import { z } from 'zod';

// Enhanced Property Entity - Translated from Laravel with proven business logic
export const PropertySchema = z.object({
  id: z.number().int().positive(),
  propertyTypeId: z.number().int().positive(),
  dispositionId: z.number().int().positive().optional(),
  countyId: z.number().int().positive(),
  
  // Address Information
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
  
  // Original address (for correction tracking)
  originalAddress1: z.string().max(255),
  originalCity: z.string().max(100),
  originalState: z.string().length(2),
  originalZip: z.string().max(10),
  address1Corrected: z.boolean().default(false),
  
  // Geographic Coordinates
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeId: z.string().optional(), // Google Places ID
  
  // Property Values (Laravel: improvement_value + land_value = total_value)
  improvementValue: z.number().min(0),
  landValue: z.number().min(0),
  totalValue: z.number().min(0),
  marketValue: z.number().min(0).optional(),
  
  // Tax Information (Panacea PLE System Integration)
  taxUrl: z.string().url().optional(),
  cadUrl: z.string().url().optional(),
  accountNumber: z.string().min(1),
  
  // Tax lien data from PLE system
  plePropertyId: z.number().int().optional(),
  pleAmountDue: z.number().min(0).optional(),
  pleAmountTax: z.number().min(0).optional(),
  pleLawsuitNo: z.string().optional(),
  pleDate: z.string().optional(),
  pleRate: z.number().min(0).optional(),
  pleApr: z.number().min(0).optional(),
  plePmt: z.number().min(0).optional(),
  pleBocRepay: z.string().optional(),
  pleCounty: z.string().optional(),
  plePurl: z.string().url().optional(),
  pleCode: z.string().optional(),
  pleObligation: z.string().optional(),
  pleIfPaidBy: z.string().optional(),
  
  // Existing loans and encumbrances
  existingTaxLoan: z.boolean().default(false),
  existingTaxLoanAmount: z.number().min(0).optional(),
  existingTaxLoanLender: z.string().optional(),
  
  // Foreclosure status
  inForeclosure: z.boolean().default(false),
  lastKnownLawsuitDate: z.string().optional(),
  lastKnownLawsuitNo: z.string().optional(),
  
  // Payment tracking
  lastPayment: z.number().min(0).optional(),
  lastPaymentDate: z.string().optional(),
  lastPayer: z.string().optional(),
  
  // Property details
  term: z.number().int().min(1).optional(),
  description: z.text().optional(),
  street: z.string().optional(),
  exemptions: z.string().optional(),
  notes: z.text().optional(),
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Property = z.infer<typeof PropertySchema>;

export class EnhancedPropertyEntity {
  private constructor(private readonly data: Property) {}

  static create(data: Omit<Property, 'id' | 'totalValue' | 'createdAt' | 'updatedAt'>): EnhancedPropertyEntity {
    const now = new Date();
    const property: Property = {
      ...data,
      id: 0, // Will be set by database
      totalValue: data.improvementValue + data.landValue, // Laravel business rule
      createdAt: now,
      updatedAt: now,
    };
    
    return new EnhancedPropertyEntity(PropertySchema.parse(property));
  }

  static fromData(data: Property): EnhancedPropertyEntity {
    return new EnhancedPropertyEntity(PropertySchema.parse(data));
  }

  get id(): number {
    return this.data.id;
  }

  get fullAddress(): string {
    const parts = [this.data.address1];
    if (this.data.address2) parts.push(this.data.address2);
    parts.push(`${this.data.city}, ${this.data.state} ${this.data.zip}`);
    return parts.join(', ');
  }

  get coordinates(): { lat: number; lng: number } {
    return {
      lat: this.data.latitude,
      lng: this.data.longitude,
    };
  }

  /**
   * Calculate property score based on Laravel algorithm
   * Factors: market value, improvement value, land value, tax amount, existing loans, foreclosure
   */
  calculatePropertyScore(): number {
    let score = 50; // Base score
    
    // Market value factor (0-30 points)
    const marketValue = this.data.marketValue || this.data.totalValue;
    if (marketValue > 100000) score += 30;
    else if (marketValue > 50000) score += 20;
    else if (marketValue > 25000) score += 10;
    
    // Tax burden factor (-20 to +10 points)
    const taxBurden = this.data.pleAmountDue || 0;
    const taxToValueRatio = taxBurden / marketValue;
    if (taxToValueRatio < 0.05) score += 10;
    else if (taxToValueRatio > 0.20) score -= 20;
    else if (taxToValueRatio > 0.10) score -= 10;
    
    // Existing encumbrances (-30 points)
    if (this.data.existingTaxLoan) score -= 15;
    if (this.data.inForeclosure) score -= 30;
    
    // Property condition (improvement to land ratio)
    const improvementRatio = this.data.improvementValue / this.data.totalValue;
    if (improvementRatio > 0.7) score += 15; // Well-improved property
    else if (improvementRatio < 0.3) score -= 10; // Mostly land value
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate loan-to-value ratio for a given loan amount
   * From Laravel: round($loanAmount / $property->market_value, 4)
   */
  calculateLTV(loanAmount: number): number {
    const marketValue = this.data.marketValue || this.data.totalValue;
    if (marketValue === 0) return 0;
    return Math.round((loanAmount / marketValue) * 10000) / 10000; // 4 decimal precision
  }

  /**
   * Check if property is eligible for investment
   * Based on Laravel business rules
   */
  isEligibleForInvestment(): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // Must have valid market value
    const marketValue = this.data.marketValue || this.data.totalValue;
    if (marketValue < 10000) {
      reasons.push('Property value too low (minimum $10,000)');
    }
    
    // Cannot be in foreclosure
    if (this.data.inForeclosure) {
      reasons.push('Property is currently in foreclosure');
    }
    
    // Cannot have excessive tax burden
    const taxBurden = this.data.pleAmountDue || 0;
    if (taxBurden > marketValue * 0.25) {
      reasons.push('Tax burden exceeds 25% of property value');
    }
    
    // Must have valid coordinates
    if (this.data.latitude === 0 || this.data.longitude === 0) {
      reasons.push('Invalid or missing property coordinates');
    }
    
    // Must be active
    if (!this.data.isActive) {
      reasons.push('Property is marked as inactive');
    }
    
    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Calculate distance to another property using Haversine formula
   * From Laravel mission assignment algorithm
   */
  distanceTo(lat: number, lng: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = this.toRadians(lat - this.data.latitude);
    const dLng = this.toRadians(lng - this.data.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(this.data.latitude)) *
              Math.cos(this.toRadians(lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in miles
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Update property values and recalculate total
   * Maintains Laravel business rule: total = improvement + land
   */
  updateValues(improvementValue: number, landValue: number, marketValue?: number): EnhancedPropertyEntity {
    const updatedData: Property = {
      ...this.data,
      improvementValue,
      landValue,
      totalValue: improvementValue + landValue, // Laravel rule
      marketValue: marketValue ?? this.data.marketValue,
      updatedAt: new Date(),
    };
    
    return new EnhancedPropertyEntity(updatedData);
  }

  /**
   * Update tax information from PLE system
   */
  updateTaxInfo(taxData: {
    pleAmountDue?: number;
    pleAmountTax?: number;
    pleLawsuitNo?: string;
    pleDate?: string;
    pleRate?: number;
  }): EnhancedPropertyEntity {
    const updatedData: Property = {
      ...this.data,
      ...taxData,
      updatedAt: new Date(),
    };
    
    return new EnhancedPropertyEntity(updatedData);
  }

  /**
   * Mark address as corrected
   */
  markAddressCorrected(newAddress: {
    address1: string;
    city: string;
    state: string;
    zip: string;
  }): EnhancedPropertyEntity {
    const updatedData: Property = {
      ...this.data,
      address1: newAddress.address1,
      city: newAddress.city,
      state: newAddress.state,
      zip: newAddress.zip,
      address1Corrected: true,
      updatedAt: new Date(),
    };
    
    return new EnhancedPropertyEntity(updatedData);
  }

  /**
   * Update foreclosure status
   */
  updateForeclosureStatus(inForeclosure: boolean, lawsuitNo?: string, lawsuitDate?: string): EnhancedPropertyEntity {
    const updatedData: Property = {
      ...this.data,
      inForeclosure,
      lastKnownLawsuitNo: lawsuitNo ?? this.data.lastKnownLawsuitNo,
      lastKnownLawsuitDate: lawsuitDate ?? this.data.lastKnownLawsuitDate,
      updatedAt: new Date(),
    };
    
    return new EnhancedPropertyEntity(updatedData);
  }

  toJSON(): Property {
    return { ...this.data };
  }
}