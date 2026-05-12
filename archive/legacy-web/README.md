# Legacy Web Archive

This folder contains the retired browser version of Terra Tread.

The active product is the native iOS game in `../../ios/`. These files are kept only for reference and historical comparison.

Contents:

- archived HTML, CSS, and JavaScript client files
- the browser-era JavaScript game engine
- the matching JS regression test
- captured web QA output and test artifacts

Notes:

- The backend no longer serves this client from `/`.
- Shared artwork still lives in `../../images/` because the iOS app continues to bundle those assets.
- If you inspect the archived client directly, its asset paths now point back to the root `images/` folder.
