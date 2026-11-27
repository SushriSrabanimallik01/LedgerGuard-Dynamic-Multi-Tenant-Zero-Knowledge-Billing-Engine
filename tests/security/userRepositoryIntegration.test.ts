import express from 'express';
import request from 'supertest';
import authRoutes from '../../backend/src/routes/authRoutes';
import {
  setUserRepository,
  getUserRepository,
  InMemoryUserRepository,
  MongoUserRepository,
  IMongooseUserModel,
  IUserDocumentLike
} from '../../backend/src/repositories/userRepository';
import { hashPassword } from '../../backend/src/security/password';
import { verifyAccessToken, generateRefreshToken } from '../../backend/src/security/jwt';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';

/**
 * DB-Backed User Repository Integration Test
 *
 * Verifies that the security authentication layer (authController, jwt, password)
 * operates seamlessly when plugged into a MongoDB-backed repository implementation
 * without embedding database-specific code into controller logic.
 */
describe('Security Integration: DB-Backed Authentication Repository', () => {
  let app: express.Application;

  // In-memory backing store simulating MongoDB collection
  let mongoStore: Map<string, IUserDocumentLike>;
  let mockUserModel: IMongooseUserModel;
  let mongoRepo: MongoUserRepository;

  // Stored password hash for test user
  let activePasswordHash: string;
  const rawPassword = 'StrongPassword!2026';

  beforeAll(async () => {
    activePasswordHash = await hashPassword(rawPassword);
  });

  beforeEach(() => {
    mongoStore = new Map();

    // Mock Mongoose UserModel simulating MongoDB ObjectId and collection operations
    mockUserModel = {
      async findOne(query: { email: string }): Promise<IUserDocumentLike | null> {
        const normalized = query.email.toLowerCase().trim();
        for (const doc of mongoStore.values()) {
          if (doc.email.toLowerCase().trim() === normalized) {
            return { ...doc };
          }
        }
        return null;
      },

      async findById(id: string): Promise<IUserDocumentLike | null> {
        const doc = mongoStore.get(id);
        return doc ? { ...doc } : null;
      },

      async create(data: Omit<IUserDocumentLike, '_id' | 'createdAt' | 'updatedAt'>): Promise<IUserDocumentLike> {
        const simulatedObjectId = {
          _idString: `mongo_id_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toString() {
            return this._idString;
          }
        };

        const now = new Date();
        const doc: IUserDocumentLike = {
          ...data,
          _id: simulatedObjectId,
          createdAt: now,
          updatedAt: now
        };
        mongoStore.set(simulatedObjectId.toString(), doc);
        return doc;
      }
    };

    // Seed mock MongoDB store with test documents
    const aliceDoc: IUserDocumentLike = {
      _id: { toString: () => '64f8a1b2c3d4e5f6a7b8c9d0' },
      email: 'alice@acme.corp',
      passwordHash: activePasswordHash,
      role: UserRole.BILLING_MANAGER,
      organizationId: 'org_acme_corp',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z')
    };

    const inactiveDoc: IUserDocumentLike = {
      _id: { toString: () => '64f8a1b2c3d4e5f6a7b8c9d1' },
      email: 'inactive@acme.corp',
      passwordHash: activePasswordHash,
      role: UserRole.MEMBER,
      organizationId: 'org_acme_corp',
      isActive: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z')
    };

    mongoStore.set(aliceDoc._id.toString(), aliceDoc);
    mongoStore.set(inactiveDoc._id.toString(), inactiveDoc);

    // Instantiate MongoUserRepository and wire into auth engine
    mongoRepo = new MongoUserRepository(mockUserModel);
    setUserRepository(mongoRepo);

    // Set up test Express application
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
  });

  afterAll(() => {
    // Restore clean in-memory repository
    setUserRepository(new InMemoryUserRepository());
  });

  // 1. Existing User Login
  it('should authenticate an existing user stored in MongoDB repository and return tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'Alice@Acme.Corp', // Tests case-insensitivity against MongoDB
        password: rawPassword
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.id).toBe('64f8a1b2c3d4e5f6a7b8c9d0');
    expect(res.body.data.user.email).toBe('alice@acme.corp');
    expect(res.body.data.user.role).toBe(UserRole.BILLING_MANAGER);
    expect(res.body.data.user.organizationId).toBe('org_acme_corp');
  });

  // 2. Nonexistent User Login (with Timing-Attack Mitigation)
  it('should return generic 401 when user does not exist in MongoDB', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@acme.corp',
        password: rawPassword
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_CREDENTIALS_INVALID);
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 3. Wrong Password
  it('should return identical generic 401 when password is wrong for MongoDB user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@acme.corp',
        password: 'IncorrectPassword123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_CREDENTIALS_INVALID);
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 4. Inactive User
  it('should reject login for deactivated user with HTTP 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'inactive@acme.corp',
        password: rawPassword
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
    expect(res.body.message).toMatch(/account is deactivated/i);
  });

  // 5. Refresh Token Flow
  it('should refresh access token using valid refresh token verified against MongoDB', async () => {
    // Generate valid refresh token for Alice
    const refreshToken = generateRefreshToken('64f8a1b2c3d4e5f6a7b8c9d0', 'org_acme_corp');

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    // Verify claims in newly issued access token
    const decoded = verifyAccessToken(res.body.data.accessToken);
    expect(decoded.sub).toBe('64f8a1b2c3d4e5f6a7b8c9d0');
    expect(decoded.organizationId).toBe('org_acme_corp');
    expect(decoded.role).toBe(UserRole.BILLING_MANAGER);
  });

  it('should reject refresh token when MongoDB user has been deactivated', async () => {
    const refreshToken = generateRefreshToken('64f8a1b2c3d4e5f6a7b8c9d1', 'org_acme_corp');

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
  });

  // 6. Tenant Identity in JWT (Zero-Trust verification)
  it('should issue JWT access token with tenant identity originating strictly from MongoDB', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@acme.corp',
        password: rawPassword
      });

    expect(res.status).toBe(200);
    const token = res.body.data.accessToken;

    const payload = verifyAccessToken(token);
    // Verified: organizationId matches Alice's record in MongoDB, never client-supplied
    expect(payload.organizationId).toBe('org_acme_corp');
  });

  // 7. Role Claim Integrity
  it('should issue JWT access token with role claim sourced strictly from MongoDB', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@acme.corp',
        password: rawPassword
      });

    expect(res.status).toBe(200);
    const payload = verifyAccessToken(res.body.data.accessToken);
    // Verified: role is BILLING_MANAGER from MongoDB, preventing privilege escalation
    expect(payload.role).toBe(UserRole.BILLING_MANAGER);
  });

  // 8. Database Error Isolation
  it('should return generic HTTP 500 without leaking database error details on query failure', async () => {
    // Force mock model to throw simulated database connection error
    jest.spyOn(mockUserModel, 'findOne').mockRejectedValueOnce(new Error('MongoNetworkTimeoutException: connection closed'));

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@acme.corp',
        password: rawPassword
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(res.body.message).toBe('An unexpected error occurred during login');
    // Ensure raw database error is NOT leaked in the response body
    expect(JSON.stringify(res.body)).not.toMatch(/MongoNetworkTimeoutException/i);
  });
});
