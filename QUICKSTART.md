# Quick Start Guide

## Installation (5 minutes)

```bash
cd pump
npm run install-all
```

This installs dependencies for the monorepo (root + workspaces).

## Development (Local Testing)

### Recommended: One command from root
```bash
npm run dev
```

Starts backend and frontend together.
By default, the frontend runs on `5174` so it does not collide with `contrats`.

### Optional: Start services separately

### Backend
```bash
# if port 3000 is already taken, override with:
PORT=3001 npm run dev:backend
```

Starts Express server with auto-reload on file changes (default port 3000, fallback 3001).

### Frontend
```bash
npm run dev:frontend
```

Starts Vite dev server with HMR (port 5174 by default).

### Open Browser
```
http://localhost:5174
```

## First Session (Example)

### Step 1: Configure

Fill in the configuration form:

```
Website URL:           https://example.com
Username:              test@example.com
Scroll Zone Selector:  .carousel
Scroll Count:          3
Scroll Distance:       500px
Output Folder:         (leave empty for default)
```

### Step 2: Test (Optional)

- Click **🔗 Test Connection** to verify login works
- Click **↔️ Test Scroll Zone** to verify element exists

### Step 3: Configure Filters (Optional)

- Toggle **🔍 Filter Rules**
- Click **JSON + No Analytics** preset
- Or add custom rules

### Step 4: Launch

- Enter password (will be in-memory only)
- Click **🚀 Launch Session**
- Watch logs stream in real-time

### Step 5: Review

After completion:
- View captured API count
- Click responses to see details
- Results saved to `data/sessions/{sessionId}/`

## Folder Structure

```
pump/
├── backend/           # Node.js API server
├── frontend/          # React UI
├── data/
│   ├── configs/      # Saved configurations
│   └── sessions/     # Session results
├── README.md         # Full documentation
└── ARCHITECTURE.md   # Technical details
```

## Common Tasks

### Save Configuration
Click **💾 Save Configuration** - saved to `data/configs/last.json` automatically on startup.

### Change Selectors
Go to **⚙️ Advanced Settings** to customize:
- Username input CSS selector
- Password input CSS selector
- Submit button selector

### Add Filters
Go to **🔍 Filter Rules**:
- **Keep**: Inclusive rules (must match one)
- **Exclude**: Exclusive rules (must not match)

### View Results
After session completes:
- Click response to see full details
- Click **📁 Open Folder** to view files
- Files are in `data/sessions/{sessionId}/`

### Export HAR
Before launching, toggle **Enable HAR Export** in config.

## Troubleshooting

### "Failed to start session"

1. Click **🔗 Test Connection** first
2. Verify URL is reachable
3. Check CSS selector in Advanced Settings
4. Increase wait time

### "Element not found"

1. Click **↔️ Test Scroll Zone**
2. Verify selector in browser DevTools (F12)
3. Check if element loads dynamically (needs wait time)

### "No responses captured"

1. Check filter rules aren't too restrictive
2. Open developer tools (F12) Network tab to verify APIs are called
3. Try clearing filters (no rules = keep all)

## Environment

For production builds, create `backend/.env`:

```
PORT=3000
NODE_ENV=production
DATA_DIR=/path/to/output
```

## Next Steps

1. Read [README.md](README.md) for full documentation
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
3. Explore source code in `backend/src/` and `frontend/src/`

## Help

- Check logs in backend terminal for detailed errors
- Check browser F12 DevTools for frontend errors
- Review files in `data/logs/` for app errors

---

**Happy automating! 🚀**
