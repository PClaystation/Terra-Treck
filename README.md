# Terra Tread

Terra Tread is a step-powered city-building project with two connected parts:

- A browser-based game at the repository root
- A small Node.js backend in [`backend/`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/backend)

The core loop is simple: earn steps, spend them on buildings, and grow a city on a tile grid.

## Features

- 20x20 city grid rendered in the browser
- Persistent local game state using `localStorage`
- Buildable structures:
  - `house` for 100 steps
  - `shop` for 200 steps
  - `park` for 150 steps
- Tree placement and map reset support
- Guest mode plus login flow integration through Continental ID
- Backend step logging and per-user step summaries
- Native integration hooks kept in place for a future rebuilt iOS client

## Repository Structure

```text
.
├── index.html          # Main web game entry
├── script.js           # Game logic, auth/session handling, step sync
├── style.css           # Web styling
├── login.html          # Redirect page for Continental ID sign-in
├── images/             # Game and branding assets
└── backend/            # Express backend for config + step logging
```

## How It Works

The web client stores the city layout and available steps in browser storage. Buildings cost steps and remain after reloads.

The backend exposes endpoints for:

- health/config discovery
- writing step entries
- reading a user’s step history and total

The web and backend code still include integration points for a native iOS container, but the iOS app project has been removed from this repository for now and can be rebuilt later.

## Local Development

### 1. Run the backend

From [`backend/`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/backend):

```bash
npm install
npm start
```

By default the backend runs on `http://localhost:3000`.

### 2. Open the web app

Once the backend is running, open:

- `http://localhost:3000/`

The backend serves the root web app, login page, styles, scripts, and images.

## Backend API

### `GET /api/health`

Returns backend status plus resolved client configuration.

### `GET /api/client-config`

Returns client-facing configuration values such as auth and game API base URLs.

### `POST /api/game/steps`

Creates a step entry.

Expected JSON shape:

```json
{
  "userId": "user-123",
  "steps": 1200,
  "source": "ios-healthkit",
  "syncKey": "optional-deduplication-key",
  "deviceDayKey": "2026-04-08",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "metadata": {}
}
```

### `GET /api/game/steps/:userId`

Returns all stored entries for a user plus a summary.

### Legacy routes

The backend also keeps these older routes for compatibility:

- `POST /steps`
- `GET /steps/:userId`

## Environment Variables

The backend reads these optional environment variables:

- `PORT`: backend port, default `3000`
- `TERRA_TREAD_DATA_DIR`: directory for backend data storage
- `TERRA_TREAD_STEP_LOG_PATH`: path to the newline-delimited step log file
- `TERRA_TREAD_WEBSITE_BASE_URL`: public base URL for the site
- `TERRA_TREAD_AUTH_API_BASE_URL`: auth API base URL
- `TERRA_TREAD_GAME_API_BASE_URL`: game API base URL exposed to clients
- `TERRA_TREAD_LOGIN_POPUP_URL`: login popup URL
- `SSL_KEY_PATH`: TLS private key path
- `SSL_CERT_PATH`: TLS certificate path

If valid certificate files are available, the backend can serve HTTPS.

## Authentication Notes

The web app is wired to a Continental ID login flow. In local development, auth behavior depends on the configured remote endpoints. If those services are unavailable, the game still supports guest-mode play locally.

## Data Storage

- Web game state is stored in browser `localStorage`
- Backend step data is stored as newline-delimited JSON in `backend/data/steps.log` unless overridden

`backend/steps.log` is ignored by Git, but the current backend default writes to `backend/data/steps.log`.

## Current Gaps

- There is no root-level automated test suite or build pipeline in this repository yet.
- The browser app is plain HTML/CSS/JavaScript without a package-managed frontend toolchain.
- Auth depends on external Continental-hosted services.
- Backend persistence is file-based and suited to development or lightweight usage, not production-scale storage.

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express

## License

No license file is currently included in this repository.
