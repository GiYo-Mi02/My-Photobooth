# GioPix Photobooth

Production-focused MERN photobooth system with admin-managed templates, server-side compositing, QR sharing, and local plus cloud storage support.

## 1. Executive Summary

GioPix is a full-stack photobooth platform designed for event workflows:

- Capture up to 10 photos per session
- Select photos, choose a template, generate a final photostrip
- Apply post-generation photo-only filters (template stays intact)
- Download, print, and share via QR
- Manage templates in admin (upload, edit slots, hide/unhide)
- Store generated outputs locally and optionally in Cloudinary

This document is both:

- Setup and operations guide
- Engineering audit with candid feedback and improvement roadmap

## 2. Principal Engineering Audit

### 2.1 What Is Working Well

- Clear separation of frontend and backend responsibilities
- Server-side image generation with Sharp provides deterministic output quality
- Template slot model is flexible (visual editor + JSON import)
- Practical fallback strategy: local storage remains available when cloud upload fails
- Strong velocity: feature iteration has been fast

### 2.2 Current Risks and Gaps

- Debug-heavy route logic: `backend/routes/sessions.js` is very large and mixes many concerns
- Limited automated testing: no unit/integration/smoke test coverage for core image pipeline
- Default pagination behavior caused template visibility confusion in admin/client screens
- Runtime environment drift risk (stale process env vs `.env`) can break Cloudinary unexpectedly
- Operational fragility from port collisions during development (`EADDRINUSE`)
- No formal release checklist or deployment profile for non-local sharing

### 2.3 Overall Assessment

Current state is feature-rich and functional for active development and pilot use, but not yet hardened for zero-drama production operations. The highest ROI improvements are test coverage, route modularization, and predictable environment/deployment controls.

## 3. Tech Stack

- Frontend: React 19, Vite, TypeScript, Zustand, Axios, Framer Motion
- Backend: Node.js, Express, Mongoose, Multer, Sharp
- Database: MongoDB
- Image/Media: WebRTC capture (client), Sharp compositing (server)
- Storage:
   - Local filesystem (`uploads/`)
   - Cloudinary (optional, for generated outputs and sharing)
- Auth: JWT

## 4. Repository Structure

```text
Photobooth/
   backend/
      routes/
      models/
      middleware/
      lib/
      server.js
   frontend/
      src/
         components/
         pages/
         services/
         stores/
         lib/
   uploads/
      photos/
      photostrips/
      templates/
   README.md
```

## 5. Setup Guide

### 5.1 Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (local or remote)

### 5.2 Install

From repository root:

```bash
npm run install-all
```

### 5.3 Environment Configuration

#### Backend: `backend/.env`

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/photobooth
MONGODB_DB_NAME=photobooth

JWT_SECRET=replace_with_strong_secret

# Public URL used for share links and QR target fallback
PUBLIC_BASE_URL=http://localhost:5000

# Optional admin auto-seed on server start
ADMIN_EMAIL=admin@local
ADMIN_PASSWORD=admin1234
ADMIN_USERNAME=admin

# Optional Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

#### Frontend: `frontend/.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_PUBLIC_BASE_URL=http://localhost:5000
```

Notes:

- Do not leave placeholder values like `your-public-ip-or-domain` in active env files.
- If you run QR/share outside localhost, set both public base URLs to a reachable host/IP.

### 5.4 Run (Development)

From repository root:

```bash
npm run dev
```

Or in VS Code, run task: `Dev: run frontend and backend`.

Expected:

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173` (or next available port if occupied)

## 6. Core Workflow

1. Create session
2. Capture photos (up to 10)
3. Review and select photos
4. Choose template
5. Generate photostrip
6. Optional post-generation photo-only filter (Original, Monochrome, Rio)
7. Download/print/share

## 7. Storage Model (Current)

- Captured photos: local (`uploads/photos`)
- Generated photostrips: local (`uploads/photostrips`) and Cloudinary (if configured)
- Session metadata may store Cloudinary URL for sharing/QR

This dual-write pattern improves kiosk reliability while enabling public sharing.

## 8. Admin Template Management

Admin capabilities include:

- Upload template image
- Define/edit photo slots visually or by JSON
- Set default template
- Hide/Unhide templates

Behavior:

- Hidden templates are not shown in client Template Stage
- Hidden templates remain visible in admin and can be unhidden

## 9. Debugging Playbook

### 9.1 Server Won't Start (`EADDRINUSE`)

Symptoms:

- Backend logs `listen EADDRINUSE :::5000`

Actions:

1. Stop old dev processes/terminals
2. Restart once from root (`npm run dev`)
3. Confirm only one backend process is bound to 5000

### 9.2 Templates Missing in Admin or Client

Symptoms:

- Not all templates visible

Likely causes:

- Pagination limit reached
- Template is hidden (`isActive: false`)

Actions:

1. Check admin list for `Hidden` badge
2. Unhide if needed
3. Refresh template data

### 9.3 QR Points to Localhost

Symptoms:

- QR link opens `localhost` on other devices

Actions:

1. Set `PUBLIC_BASE_URL` in backend `.env` to reachable host
2. Set `VITE_PUBLIC_BASE_URL` in frontend `.env` similarly
3. Restart frontend and backend

### 9.4 Cloudinary `Invalid cloud_name`

Symptoms:

- Upload fails despite env changes

Actions:

1. Verify backend `.env` values
2. Fully restart backend process
3. Ensure stale `CLOUDINARY_URL` is not overriding credentials

### 9.5 Filter "Does Nothing"

Symptoms:

- Filter toggle appears to succeed but output unchanged

Likely causes:

- Silent fallback after filter/composite failure
- External gradient path invalid (for Rio style)

Actions:

1. Check backend logs for filter warnings
2. Confirm gradient asset path if using custom gradient
3. Regenerate and verify new output path/version

### 9.6 Misalignment After Filter Toggle

Symptoms:

- Photos shift after switching filters

Cause:

- Regeneration path not preserving template slot mode

Action:

- Ensure filter regeneration uses template slot-respecting layout settings

## 10. API Surface (High-Level)

- `POST /api/auth/login`
- `POST /api/sessions/create`
- `POST /api/photos/upload`
- `POST /api/sessions/:sessionId/photostrip`
- `GET /api/templates`
- `PUT /api/templates/:id` (admin)
- `GET /api/sessions/:sessionId/share`

## 11. Engineering Improvements Roadmap

### High Priority

- Split `backend/routes/sessions.js` into focused modules:
   - layout resolver
   - photo pipeline
   - template compositor
   - share/QR utilities
- Add automated tests:
   - slot mapping correctness
   - filter transforms
   - generation output shape checks
   - hide/unhide visibility behavior
- Add request validation schema for generation payloads and customization fields

### Medium Priority

- Add observability:
   - structured logs (request/session IDs)
   - error categorization
   - optional metrics
- Introduce idempotent generation/versioning strategy to avoid stale preview confusion
- Add explicit environment profiles for local/LAN/production

### Low Priority

- Add E2E Cypress/Playwright flow for capture -> generate -> share
- Add worker queue for heavy generation under high concurrency
- Add richer admin analytics for template performance and session outcomes

## 12. Quality Gates (Recommended)

Before merging significant changes:

1. Frontend build passes
2. Backend starts cleanly
3. Manual smoke test:
    - capture
    - select
    - template stage load
    - generate
    - filter toggle
    - share link/QR
4. Admin smoke test:
    - upload/edit/hide/unhide

## 13. License

MIT
