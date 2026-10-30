# ULTRON

**Study smarter. Go further.**

This is a mobile-first, offline-capable PWA. Its app files run from the device’s own loopback server and are not hosted on GitHub. Authentication is required before any protected screen or local workspace data is loaded. The API URL is intentionally blank, so this copy remains on the sign-in screen and sends no OTP, Gemini, Spotify, payment, analytics, or other API requests. No API key is included.

## Run on this Windows device

1. Install Node.js 20 or later.
2. Double-click **Start ULTRON.bat**.
3. Keep the small window open. Your browser opens ULTRON at `http://127.0.0.1:8765`.
4. Choose **Install ULTRON on this device** in Profile or use the browser menu to install it. After the first load, the app shell is cached for offline use.

The local server listens only on `127.0.0.1`. It serves the files; tasks, cards, notes, focus sessions, streaks, and preferences are saved by the browser on that device in IndexedDB. If IndexedDB is unavailable, the app falls back to browser local storage.

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
- UPI plan details and payment claims saved only as local drafts; no plan is activated.

After server-confirmed phone sign-in, tasks, cards, notes, focus sessions, streaks, and preferences use the device’s IndexedDB. Logging out clears the in-memory token and locks the interface again. Passwords, OTPs, and access tokens are never written to IndexedDB.

## Waiting for your API

Phone OTP, account registration and sign-in, Gemini responses, OCR, server-verified quotas/XP, payment review and activation, school portal moderation/chat, parent sync, media generation, and Spotify playback require the API you will provide. These controls currently report that no request was sent. The API contract and seeding requirements are in [API handoff notes](API_HANDOFF.md).

The complimentary lifetime Pro grants and admin roles must be provisioned and enforced by the server. The browser never grants paid plans, admin permissions, XP authority, or cross-school access based on local data.
