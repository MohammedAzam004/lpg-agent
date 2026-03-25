# AI-Powered LPG Smart Assistant

AI-Powered LPG Smart Assistant is a full-stack LPG availability platform built with React, Node.js, and Express. It helps users discover nearby LPG branches, compare price and availability, register with profile details, request alerts for out-of-stock branches, and receive automated email updates when stock changes.

## Overview

The project combines a conversational assistant, structured LPG branch data, scheduler-driven alerting, request tracking, and an admin dashboard. The chatbot uses a safe multi-layer pipeline: lightweight intent checks, Gemini-assisted query understanding when configured, short-term chat memory, and strict backend filtering against local JSON data.

## Features

- AI + rule-based chatbot for LPG availability, price, and recommendation queries
- Short-term chatbot memory for follow-up queries like "cheapest one" or "within 3 km"
- LPG branch tracking with state -> city -> store hierarchy
- Smart email notifications for stock recovery, periodic updates, request matches, price drops, and low stock
- User profile system with registration, simple login, address capture, and notification settings
- Out-of-stock request tracking and automated alert fulfillment
- Admin panel for store management, user management, request tracking, analytics, and AI agent overview
- Trend analytics for price and availability snapshots
- Voice input and multilingual UI support (English, Hindi, and Telugu)

## Tech Stack

- Frontend: React, Vite, Chart.js
- Backend: Node.js, Express
- AI: Google Gemini API
- Notifications: Nodemailer
- Scheduler: node-cron
- Data Storage: JSON files

## System Architecture

```text
Frontend (React UI)
    -> API layer (fetch)
    -> Express backend
        -> Chat services + agent orchestrator
        -> Chat memory service
        -> Store, user, request, booking services
        -> JSON data files
        -> Scheduler (node-cron)
        -> Email notifications (Nodemailer)
```

### Runtime Flow

1. The user interacts with the dashboard or chatbot in the frontend.
2. React sends requests to the Express backend on port `5001`.
3. Backend services read LPG branch data from JSON files and apply business rules.
4. The chatbot uses Gemini when configured, then validates everything against backend filters.
5. The scheduler checks stock, requests, price drops, and low-stock events on a timed interval.
6. Matching notifications are sent through Nodemailer or printed to the console when email is not configured.

## User Profile Model

Registered users are stored in `backend/data/users.json` with fields such as:

- `id`
- `name`
- `email`
- `phone`
- `address`
- `createdAt`
- `maxPrice`
- `maxDistance`
- `notificationsEnabled`
- `preferredLanguage`

## Folder Structure

```text
backend/
  controllers/
  data/
  routes/
  services/
  utils/
frontend/
  src/
    components/
    services/
    styles/
docs/
  screenshots/
```

## Setup Instructions

## Deployed URLs

- Frontend: `https://lpg-agent.vercel.app/`
- Backend: `https://lpg-agent.onrender.com`

### Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend default URL:

```text
https://lpg-agent.onrender.com
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend local dev URL:

```text
http://localhost:5173
```

## Environment Variables

Create a local `.env` file from `backend/.env.example` before running the backend.

Required backend variables:

```env
EMAIL_USER=your_email_here
EMAIL_PASS=your_app_password
GEMINI_API_KEY=your_api_key
```

Optional backend variables:

```env
PORT=5001
SCHEDULER_TEST_MODE=false
FRONTEND_URL=https://lpg-agent.vercel.app
EMAIL_TO=alerts@example.com
```

Scheduler behavior:

- Production mode runs every 1 hour
- Test mode runs every 30 seconds
- Toggle with `SCHEDULER_TEST_MODE`

Frontend variables:

```env
VITE_API_BASE_URL=https://lpg-agent.onrender.com
```

## Multi-language Support

This project supports:

- English
- Hindi
- Telugu

Language choice is stored in browser `localStorage`, and UI/chatbot text falls back to English if a translation key is missing.

## API Endpoints

### Store APIs

- `GET /stores`
- `GET /stores/available`
- `GET /stores/nearby?location=Mumbai`
- `GET /stores/recommend?location=Mumbai`
- `GET /stores/analytics`
- `POST /stores`
- `PUT /stores/:id`
- `DELETE /stores/:id`

### Chat API

- `GET /chat`
- `POST /chat`

### User APIs

- `POST /user/register`
- `GET /user/profile`
- `POST /user/preferences`
- `PUT /user/profile`

### Utility APIs

- `GET /`
- `GET /health`

### Request and Booking APIs

- `POST /request`
- `GET /request`
- `DELETE /request/:id`
- `POST /bookings`
- `GET /bookings`

### Admin APIs

- `GET /admin/users`
- `DELETE /admin/user/:id`
- `GET /admin/requests`
- `DELETE /admin/request/:id`
- `GET /admin/insights`

## Screenshots

Add UI screenshots to `docs/screenshots/` and reference them here, for example:

- `docs/screenshots/dashboard.png`
- `docs/screenshots/chatbot.png`
- `docs/screenshots/admin-panel.png`

## Highlights for Recruiters

- Modular service-oriented backend with clear routing/controller/service separation
- Safe AI integration with backend validation as the final authority
- Automated notification workflow with scheduler + request fulfillment
- Admin tooling for operational visibility and store management
- Frontend experience focused on usability, analytics, and conversational discovery

## Future Improvements

- Replace JSON storage with MongoDB or PostgreSQL
- Add authentication with JWT or OAuth
- Add role-based admin access
- Add test coverage with Jest and React Testing Library
- Add deployment configuration for Docker and cloud hosting
- Add real-time updates using WebSockets

## Notes

- Runtime `.env` files are intentionally ignored by Git.
- Sample user, request, booking, and chat-memory files are reset to clean arrays for safe sharing.
- If email credentials are missing, the backend falls back to console previews instead of crashing.
- Gemini remains optional at runtime; if `GEMINI_API_KEY` is missing, the chatbot falls back to rule-based filtering.
