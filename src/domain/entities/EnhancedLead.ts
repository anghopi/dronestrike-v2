import { z } from 'zod';

// Enhanced Lead Entity - Translated from Laravel with proven business logic
export const LeadStatusSchema = z.enum([
  'new',
  'contacted', 
  'interested',
  'qualified',
  'unqualified',
  'converted',
  'closed_lost',
  'do_not_call',
  'safety_concern'
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const LeadSourceSchema = z.enum([
  'tax_lien_research',
  'property_assessment', 
  'direct_marketing',
  'referral',
  'website',
  'cold_outreach',
  'purl_landing',
  'mailer_response',
  'other'
]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

export const CommunicationPreferenceSchema = z.enum(['email', 'mail', 'phone', 'text']);
export type CommunicationPreference = z.infer<typeof CommunicationPreferenceSchema>;

export const LanguagePreferenceSchema = z.enum(['english', 'spanish']);
export type LanguagePreference = z.infer<typeof LanguagePreferenceSchema>;

export const LeadSchema = z.object({
  id: z.number().int().positive(),
  propertyId: z.number().int().positive(),
  
  // Contact Information
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  
  // Address (if different from property)
  mailingAddress1: z.string().max(255).optional(),
  mailingAddress2: z.string().max(255).optional(),
  mailingCity: z.string().max(100).optional(),
  mailingState: z.string().length(2).optional(),
  mailingZip: z.string().max(10).optional(),
  
  // Lead Details
  status: LeadStatusSchema.default('new'),
  source: LeadSourceSchema,
  score: z.number().int().min(0).max(100).default(50),
  
  // Interest & Motivation (from Laravel)
  interestLevel: z.number().int().min(1).max(10).default(5),
  interestedInSale: z.boolean().default(false),
  motivationNotes: z.string().max(1000).optional(),
  timeframe: z.string().max(255).optional(),
  
  // Communication Preferences (Laravel: enable_email, enable_mail flags)
  communicationPreference: CommunicationPreferenceSchema.default('mail'),
  enableEmail: z.boolean().default(true),
  enableMail: z.boolean().default(true),
  enablePhone: z.boolean().default(true),
  enableText: z.boolean().default(false),
  
  // Language & Accessibility (Laravel: language field)
  languagePreference: LanguagePreferenceSchema.default('english'),
  
  // Financial Information
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  hasFinancing: z.boolean().optional(),
  creditScore: z.number().int().min(300).max(850).optional(),
  
  // Property-specific interest
  currentMortgageBalance: z.number().min(0).optional(),
  monthlyPayment: z.number().min(0).optional(),
  yearsRemaining: z.number().int().min(0).optional(),
  
  // Safety & Compliance (Laravel: safety concerns)
  hasSafetyConcerns: z.boolean().default(false),
  safetyConcernDetails: z.string().max(500).optional(),
  doNotContact: z.boolean().default(false),
  doNotContactReason: z.string().max(255).optional(),
  
  // Assignment & Tracking
  assignedTo: z.number().int().positive().optional(),
  lastContactDate: z.date().optional(),
  nextFollowUpDate: z.date().optional(),
  contactAttempts: z.number().int().min(0).default(0),
  
  // Laravel: Read status tracking
  wasReadByAssignee: z.boolean().default(false),
  wasReadByAdmin: z.boolean().default(false),
  
  // Conversion tracking
  convertedToOpportunityId: z.number().int().positive().optional(),
  conversionDate: z.date().optional(),
  
  // PURL tracking (from Laravel)
  purlCode: z.string().optional(),
  purlVisits: z.number().int().min(0).default(0),
  purlLastVisit: z.date().optional(),
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Lead = z.infer<typeof LeadSchema>;

export class EnhancedLeadEntity {
  private constructor(private readonly data: Lead) {}

  static create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): EnhancedLeadEntity {
    const now = new Date();
    const lead: Lead = {
      ...data,
      id: 0, // Will be set by database
      createdAt: now,
      updatedAt: now,
    };
    
    return new EnhancedLeadEntity(LeadSchema.parse(lead));
  }

  static fromData(data: Lead): EnhancedLeadEntity {
    return new EnhancedLeadEntity(LeadSchema.parse(data));
  }

  get id(): number {
    return this.data.id;
  }

  get propertyId(): number {
    return this.data.propertyId;
  }

  get status(): LeadStatus {
    return this.data.status;
  }

  get score(): number {
    return this.data.score;
  }

  /**
   * Check if lead is in "interested" status group
   * From Laravel: LeadService.isInterestedStatus()
   */
  get isInterested(): boolean {
    return ['interested', 'qualified', 'converted'].includes(this.data.status);
  }

  /**
   * Check if lead is qualified for conversion
   * Based on Laravel qualification rules
   */
  get isQualified(): boolean {
    return this.data.status === 'qualified' && 
           this.data.score >= 70 &&
           !this.data.hasSafetyConcerns &&
           !this.data.doNotContact &&
           this.hasValidContactInfo();
  }

  get isConverted(): boolean {
    return this.data.status === 'converted' && !!this.data.convertedToOpportunityId;
  }

  get hasValidContactInfo(): boolean {
    return !!(this.data.email || this.data.phone || this.hasValidMailingAddress());
  }

  get hasValidMailingAddress(): boolean {
    return !!(this.data.mailingAddress1 && this.data.mailingCity && this.data.mailingState && this.data.mailingZip);
  }

  get contactInfo(): {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } {
    const name = this.data.firstName && this.data.lastName 
      ? `${this.data.firstName} ${this.data.lastName}`
      : this.data.firstName || this.data.lastName;
    
    let address: string | undefined;
    if (this.hasValidMailingAddress()) {
      const parts = [this.data.mailingAddress1];
      if (this.data.mailingAddress2) parts.push(this.data.mailingAddress2);
      parts.push(`${this.data.mailingCity}, ${this.data.mailingState} ${this.data.mailingZip}`);
      address = parts.join(', ');
    }
    
    return {
      name,
      email: this.data.email,
      phone: this.data.phone,
      address,
    };
  }

  /**
   * Calculate lead score using Laravel-inspired algorithm
   * Factors: contact info completeness, interest level, response time, property value alignment
   */
  calculateLeadScore(propertyValue?: number): number {
    let score = this.data.interestLevel * 10; // Base score from interest (10-100)
    
    // Contact information completeness (0-20 points)
    let contactScore = 0;
    if (this.data.email) contactScore += 5;
    if (this.data.phone) contactScore += 5;
    if (this.hasValidMailingAddress()) contactScore += 10;
    score += contactScore;
    
    // Communication responsiveness (-10 to +15 points)
    if (this.data.contactAttempts === 0) {
      score += 15; // Fresh lead
    } else if (this.data.contactAttempts <= 2) {
      score += 10; // Responsive
    } else if (this.data.contactAttempts <= 5) {
      score += 0; // Neutral
    } else {
      score -= 10; // Hard to reach
    }
    
    // Budget alignment with property value (0-15 points)
    if (propertyValue && this.data.budgetMax) {
      const budgetRatio = this.data.budgetMax / propertyValue;
      if (budgetRatio >= 1.0) score += 15;
      else if (budgetRatio >= 0.8) score += 10;
      else if (budgetRatio >= 0.6) score += 5;
      else score -= 5;
    }
    
    // Credit score factor (0-10 points)
    if (this.data.creditScore) {
      if (this.data.creditScore >= 740) score += 10;
      else if (this.data.creditScore >= 680) score += 5;
      else if (this.data.creditScore >= 620) score += 0;
      else score -= 10;
    }
    
    // Interest indicators (+10 points)
    if (this.data.interestedInSale) score += 10;
    
    // Negative factors
    if (this.data.hasSafetyConcerns) score -= 30;
    if (this.data.doNotContact) score -= 50;
    
    // PURL engagement (+5 points)
    if (this.data.purlVisits > 0) score += 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Update status with business rule validation
   * From Laravel status transition logic
   */
  updateStatus(status: LeadStatus, notes?: string): EnhancedLeadEntity {
    // Validate status transitions
    if (this.data.doNotContact && !['do_not_call', 'closed_lost'].includes(status)) {
      throw new Error('Cannot change status for do-not-contact leads');
    }
    
    if (this.data.hasSafetyConcerns && status === 'qualified') {
      throw new Error('Cannot qualify leads with safety concerns');
    }
    
    const updatedData: Lead = {
      ...this.data,
      status,
      lastContactDate: new Date(),
      motivationNotes: notes || this.data.motivationNotes,
      score: status === 'qualified' ? Math.max(this.data.score, 70) : this.data.score,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Record contact attempt with Laravel-style tracking
   */
  recordContact(method: 'email' | 'phone' | 'mail' | 'text', notes?: string): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      lastContactDate: new Date(),
      contactAttempts: this.data.contactAttempts + 1,
      motivationNotes: notes ? `${this.data.motivationNotes || ''}\n[${method.toUpperCase()}] ${notes}`.trim() : this.data.motivationNotes,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Mark as read by assignee/admin (Laravel: was_read_by_assignee)
   */
  markAsRead(by: 'assignee' | 'admin'): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      wasReadByAssignee: by === 'assignee' ? true : this.data.wasReadByAssignee,
      wasReadByAdmin: by === 'admin' ? true : this.data.wasReadByAdmin,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Schedule follow-up with validation
   */
  scheduleFollowUp(date: Date): EnhancedLeadEntity {
    if (date <= new Date()) {
      throw new Error('Follow-up date must be in the future');
    }
    
    if (this.data.doNotContact) {
      throw new Error('Cannot schedule follow-up for do-not-contact leads');
    }
    
    const updatedData: Lead = {
      ...this.data,
      nextFollowUpDate: date,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Qualify lead with validation (Laravel business rules)
   */
  qualify(qualificationNotes?: string): EnhancedLeadEntity {
    if (this.data.hasSafetyConcerns) {
      throw new Error('Cannot qualify leads with safety concerns');
    }
    
    if (this.data.doNotContact) {
      throw new Error('Cannot qualify do-not-contact leads');
    }
    
    if (!this.hasValidContactInfo()) {
      throw new Error('Lead must have valid contact information to qualify');
    }
    
    const updatedData: Lead = {
      ...this.data,
      status: 'qualified',
      score: Math.max(this.data.score, 70),
      motivationNotes: qualificationNotes || this.data.motivationNotes,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Disqualify with reason
   */
  disqualify(reason: string): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'unqualified',
      motivationNotes: `DISQUALIFIED: ${reason}`,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Mark safety concern (Laravel: safety_concern status)
   */
  markSafetyConcern(details: string): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'safety_concern',
      hasSafetyConcerns: true,
      safetyConcernDetails: details,
      score: Math.min(this.data.score, 20), // Drastically reduce score
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Mark as do not contact
   */
  markDoNotContact(reason: string): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'do_not_call',
      doNotContact: true,
      doNotContactReason: reason,
      enableEmail: false,
      enableMail: false,
      enablePhone: false,
      enableText: false,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Convert to opportunity (Laravel: conversion tracking)
   */
  convertToOpportunity(opportunityId: number): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'converted',
      convertedToOpportunityId: opportunityId,
      conversionDate: new Date(),
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Track PURL interaction
   */
  recordPurlVisit(): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      purlVisits: this.data.purlVisits + 1,
      purlLastVisit: new Date(),
      score: Math.min(this.data.score + 5, 100), // Boost score for engagement
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  /**
   * Update contact information
   */
  updateContactInfo(contact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    mailingAddress1?: string;
    mailingAddress2?: string;
    mailingCity?: string;
    mailingState?: string;
    mailingZip?: string;
  }): EnhancedLeadEntity {
    const updatedData: Lead = {
      ...this.data,
      firstName: contact.firstName ?? this.data.firstName,
      lastName: contact.lastName ?? this.data.lastName,
      email: contact.email ?? this.data.email,
      phone: contact.phone ?? this.data.phone,
      mailingAddress1: contact.mailingAddress1 ?? this.data.mailingAddress1,
      mailingAddress2: contact.mailingAddress2 ?? this.data.mailingAddress2,
      mailingCity: contact.mailingCity ?? this.data.mailingCity,
      mailingState: contact.mailingState ?? this.data.mailingState,
      mailingZip: contact.mailingZip ?? this.data.mailingZip,
      updatedAt: new Date(),
    };
    
    return new EnhancedLeadEntity(updatedData);
  }

  toJSON(): Lead {
    return { ...this.data };
  }
}