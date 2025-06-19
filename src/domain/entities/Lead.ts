import { z } from 'zod';

// Lead Entity - Potential investment opportunities
export const LeadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'closed_lost',
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const LeadSourceSchema = z.enum([
  'tax_lien_research',
  'property_assessment', 
  'direct_marketing',
  'referral',
  'website',
  'cold_outreach',
  'other'
]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

export const LeadSchema = z.object({
  id: z.number().int().positive(),
  propertyId: z.number().int().positive(),
  
  // Contact Information
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  
  // Lead Details
  status: LeadStatusSchema.default('new'),
  source: LeadSourceSchema,
  score: z.number().int().min(0).max(100).default(50),
  
  // Interest & Motivation
  interestLevel: z.number().int().min(1).max(10).default(5),
  motivationNotes: z.string().max(1000).optional(),
  timeframe: z.string().max(255).optional(),
  
  // Financial Information
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  hasFinancing: z.boolean().optional(),
  
  // Assignment
  assignedTo: z.number().int().positive().optional(),
  
  // Tracking
  lastContactDate: z.date().optional(),
  nextFollowUpDate: z.date().optional(),
  contactAttempts: z.number().int().min(0).default(0),
  
  // Conversion
  convertedToOpportunityId: z.number().int().positive().optional(),
  conversionDate: z.date().optional(),
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Lead = z.infer<typeof LeadSchema>;

export class LeadEntity {
  private constructor(private readonly data: Lead) {}

  static create(data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): LeadEntity {
    const now = new Date();
    const lead: Lead = {
      ...data,
      id: 0, // Will be set by database
      createdAt: now,
      updatedAt: now,
    };
    
    return new LeadEntity(LeadSchema.parse(lead));
  }

  static fromData(data: Lead): LeadEntity {
    return new LeadEntity(LeadSchema.parse(data));
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

  get isQualified(): boolean {
    return this.data.status === 'qualified' && this.data.score >= 70;
  }

  get isConverted(): boolean {
    return this.data.status === 'converted' && !!this.data.convertedToOpportunityId;
  }

  get contactInfo(): {
    name?: string;
    email?: string;
    phone?: string;
  } {
    const name = this.data.firstName && this.data.lastName 
      ? `${this.data.firstName} ${this.data.lastName}`
      : this.data.firstName || this.data.lastName;
    
    return {
      name,
      email: this.data.email,
      phone: this.data.phone,
    };
  }

  updateStatus(status: LeadStatus, notes?: string): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status,
      lastContactDate: new Date(),
      motivationNotes: notes || this.data.motivationNotes,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  updateScore(score: number): LeadEntity {
    const clampedScore = Math.max(0, Math.min(100, score));
    const updatedData: Lead = {
      ...this.data,
      score: clampedScore,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  recordContact(notes?: string): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      lastContactDate: new Date(),
      contactAttempts: this.data.contactAttempts + 1,
      motivationNotes: notes || this.data.motivationNotes,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  scheduleFollowUp(date: Date): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      nextFollowUpDate: date,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  qualify(): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'qualified',
      score: Math.max(this.data.score, 70),
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  disqualify(reason?: string): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'unqualified',
      motivationNotes: reason || this.data.motivationNotes,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  convertToOpportunity(opportunityId: number): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      status: 'converted',
      convertedToOpportunityId: opportunityId,
      conversionDate: new Date(),
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  assign(userId: number): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      assignedTo: userId,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  updateContactInfo(contact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): LeadEntity {
    const updatedData: Lead = {
      ...this.data,
      firstName: contact.firstName ?? this.data.firstName,
      lastName: contact.lastName ?? this.data.lastName,
      email: contact.email ?? this.data.email,
      phone: contact.phone ?? this.data.phone,
      updatedAt: new Date(),
    };
    
    return new LeadEntity(updatedData);
  }

  toJSON(): Lead {
    return { ...this.data };
  }
}