# Terra Tread

Terra Tread is a native iOS mobile game built around daily steps, city growth, and persistent progression.

This repository now centers on the SwiftUI app in `ios/`. The Node service in `backend/` exists to support the app with step sync, cloud saves, reward claims, and auth-related configuration. The old browser build has been archived and is no longer the product surface.

## Active Repository Layout

```text
.
├── ios/                 # Native iOS game and XcodeGen project
├── backend/             # API service for sync, cloud state, and rewards
├── images/              # Shared art bundled into the iOS app
├── archive/legacy-web/  # Retired browser prototype and old JS tests
├── progress.md
└── To-Do.txt
```

## Product Direction

- Terra Tread is now an iOS-first game, not a website with a mobile wrapper.
- Gameplay, simulation, persistence, and presentation live in the native app.
- The only remaining web surface in the app is the embedded sign-in sheet used for Continental ID authentication.
- The backend no longer serves the archived browser client from `/`.

## Run The Backend

From `backend/`:

```bash
npm install
npm start
```

Default local URL:

- `http://localhost:3000`

## Run The iOS App

From `ios/`:

```bash
xcodegen generate
open TerraTreadViewer.xcodeproj
```

The Xcode project filename still uses its older name, but it builds the native Terra Tread iOS app.

The app reads these values from `ios/Configs/Debug.xcconfig` and `ios/Configs/Release.xcconfig`:

- `TERRA_TREAD_GAME_API_BASE_URL`
- `TERRA_TREAD_AUTH_API_BASE_URL`
- `TERRA_TREAD_LOGIN_POPUP_URL`
- `TERRA_TREAD_ALLOW_WEB_AUTH`

## Backend API

- `GET /api/health`
- `GET /api/client-config`
- `POST /api/game/steps`
- `GET /api/game/steps/:userId`
- `GET /api/game/state/:userId`
- `PUT /api/game/state/:userId`
- `POST /api/game/streaks/:userId/claim`

Legacy compatibility routes still exist for older step writers:

- `POST /steps`
- `GET /steps/:userId`

## Backend Environment Variables

- `PORT`
- `TERRA_TREAD_DATA_DIR`
- `TERRA_TREAD_STEP_LOG_PATH`
- `TERRA_TREAD_PUBLIC_BASE_URL`
- `TERRA_TREAD_WEBSITE_BASE_URL` as a backward-compatible fallback for `TERRA_TREAD_PUBLIC_BASE_URL`
- `TERRA_TREAD_AUTH_API_BASE_URL`
- `TERRA_TREAD_GAME_API_BASE_URL`
- `TERRA_TREAD_LOGIN_POPUP_URL`
- `SSL_KEY_PATH`
- `SSL_CERT_PATH`

If valid certificate files are available, the backend can serve HTTPS.

## Legacy Web Archive

The retired browser implementation now lives in `archive/legacy-web/`.

That archive keeps:

- the original HTML, CSS, and JavaScript client
- the old shared JavaScript game engine
- the browser-era regression test file
- captured web QA output and test artifacts

It is retained for reference only. It is not the current product and it is not served by the backend anymore.

## Tech Stack

- SwiftUI
- Observation
- Native iOS step syncing
- Node.js
- Express

## License

No license file is currently included in this repository.
