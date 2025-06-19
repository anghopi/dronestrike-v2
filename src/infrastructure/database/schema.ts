import { pgTable, serial, varchar, text, timestamp, boolean, integer, decimal, pgEnum, real, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// === ENUMS ===
export const userRoleEnum = pgEnum('user_role', ['admin', 'officer', 'soldier', 'client']);
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'closed_lost']);
export const leadSourceEnum = pgEnum('lead_source', ['tax_lien_research', 'property_assessment', 'direct_marketing', 'referral', 'website', 'cold_outreach', 'other']);
export const missionStatusEnum = pgEnum('mission_status', ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'failed']);
export const missionPriorityEnum = pgEnum('mission_priority', ['low', 'normal', 'high', 'urgent']);
export const missionTypeEnum = pgEnum('mission_type', ['property_assessment', 'photo_documentation', 'condition_inspection', 'neighbor_contact', 'market_research', 'compliance_check']);
export const opportunityStatusEnum = pgEnum('opportunity_status', ['new', 'analyzing', 'approved', 'rejected', 'converted']);
export const loanStatusEnum = pgEnum('loan_status', ['pending', 'approved', 'funded', 'active', 'paid_off', 'defaulted']);

// === CORE TABLES ===

// Users table - Authentication and role management
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  role: userRoleEnum('role').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  lastLogin: timestamp('last_login'),
  lastActivity: timestamp('last_activity'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Property Types table
export const propertyTypes = pgTable('property_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Counties table
export const counties = pgTable('counties', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  fipsCode: varchar('fips_code', { length: 5 }),
  taxUrl: varchar('tax_url', { length: 500 }),
  cadUrl: varchar('cad_url', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Properties table - Real estate assets
export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  propertyTypeId: integer('property_type_id').references(() => propertyTypes.id).notNull(),
  countyId: integer('county_id').references(() => counties.id).notNull(),
  dispositionId: integer('disposition_id'),
  
  // Address
  address1: varchar('address_1', { length: 255 }).notNull(),
  address2: varchar('address_2', { length: 255 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  zip: varchar('zip', { length: 10 }).notNull(),
  
  // Coordinates
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  
  // Values
  improvementValue: decimal('improvement_value', { precision: 12, scale: 2 }).default('0').notNull(),
  landValue: decimal('land_value', { precision: 12, scale: 2 }).default('0').notNull(),
  totalValue: decimal('total_value', { precision: 12, scale: 2 }).default('0').notNull(),
  
  // Tax Information
  taxUrl: varchar('tax_url', { length: 500 }),
  cadUrl: varchar('cad_url', { length: 500 }),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Leads table - Potential investment opportunities
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id).notNull(),
  
  // Contact Information
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  
  // Lead Details
  status: leadStatusEnum('status').default('new').notNull(),
  source: leadSourceEnum('source').notNull(),
  score: integer('score').default(50).notNull(),
  
  // Interest & Motivation
  interestLevel: integer('interest_level').default(5).notNull(),
  motivationNotes: text('motivation_notes'),
  timeframe: varchar('timeframe', { length: 255 }),
  
  // Financial Information
  budgetMin: decimal('budget_min', { precision: 12, scale: 2 }),
  budgetMax: decimal('budget_max', { precision: 12, scale: 2 }),
  hasFinancing: boolean('has_financing'),
  
  // Assignment
  assignedTo: integer('assigned_to').references(() => users.id),
  
  // Tracking
  lastContactDate: timestamp('last_contact_date'),
  nextFollowUpDate: timestamp('next_follow_up_date'),
  contactAttempts: integer('contact_attempts').default(0).notNull(),
  
  // Conversion
  convertedToOpportunityId: integer('converted_to_opportunity_id'),
  conversionDate: timestamp('conversion_date'),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Missions table - Field operations
export const missions = pgTable('missions', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id).notNull(),
  
  // Mission Details
  type: missionTypeEnum('type').notNull(),
  status: missionStatusEnum('status').default('pending').notNull(),
  priority: missionPriorityEnum('priority').default('normal').notNull(),
  
  // Description
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions'),
  
  // Scheduling
  scheduledDate: timestamp('scheduled_date'),
  estimatedDuration: integer('estimated_duration').default(60).notNull(), // minutes
  
  // Location Data
  startLatitude: real('start_latitude'),
  startLongitude: real('start_longitude'),
  endLatitude: real('end_latitude'),
  endLongitude: real('end_longitude'),
  
  // Completion Data
  actualDuration: integer('actual_duration'),
  completedAt: timestamp('completed_at'),
  completionNotes: text('completion_notes'),
  
  // Results
  photosCount: integer('photos_count').default(0).notNull(),
  documentsCount: integer('documents_count').default(0).notNull(),
  
  // Quality Assessment
  qualityScore: integer('quality_score'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  
  // Assignment
  assignedBy: integer('assigned_by').references(() => users.id).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Mission Assignments - Many-to-many relationship between missions and soldiers
export const missionAssignments = pgTable('mission_assignments', {
  id: serial('id').primaryKey(),
  missionId: integer('mission_id').references(() => missions.id).notNull(),
  soldierId: integer('soldier_id').references(() => users.id).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// Opportunities table - Qualified investment prospects
export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id).notNull(),
  leadId: integer('lead_id').references(() => leads.id),
  
  // Opportunity Details
  status: opportunityStatusEnum('status').default('new').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  // Financial Analysis
  investmentAmount: decimal('investment_amount', { precision: 12, scale: 2 }),
  projectedRoi: decimal('projected_roi', { precision: 5, scale: 2 }),
  riskScore: integer('risk_score').default(50).notNull(),
  
  // Timeline
  targetCloseDate: date('target_close_date'),
  actualCloseDate: date('actual_close_date'),
  
  // Assignment
  assignedTo: integer('assigned_to').references(() => users.id),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Loans table - Financed opportunities
export const loans = pgTable('loans', {
  id: serial('id').primaryKey(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id).notNull(),
  borrowerId: integer('borrower_id').references(() => users.id).notNull(),
  
  // Loan Details
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal('interest_rate', { precision: 5, scale: 4 }).notNull(),
  termMonths: integer('term_months').notNull(),
  
  // Status
  status: loanStatusEnum('status').default('pending').notNull(),
  
  // Dates
  originatedDate: timestamp('originated_date'),
  firstPaymentDate: date('first_payment_date'),
  maturityDate: date('maturity_date'),
  
  // Balances
  principalBalance: decimal('principal_balance', { precision: 12, scale: 2 }),
  interestBalance: decimal('interest_balance', { precision: 12, scale: 2 }),
  totalBalance: decimal('total_balance', { precision: 12, scale: 2 }),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Documents table - File management
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  
  // Document Details
  name: varchar('name', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  
  // Storage
  storagePath: varchar('storage_path', { length: 500 }).notNull(),
  url: varchar('url', { length: 500 }),
  
  // Associations
  propertyId: integer('property_id').references(() => properties.id),
  missionId: integer('mission_id').references(() => missions.id),
  leadId: integer('lead_id').references(() => leads.id),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),
  loanId: integer('loan_id').references(() => loans.id),
  
  // Metadata
  uploadedBy: integer('uploaded_by').references(() => users.id).notNull(),
  tags: text('tags'), // JSON array of tags
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads: many(leads),
  assignedMissions: many(missions),
  assignedOpportunities: many(opportunities),
  loans: many(loans),
  documents: many(documents),
  missionAssignments: many(missionAssignments),
}));

export const propertyTypesRelations = relations(propertyTypes, ({ many }) => ({
  properties: many(properties),
}));

export const countiesRelations = relations(counties, ({ many }) => ({
  properties: many(properties),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  propertyType: one(propertyTypes, {
    fields: [properties.propertyTypeId],
    references: [propertyTypes.id],
  }),
  county: one(counties, {
    fields: [properties.countyId],
    references: [counties.id],
  }),
  leads: many(leads),
  missions: many(missions),
  opportunities: many(opportunities),
  documents: many(documents),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  property: one(properties, {
    fields: [leads.propertyId],
    references: [properties.id],
  }),
  assignedUser: one(users, {
    fields: [leads.assignedTo],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const missionsRelations = relations(missions, ({ one, many }) => ({
  property: one(properties, {
    fields: [missions.propertyId],
    references: [properties.id],
  }),
  assignedByUser: one(users, {
    fields: [missions.assignedBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [missions.reviewedBy],
    references: [users.id],
  }),
  assignments: many(missionAssignments),
  documents: many(documents),
}));

export const missionAssignmentsRelations = relations(missionAssignments, ({ one }) => ({
  mission: one(missions, {
    fields: [missionAssignments.missionId],
    references: [missions.id],
  }),
  soldier: one(users, {
    fields: [missionAssignments.soldierId],
    references: [users.id],
  }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  property: one(properties, {
    fields: [opportunities.propertyId],
    references: [properties.id],
  }),
  lead: one(leads, {
    fields: [opportunities.leadId],
    references: [leads.id],
  }),
  assignedUser: one(users, {
    fields: [opportunities.assignedTo],
    references: [users.id],
  }),
  loans: many(loans),
  documents: many(documents),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [loans.opportunityId],
    references: [opportunities.id],
  }),
  borrower: one(users, {
    fields: [loans.borrowerId],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  property: one(properties, {
    fields: [documents.propertyId],
    references: [properties.id],
  }),
  mission: one(missions, {
    fields: [documents.missionId],
    references: [missions.id],
  }),
  lead: one(leads, {
    fields: [documents.leadId],
    references: [leads.id],
  }),
  opportunity: one(opportunities, {
    fields: [documents.opportunityId],
    references: [opportunities.id],
  }),
  loan: one(loans, {
    fields: [documents.loanId],
    references: [loans.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));