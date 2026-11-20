# Repo Atlas
Static, zero-dependency web app that maps how any GitHub repo is built.
- Open `index.html` in a browser (or host it anywhere static, e.g. GitHub Pages). No server, no build needed.
- Paste `owner/repo` (optionally `@branch`). Add a GitHub token (⚙) for private repos / higher rate limits.
- Local code: click **📁 Local folder** to analyse a folder on your machine. It is read in your browser (respects `.gitignore`), nothing is uploaded, and no network requests are made. Chrome/Edge use the folder picker; other browsers fall back to a file-upload dialog. CLI check: `node test-local.js ./folder`.
- Deep link: `index.html#owner/repo` (optionally `?tab=arch`).
- Dev: edit `analyzer.js` (analysis), `ui.js`, `template.html`, then run `./build.sh`. CLI test: `node test2.js owner/repo`.
