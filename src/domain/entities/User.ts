import { z } from 'zod';
import bcrypt from 'bcryptjs';

// User Entity - Authentication and role management
export const UserRoleSchema = z.enum(['admin', 'officer', 'soldier', 'client']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  
  // Personal Information
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(10).max(20).optional(),
  
  // Role & Access
  role: UserRoleSchema,
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  
  // Activity Tracking
  lastLogin: z.date().optional(),
  lastActivity: z.date().optional(),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export class UserEntity {
  private constructor(private readonly data: User) {}

  static async create(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
  }): Promise<UserEntity> {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const now = new Date();
    
    const user: User = {
      id: 0, // Will be set by database
      username: data.username,
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role,
      isActive: true,
      isEmailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
    
    return new UserEntity(UserSchema.parse(user));
  }

  static fromData(data: User): UserEntity {
    return new UserEntity(UserSchema.parse(data));
  }

  get id(): number {
    return this.data.id;
  }

  get email(): string {
    return this.data.email;
  }

  get username(): string {
    return this.data.username;
  }

  get fullName(): string {
    return `${this.data.firstName} ${this.data.lastName}`;
  }

  get role(): UserRole {
    return this.data.role;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get isEmailVerified(): boolean {
    return this.data.isEmailVerified;
  }

  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.data.passwordHash);
  }

  async updatePassword(newPassword: string): Promise<UserEntity> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedData: User = {
      ...this.data,
      passwordHash,
      updatedAt: new Date(),
    };
    
    return new UserEntity(updatedData);
  }

  updateLastLogin(): UserEntity {
    const now = new Date();
    const updatedData: User = {
      ...this.data,
      lastLogin: now,
      lastActivity: now,
      updatedAt: now,
    };
    
    return new UserEntity(updatedData);
  }

  updateActivity(): UserEntity {
    const updatedData: User = {
      ...this.data,
      lastActivity: new Date(),
      updatedAt: new Date(),
    };
    
    return new UserEntity(updatedData);
  }

  verifyEmail(): UserEntity {
    const updatedData: User = {
      ...this.data,
      isEmailVerified: true,
      updatedAt: new Date(),
    };
    
    return new UserEntity(updatedData);
  }

  deactivate(): UserEntity {
    const updatedData: User = {
      ...this.data,
      isActive: false,
      updatedAt: new Date(),
    };
    
    return new UserEntity(updatedData);
  }

  activate(): UserEntity {
    const updatedData: User = {
      ...this.data,
      isActive: true,
      updatedAt: new Date(),
    };
    
    return new UserEntity(updatedData);
  }

  // Return data without sensitive information
  toPublic(): Omit<User, 'passwordHash'> {
    const { passwordHash, ...publicData } = this.data;
    return publicData;
  }

  toJSON(): User {
    return { ...this.data };
  }
}