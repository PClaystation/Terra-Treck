# Terra Tread

Terra Tread is a step-powered city-building project with two connected parts:

- A browser-based game at the repository root
- A small Node.js backend in [`backend/`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/backend)
- A native iOS viewer app in [`ios/`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/ios)

The core loop is simple: earn steps, spend them on buildings, and grow a city on a tile grid.

## Features

- 20x20 city grid rendered in the browser
- Persistent local game state using `localStorage`
- Optional per-user cloud saves that sync city state after Continental ID login
- Daily step-goal rewards and multi-day streak bonuses backed by the backend
- Buildable structures:
  - `house` for 100 steps
  - `shop` for 200 steps
  - `park` for 150 steps
- Tree placement and map reset support
- Guest mode plus login flow integration through Continental ID
- Backend step logging and per-user step summaries
- A rebuilt SwiftUI iOS wrapper with `WKWebView`, native step sync, and bundled web fallback

## Repository Structure

```text
.
├── index.html          # Main web game entry
├── script.js           # Browser bootstrap + UI/runtime wiring
├── style.css           # Web styling
├── login.html          # Redirect page for Continental ID sign-in
├── app/                # Shared game engine modules used by the web client and tests
├── images/             # Game and branding assets
├── tests/              # Node-based regression tests for city/step rules
├── backend/            # Express backend for config + step logging
└── ios/                # SwiftUI iOS wrapper app generated with XcodeGen
```

## How It Works

The web client stores the city layout and available steps in browser storage. When a player signs in with Continental ID, the browser can also push the city state to the backend and restore it on another device.

The backend exposes endpoints for:

- health/config discovery
- writing step entries
- reading a user’s step history, daily goal progress, and streak summary
- reading and writing per-user cloud save state
- claiming server-tracked streak rewards

The web client, backend, and iOS app now share a concrete bridge contract. The app injects native context into the page, answers the existing `terraTread` message handler, keeps the login popup inside the app, and can fall back to bundled web assets when a hosted page is unavailable.

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

### 3. Build the iOS app

From [`ios/`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/ios):

```bash
xcodegen generate
open TerraTreadViewer.xcodeproj
```

The default Debug configuration points the app at `http://localhost:3000/`, so the simulator can load the hosted web game directly while still using the native step bridge.

If the hosted URL is unavailable, the app falls back to the bundled copies of:

- `index.html`
- `script.js`
- `style.css`
- `login.html`
- `images/`

#### iOS configuration

Edit these values in [`ios/Configs/Debug.xcconfig`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/ios/Configs/Debug.xcconfig) or [`ios/Configs/Release.xcconfig`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/ios/Configs/Release.xcconfig):

- `TERRA_TREAD_WEB_URL`: hosted page URL for the app shell
- `TERRA_TREAD_GAME_API_BASE_URL`: backend base URL for step sync
- `TERRA_TREAD_AUTH_API_BASE_URL`: Continental ID API base URL
- `TERRA_TREAD_LOGIN_POPUP_URL`: login popup URL
- `TERRA_TREAD_ALLOW_WEB_AUTH`: `YES` to keep the web login flow enabled inside the app

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
  "source": "ios-motion",
  "syncKey": "optional-deduplication-key",
  "deviceDayKey": "2026-04-08",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "metadata": {}
}
```

### `GET /api/game/steps/:userId`

Returns all stored entries for a user plus a summary that includes:

- total step counts
- latest entry timestamp
- daily goal progress for the current day
- current and longest streaks
- claimable daily-goal and streak-milestone rewards

### `GET /api/game/state/:userId`

Returns the saved cloud state for a user, or `null` when that user has not saved a city yet.

### `PUT /api/game/state/:userId`

Stores the current cloud city state for a user.

Expected JSON shape:

```json
{
  "state": {
    "availableSteps": 1234,
    "buildings": [{ "type": "house", "row": 0, "col": 0 }],
    "trees": [],
    "lastStepTimestamp": "2026-04-27T12:00:00.000Z"
  }
}
```

### `POST /api/game/streaks/:userId/claim`

Claims a reward that the summary reported as claimable.

Expected JSON shape:

```json
{
  "type": "daily-goal",
  "dayKey": "2026-04-27"
}
```

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
- Backend cloud saves and reward-claim state are stored as per-user JSON files in `backend/data/profiles/`

`backend/steps.log` is ignored by Git, but the current backend default writes to `backend/data/steps.log`.

## Current Gaps

- The browser app is still plain HTML/CSS/JavaScript without a package-managed frontend toolchain.
- Auth depends on external Continental-hosted services.
- Backend persistence is file-based and suited to development or lightweight usage, not production-scale storage.

## Testing

Core city simulation and step-sync rules now have focused regression coverage in [`tests/game-engine.test.mjs`](/Users/charliearnerstal/Documents/GitHub/Terra-Treck/tests/game-engine.test.mjs).

Run the tests from the repository root:

```bash
node --test tests/game-engine.test.mjs
```

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express

## License

No license file is currently included in this repository.
