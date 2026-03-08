# 🚀 Pump - Web Automation & API Capture Tool

**Pump** is a local web automation tool designed for testing, exploration, and archival of your own websites. It combines Playwright browser automation with intelligent API response capture and filtering.

## Features

✅ **Configuration-Based Automation** - All settings via UI, no hardcoded values  
✅ **Flexible Login Support** - Simple login, multi-step, and OTP/2FA ready  
✅ **Persistent Session Reuse** - Reuse Playwright storage state across runs when the site allows it  
✅ **Targeted Horizontal Scrolling** - Scroll specific CSS-selected zones  
✅ **Network Capture** - Intercept and monitor all API calls during session  
✅ **Smart Response Filtering** - Define inclusive/exclusive rules for captured responses  
✅ **Session Export** - Organized JSON exports with metadata and optional HAR  
✅ **Real-time Logs** - Live streaming of session execution via SSE  
✅ **Modern UI** - Built with React + Tailwind CSS  

## Architecture

```
pump/
├── backend/              # Node.js + Express API
│   └── src/
│       ├── config/      # Configuration management
│       ├── playwright/  # Browser automation
│       ├── network/     # API capture & filtering
│       ├── export/      # Session export logic
│       └── routes/      # REST API endpoints
│
├── frontend/            # React + Vite UI
│   └── src/
│       ├── pages/       # ConfigPage, SessionPage
│       ├── components/  # UI components
│       ├── api/         # API client
│       ├── hooks/       # React hooks
│       ├── store/       # State management (Zustand)
│       └── styles/      # Tailwind CSS
│
└── data/               # Local storage
    ├── configs/        # Saved configurations
    └── sessions/       # Session results
```

## Getting Started

### Prerequisites

- Node.js >= 16
- macOS, Linux, or Windows

### Installation

```bash
# Clone or navigate to project
cd pump

# Install all dependencies (monorepo)
npm run install-all

# Equivalent:
npm install
```

### Development

```bash
# Start backend + frontend from root
npm run dev
```

Optional (separate terminals):
```bash
npm run dev:backend
npm run dev:frontend
```

- Frontend: http://localhost:5174
- Backend: http://localhost:3000 (or another port if 3000 is busy; you can set PORT environment variable)

These defaults are meant to coexist with the `contrats` repo without changing ports.

### API Security

To protect all `/api/*` routes in production, define:

```bash
export PUMP_API_KEY="replace-with-a-long-random-secret"
```

The frontend includes an API key field and stores the key only in the current browser.

Optional, if automated refresh needs to log in again:

```bash
export PUMP_SESSION_PASSWORD="your-login-password"
```

Recommended for server and container deployments:

```bash
export PLAYWRIGHT_HEADLESS="true"
```

If no X server / Wayland display is available, the backend now forces Playwright to run headless automatically.

Optional path overrides:

```bash
export DATA_DIR="./data"
export FRONTEND_DIST_DIR="./frontend/dist"
export FRONTEND_URL="http://localhost:5174"
```

### Production Build

```bash
npm run build
npm run lint
npm start
```

Builds the frontend, then starts the backend on port 3000 and serves the built UI from Express.

### Deployment Checklist

Before exposing the app outside localhost:

1. Define `PUMP_API_KEY` with a long random secret.
2. Set `FRONTEND_URL` to the real frontend origin allowed by CORS.
3. Set `PLAYWRIGHT_HEADLESS=true` on servers and containers.
4. If needed, set `PLAYWRIGHT_DISABLE_SANDBOX=true` for restricted container runtimes.
5. Ensure `DATA_DIR` points to a persistent writable directory.
6. Run `npm ci`.
7. Run `npm run lint`.
8. Run `npm run build`.
9. Start the app with `npm start`.
10. Verify the smoke tests below before opening network access.

### Production Smoke Tests

Without API key:

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/config
```

Expected:
- `/` returns `200`
- `/health` returns `200`
- `/api/config` returns `401` when `PUMP_API_KEY` is configured

With API key:

```bash
curl -i http://localhost:3000/api/config \
  -H "x-api-key: $PUMP_API_KEY"

curl -i http://localhost:3000/api/results/sessions \
  -H "x-api-key: $PUMP_API_KEY"
```

Expected:
- authenticated API routes return `200`
- the UI loads and can fetch config after entering the API key in the browser

---

## Usage Guide

### 1. Configure Your Session

Fill in the main configuration form:

- **Website URL** - Starting URL to navigate to
- **Username / Email** - Login credential
- **Password** - Entered at session start (not saved)
- **Scroll Zone Selector** - CSS selector for the horizontal scrolling element
- **Scroll Parameters** - Count, distance, delays
- **Output Folder** - Where to save session results

### 2. Test Connection (Optional)

Click **🔗 Test Connection** to verify:
- URL is reachable
- Login process works
- No credentials are saved

### 3. Test Scroll Zone (Optional)

Click **↔️ Test Scroll Zone** to verify:
- Element exists in the DOM
- Element is horizontally scrollable

### 4. Configure Filters (Optional)

Define which API responses to keep:

- **Inclusive Rules** - Keep responses matching these patterns
- **Exclusive Rules** - Skip responses matching these patterns
- **Quick Presets** - Pre-built filter combinations

Examples:
- Keep only JSON responses: `Content Type = application/json`
- Keep only `/api/` calls: `URL contains = /api/`
- Exclude analytics: `Exclude tracking`

### 5. Launch Session

Click **🚀 Launch Session**:

1. Enter password (in-memory only, never saved)
2. Session starts in background
3. Watch live logs stream in real-time
4. Session completes automatically

### 6. Review Results

After session completes:

- View captured API count
- View the extracted reservation list in manual mode
- Click responses to see details
- Check filter explanations for each response
- Open results folder

### External Consumer Route

Once a session has finished, another local app can read the latest extracted reservations from:

```bash
GET /api/reservations/latest
```

All `/api/reservations/*` endpoints require either:

- `x-api-key: <PUMP_API_KEY>`
- or `Authorization: Bearer <PUMP_API_KEY>`

Recommended flow for another app:

```bash
POST /api/reservations/refresh
GET /api/reservations/status
GET /api/reservations/latest
```

Example `curl` commands:

```bash
curl -X POST http://localhost:3000/api/reservations/refresh \
  -H "x-api-key: $PUMP_API_KEY"

curl http://localhost:3000/api/reservations/status \
  -H "x-api-key: $PUMP_API_KEY"

curl http://localhost:3000/api/reservations/latest \
  -H "x-api-key: $PUMP_API_KEY"
```

`POST /api/reservations/refresh` starts a new background capture using the saved Pump config.

`GET /api/reservations/status` returns the latest refresh state (`idle`, `starting`, `running`, `completed`, `failed`, `stopped`).

Example response:

```json
{
  "sessionId": "session_20260306_145230_abc123",
  "status": "completed",
  "updatedAt": "2026-03-06T14:52:30Z",
  "reservationCount": 14,
  "stats": {
    "inspectedResponses": 26,
    "matchedResponses": 9
  },
  "reservations": [
    {
      "confirmationCode": "HM53BQHRER",
      "guestName": "Anne Le Brigant",
      "listingName": "Gîte de la Grée, charme en Brocéliande",
      "checkIn": "2026-03-11",
      "checkOut": "2026-03-13",
      "payoutFormatted": "116,61 €"
    }
  ]
}
```

---

## Advanced Settings

Toggle **⚙️ Advanced Settings** to customize:

- **Login Strategy** - Simple or multi-step
- **Has OTP/2FA** - Enable OTP support
- **Reuse Persisted Session** - Save and reload cookies/local storage across runs
- **Custom CSS Selectors** - Username, password, submit button fields

---

## Filter Rules Reference

### Rule Types

| Type | Description | Example |
|------|-------------|---------|
| `url-contains` | URL includes pattern | `/api/` |
| `url-starts-with` | URL begins with pattern | `https://api.example.com` |
| `method` | HTTP method | `POST`, `GET` |
| `content-type` | Response Content-Type | `application/json` |
| `status-code` | HTTP status code | `200`, `404` |
| `status-range` | Status code range | `200-299` |
| `response-contains` | Response body includes | `"data"` |
| `json-only` | Response is JSON | (no pattern needed) |
| `exclude-assets` | Exclude images, CSS, fonts | (no pattern needed) |
| `exclude-tracking` | Exclude analytics | (no pattern needed) |

### Quick Presets

- **JSON + No Analytics** - Keep JSON responses, skip tracking
- **/api/ Only** - Keep only requests to `/api/` endpoints

---

## Session Output Structure

```
pump_sessions/session_20260306_145230_abc123/
├── metadata.json              # Response metadata & index
├── session_summary.json       # Session statistics & summary
├── session.har               # HAR file (if enabled)
├── responses/                # Individual response JSON files
│   ├── 0001_get_api_users.json
│   ├── 0002_post_api_search.json
│   └── ...
└── logs/
    └── responses.log         # Text log of all responses
```

### metadata.json

```json
{
  "sessionId": "session_20260306_145230_abc123",
  "timestamp": "2026-03-06T14:52:30Z",
  "config": {
    "baseUrl": "https://example.com",
    "scrollSelector": ".carousel"
  },
  "responses": [
    {
      "index": 0,
      "url": "https://example.com/api/users",
      "method": "GET",
      "status": 200,
      "contentType": "application/json",
      "context": "during-scroll",
      "timestamp": "2026-03-06T14:52:35Z",
      "filterExplanation": "Matched 1 inclusive rule(s)"
    }
  ],
  "totalCaptured": 42
}
```

### Individual Response File

```json
{
  "url": "https://example.com/api/users",
  "method": "GET",
  "status": 200,
  "headers": { "content-type": "application/json", ... },
  "requestHeaders": { "accept": "application/json", ... },
  "contentType": "application/json",
  "body": { "data": [...] },
  "timestamp": "2026-03-06T14:52:35Z",
  "context": "during-scroll",
  "filterExplanation": "Matched 1 inclusive rule(s)"
}
```

---

## Configuration Persistence

### Auto-Save

Configuration is automatically saved to:

```
data/configs/last.json
```

Loaded on app startup.

### Manual Save

Click **💾 Save Configuration** to explicitly save current settings.

### Sensitive Data

- **Passwords** - **Never stored**. Entered at session start, kept in memory only.
- **Persisted Sessions** - Saved locally as Playwright storage state when enabled.
- **Tokens** - Not captured or stored by default.
- **Logs** - Passwords and sensitive data are scrubbed from logs.

---

## Security Considerations

⚠️ **Important**: This tool is meant for local development and testing of **your own websites** only.

### What's Protected

✅ Passwords are **in-memory only**, never persisted  
✅ Configuration excludes sensitive fields  
✅ Logs automatically scrub secrets  
✅ Output folder is local (configurable)  

### What's Not Protected

⚠️ Network traffic between browser and pages is unencrypted (use HTTPS)  
⚠️ API responses are stored locally as-is  
⚠️ Output folder should be kept private  

### Best Practices

1. **Use HTTPS** for all target sites
2. **Don't commit** `data/` folder to version control
3. **Keep output folder** in a private location
4. **Use throwaway credentials** if possible
5. **Review captured responses** before sharing

---

## Limitations & Known Issues

### Current Limitations

- ❌ **No automatic OTP retrieval** - Must be entered manually or pre-configured
- ❌ **No JavaScript execution breakpoints** - Script runs continuously
- ❌ **No screenshot capture** - (Planned for v1.1)
- ❌ **Single login strategy** - Execute only one path per session
- ❌ **No multi-tab support** - Single page context

### Planned Features (v1.1+)

- 📸 Screenshot capture (start/end of session)
- 💾 Multiple saved profiles
- 🔄 Session replay/relaunching
- 📝 Manual API response annotation
- 🎥 Video recording of session
- 🤖 JavaScript execution hooks

---

## Troubleshooting

### Session Fails to Start

**Problem**: "Failed to start session" error

**Solutions**:
1. Verify URL is correct and reachable
2. Test connection first: **🔗 Test Connection**
3. Check browser console for errors
4. Ensure CSS selector is correct in advanced settings
5. On Linux servers without `DISPLAY`/`WAYLAND_DISPLAY`, Playwright is forced to headless mode automatically

### Elements Not Found

**Problem**: "Element not found" for scroll zone

**Solutions**:
1. Click **↔️ Test Scroll Zone** to diagnose
2. Verify CSS selector in browser DevTools
3. Wait time may need to be increased
4. Element may require page scroll first

### No Responses Captured

**Problem**: "0 responses captured"

**Solutions**:
1. Check filter rules - may be too restrictive
2. Network tab in browser DevTools should show requests
3. HAR export may fail silently; check logs
4. API may not be called during scroll

### Login Doesn't Work

**Problem**: Session fails at login step

**Solutions**:
1. **Test Connection** to isolate login issue
2. Verify credentials are correct
3. Check if site has OTP enabled (configure in Advanced Settings)
4. Try different CSS selectors in Advanced Settings
5. Some sites may require additional delays

---

## API Documentation

### Configuration API

```
GET /api/config                    # Get current config
POST /api/config/save              # Save/update config
POST /api/config/validate          # Validate config
```

### Session API

```
POST /api/session/start             # Start new session
POST /api/session/test-connection   # Test login
POST /api/session/test-scroll-target # Test scroll zone
GET /api/session/:id/status         # Get session status
POST /api/session/:id/stop          # Stop session
```

### Results API

```
GET /api/results/sessions           # List recent sessions
GET /api/results/:id/metadata       # Get session metadata
GET /api/results/:id/summary        # Get session summary
GET /api/results/:id/responses/:fn  # Get specific response
```

### Logs API

```
GET /api/logs/stream                # SSE stream of logs
```

---

## Development

### Project Structure

- **Backend** - Pure Node.js, no build step (ESM modules)
- **Frontend** - Vite + React, fast HMR during development

### Adding New Filter Rules

Edit [`backend/src/network/filter.js`](backend/src/network/filter.js):

```javascript
// Add new case in evaluateRule()
case 'my-custom-rule':
  result = myCustomLogic(request, response, pattern);
  break;
```

### Extending UI

Components live in [`frontend/src/components/`](frontend/src/components/).

State management: [`frontend/src/store/store.js`](frontend/src/store/store.js) (Zustand simple store)

### Adding New Login Strategy

Edit [`backend/src/playwright/connection.js`](backend/src/playwright/connection.js):

```javascript
// Add new strategy function
async function performXXXLogin(page, config) {
  // Implementation
}

// Update attemptLogin() to call it
```

---

## Environment Variables

Create `.env` in `backend/` (optional):

```
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174
PUMP_API_KEY=replace-with-a-long-random-secret
# only needed if the persisted Airbnb session expires
PUMP_SESSION_PASSWORD=
DATA_DIR=./data
```

---

## License

Personal use only. Not for distribution.

---

## Questions or Issues?

1. Check [Troubleshooting](#troubleshooting) section
2. Review logs in browser DevTools (F12)
3. Check backend logs (terminal where server runs)
4. Verify website structure matches your CSS selectors

---

**Version**: 1.0.0  
**Last Updated**: March 6, 2026  
**Status**: Stable
