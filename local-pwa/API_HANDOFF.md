# ULTRON API handoff notes

The local app is deliberately disconnected until the API is provided. A key was pasted into chat; treat it as exposed and rotate or revoke it before use. Do not add its replacement or any provider key to `index.html`, `app.js`, the manifest, a mobile package, or browser storage. Keep secrets and authority in the server environment.

The client expects its HTTPS API origin in the empty `ultron-api-base-url` meta tag. Configure strict CORS for the exact app origin. Add only that API origin to the local static server's `connect-src` policy; never use a client API key.

## Identity and phone OTP

- Registration must validate full name, class, section, school/institution, date of birth, age, email, and password. Hash passwords with Argon2id or bcrypt; never store plaintext.
- Phone verification should issue and verify OTPs through the server. Use short expiry, resend throttling per phone and source address, attempt limits, one-time challenges, generic responses, and abuse monitoring. Do not log or persist plaintext codes.
- `POST /auth/phone/start` accepts an E.164 `phone_number` and `purpose` and returns a generic message plus `challenge_id` after server-side SMS dispatch.
- `POST /auth/phone/verify` accepts the phone, code, password, challenge ID, and purpose. Return an `access_token` and safe `user` object only after the code and credentials are verified.
- `POST /auth/register` accepts the required academic fields, email, password, phone, code, and challenge ID. Create the account only after phone verification and return a verified session only after all checks pass.
- The client keeps every protected screen locked until it receives both `access_token` and `user`. No offline/demo bypass is included. Reload requires fresh sign-in until a secure session refresh endpoint is supplied.
- Use HTTPS, strict origin allowlists, short-lived access tokens, HTTP-only secure refresh cookies, refresh-token rotation, revocation, and rate limits. The app must not save passwords, OTPs, or refresh tokens locally.
- Server responses, not client profile fields, determine verified email, roles, school tenant, plan, quotas, XP, and complimentary access.

## Required seed and role rules

Provision these accounts with lifetime complimentary Pro access, `ACTIVE` status, `PRO` tier, unlimited chat and media quotas, and no billing prompts:

- `bharadwajashok289@gmail.com` — Super Admin
- `manaskakkunuri55@gmail.com` — Super Admin
- `pizzawasher70@gmail.com` — Complimentary Pro
- `sahasraaa02@gmail.com` — Complimentary Pro

Run the seed both for new account creation and existing-account migration. Admin access requires verified identity plus a separately provisioned Super Admin role; matching an email string alone must never authorize an admin endpoint.

## Plans and UPI

- Free: ₹0/month, 50 chats and 10 image uploads per month.
- Basic: ₹99 introductory month, then ₹199/month; 200 chats and 50 image uploads per month.
- Pro: ₹299 introductory month, then ₹399/month; unlimited chats and image uploads.
- Merchant VPA: `shreetulasi@oksbi`.
- Save UTR submissions as `PENDING`. Never activate from a UTR alone. Require independent reconciliation, an authorized administrator, a review note, and an audit record. Notify both Super Admin addresses on new claims.

## Service behavior

- Deduct Gemini usage only after a successful valid response. Keep Gemini API keys server-side.
- Keep OCR and media generation in server jobs with explicit queued/processing/completed/failed states. Provide progress polling or WebSocket notifications.
- Scope every portal, directory, message query, upload, and websocket subscription by the authenticated `school_id`. Reject tenant mismatches at the server.
- Spotify must use server-side OAuth authorization code and refresh handling. Missing credentials should leave the local timer usable and show a quiet fallback.
- Server owns XP totals, badge awards, streak validation, payment status, subscription expiry, and user roles. Local previews are not authoritative.

## Client data separation

The PWA keeps drafts, local flashcards, selected photos, whiteboard work, tasks, and preferences in device storage. Once a sync API is defined, sync only the intended user-owned fields and keep local drafts separate from server-approved plan, identity, and gamification state. School messages, parent diary data, and other shared records are server-owned and tenant-scoped.
