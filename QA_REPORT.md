# WASSILHA QA / Completion Notes

This package was completed from the uploaded ZIP as the source of truth; the existing React + FastAPI architecture was retained.

## Implemented/refined
- Canonical identity: WASSILHA / وسيلة; incorrect Arabic variants removed from project text.
- Email-or-phone registration/login, phone validation, unique phone index, bcrypt password hashing retained.
- Shorter-lived access token (30 min) with 14-day refresh token; httpOnly/secure cookies retained.
- Per-user ownership checks retained across business collections.
- Personal AI provider API key storage is application-encrypted with Fernet; raw key is never returned by settings endpoints.
- Real AI provider connection test endpoints for OpenAI, Anthropic, and Gemini.
- Official key-generation links in Settings.
- Leaflet map switched to direct OpenStreetMap tiles; GPS and draggable marker remain supported in LocationPicker.
- Quick contact actions: call, message/WhatsApp, and video/media navigation on customer views and conversation header.
- Global developer contact launcher for email and WhatsApp.
- Science/Math calculator retained and expanded with categorized tap-to-insert symbol palette.
- Premium dark/light visual polish and animated logo gleam treatment.
- Developer About information includes Nidal Watfa, email, WhatsApp and ORCID.

## Verification performed in this build environment
- Python backend `compileall`: PASS.
- JavaScript/JSX parsing with the installed TypeScript parser: PASS; 0 JSX parse errors.
- JSON validation for package/config files: PASS.
- Project-wide scan for forbidden Arabic name variants: PASS.

## Environment limitation
The execution environment did not contain Yarn or the frontend dependencies. Two attempts to install dependencies with npm exceeded the environment timeout, so a production React bundle and live browser click-through could not be honestly claimed as verified here. The existing backend integration test suite also targets an external preview host that was not DNS-resolvable from this environment, and the local environment lacked Motor.

Before public deployment, run the project's normal frontend install/build and browser E2E walkthrough in the deployment environment, including map tiles/GPS, microphone, uploads, auth round-trip, AI provider test, and console-error check.

## Deployment security requirement
Set `DATA_ENCRYPTION_KEY` to a persistent Fernet key in production. Use HTTPS-only origins in `CORS_ORIGINS` and a MongoDB deployment with encryption at rest enabled.
