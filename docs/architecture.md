# Architecture: MatchDay AI

## 1. Tech Stack (with versions)

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18.3.1 |
| Frontend build tool | Vite | 5.4.2 |
| Frontend language | TypeScript | 5.5.4 |
| Styling | Tailwind CSS | 3.4.10 |
| UI components | shadcn/ui (Radix primitives) | Radix UI 1.1.x |
| State management | Zustand | 4.5.4 |
| Backend runtime | Node.js | 20.16.0 (LTS) |
| Backend framework | Express | 4.19.2 |
| Backend language | TypeScript | 5.5.4 |
| Database | PostgreSQL | 16.4 |
| ORM | Prisma | 5.18.0 |
| Cache / rate limiting | Redis | 7.4.0 |
| GenAI provider | Anthropic Claude API (claude-sonnet-4-6) | API version 2023-06-01 |
| Real-time updates | Socket.IO | 4.7.5 |
| Auth | JWT (jsonwebtoken) | 9.0.2 |
| Testing (frontend) | Vitest + React Testing Library | Vitest 2.0.5 / RTL 16.0.0 |
| Testing (backend) | Jest + Supertest | Jest 29.7.0 / Supertest 7.0.0 |
| CI | GitHub Actions | n/a (hosted) |
| Deployment | Docker + Docker Compose | Docker Engine 27.1 |

## 2. Database Schema

### Tables

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | default gen_random_uuid() |
| role | ENUM('fan','staff','admin') | default 'fan' |
| preferred_language | VARCHAR(10) | ISO 639-1 code, e.g. 'es' |
| created_at | TIMESTAMPTZ | default now() |

**venues**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | VARCHAR(255) | |
| city | VARCHAR(255) | |
| capacity | INTEGER | |
| created_at | TIMESTAMPTZ | |

**zones**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| venue_id | UUID (FK → venues.id) | ON DELETE CASCADE |
| name | VARCHAR(255) | e.g. "Gate B Concourse" |
| zone_type | ENUM('gate','concourse','transit','restroom','concession','exit') | |
| max_capacity | INTEGER | soft threshold for alerting |
| geo_coordinates | JSONB | {lat, lng} or polygon for map rendering |

**density_readings**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| zone_id | UUID (FK → zones.id) | ON DELETE CASCADE |
| estimated_count | INTEGER | from sensor/camera-count feed (non-biometric aggregate count only) |
| density_pct | DECIMAL(5,2) | estimated_count / max_capacity |
| recorded_at | TIMESTAMPTZ | indexed, high write volume |

**alerts**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| zone_id | UUID (FK → zones.id) | ON DELETE CASCADE |
| severity | ENUM('info','warning','critical') | |
| ai_recommendation | TEXT | GenAI-generated mitigation suggestion |
| acknowledged_by | UUID (FK → users.id, nullable) | |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ (nullable) | |

**chat_queries**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users.id, nullable) | nullable for anonymous fans |
| venue_id | UUID (FK → venues.id) | |
| query_text | TEXT | sanitized input |
| detected_language | VARCHAR(10) | |
| response_text | TEXT | |
| was_cached | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | |

**translation_cache**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| query_hash | VARCHAR(64) (UNIQUE) | SHA-256 of normalized query + language |
| language | VARCHAR(10) | |
| response_text | TEXT | |
| hit_count | INTEGER | default 0 |
| updated_at | TIMESTAMPTZ | |

### Relationships

- `venues (1) → (many) zones`
- `zones (1) → (many) density_readings`
- `zones (1) → (many) alerts`
- `users (1) → (many) chat_queries`
- `venues (1) → (many) chat_queries`
- `translation_cache` is a standalone lookup table, keyed by `query_hash`, referenced logically (not FK) by `chat_queries.was_cached`.

## 3. API Routes / Endpoints

### Chat / Navigation
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/chat/query` | Submit a fan question; returns translated navigation answer (checks cache first) |
| GET | `/api/v1/chat/history/:userId` | Retrieve a fan's prior queries (if authenticated) |
| POST | `/api/v1/navigation/route` | Get step-by-step directions between two zone IDs |

### Crowd Density / Alerts
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/zones/:venueId` | List all zones for a venue with current density |
| POST | `/api/v1/density/ingest` | Ingest a new density reading (from sensor/camera-count feed) |
| GET | `/api/v1/alerts/active/:venueId` | List active (unresolved) alerts for a venue |
| POST | `/api/v1/alerts/:alertId/acknowledge` | Staff acknowledges an alert |
| POST | `/api/v1/alerts/:alertId/resolve` | Mark an alert resolved |
| GET | `/api/v1/alerts/:alertId/recommendation` | Fetch AI-generated mitigation recommendation |

### Auth
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Staff/admin login (JWT issuance) |
| POST | `/api/v1/auth/refresh` | Refresh JWT |

### Real-time (Socket.IO events, not REST)
| Event | Direction | Purpose |
|---|---|---|
| `density:update` | server → client | Push live density changes to dashboard |
| `alert:new` | server → client | Push new alert to staff dashboard |
| `alert:resolved` | server → client | Notify dashboard an alert closed |

## 4. Security Notes (implementation detail supporting PRD/eval criteria)

- All routes under `/api/v1/alerts/*` and `/api/v1/density/ingest` require `role IN ('staff','admin')` via JWT middleware.
- `chat/query` input is sanitized (strip control characters, enforce max length 500 chars, strip markdown/HTML) before being passed to the GenAI prompt, and the prompt template uses strict system/user role separation to mitigate prompt injection.
- All DB access goes through Prisma parameterized queries — no raw SQL string concatenation.
- CORS restricted to the deployed frontend origin; CSRF tokens required on state-changing staff-dashboard requests.
