import { z } from 'zod';

// Property Entity - Core business object for real estate assets
export const PropertySchema = z.object({
  id: z.number().int().positive(),
  propertyTypeId: z.number().int().positive(),
  dispositionId: z.number().int().positive().optional(),
  
  // Address Information
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
  
  // Geographic Coordinates
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  
  // Property Values
  improvementValue: z.number().min(0),
  landValue: z.number().min(0),
  totalValue: z.number().min(0),
  
  // Tax Information
  taxUrl: z.string().url().optional(),
  cadUrl: z.string().url().optional(),
  taxAmount: z.number().min(0).optional(),
  
  // County Information
  countyId: z.number().int().positive(),
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Property = z.infer<typeof PropertySchema>;

export class PropertyEntity {
  private constructor(private readonly data: Property) {}

  static create(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): PropertyEntity {
    const now = new Date();
    const property: Property = {
      ...data,
      id: 0, // Will be set by database
      totalValue: data.improvementValue + data.landValue,
      createdAt: now,
      updatedAt: now,
    };
    
    return new PropertyEntity(PropertySchema.parse(property));
  }

  static fromData(data: Property): PropertyEntity {
    return new PropertyEntity(PropertySchema.parse(data));
  }

  get id(): number {
    return this.data.id;
  }

  get address(): string {
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

  get value(): {
    improvement: number;
    land: number;
    total: number;
  } {
    return {
      improvement: this.data.improvementValue,
      land: this.data.landValue,
      total: this.data.totalValue,
    };
  }

  updateValue(improvementValue: number, landValue: number): PropertyEntity {
    const updatedData: Property = {
      ...this.data,
      improvementValue,
      landValue,
      totalValue: improvementValue + landValue,
      updatedAt: new Date(),
    };
    
    return new PropertyEntity(updatedData);
  }

  deactivate(): PropertyEntity {
    const updatedData: Property = {
      ...this.data,
      isActive: false,
      updatedAt: new Date(),
    };
    
    return new PropertyEntity(updatedData);
  }

  toJSON(): Property {
    return { ...this.data };
  }
}