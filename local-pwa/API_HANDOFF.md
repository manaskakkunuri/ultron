# ULTRON API handoff notes

The local app is wired to the existing ULTRON API's server-side AI route. Never add provider keys to `index.html`, `app.js`, the manifest, a mobile package, or browser storage. Keep secrets and authority in the server environment. Rotate any credential that may have been disclosed.

Set `ULTRON_API_BASE_URL` in the environment before starting `serve-local.mjs`. The local server injects it into the `ultron-api-base-url` meta tag and adds only its origin to the CSP `connect-src`. Use the HTTPS origin of the existing ULTRON API and configure CORS for `http://127.0.0.1:8765` (and `http://localhost:8765` only if users launch that host). Never use a client API key.

## Low-end device path

- The browser submits only a student's explicit Study chat prompt to `POST /ai/answer`, with the authenticated bearer token and a small `{prompt, mode}` JSON body. The backend does model inference; the phone does not load a local model or send images for this feature.
- The existing backend returns `{answer, provider, elapsed_ms, usage}`. The client renders the text answer and does not retry automatically, limiting duplicate requests and surprise usage.
- Tasks, cards, notes, timer, whiteboard, and preferences remain local. The app automatically reduces blur, animation, shadow, and canvas pixel ratio on data-saver or lower-memory/CPU devices.
- The API base URL and token are never saved in IndexedDB. The base URL is injected at launch; the access token stays in memory.

## Identity and phone OTP

- Registration must validate full name, class, section, school/institution, date of birth, age, email, and password. Hash passwords with Argon2id or bcrypt; never store plaintext.
- Phone verification should issue and verify OTPs through the server. Use short expiry, resend throttling per phone and source address, attempt limits, one-time challenges, generic responses, and abuse monitoring. Do not log or persist plaintext codes.
- `POST /auth/phone/start` accepts an E.164 `phone_number` and `purpose` and returns a generic message plus `challenge_id` after server-side SMS dispatch.
- `POST /auth/phone/verify` accepts the phone, code, password, challenge ID, and purpose. Return an `access_token` and safe `user` object only after the code and credentials are verified.
- `POST /auth/register` accepts the required academic fields, email, password, phone, code, and challenge ID. Create the account only after phone verification and return a verified session only after all checks pass.
- The existing `manaskakkunuri.github.io` backend does **not** currently implement `/auth/phone/start`, `/auth/phone/verify`, or phone-based registration. Its `/auth/register` expects only email, display name, and password, and its `/auth/login` expects email and password. It also has `/auth/google`. Keep the app locked until the backend gains the requested phone OTP routes or the user explicitly changes the phone-OTP requirement; do not invent a client-side bypass.
- The client keeps every protected screen locked until it receives both `access_token` and `user`. No offline/demo bypass is included. Reload requires fresh sign-in until a secure session refresh endpoint is supplied.
- Use HTTPS, strict origin allowlists, short-lived access tokens, HTTP-only secure refresh cookies, refresh-token rotation, revocation, and rate limits. The app must not save passwords, OTPs, or refresh tokens locally.
- Server responses, not client profile fields, determine verified email, roles, school tenant, plan, quotas, XP, and complimentary access.

## Required seed and role rules

Provision the two Super Admin accounts and the complimentary Pro accounts listed in the owner's private deployment records with lifetime complimentary Pro access, `ACTIVE` status, `PRO` tier, unlimited chat and media quotas, and no billing prompts. Keep their email addresses in private server-side seed configuration; do not commit them to this repository.

Run the seed both for new account creation and existing-account migration. Admin access requires verified identity plus a separately provisioned Super Admin role; matching an email string alone must never authorize an admin endpoint. Keep the seed private and review changes to it.

## Plans and UPI

- Free: ₹0/month, 50 chats and 10 image uploads per month.
- Basic: ₹99 introductory month, then ₹199/month; 200 chats and 50 image uploads per month.
- Pro: ₹299 introductory month, then ₹399/month; unlimited chats and image uploads.
- Configure the merchant VPA in the approved payment configuration. The current app displays its configured VPA to students; keep this only if it is intended to be publicly visible.
- Save UTR submissions as `PENDING`. Never activate from a UTR alone. Require independent reconciliation, an authorized administrator, a review note, and an audit record. Notify Super Admin accounts using private server-side configuration.

## Service behavior

- Deduct Gemini usage only after a successful valid response. Keep Gemini API keys server-side.
- Keep OCR and media generation in server jobs with explicit queued/processing/completed/failed states. Provide progress polling or WebSocket notifications.
- Scope every portal, directory, message query, upload, and websocket subscription by the authenticated `school_id`. Reject tenant mismatches at the server.
- Spotify must use server-side OAuth authorization code and refresh handling. Missing credentials should leave the local timer usable and show a quiet fallback.
- Server owns XP totals, badge awards, streak validation, payment status, subscription expiry, and user roles. Local previews are not authoritative.

## Client data separation

The PWA keeps drafts, local flashcards, selected photos, whiteboard work, tasks, and preferences in device storage. Once a sync API is defined, sync only the intended user-owned fields and keep local drafts separate from server-approved plan, identity, and gamification state. School messages, parent diary data, and other shared records are server-owned and tenant-scoped.
