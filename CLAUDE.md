# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LibreChat is a self-hosted AI chat platform that unifies multiple AI providers (OpenAI, Anthropic, Google, Azure, AWS Bedrock, etc.) in a single interface. It's a full-stack monorepo application with:
- Node.js/Express backend API
- React (TypeScript) frontend with Vite
- MongoDB for data persistence
- Redis for caching and session management
- MeiliSearch for conversation search
- Docker support for deployment

## Architecture

### Monorepo Structure

This is a npm workspaces monorepo with the following packages:

- **`api/`** - Express.js backend server
  - `server/` - Main server entry point and configuration
  - `models/` - Mongoose database models
  - `strategies/` - Passport authentication strategies
  - `app/` - Core business logic
  - `db/` - Database connection and utilities

- **`client/`** - React frontend application
  - `src/components/` - React components organized by feature (Chat, Messages, Agents, etc.)
  - `src/store/` - State management (Recoil)
  - `src/hooks/` - Custom React hooks
  - `src/data-provider/` - API client and React Query hooks
  - Built with Vite, uses Tailwind CSS and Radix UI

- **`packages/`** - Shared packages
  - `data-provider/` - Shared data fetching logic and API client (used by both client and API)
  - `data-schemas/` - Shared TypeScript types and Zod schemas
  - `api/` - Shared API utilities and helpers
  - `client/` - Shared client utilities

### Key Technologies

- **Backend**: Express 5, Mongoose, Passport (OAuth/JWT/LDAP), Socket.io for real-time features
- **Frontend**: React 18, TypeScript, Vite, TanStack Query (React Query), Recoil, Tailwind CSS
- **AI Integration**: OpenAI SDK, Anthropic SDK, Google Vertex AI, AWS Bedrock, Langchain
- **Agents**: Custom agent system with MCP (Model Context Protocol) support via `@librechat/agents`

### Request Flow

1. Client makes API requests to `/api/*` endpoints
2. In development, Vite proxy forwards to Express backend (port 3080)
3. Express middleware handles auth (JWT/session), rate limiting, validation
4. Routes in `api/server/routes/` dispatch to controllers
5. Controllers use models to interact with MongoDB
6. AI provider SDKs handle LLM communication
7. Responses stream back to client via SSE (Server-Sent Events)

### Authentication & Authorization

- Passport.js with multiple strategies: local, JWT, OAuth2 (Google, GitHub, Discord, etc.), LDAP
- Session management via express-session with Redis/Memorystore
- Role-based permissions system for agents, prompts, and features
- Token spend tracking and balance management

### Data Flow for AI Conversations

1. User input captured in `client/src/components/Chat/`
2. Message sent via `data-provider` API client
3. Backend routes through `api/server/routes/messages.js`
4. Message stored in MongoDB via Mongoose models
5. AI provider client instantiated based on endpoint config
6. Response streamed back via SSE
7. Frontend updates conversation state (Recoil) and UI

## Development Commands

### Setup & Installation

```bash
# Install dependencies (use npm, not yarn or pnpm)
npm ci

# Build shared packages (required before running client or API)
npm run build:data-provider
npm run build:data-schemas
npm run build:api
npm run build:client-package

# Alternative: Build all packages at once
npm run build:packages
```

### Running Development Servers

```bash
# Backend development server (with hot reload via nodemon)
npm run backend:dev

# Frontend development server (Vite dev server on port 3090)
npm run frontend:dev

# Run both concurrently from root
# Note: Start backend first, then frontend in separate terminals
```

### Building for Production

```bash
# Build frontend (includes building packages)
npm run frontend

# Build client only (after packages are built)
npm run build:client

# Production backend
npm run backend
```

### Testing

```bash
# Run all tests
npm run test:all

# Backend API tests
npm run test:api
cd api && npm test  # Watch mode

# Frontend tests
npm run test:client
cd client && npm test  # Watch mode

# E2E tests (requires MongoDB running)
npm run e2e
npm run e2e:headed    # With browser UI
npm run e2e:debug     # Debug mode

# Individual package tests
npm run test:packages:api
npm run test:packages:data-provider
npm run test:packages:data-schemas
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Format with Prettier
npm run format
```

### Database & User Management

```bash
# User management utilities
npm run create-user
npm run list-users
npm run delete-user
npm run ban-user
npm run reset-password

# Balance management (token credits)
npm run add-balance
npm run set-balance
npm run list-balances

# Database utilities
npm run reset-meili-sync  # Reset MeiliSearch index
npm run flush-cache       # Clear Redis cache
```

### Update & Reinstall

```bash
# Update from upstream (git pull + reinstall)
npm run update

# Reinstall all dependencies (cleans node_modules)
npm run reinstall

# Update for local development (no docker)
npm run update:local

# Update for docker setup
npm run update:docker
```

## Configuration Files

### Environment Variables
- `.env` - Main environment configuration (see `.env.example`)
  - Database: `MONGO_URI` (default: `mongodb://127.0.0.1:27017/LibreChat`)
  - Server: `HOST`, `PORT` (default: 3080)
  - Redis: Optional, for caching and session storage
  - AI Provider API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

### LibreChat Configuration
- `librechat.yaml` - Main application configuration (see `librechat.example.yaml`)
  - AI endpoint configuration (custom endpoints, model settings)
  - Interface customization (features, branding, terms of service)
  - File storage strategy (local/S3/Firebase)
  - Agent and tool configurations
  - MCP server definitions

### Build Configuration
- `client/vite.config.ts` - Vite configuration for frontend
- `packages/*/rollup.config.js` - Rollup configs for shared packages
- `tsconfig.json` files throughout for TypeScript compilation

## Common Development Workflows

### Adding a New API Endpoint

1. Create route handler in `api/server/routes/`
2. Add controller logic (may use models from `api/models/`)
3. Update OpenAPI types if needed
4. Add corresponding data-provider method in `packages/data-provider/src/`
5. Build data-provider: `npm run build:data-provider`
6. Create React Query hook in `client/src/data-provider/`
7. Use hook in React components

### Adding a New UI Component

1. Create component in appropriate `client/src/components/` subdirectory
2. Follow existing patterns (use Radix UI primitives, Tailwind for styling)
3. Use existing hooks from `client/src/hooks/` or create new ones
4. Connect to state via Recoil atoms/selectors in `client/src/store/`
5. Ensure accessibility (ARIA attributes, keyboard navigation)

### Working with AI Providers

1. Provider-specific code typically in `api/app/clients/` or via SDK
2. Configuration via `librechat.yaml` under `endpoints`
3. Model definitions in `api/models/` for conversation/message storage
4. Streaming responses handled via SSE in routes
5. Token counting and rate limiting per provider

### Database Changes

1. Models defined in `api/models/` using Mongoose
2. Migrations handled via `api/server/services/start/migration.js`
3. Always check for existing migrations before modifying schemas
4. Index definitions in model schemas (MongoDB will auto-create)
5. Use `MONGO_AUTO_INDEX=true` in `.env` for development

## Testing Strategy

- **Unit Tests**: Jest for both frontend and backend
  - Backend: `api/test/` with MongoDB memory server
  - Frontend: `client/src/**/*.test.tsx` with React Testing Library

- **Integration Tests**: Playwright E2E tests in `e2e/`
  - Requires MongoDB and backend running
  - Storage state for authenticated sessions
  - Tests cover full user workflows

- **Type Checking**: TypeScript strict mode enabled
  - Run `npm run typecheck` in client directory
  - Shared types in `packages/data-schemas/`

## Important Notes

### Before Committing

1. Run `npm run lint` to check for issues (or ensure husky pre-commit works)
2. Clear localStorage and cookies in browser after frontend changes
3. Run `npm run reinstall` after package.json changes
4. Rebuild packages if you modified anything in `packages/`
5. Run relevant tests: `npm run test:api` and/or `npm run test:client`

### Package Dependencies

- Shared packages must be built before client/API can use them
- Build order matters: `data-schemas` → `data-provider` → `api` → `client`
- Changes to `packages/*` require rebuild and may need IDE restart

### Node.js Version

- Use Node.js 20.x (required)
- Install TypeScript globally: `npm i -g typescript`
- Bun is also supported (experimental) - see `b:*` scripts

### Docker Considerations

- `Dockerfile` and `Dockerfile.multi` for different build strategies
- `docker-compose.yml` for local development
- `deploy-compose.yml` for production deployments
- Override file: `docker-compose.override.yml.example`

## Key Directories & File Locations

- **API Routes**: `api/server/routes/*.js`
- **API Controllers**: `api/server/controllers/`
- **Database Models**: `api/models/*.js`
- **React Components**: `client/src/components/`
- **State Management**: `client/src/store/` (Recoil atoms/selectors)
- **API Client**: `packages/data-provider/src/` and `client/src/data-provider/`
- **Shared Types**: `packages/data-schemas/src/`
- **Configuration Scripts**: `config/*.js` (user management, migrations, etc.)
- **E2E Tests**: `e2e/*.spec.ts`

## External Documentation

- Official docs: https://docs.librechat.ai
- Configuration guide: https://www.librechat.ai/docs/configuration/librechat_yaml
- Environment variables: https://www.librechat.ai/docs/configuration/dotenv
- Contributing guide: `.github/CONTRIBUTING.md`
