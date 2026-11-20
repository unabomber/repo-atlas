# Repo Atlas
Static, zero-dependency web app that maps how any GitHub repo is built.
- Open `index.html` in a browser (or host it anywhere static, e.g. GitHub Pages). No server, no build needed.
- Paste `owner/repo` (optionally `@branch`). Add a GitHub token (⚙) for private repos / higher rate limits.
- Deep link: `index.html#owner/repo` (optionally `?tab=arch`).
- Dev: edit `analyzer.js` (analysis), `ui.js`, `template.html`, then run `./build.sh`. CLI test: `node test2.js owner/repo`.
