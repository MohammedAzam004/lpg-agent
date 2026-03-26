# Architecture Notes

## Overview

LPG Smart Assistant is organized as a frontend-backend system with a service-driven backend and JSON-based storage.

```text
Frontend (React + Vite)
  -> API layer
  -> Express backend
      -> Routes
      -> Controllers
      -> Services
      -> JSON data files
      -> Scheduler
      -> Email service
```

## Frontend Responsibilities

The frontend is responsible for:

- user registration and lightweight login
- chatbot interaction
- store browsing and filtering
- request tracking
- notification settings
- admin workspace rendering

Important files:

- [frontend/src/App.jsx](D:/lpg-agengt/frontend/src/App.jsx)
- [frontend/src/services/api.js](D:/lpg-agengt/frontend/src/services/api.js)
- [frontend/src/components](D:/lpg-agengt/frontend/src/components)

## Backend Responsibilities

The backend is responsible for:

- API routing
- user, booking, request, and store management
- admin access control
- chatbot orchestration and memory
- scheduled notifications
- JSON persistence

Important files:

- [backend/app.js](D:/lpg-agengt/backend/app.js)
- [backend/server.js](D:/lpg-agengt/backend/server.js)
- [backend/utils/accessControl.js](D:/lpg-agengt/backend/utils/accessControl.js)
- [backend/services/sessionService.js](D:/lpg-agengt/backend/services/sessionService.js)

## Service Layer

The backend uses a modular service layer so that business logic stays out of routes and controllers.

Main services:

- [backend/services/storeService.js](D:/lpg-agengt/backend/services/storeService.js)
- [backend/services/chatService.js](D:/lpg-agengt/backend/services/chatService.js)
- [backend/services/chatMemoryService.js](D:/lpg-agengt/backend/services/chatMemoryService.js)
- [backend/services/requestService.js](D:/lpg-agengt/backend/services/requestService.js)
- [backend/services/bookingService.js](D:/lpg-agengt/backend/services/bookingService.js)
- [backend/services/userService.js](D:/lpg-agengt/backend/services/userService.js)
- [backend/services/schedulerService.js](D:/lpg-agengt/backend/services/schedulerService.js)
- [backend/services/pdfImportService.js](D:/lpg-agengt/backend/services/pdfImportService.js)

## AI Layer

The AI functionality is intentionally constrained.

Flow:

1. preprocess user query
2. classify greeting vs LPG vs unrelated query
3. use Gemini for structured extraction when configured
4. apply backend validation and filtering as the final authority

This keeps the chatbot useful without allowing fake LPG results.

Important files:

- [backend/services/geminiService.js](D:/lpg-agengt/backend/services/geminiService.js)
- [backend/services/chatService.js](D:/lpg-agengt/backend/services/chatService.js)
- [backend/services/agents](D:/lpg-agengt/backend/services/agents)

## Data Storage

Data is stored in JSON files for simplicity and easy demo setup.

Tracked repository data:

- store dataset
- previous store snapshot
- empty runtime templates for users, requests, bookings, chat memory, and auth sessions

This design keeps the repository clean while still allowing the app to run immediately after cloning.

## Notification Flow

The scheduler checks store changes and pending requests on a timed interval.

Typical flow:

1. read current stores
2. compare with previous snapshot
3. detect restocks and availability changes
4. match requests and notification filters
5. send combined or targeted emails
6. save the next snapshot

## Admin Access

Admin access is enforced in the backend, not just hidden in the frontend.

The admin identity comes from:

- `ADMIN_EMAIL` when set
- otherwise `EMAIL_USER`

This allows private admin configuration without exposing personal emails in tracked code.

## Session Security

Protected backend routes now require a backend-issued session token instead of a raw email header.

Flow:

1. user registers or logs in through `POST /user/register`
2. backend creates a session record in [backend/data/authSessions.json](D:/lpg-agengt/backend/data/authSessions.json)
3. frontend stores the returned session token locally
4. protected routes use `Authorization: Bearer <token>`
5. admin access is derived from the session user email plus `ADMIN_EMAIL`

## Deployment Model

- Frontend hosted on Vercel
- Backend hosted on Render
- Frontend default API base points to the deployed Render backend
- local development can still override URLs with `.env` files
- Vercel route refreshes are handled by [frontend/vercel.json](D:/lpg-agengt/frontend/vercel.json)
