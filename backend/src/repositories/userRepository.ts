import { IUser } from '@shared/types/auth.types';

/**
 * User Repository Interface
 *
 * Defines the database-agnostic contract for user persistence and retrieval.
 * This boundary isolates authentication controllers and security services
 * from underlying database technologies (Mongoose/MongoDB).
 */
export interface IUserRepository {
  /**
   * Finds a user by their unique email address (case-insensitive).
   *
   * @param email - Normalized user email
   * @returns The user domain object or null if not found
   */
  findByEmail(email: string): Promise<IUser | null>;

  /**
   * Finds a user by their unique primary identifier.
   *
   * @param id - User identifier string
   * @returns The user domain object or null if not found
   */
  findById(id: string): Promise<IUser | null>;

  /**
   * Creates and persists a new user record.
   *
   * @param userData - User attributes excluding auto-generated id and timestamps
   * @returns The newly created user domain object
   */
  create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser>;
}

/**
 * In-memory repository for initial development and isolated testing.
 */
export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, IUser>();

  async findByEmail(email: string): Promise<IUser | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase().trim() === normalized) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<IUser | null> {
    return this.users.get(id) || null;
  }

  async create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const newUser: IUser = {
      ...userData,
      email: userData.email.toLowerCase().trim(),
      id,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, newUser);
    return newUser;
  }

  // Helper for test seeding
  seedUser(user: IUser): void {
    this.users.set(user.id, {
      ...user,
      email: user.email.toLowerCase().trim()
    });
  }

  clear(): void {
    this.users.clear();
  }
}

/**
 * Expected Mongoose Document Shape
 * (To be supplied by Aniket in backend/src/models/User.ts)
 */
export interface IUserDocumentLike {
  _id: { toString(): string } | string;
  email: string;
  passwordHash: string;
  role: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Maps a MongoDB/Mongoose document to the domain IUser model.
 * Bridges MongoDB `_id` to domain `id` and validates required security claims.
 */
export function mapMongoUserToDomain(doc: IUserDocumentLike): IUser {
  return {
    id: typeof doc._id === 'string' ? doc._id : doc._id.toString(),
    email: doc.email.toLowerCase().trim(),
    passwordHash: doc.passwordHash,
    role: doc.role as IUser['role'],
    organizationId: doc.organizationId,
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt)
  };
}

/**
 * Structural interface for the Mongoose Model expected from Aniket.
 * Allows dependency injection without importing Mongoose directly.
 */
export interface IMongooseUserModel {
  findOne(query: { email: string }): Promise<IUserDocumentLike | null>;
  findById(id: string): Promise<IUserDocumentLike | null>;
  create(data: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUserDocumentLike>;
}

/**
 * MongoDB-backed implementation of IUserRepository.
 * Consumes Aniket's Mongoose UserModel and safely transforms documents to domain models.
 */
export class MongoUserRepository implements IUserRepository {
  constructor(private readonly userModel: IMongooseUserModel) {}

  async findByEmail(email: string): Promise<IUser | null> {
    const doc = await this.userModel.findOne({ email: email.toLowerCase().trim() });
    return doc ? mapMongoUserToDomain(doc) : null;
  }

  async findById(id: string): Promise<IUser | null> {
    const doc = await this.userModel.findById(id);
    return doc ? mapMongoUserToDomain(doc) : null;
  }

  async create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    const doc = await this.userModel.create({
      ...userData,
      email: userData.email.toLowerCase().trim()
    });
    return mapMongoUserToDomain(doc);
  }
}

// Global active user repository instance (defaults to InMemoryUserRepository)
let activeUserRepository: IUserRepository = new InMemoryUserRepository();

export function setUserRepository(repo: IUserRepository): void {
  activeUserRepository = repo;
}

export function getUserRepository(): IUserRepository {
  return activeUserRepository;
}
