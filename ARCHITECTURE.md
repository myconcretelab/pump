# Pump Architecture Documentation

## Overview

Pump is built as a Node.js + React monorepo with clear separation of concerns:

- **Backend**: Express API server with Playwright automation
- **Frontend**: React SPA with real-time log streaming
- **Data**: Local file-based persistence

---

## Backend Architecture

### Directory Structure

```
backend/src/
├── index.js                    # Express app setup, routes mounting
├── logger.js                   # Unified logging system
├── config/
│   ├── configManager.js        # Load/save configuration
│   └── validation.js           # Config validation
├── playwright/
│   ├── session.js              # PlaywrightSession class (main orchestrator)
│   ├── connection.js           # Login strategies
│   ├── scrolling.js            # Scroll strategies
│   └── utils.js                # Playwright helpers
├── network/
│   ├── capture.js              # NetworkCapture class
│   ├── filter.js               # Response filter engine
│   └── har.js                  # HAR export format
├── export/
│   ├── saver.js                # SessionSaver class (file I/O)
│   ├── naming.js               # Stable filename generation
│   └── summary.js              # Session statistics
└── routes/
    ├── config.js               # /api/config
    ├── session.js              # /api/session
    ├── results.js              # /api/results
    └── logs.js                 # /api/logs (SSE stream)
```

### Core Classes

#### PlaywrightSession

Orchestrates automation workflow:

```javascript
// Initialize browser
await session.initialize();

// Navigate & login
await session.navigate(url);
await session.performLogin(otpCallback);

// Scroll & capture (internal uses NetworkCapture)
await session.performScrollSequence();

// Cleanup
await session.close();
```

**Key Methods**:
- `initialize()` - Launch chromium browser
- `navigate(url)` - Go to page
- `performLogin()` - Execute login flow
- `testLogin()` - Test without full session
- `testScrollTarget()` - Test scroll zone
- `performScrollSequence()` - Scroll & trigger APIs
- `close()` - Cleanup

#### NetworkCapture

Intercepts and filters API responses:

```javascript
// Start listening
await capture.start();

// Update context during execution
capture.setContext('during-scroll');

// Get results
const responses = capture.getResponses();
const summary = capture.getSummary();
```

**Key Methods**:
- `start()` - Begin listening to responses
- `setContext(ctx)` - Mark current execution phase
- `getResponses()` - Get filtered responses array
- `getSummary()` - Statistics by status/type/context
- `stop()` - Stop listening

#### SessionSaver

Manages file I/O for results:

```javascript
// Save individual responses
saver.saveResponse(response, index);

// Save session data
saver.saveMetadata(networkCapture);
saver.saveSessionSummary(networkCapture, errors, duration);
saver.saveHAR(networkCapture);
```

**Directory Created**:
```
{outputFolder}/pump_sessions/{sessionId}/
├── metadata.json
├── session_summary.json
├── session.har
├── responses/
│   ├── 0001_method_name.json
│   └── ...
└── logs/
    └── responses.log
```

### Session Execution Flow

```
POST /api/session/start
    ↓
1. Load config from disk
2. Create PlaywrightSession + NetworkCapture + SessionSaver
3. Store in activeSessions map
4. Return sessionId immediately
5. Execute async executeSession(sessionId):
    ├─ Initialize Playwright browser
    ├─ Start NetworkCapture listener
    ├─ Navigate to baseUrl (context: before-login)
    ├─ Perform login (context: login)
    ├─ Wait before scroll (context: before-scroll)
    ├─ Execute scroll sequence (context: during-scroll)
    ├─ Final state (context: after-scroll)
    ├─ Save all responses with filtering
    ├─ Generate metadata, summary, HAR
    └─ Close browser
```

### Filter Engine

Located in `network/filter.js`:

```javascript
// Evaluate single rule against request/response
evaluateRule(rule, request, response) -> boolean

// Check if response should be kept
shouldKeepResponse(request, response, filters) -> boolean

// Explain why response was kept/filtered
getFilterExplanation(request, response, filters) -> string
```

**Filtering Logic**:

```
If no filters configured:
    ✓ Keep all responses

If inclusive rules exist:
    ✓ Keep if matches AT LEAST ONE inclusive rule

If exclusive rules exist:
    ✓ Keep if does NOT match ANY exclusive rule

Combine:
    ✓ Keep = (matches inclusive OR no inclusive) AND (not excluded)
```

### Login Strategies

Located in `playwright/connection.js`:

#### Simple Login
1. Find username input using selector
2. Fill username
3. Find password input
4. Fill password
5. Click submit button
6. Wait for navigation

#### OTP-Aware Login
1. Run simple login
2. Pause and wait for OTP (manual or callback)
3. Fill OTP input
4. Click OTP submit
5. Wait for final navigation

**Selector Detection**:
```javascript
// Tries multiple selectors in order:
"input[type='email']"
"input[type='text'][placeholder*='email']"
"input[name*='email']"
```

### Scroll Strategies

Located in `playwright/scrolling.js`:

#### Direct Modification (Default)
```javascript
// Most reliable for automation
element.scrollLeft += scrollDistance
```

#### Mouse Wheel (Fallback)
```javascript
// More "human-like"
element.dispatchEvent(new WheelEvent(...))
```

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── main.jsx                    # React entry point
├── App.jsx                     # Root component
├── pages/
│   ├── ConfigPage.jsx          # Configuration interface
│   └── SessionPage.jsx         # Session execution & results
├── components/
│   ├── ConfigForm.jsx          # Main config form
│   ├── FilterRules.jsx         # Filter management UI
│   ├── LogViewer.jsx           # Live log display
│   ├── ResultsPanel.jsx        # Session results
│   └── ProgressBar.jsx         # Progress indicator
├── api/
│   └── client.js               # Axios API wrapper
├── hooks/
│   ├── useConfig.js            # Config loading/saving
│   ├── useSession.js           # Session polling
│   └── useLogs.js              # SSE log streaming
├── store/
│   └── store.js                # Zustand global state
└── styles/
    └── index.css               # Tailwind CSS
```

### State Management

Simple Zustand store (`store/store.js`):

```javascript
useStore.getState().config         // Current config
useStore.getState().updateConfig() // Partial update
useStore.getState().setConfig()    // Full replacement
useStore.getState().resetConfig()  // Clear
```

No complex reducers, just simple object updates.

### React Hooks

#### useConfig()
Manages configuration:
```javascript
const { config, loading, error, saveConfig, reloadConfig } = useConfig();
```

Automatically loads config on mount.

#### useSession()
Polls session status:
```javascript
const { status, sessionData, loading } = useSession(sessionId);
```

Polls every 2 seconds, stops when completed/failed.

#### useLogs()
Subscribes to SSE log stream:
```javascript
const { logs, clearLogs } = useLogs();
```

Logs array appends new entries, auto-clears on unmount.

### Component Communication

```
App.jsx
├── ConfigPage
│   ├── ConfigForm (reads/updates store)
│   ├── FilterRules (reads/updates store)
│   └── AdvancedSettings (reads/updates store)
│
└── SessionPage
    ├── ProgressBar (displays session status)
    ├── LogViewer (displays streamed logs)
    └── ResultsPanel (displays session results)
```

**Data Flow**:
1. User fills ConfigForm
2. Zustand store updates
3. Clicking "Launch" POSTs to backend
4. SessionPage mounts with sessionId
5. useSession hooks polls /api/session/{id}/status
6. useLogs hooks subscribes to /api/logs/stream
7. Results load on completion

---

## API Endpoints Reference

### Configuration

```
GET /api/config
Returns: { baseUrl, username, scrollSelector, ... }

POST /api/config/save
Accepts: { baseUrl, username, scrollSelector, ... }
Returns: { success: true }

POST /api/config/validate
Accepts: config object
Returns: { valid: boolean, errors: [...] }
```

### Session Execution

```
POST /api/session/start
Accepts: { password? }
Returns: { success: true, sessionId: string }
Executes async in background

POST /api/session/test-connection
Returns: { success: true, result: {...} }
Blocks until test complete

POST /api/session/test-scroll-target
Returns: { success: true, scrollInfo: {...} }
Blocks until test complete

GET /api/session/:id/status
Returns: { sessionId, status, duration, errors, results }

POST /api/session/:id/stop
Returns: { success: true }
```

### Results & History

```
GET /api/results/sessions
Returns: { sessions: [ "session_...", ... ] }

GET /api/results/:id/metadata
Returns: { sessionId, timestamp, config, responses: [...], totalCaptured }

GET /api/results/:id/summary
Returns: { session, configuration, results, filters, errors, metadata }

GET /api/results/:id/responses/:filename
Returns: { url, method, status, headers, body, ... }
```

### Logs (Server-Sent Events)

```
GET /api/logs/stream
Returns: EventSource streaming:
{
  type: 'log' | 'session-update' | 'connected' | 'ping',
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  message: string,
  timestamp: ISO8601,
  ...
}
```

---

## Data Persistence

### Configuration Storage

```
data/configs/last.json {
  "baseUrl": "https://example.com",
  "username": "user@example.com",
  "password": "",                    // NEVER stored with real password
  "scrollSelector": ".carousel",
  "scrollCount": 5,
  ...
}
```

Loaded on app startup, updated by `POST /api/config/save`.

### Session Results

```
data/sessions/{sessionId}/ {
  "metadata.json"        // Response index
  "session_summary.json" // Statistics
  "session.har"          // HAR export (optional)
  "responses/{}"         // Individual JSON responses
  "logs/responses.log"   // Text log
}
```

Naming strategy (`export/naming.js`):
- Stable: based on method + URL
- Sanitized: no special characters
- Indexed: prevents collisions

---

## Logging System

### Logger (`logger.js`)

```javascript
logger.debug(msg, data)
logger.info(msg, data)
logger.warn(msg, data)
logger.error(msg, data)
```

**Output**:
- Console (colored)
- File `data/logs/app-{date}.log` (errors only)

### Real-time Logs (SSE)

Backend broadcasts to connected clients via `/api/logs/stream`:

```javascript
// In routes, announce via broadcastLog()
broadcastLog('INFO', 'Session started', { sessionId });
```

Frontend receives and displays in LogViewer.

---

## Security Considerations

### Sensitive Data Handling

1. **Passwords**
   - Received in `/api/session/start` POST request
   - Stored in PlaywrightSession memory only
   - Never written to disk
   - Cleared when browser closes

2. **Tokens**
   - Set cookies via Playwright browser context
   - Not captured in response logs
   - Per-session ephemeral

3. **Logs**
   - Filter excluded (never log request bodies)
   - Error logs written to disk locally
   - No stdout logging of credentials

### CORS & API Security

- Backend allows `cors()` middleware
- Frontend proxy configured via Vite `server.proxy`
- Development only (review for production use)

---

## Performance Considerations

### Network Capture

- Event-based interception (low overhead)
- Response bodies parsed on-demand
- Large responses may cause memory usage
- Consider response size limits in production

### Scroll Execution

- Direct `scrollLeft` modification is CPU-efficient
- Mouse wheel event dispatching is slower
- Long scroll sequences generate many API calls
- Filter engine is O(n*m) where n=responses, m=rules

### Frontend

- Zustand store is minimal (no heavy reducers)
- SSE logs appended continuously (UI re-renders)
- Session polling every 2 seconds (configurable)
- Result metadata lazy-loaded on completion

---

## Extension Points

### Adding New Filter Rules

1. Add case in `filter.js` `evaluateRule()`
2. Update FILTER_TYPES in `FilterRules.jsx`
3. Add documentation in README

### Adding New Login Strategies

1. Create strategy function in `connection.js`
2. Add to `loginStrategy` dropdown in UI
3. Update logic in `attemptLogin()`

### Adding New Scroll Strategies

1. Create strategy function in `scrolling.js`
2. Call from `performScrolling()` based on config
3. Add toggle in AdvancedSettings

### Adding New Export Formats

1. Create exporter in `export/`
2. Call from `SessionSaver` after network capture complete
3. Add checkbox in UI if needed

---

## Known Limitations

- ❌ Cannot handle OTP via SMS/email automatically
- ❌ JavaScript-heavy sites may need longer waits
- ❌ Cannot interact with multiple pages/tabs
- ❌ Requires exact CSS selectors (no fuzzy matching)
- ❌ No screenshot/video recording in v1.0

## Future Enhancements

- 🔮 Multi-profile saved configurations
- 🔮 Session replay & relaunching
- 🔮 Screenshot capture
- 🔮 Video recording
- 🔮 Custom JavaScript injection
- 🔮 Webhook notifications
- 🔮 API response annotation

---

**Last Updated**: March 6, 2026  
**Version**: 1.0.0
