# LifeDesk — Complete Starter Kit

A local-first personal command-center prototype built with React + Vite. It is designed to be beginner-friendly and free to run locally.

## Included features
- Dashboard with overview stats and quick task capture
- Tasks: add, complete, search, delete, clear completed
- Notes: create and delete notes
- Reminders with date/time and browser notifications while the app is open
- Browser voice input (where supported) and spoken responses
- Free-first local rule-based assistant that can summarize your LifeDesk data
- Gmail read-only integration using Google OAuth and Gmail API
- Google Calendar read-only integration for the next 14 days
- WhatsApp exported `.txt` import and text search (not a live WhatsApp connection)
- Settings and local data reset
- Responsive dark UI

## Requirements
- Node.js 20 or newer recommended
- Internet connection for installing packages and Google sign-in library
- Google account only if you want Gmail/Calendar integrations

## Run on Windows
1. Extract this ZIP.
2. Open the extracted `lifedesk-complete-kit` folder in VS Code.
3. In VS Code, choose **Terminal → New Terminal**.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open the local URL printed by Vite, usually `http://localhost:5173`.
6. Keep the terminal open while using the app. Stop it with `Ctrl+C`.

## Set up Gmail and Google Calendar
These are optional. The rest of the app works without them.

1. Open https://console.cloud.google.com/ and create/select a Google Cloud project.
2. Enable **Gmail API** and **Google Calendar API**.
3. Configure the OAuth consent screen. Add your own account as a test user if the app is in testing mode.
4. Create an OAuth Client ID of type **Web application**.
5. Add `http://localhost:5173` under **Authorized JavaScript origins**.
6. Copy the OAuth Client ID (ends in `.apps.googleusercontent.com`) into LifeDesk → Settings. Never paste a client secret into this frontend.
7. Open Gmail or Calendar and click **Connect / refresh**. Approve the read-only scopes in Google's consent window.

This frontend uses Google Identity Services to request browser access tokens and calls Google APIs directly. It does not store a client secret. Access tokens are held in memory for the current page session. Google OAuth setup/verification requirements may vary by account and consent-screen configuration.

## WhatsApp import
In WhatsApp, open a chat → menu → More → Export chat → Without media. Choose the `.txt` export in LifeDesk → WhatsApp Import. The app reads the text file in your browser. It does not log into WhatsApp, sync new messages, or import media.

## Important limits — please read
- This is a complete runnable **starter/prototype**, not a production-ready autonomous assistant.
- Tasks, notes, reminders, imported WhatsApp text, and app settings are stored in the browser's localStorage on this device/browser. They do not sync to another device. Clearing browser site data can delete them.
- The assistant is local rule-based logic, not a large language model. It does not send data to an AI provider. A secure backend would be needed to add a hosted AI provider safely.
- Browser speech recognition availability varies by browser and may use the browser provider's speech service. Spoken replies use the browser's speech synthesis.
- Notifications are checked while the app is open. Reliable notifications while the browser is closed require a service worker plus a push service/backend.
- Gmail and Calendar permissions are read-only. This app does not send, delete, or modify emails/events.
- Do not use this prototype on a shared computer with personal data. Use Settings → Delete local LifeDesk data when appropriate. To revoke Google permissions, use your Google Account security settings.
- This starter has no backend, cloud sync, account login, encryption layer, or production security review.

## Build for production
```bash
npm run build
npm run preview
```

Production deployment requires configuring the OAuth authorized origins/redirect settings for the deployed domain and reviewing privacy/security requirements first.
