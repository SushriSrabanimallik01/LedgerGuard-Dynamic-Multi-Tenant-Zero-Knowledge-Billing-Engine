# Database-Backed Authentication Integration Specification

**Authors:** API Gateway & Security (Srabani)  
**Target Module Owner:** Database & Data Models (Aniket)  
**Status:** Ready for Integration  
**Date:** November 2026  

---

## 1. Overview & Architectural Boundary

LedgerGuard employs a strict repository abstraction (`IUserRepository`) to isolate the authentication and authorization layer (`authController.ts`) from the physical database technology (MongoDB / Mongoose).

- **Srabani owns:** `IUserRepository` interface, `MongoUserRepository` wrapper, password verification (`bcrypt`), JWT token issuance, timing-attack mitigations, and route security.
- **Aniket owns:** Mongoose connection (`connectDB`), Mongoose Schema/Model (`backend/src/models/User.ts`), database indexing, and connection pooling.

This document specifies the exact schema, constraints, and mappings required from Aniket to connect MongoDB to the authentication engine.

---

## 2. Required Mongoose Model Contract (`backend/src/models/User.ts`)

Aniket must export a Mongoose model named `User` matching the following specification:

```typescript
import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../../shared/types/auth.types';

export interface IUserDocument extends Document {
  email: string;
  passwordHash: string;
  role: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.MEMBER,
      required: true
    },
    organizationId: {
      type: String,
      required: [true, 'Organization (Tenant) ID is required'],
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true
    }
  },
  {
    timestamps: true // Automatically manages createdAt and updatedAt
  }
);

export default mongoose.model<IUserDocument>('User', UserSchema);
```

---

## 3. Data Mapping Proposal

MongoDB documents utilize `_id` (`ObjectId`). The LedgerGuard security core uses string `id`.

The `mapMongoUserToDomain` function in `backend/src/repositories/userRepository.ts` standardizes this transformation:

| MongoDB / Mongoose Field | Domain `IUser` Field | Transformation |
|---|---|---|
| `_id: ObjectId` | `id: string` | `doc._id.toString()` |
| `email: string` | `email: string` | Normalized: `doc.email.toLowerCase().trim()` |
| `passwordHash: string` | `passwordHash: string` | Direct string pass-through |
| `role: string` | `role: UserRole` | Cast to `UserRole` enum |
| `organizationId: string`| `organizationId: string`| Direct string pass-through (authoritative tenant boundary) |
| `isActive: boolean` | `isActive: boolean` | Explicit `Boolean(doc.isActive)` |
| `createdAt: Date` | `createdAt: Date` | Ensured `Date` instance |
| `updatedAt: Date` | `updatedAt: Date` | Ensured `Date` instance |

---

## 4. Repository Integration & Server Wiring

The security layer provides `MongoUserRepository` which accepts any Mongoose model matching `IMongooseUserModel`.

To activate MongoDB user storage on server startup, Aniket (or the server entry point) simply executes:

```typescript
import { connectDB } from './config/database';
import UserModel from './models/User';
import { setUserRepository, MongoUserRepository } from './repositories/userRepository';

async function bootstrap() {
  await connectDB();
  
  // Wire MongoDB into the authentication engine
  setUserRepository(new MongoUserRepository(UserModel));
  
  console.log('✅ Authentication engine connected to MongoDB UserModel');
}
```

No changes to `authController.ts`, `authRoutes.ts`, or security tests are needed when this is wired.

---

## 5. Security Invariants Enforced by the Security Layer

1. **Zero-Trust Identity Origin:**
   JWT claims (`organizationId`, `role`, `email`) are sourced **strictly from the database user record**, never from client-supplied login bodies or headers. An attacker cannot escalate their role or switch tenants during login.
2. **Password Verification:**
   Password comparison uses `bcrypt.compare` with salt rounds matching `securityConfig.password.saltRounds` (12).
3. **Nonexistent-User Timing Mitigation:**
   If `userModel.findOne` returns `null`, `authController` executes a dummy bcrypt comparison against a precomputed cost-12 hash to prevent user enumeration timing attacks.
4. **Account Invalidation:**
   If `user.isActive === false`, authentication immediately returns HTTP 403 `FORBIDDEN_INSUFFICIENT_ROLE`. Refresh tokens are also invalidated when `isActive === false`.
5. **Database Failure Isolation:**
   If MongoDB queries throw an exception or time out, `authController` catches the error and returns generic HTTP 500 without leaking connection strings, database names, or query contents.
