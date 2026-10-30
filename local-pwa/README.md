# ULTRON

**Study smarter. Go further.**

This is a mobile-first, offline-capable PWA. Its app files run from the device’s own loopback server and are not hosted on GitHub. Authentication is required before any protected screen or local workspace data is loaded. AI study prompts are sent only when the student taps **Ask ULTRON**; the ULTRON API does the model work so low-end phones do not run a local model. Tasks, notes, cards, and focus sessions remain on the device. No API key is included in this app.

## Run on this Windows device

1. Install Node.js 20 or later.
2. Double-click **Start ULTRON.bat**.
3. Keep the small window open. Your browser opens ULTRON at `http://127.0.0.1:8765`.
4. Choose **Install ULTRON on this device** in Profile or use the browser menu to install it. After the first load, the app shell is cached for offline use.

The local server listens only on `127.0.0.1`. It serves the files; tasks, cards, notes, focus sessions, streaks, and preferences are saved by the browser on that device in IndexedDB. If IndexedDB is unavailable, the app falls back to browser local storage.

To connect the existing ULTRON API, set its HTTPS base URL in the local server environment before launch. In Windows PowerShell, run `cd outputs/ultron-local`, `$env:ULTRON_API_BASE_URL="https://YOUR-ULTRON-API"`, then `node serve-local.mjs`. On Android Termux, run `export ULTRON_API_BASE_URL="https://YOUR-ULTRON-API"` before `node serve-local.mjs`. The local server injects this URL into the page and adds only that API origin to its Content Security Policy. The API must allow the app origin `http://127.0.0.1:8765` in CORS. Never place an API key in the app or this environment variable.

## Run on Android

1. Copy the `ultron-local` folder into the phone’s Downloads folder.
2. Install Termux, open it, then run `termux-setup-storage` and `pkg install nodejs-lts`.
3. Run `cd ~/storage/downloads/ultron-local` and then `node serve-local.mjs`.
4. Open Chrome on that phone and visit `http://127.0.0.1:8765`, then use **Add to Home Screen**.

The local app stays on the phone. Closing the local server stops serving uncached files; after installation, the service worker keeps the app shell available offline. Keep the Termux process running while using the app if the browser needs to reload files.

This is an installable PWA, not a compiled Android APK or iOS IPA. The current build environment has no Android or iOS packaging toolchain; the phone runs the PWA assets and stores its workspace locally.

## Available locally

- Seven bottom tabs: Home, Study, Focus, Tasks, Awards, Plans, Profile.
- Tasks with Today, Tomorrow, Upcoming, Completed, priority, deadlines, and local +10 XP.
- Manually created flashcards and quizzes from your own card deck.
- Homework photo preview, local concept maps, and a touch-friendly whiteboard.
- 15/25/45/60-minute focus timer, optional local completion chime, and revision notes.
- Streak calendar, badges, language selection, theme, IndexedDB storage, and JSON backup/restore.
- Subscription plan display and payment claims saved only as local drafts; payment is disabled until the server payment flow is configured. No plan is activated.

After server-confirmed phone sign-in, tasks, cards, notes, focus sessions, streaks, and preferences use the device’s IndexedDB. Logging out clears the in-memory token and locks the interface again. Passwords, OTPs, and access tokens are never written to IndexedDB.

## Waiting for your API

The existing ULTRON API provides server-side AI answers at `/ai/answer`, which the Study chat uses after a verified API session is available. The current backend supports email/password and Google sign-in, not the requested phone OTP flow; it will need a compatible OTP service before the app can unlock with phone verification. OCR, server-verified quotas/XP, payment review and activation, school portal moderation/chat, parent sync, media generation, and Spotify playback require additional API wiring. The API contract and setup notes are in [API handoff notes](API_HANDOFF.md).

The complimentary lifetime Pro grants and admin roles must be provisioned and enforced by the server. The browser never grants paid plans, admin permissions, XP authority, or cross-school access based on local data.
