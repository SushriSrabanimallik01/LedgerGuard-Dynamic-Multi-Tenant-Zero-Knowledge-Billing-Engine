# Infrastructure & Deployment

**Module Owner:** Purnima
**Scope:** Docker configuration, local orchestrations, CI/CD, and deployment

## Purpose & Scope
This directory contains container configurations, orchestration templates, and deployment scripts for LedgerGuard.

### Key Responsibilities:
- **Docker Orchestration (`docker-compose.yml`):**
  - Defines multi-container development environment:
    - `backend`: Express Node.js application
    - `frontend`: React development container
    - `mongodb`: MongoDB container with replica set for ACID transaction support
    - `redis`: Redis standalone or cluster container
- **Production Deployment:**
  - Dockerfiles for backend and frontend.
  - Deployment configuration for Render / AWS ECS / EC2.
- **Monitoring & Logging:**
  - Structured logging configuration and health probes.
