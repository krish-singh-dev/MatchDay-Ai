# SECURITY.md - Security Mitigations Traceability

This document details the security mitigations implemented in MatchDay AI and links them to the exact files and lines of code.

## 1. Input Sanitization & Validation
- Sanitizer middleware: [sanitize.middleware.ts](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/middleware/sanitize.middleware.ts) (strips out HTML/XML tags and trims whitespaces).
- Mounted on the chat query routing pipeline: [chat.routes.ts#L29](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/chat.routes.ts#L29).
- Ingestion parameter bounds checking and regex type validations: [density.routes.ts#L18-L28](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/density.routes.ts#L18-L28) (prevents negative counts and restricts IDs to alphanumeric/dashed strings).
- Navigation inputs checks: [navigation.routes.ts#L15-L18](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/navigation.routes.ts#L15-L18).

## 2. Parameterized Database Queries
- Done out-of-the-box by Prisma Client for all queries, avoiding manual SQL building:
  - Cache checking query: [chat.routes.ts#L87](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/chat.routes.ts#L87).
  - Zone validation check: [density.routes.ts#L30](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/density.routes.ts#L30).
  - Alert creation: [density.routes.ts#L63](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/density.routes.ts#L63).

## 3. CORS & Security Headers
- CORS configuration: [cors.config.ts](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/config/cors.config.ts) (restricts origins to designated host ports).
- Security middleware mount: [app.ts](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/app.ts) (mounts `cors()` and standard Express JSON parsers).

## 4. JWT Authentication & Role Gating
- Auth middleware declarations: [auth.middleware.ts](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/middleware/auth.middleware.ts) (exports `requireAuth` and `requireRole` decorators).
- Gating user-specific chat history logs: [chat.routes.ts#L173-L194](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/chat.routes.ts#L173-L194) (validates caller ID matches parameter target).
- Gating sensor density ingestion to staff/admin roles: [density.routes.ts#L11](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/density.routes.ts#L11).
- Gating operations alerts console access to staff/admin roles: [alerts.routes.ts#L10](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/alerts.routes.ts#L10).

## 5. Prompt Injection Mitigations
- Gemini system prompts isolation: [geminiClient.ts#L12-L28](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/ai/geminiClient.ts#L12-L28) (confines responses, instructs model to ignore instruction overrides, bounds query input length, and strips HTML markup).

## 6. Denial of Service (DoS) & Spam Protections
- Custom Sliding Window Rate Limiter: [rateLimit.middleware.ts](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/middleware/rateLimit.middleware.ts) (confines incoming calls to 60 requests per minute per IP, protecting the app and LLM query quotas).
- Mounted on the chat query route: [chat.routes.ts#L29](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/chat.routes.ts#L29).
- Mounted on sensor ingestion routes: [density.routes.ts#L11](file:///c:/KRISH/PROGRAMMING/MatchDay%20AI/backend/src/routes/density.routes.ts#L11).
