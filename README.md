# LedgerGuard: Dynamic Multi-Tenant Zero-Knowledge Billing Engine

A secure and scalable billing engine designed to support multiple tenants with reliable transaction processing, Redis caching, distributed locking, Docker deployment, and infrastructure monitoring.

## Project Overview

LedgerGuard aims to provide:

- Multi-tenant data isolation
- Secure authentication and authorization
- Redis caching
- Distributed locking
- Duplicate transaction prevention
- Reliable billing operations
- Docker-based deployment
- Infrastructure monitoring and testing

## Technology Stack

### Backend
- Node.js
- TypeScript
- Redis
- Express.js (planned)

### Database
- MongoDB (planned)

### DevOps and Monitoring
- Docker
- Docker Compose
- Prometheus
- Grafana
- Redis Exporter

### Testing
- Node.js Test Runner
- TSX

## Project Structure

```text
LedgerGuard/
|
|-- .github/
|   |-- workflows/
|       |-- ci.yml
|
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |   |-- redis.ts
|   |   |-- redis/
|   |   |   |-- cacheManager.ts
|   |   |   |-- redisHelpers.ts
|   |   |   |-- redisLock.ts
|   |   |-- index.ts
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|
|-- infrastructure/
|   |-- monitoring/
|       |-- prometheus.yml
|       |-- alerts.yml
|
|-- tests/
|   |-- infrastructure/
|       |-- redis.test.ts
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
- Duplicate operation prevention

## Docker Deployment

Build and start all services:

```bash
docker compose up --build -d
```

Check running containers:

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

## Monitoring

LedgerGuard uses Prometheus, Redis Exporter, and Grafana for infrastructure monitoring.

### Monitoring Services

| Service | URL |
|---|---|
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |
| Redis Exporter | http://localhost:9121/metrics |

### Grafana Dashboard

Grafana provides Redis monitoring dashboards, including:

- Redis memory usage
- Connected clients
- Total commands
- Cache hits and misses
- Network I/O
- Database statistics

Configure Prometheus as the Grafana data source and import a Redis Exporter dashboard.

## Environment Configuration

Create a `.env` file inside the backend folder if running the application locally.

```env
PORT=3000
REDIS_URL=redis://localhost:6379
```

Never upload actual environment secrets to GitHub.

## Testing

Build the backend:

```bash
cd backend
npm run build
```

Run Redis infrastructure tests:

```bash
npm test
```

## Continuous Integration

GitHub Actions automatically runs:

- Dependency installation
- Backend TypeScript build
- Redis infrastructure tests

Workflow location:

```text
.github/workflows/ci.yml
```

## Current Implementation

- Redis integration
- Redis caching utilities
- Distributed locking
- Backend health endpoint
- Docker containerization
- Docker health checks
- Redis infrastructure tests
- Prometheus monitoring
- Redis Exporter integration
- Grafana dashboard
- GitHub Actions CI workflow

## Future Implementation

- Multi-tenant authentication
- Billing APIs
- MongoDB integration
- Zero-knowledge security features
- Transaction management
- Advanced monitoring and analytics
