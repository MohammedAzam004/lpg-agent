# AI-Powered LPG Smart Assistant

AI-Powered LPG Smart Assistant is a full-stack LPG availability platform built with React, Node.js, Express, and Firebase Authentication. It helps users discover LPG branches, compare prices, chat with an AI assistant, request alerts for out-of-stock stores, receive scheduled email updates, and manage operations through a dedicated admin workspace.

## Live Deployment

- Frontend: [https://lpg-agent.vercel.app/](https://lpg-agent.vercel.app/)
- Backend: [https://lpg-agent.onrender.com](https://lpg-agent.onrender.com)

## Overview

The project combines:

- an AI-assisted LPG chatbot with safe backend filtering
- store tracking with price, stock, availability, and location data
- scheduled email notifications and request fulfillment
- a simple user profile and notification settings flow
- an admin portal for store, user, and request management

The chatbot does not invent LPG stores. All results are filtered against the real JSON store dataset in the backend.

## Core Features

- LPG chatbot with Gemini-assisted query understanding and safe rule-based fallback
- short-term chatbot memory for follow-up questions like `cheapest one`
- Firebase Authentication with Email/Password and Google sign-in
- 6-digit email OTP verification for email/password sign-in before protected access
- LPG store search by city, state, price, distance, and availability
- best-store recommendation with explanation
- out-of-stock request tracking and stock-available email alerts
- notification preferences with max price and max distance filters
- booking and request history tracking
- admin portal with store management, user management, request tracking, and AI insights
- multilingual UI support: English, Hindi, Telugu
- voice input support in the frontend
- Google Maps redirect from store cards
- PDF import support for LPG store data

## Tech Stack

- Frontend: React, Vite, Chart.js, Firebase Web SDK
- Backend: Node.js, Express
- Scheduler: node-cron
- Email: Nodemailer
- AI: Google Gemini API
- Authentication: Firebase Authentication + Firebase Admin
- Storage: JSON files

## System Architecture

```text
React frontend
  -> API service layer
  -> Firebase Authentication
  -> Express backend
      -> Firebase token verification middleware
      -> OTP verification service
      -> Controllers
      -> Services
          -> Chat service
          -> Chat memory service
          -> Store service
          -> Request / booking / user services
          -> Admin insights agent
      -> JSON data files
      -> Scheduler
      -> Nodemailer email system
```

## Main Functional Areas

### 1. Chatbot

The chatbot uses a multi-layer pipeline:

1. preprocess the message
2. detect greeting, LPG query, or unrelated query
3. ask Gemini for structured intent when configured
4. apply strict backend filtering as the final authority
5. store short-term conversation memory per user or session

Supported examples:

- `available LPG in Hyderabad`
- `out of stock LPG in Mumbai`
- `gas under 900 within 3 km`
- `cheapest one`

### 2. User Profile

Users authenticate through Firebase using email/password or Google sign-in. Email/password sign-in is followed by a 6-digit OTP email verification step before protected routes are unlocked.

Each synced profile stores:

- `id`
- `name`
- `email`
- `phone`
- `address`
- `firebaseUid`
- `authProvider`
- `emailVerified`
- `createdAt`
- `lastLoginAt`
- `maxPrice`
- `maxDistance`
- `notificationsEnabled`
- `preferredLanguage`
- `latitude`
- `longitude`
- `role`
- `isAdmin`

### 3. Notifications

The scheduler runs every 2 hours in production and checks:

- restocked LPG branches
- request matches
- targeted stock alerts
- periodic user digest emails

Alerts respect user filters such as max price and max distance.

### 4. Admin Workspace

Admin users can:

- view all users
- delete users
- view all requests
- delete requests
- create, edit, and delete stores
- import store data from PDF
- review analytics and AI agent insights

Admin access is controlled on the backend. The admin email is configured through environment variables, not hardcoded personal data.

## Folder Structure

```text
backend/
  controllers/
  data/
  routes/
  scripts/
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

## Important Data Files

- Stores: [backend/data/stores.json](D:/lpg-agengt/backend/data/stores.json)
- Previous store snapshot: [backend/data/previousStores.json](D:/lpg-agengt/backend/data/previousStores.json)
- Users: [backend/data/users.json](D:/lpg-agengt/backend/data/users.json)
- Requests: [backend/data/requests.json](D:/lpg-agengt/backend/data/requests.json)
- Bookings: [backend/data/bookings.json](D:/lpg-agengt/backend/data/bookings.json)
- Chat memory: [backend/data/chatMemory.json](D:/lpg-agengt/backend/data/chatMemory.json)

For GitHub privacy and cleanliness:

- `stores.json` and `previousStores.json` contain shareable LPG dataset content
- `users.json`, `requests.json`, `bookings.json`, and `chatMemory.json` are intentionally reset to empty arrays in the repository

## API Summary

### Public and User APIs

- `GET /`
- `GET /health`
- `GET /auth/session`
- `POST /auth/sync-user`
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `GET /stores`
- `GET /stores/available`
- `GET /stores/nearby`
- `GET /stores/recommend`
- `GET /stores/analytics`
- `GET /chat`
- `POST /chat`
- `POST /user/register`
- `GET /user/profile`
- `POST /user/preferences`
- `PUT /user/profile`
- `GET /request`
- `POST /request`
- `DELETE /request/:id`
- `GET /bookings`
- `POST /bookings`

### Admin APIs

- `GET /admin/users`
- `DELETE /admin/user/:id`
- `GET /admin/requests`
- `DELETE /admin/request/:id`
- `GET /admin/insights`
- `POST /stores`
- `PUT /stores/:id`
- `DELETE /stores/:id`
- `POST /stores/import/pdf`

## Environment Variables

Create local `.env` files from the provided example files before running locally.

### Backend

Use [backend/.env.example](D:/lpg-agengt/backend/.env.example)

```env
PORT=5001
SCHEDULER_TEST_MODE=false
FRONTEND_URL=https://lpg-agent.vercel.app
ADMIN_EMAIL=admin@example.com
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_admin_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
EMAIL_USER=your_email_here
EMAIL_PASS=your_app_password
EMAIL_TO=alerts@example.com
GEMINI_API_KEY=your_gemini_api_key
```

### Frontend

Use [frontend/.env.example](D:/lpg-agengt/frontend/.env.example)

```env
VITE_API_BASE_URL=https://lpg-agent.onrender.com
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

## Local Development

### Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend local URL:

```text
http://localhost:5001
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend local URL:

```text
http://localhost:5173
```

## Production Notes

- The frontend is configured to use the deployed Render backend by default.
- Local development can override the backend URL through `VITE_API_BASE_URL`.
- Runtime `.env` files are ignored by Git.
- Real email delivery requires valid Gmail SMTP credentials.
- If Gemini is not configured, the chatbot falls back to backend parsing rules.

## Security and Privacy Notes

- API keys and email credentials are not stored in tracked source files.
- Admin access is not hardcoded to a private email inside the frontend anymore.
- Runtime user data is not shipped in the repo.
- Local runtime files remain private through `.gitignore`.

## Screenshots

Place product screenshots inside [docs/screenshots](D:/lpg-agengt/docs/screenshots) and link them here.

Suggested screenshots:

- dashboard
- chatbot
- admin portal
- request tracking
- analytics panel

## Future Improvements

- replace JSON storage with MongoDB or PostgreSQL
- add proper auth with JWT or OAuth
- add automated test coverage
- add Docker deployment
- add real-time updates with WebSockets
- add audit logs for admin actions

## Recruiter Highlights

- full-stack architecture with clear frontend/backend separation
- modular service-oriented backend design
- safe AI integration with backend validation
- admin operations tooling, analytics, and notification workflows
- multilingual, user-facing product experience
