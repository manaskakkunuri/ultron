# ULTRON

**Study smarter. Go further.**

ULTRON is a mobile-first, installable study PWA. Its app runs on the learner’s device and keeps tasks, notes, flashcards, and focus sessions in local browser storage. Low-end phones send AI requests to the existing ULTRON API; no model or API key runs in the app.

## Run locally

- **Windows:** install Node.js 20+, then run `local-pwa/Start ULTRON.bat`.
- **Android:** copy `local-pwa/` to the phone, start `node serve-local.mjs` in Termux, and open `http://127.0.0.1:8765`.
- Install the PWA from the browser menu to add it to the home screen.

See [the local PWA guide](local-pwa/README.md) for full setup and device details.

## Service setup

The app needs a compatible HTTPS ULTRON API for phone OTP authentication, AI answers, server-owned plans, payment review, and administrator access. The API base URL and SMS/payment services must be configured privately; no secret belongs in this repository. Until those services are configured, payments and protected server features remain unavailable.
