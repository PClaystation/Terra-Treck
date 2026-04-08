Original prompt: Look trough this project and find errors then fix them. Just improve it.

- Reviewed the static app structure and found runtime issues in auth/session handling, step sync, and state persistence.
- Planned fixes:
- Replace the broken `setLoggedIn`/`setLoggedOut` path with a working guest/login session UI.
- Stop using the hardcoded step-sync user id.
- Persist the map so buildings survive reloads and reset clears saved state properly.
- Fix HTML/CSS mismatches and login form visibility bugs.
- Rewrote `script.js` around a single persisted state object for buildings, trees, available steps, and step-sync timestamps.
- Updated `index.html` to add a usable auth/session control area instead of the orphan login button.
- Made the Panzoom enhancement load defensively so the grid still works when the CDN import is unavailable.
- Replaced `style.css` to match the new session header, build controls, and mobile layout.
- Fixed `login.html` form switching and made login/register redirects respect the incoming `redirect` query safely.
- Verification:
- `node --check script.js` passes.
- Manual Playwright smoke test confirmed guest-mode render, building a house reduces steps from 1000 to 900, and the placed building survives a reload.
- A locator screenshot of the grid wrapper rendered correctly after the CSS/UI rewrite.
