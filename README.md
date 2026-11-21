
# LedgerGuard: Dynamic Multi-Tenant Zero-Knowledge Billing Engine

A secure and scalable billing engine designed to support multiple tenants with reliable transaction processing, Redis caching, distributed locking, and secure data management.

## Project Overview

LedgerGuard aims to provide:
- Multi-tenant data isolation
- Secure authentication and authorization
- Redis caching
- Distributed locking
- Duplicate transaction prevention
- Reliable billing operations
- Docker-based deployment
- Monitoring and testing

## Technology Stack

### Backend
- Node.js
- TypeScript
- Express.js (planned)
- Redis

### Database
- MongoDB (planned)

### DevOps
- Docker
- Docker Compose
- Redis

### Testing
- Node.js Test Runner
- TSX

## Project Structure

```text
LedgerGuard/
|
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |-- redis/
|   |   |-- index.ts
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   |-- .env.example
|
|-- infrastructure/
|   |-- docker/
|   |-- deployment/
|   |-- monitoring/
|
|-- tests/
|   |-- infrastructure/
|
|-- docker-compose.yml
|-- README.md
```

## Redis Features

- Redis connection management
- Cache management
- Redis helper functions
- Distributed locking
- Lock acquisition and release
- Automatic key expiration

## Docker Deployment

Build and start containers:

```bash
docker compose up --build -d
```

Check containers:

```bash
docker compose ps
```

Check backend health:

```bash
curl http://localhost:3000/health
```

Stop containers:

```bash
docker compose down
```

## Environment Configuration

Create a `.env` file inside the backend folder.

Configure the following variables:

```env
PORT=3000
REDIS_URL=redis://localhost:6379
```

Never upload actual environment secrets to GitHub.

## Testing

Run Redis infrastructure tests:

```bash
cd backend
npx tsx --test ../tests/infrastructure/redis.test.ts
```

Build the backend:

```bash
npm run build
```

## Current Implementation

- Redis integration
- Redis caching utilities
- Distributed locking
- Backend health endpoint
- Docker containerization
- Docker health checks
- Redis infrastructure tests

## Future Implementation

- Multi-tenant authentication
- Billing APIs
- MongoDB integration
- Zero-knowledge security features
- Transaction management
- Monitoring and analytics
