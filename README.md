# WASSILHA — Business Management Platform

**WASSILHA** (وسيلة) is a modern, bilingual (Arabic RTL / English LTR) business management platform for small and medium businesses, shops, freelancers, contractors and service providers.

> Simple, intelligent business management — Customers → Products/Services → Quotes → Orders → Invoices → Payments → Tasks → Communication → Insights.

Developer: **Nidal Watfa** · nidalwatfa99@gmail.com · 00963998854450

---

## Features

- **Dashboard** — sales overview, outstanding payments, open orders, recent activity, upcoming tasks, quick actions, AI shortcut.
- **Customers** — full CRUD, search, activity history (orders/quotes/invoices/payments), map coordinates.
- **Products & Services** — supports both physical products and services.
- **Quotes → Orders → Invoices → Payments** — one-click quote-to-order and order-to-invoice conversion; payments auto-update invoice status (partially paid / paid).
- **Tasks** — priorities, statuses, due dates, quick complete.
- **Calendar** — month view with events and task due-dates.
- **Inbox** — lightweight business conversations.
- **Map** — interactive Leaflet / OpenStreetMap with theme-aware tiles and customer markers.
- **Insights** — top products and top customers, sales analytics.
- **Scientific Calculator** — fully local (no network / no AI), with history.
- **AI Assistant** — professional business assistant (Grok/OpenAI/Anthropic/Gemini via a replaceable server-side provider). Answers from real data, never fabricates, and proposes confirmable actions. The app works fully even if AI is unavailable.
- **Settings** — business info, multi-currency, Light/Dark/System theme, language, AI provider/model, data export/import.
- **Bilingual** — automatic device-language detection, Modern Standard Arabic, full RTL/LTR.
- **Security** — JWT auth via httpOnly cookies, per-owner data isolation, input validation, AI rate limiting, no secrets in the frontend.

## Tech Stack

- **Frontend:** React 19, React Router, Tailwind CSS, shadcn/ui, Recharts, Leaflet, next-themes.
- **Backend:** FastAPI, Motor (MongoDB), PyJWT, bcrypt, emergentintegrations (LLM).
- **Database:** MongoDB.

## Project Structure

```
/app
├── backend/            # FastAPI app
│   ├── server.py       # main API (all business modules)
│   ├── auth.py         # JWT auth (login/register/me/logout/refresh)
│   ├── ai_service.py   # replaceable LLM provider
│   ├── database.py     # Mongo client
│   ├── requirements.txt
│   └── .env.example
└── frontend/           # React app
    ├── src/
    │   ├── pages/       # all screens
    │   ├── components/  # Layout, Calculator, AIAssistant, DocumentEditor, common
    │   ├── context/     # AppContext (auth, language, settings)
    │   ├── i18n/        # en/ar translations
    │   └── lib/         # api client, formatters
    └── .env.example
```

## Getting Started

### Backend
```bash
cd backend
cp .env.example .env          # fill in JWT_SECRET, admin creds, EMERGENT_LLM_KEY
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
cp .env.example .env          # set REACT_APP_BACKEND_URL
yarn install
yarn start
```

An admin/owner account is auto-seeded on first backend start from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, with demo data.

## API Overview

All routes are prefixed with `/api`. Auth uses httpOnly cookies (with Bearer fallback).

- `POST /api/auth/register|login|logout|refresh`, `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/customers|products|tasks|events`
- `GET/POST/PUT/DELETE /api/quotes|orders|invoices` (+ `PATCH /{id}/status`)
- `POST /api/quotes/{id}/convert`, `POST /api/orders/{id}/invoice`
- `GET/POST/DELETE /api/payments`
- `GET/POST /api/conversations`, `POST /api/conversations/{id}/messages`
- `GET /api/dashboard`, `GET /api/insights`, `GET/PUT /api/settings`
- `POST /api/ai/chat`, `GET /api/ai/status`
- `GET /api/export`, `POST /api/import`, `POST /api/feedback`

## License

© WASSILHA — Nidal Watfa.
