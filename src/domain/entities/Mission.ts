import { z } from 'zod';

// Mission Entity - Field operations and property assessments
export const MissionStatusSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'failed'
]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

export const MissionPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type MissionPriority = z.infer<typeof MissionPrioritySchema>;

export const MissionTypeSchema = z.enum([
  'property_assessment',
  'photo_documentation',
  'condition_inspection',
  'neighbor_contact',
  'market_research',
  'compliance_check'
]);
export type MissionType = z.infer<typeof MissionTypeSchema>;

export const MissionSchema = z.object({
  id: z.number().int().positive(),
  propertyId: z.number().int().positive(),
  soldierIds: z.array(z.number().int().positive()).default([]),
  
  // Mission Details
  type: MissionTypeSchema,
  status: MissionStatusSchema.default('pending'),
  priority: MissionPrioritySchema.default('normal'),
  
  // Description & Instructions
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(2000).optional(),
  
  // Scheduling
  scheduledDate: z.date().optional(),
  estimatedDuration: z.number().int().min(15).max(480).default(60), // minutes
  
  // Location Data
  startLatitude: z.number().min(-90).max(90).optional(),
  startLongitude: z.number().min(-180).max(180).optional(),
  endLatitude: z.number().min(-90).max(90).optional(),
  endLongitude: z.number().min(-180).max(180).optional(),
  
  // Completion Data
  actualDuration: z.number().int().min(0).optional(),
  completedAt: z.date().optional(),
  completionNotes: z.string().max(2000).optional(),
  
  // Results
  photosCount: z.number().int().min(0).default(0),
  documentsCount: z.number().int().min(0).default(0),
  
  // Quality Assessment
  qualityScore: z.number().int().min(0).max(100).optional(),
  reviewedBy: z.number().int().positive().optional(),
  reviewedAt: z.date().optional(),
  reviewNotes: z.string().max(1000).optional(),
  
  // Assignment
  assignedBy: z.number().int().positive(),
  assignedAt: z.date(),
  
  // Status
  isActive: z.boolean().default(true),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Mission = z.infer<typeof MissionSchema>;

export class MissionEntity {
  private constructor(private readonly data: Mission) {}

  static create(data: {
    propertyId: number;
    type: MissionType;
    title: string;
    description?: string;
    instructions?: string;
    priority?: MissionPriority;
    scheduledDate?: Date;
    estimatedDuration?: number;
    assignedBy: number;
  }): MissionEntity {
    const now = new Date();
    const mission: Mission = {
      id: 0, // Will be set by database
      propertyId: data.propertyId,
      soldierIds: [],
      type: data.type,
      status: 'pending',
      priority: data.priority || 'normal',
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      scheduledDate: data.scheduledDate,
      estimatedDuration: data.estimatedDuration || 60,
      photosCount: 0,
      documentsCount: 0,
      assignedBy: data.assignedBy,
      assignedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    return new MissionEntity(MissionSchema.parse(mission));
  }

  static fromData(data: Mission): MissionEntity {
    return new MissionEntity(MissionSchema.parse(data));
  }

  get id(): number {
    return this.data.id;
  }

  get propertyId(): number {
    return this.data.propertyId;
  }

  get status(): MissionStatus {
    return this.data.status;
  }

  get type(): MissionType {
    return this.data.type;
  }

  get priority(): MissionPriority {
    return this.data.priority;
  }

  get soldierIds(): number[] {
    return [...this.data.soldierIds];
  }

  get isAssigned(): boolean {
    return this.data.soldierIds.length > 0;
  }

  get isCompleted(): boolean {
    return this.data.status === 'completed';
  }

  get isInProgress(): boolean {
    return this.data.status === 'in_progress';
  }

  get estimatedDuration(): number {
    return this.data.estimatedDuration;
  }

  get actualDuration(): number | undefined {
    return this.data.actualDuration;
  }

  assignToSoldier(soldierId: number): MissionEntity {
    if (this.data.soldierIds.includes(soldierId)) {
      return this; // Already assigned
    }

    const updatedData: Mission = {
      ...this.data,
      soldierIds: [...this.data.soldierIds, soldierId],
      status: this.data.status === 'pending' ? 'assigned' : this.data.status,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  unassignSoldier(soldierId: number): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      soldierIds: this.data.soldierIds.filter(id => id !== soldierId),
      status: this.data.soldierIds.length === 1 ? 'pending' : this.data.status,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  start(soldierId: number, latitude?: number, longitude?: number): MissionEntity {
    if (!this.data.soldierIds.includes(soldierId)) {
      throw new Error('Soldier not assigned to this mission');
    }

    const updatedData: Mission = {
      ...this.data,
      status: 'in_progress',
      startLatitude: latitude,
      startLongitude: longitude,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  complete(
    soldierId: number,
    data: {
      latitude?: number;
      longitude?: number;
      notes?: string;
      photosCount?: number;
      documentsCount?: number;
    }
  ): MissionEntity {
    if (!this.data.soldierIds.includes(soldierId)) {
      throw new Error('Soldier not assigned to this mission');
    }

    const completedAt = new Date();
    const actualDuration = this.data.status === 'in_progress' && this.data.updatedAt
      ? Math.round((completedAt.getTime() - this.data.updatedAt.getTime()) / (1000 * 60))
      : undefined;

    const updatedData: Mission = {
      ...this.data,
      status: 'completed',
      endLatitude: data.latitude,
      endLongitude: data.longitude,
      completionNotes: data.notes,
      photosCount: data.photosCount || this.data.photosCount,
      documentsCount: data.documentsCount || this.data.documentsCount,
      actualDuration,
      completedAt,
      updatedAt: completedAt,
    };
    
    return new MissionEntity(updatedData);
  }

  cancel(reason?: string): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      status: 'cancelled',
      completionNotes: reason,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  fail(reason?: string): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      status: 'failed',
      completionNotes: reason,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  review(reviewData: {
    reviewedBy: number;
    qualityScore: number;
    notes?: string;
  }): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      qualityScore: Math.max(0, Math.min(100, reviewData.qualityScore)),
      reviewedBy: reviewData.reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: reviewData.notes,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  updatePriority(priority: MissionPriority): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      priority,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  reschedule(newDate: Date): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      scheduledDate: newDate,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  updateDocumentCounts(photosCount?: number, documentsCount?: number): MissionEntity {
    const updatedData: Mission = {
      ...this.data,
      photosCount: photosCount ?? this.data.photosCount,
      documentsCount: documentsCount ?? this.data.documentsCount,
      updatedAt: new Date(),
    };
    
    return new MissionEntity(updatedData);
  }

  toJSON(): Mission {
    return { ...this.data };
  }
}