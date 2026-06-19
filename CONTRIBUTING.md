# Contributing to DeskChalk

Thanks for helping out. DeskChalk is a self-hosted, single-instance CS2 coach — every user runs their own copy with their own credentials and their own AI key.

## Dev setup

```bash
git clone https://github.com/verybusyowl/deskchalk
cd deskchalk
cp .env.example .env          # fill in a FACEIT key + nickname, and an AI provider
docker compose -f docker-compose.public.yml up -d
```

The UI is at `http://localhost:5608`. A fresh install shows a setup screen until an AI provider and one data source are connected.

### Architecture (short version)

- **`app/`** — FastAPI backend + the vanilla-JS dashboard in `app/static/v2/`. The dashboard is token-driven CSS (`app.css` `:root`), server-rendered heatmaps via `/heatmap`, coaching verdicts via `/api/*`.
- **`app/llm.py`** — the pluggable AI layer. All model calls go through `llm.chat()`; providers today are `anthropic` and `ollama`. Add OpenAI-compatible backends here, not in business logic.
- **`faceit-poller/`** — pulls FACEIT public stats (no demos needed).
- **`poller/` + `gc-client/` + `worker/`** — the optional demo pipeline (`--profile demos`): fetch sharecodes, download demos, parse with `demoparser2`.
- **`db/init.sql`** — schema, auto-applied on first DB boot.
- **`radars/`** — map radar images; heatmaps render on top of these.

> **Build note:** the `app` image bakes the Python in (`build: ./app`) but bind-mounts `app/static` read-only. Static changes (JS/CSS/SVG) go live on browser reload; **`main.py` changes need `docker compose up -d --build app`** — a plain restart won't reload Python.

## Ground rules

- **Never commit secrets.** `.env` and `*.private.md` are gitignored — keep it that way. Run a history scan before any push that touches them.
- **Respect platform ToS.** Do **not** add Steam login *session cookies/tokens* to any scraper — Steam data comes via the Steam Web API (no login) and a dedicated bot account for the Game Coordinator client only.
- **Keep it BYO and private.** No phoning home, no bundled telemetry, no hosted-only features. Data stays on the user's box.
- **Match the surrounding style.** Terse, no new heavy dependencies without reason.

## Pull requests

1. Branch from `main`.
2. Keep PRs focused; describe what a fresh-install user would see.
3. If you touch `main.py`, confirm `docker compose up -d --build app` boots clean and `GET /health` returns ok.
4. By contributing you agree your work is licensed under [AGPL-3.0](LICENSE).
