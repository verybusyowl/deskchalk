<div align="center">

# ✏️ DeskChalk

**The CS2 coach that tells you the truth.**

A free, open-source, self-hosted Counter-Strike 2 AI coach.
One fix per session. Bring your own AI. Your demos never leave your machine.

[Quickstart](#quickstart) · [Why DeskChalk](#how-its-different-from-closed-coaching-saas) · [Data sources](#data-sources) · [AI providers](#ai-providers) · [License](#license)

</div>

---

DeskChalk analyzes your CS2 matches and gives you **one thing to fix** before your next session — not thirty dashboards you'll never read. It runs entirely on your own hardware (a NAS, a Raspberry Pi, or your gaming PC), connects to the AI of your choice (Claude or a local Ollama model), and keeps every demo and stat on your disk.

It's the privacy-respecting, self-hostable alternative to closed coaching SaaS — open source instead of a black box, your hardware instead of someone else's cloud.

## Why

- **Free forever** — AGPL-3.0 open source. No tiers, no seats, no trial that expires.
- **100% private** — no account, no cloud, no data sale. Your match history stays on your hardware.
- **Bring your own AI** — plug in a Claude key, or run a local Ollama model for $0.
- **Runs anywhere Docker does** — a Pi, an old NAS, or your gaming rig.

## How it's different from closed coaching SaaS

| | DeskChalk | Closed coaching SaaS |
|---|:---:|:---:|
| Open source | ✓ | ✗ |
| Self-hosted | ✓ | ✗ |
| Your data stays local | ✓ | ✗ |
| Bring-your-own-AI | ✓ | ✗ |
| Free | ✓ | ✗ |

## Quickstart

```bash
git clone https://github.com/verybusyowl/deskchalk
cd deskchalk
cp .env.example .env          # add a FACEIT key + nickname, and an AI key (or use Ollama)
docker compose -f docker-compose.public.yml up -d
```

Then open **http://localhost:5608**.

The default stack runs the web UI, a bundled Postgres, and the FACEIT poller — light enough for a Raspberry Pi. To enable the heavier Steam demo-parsing pipeline (needs real CPU):

```bash
docker compose -f docker-compose.public.yml --profile demos up -d
```

> **Maintainer note:** on a public release this repo ships `docker-compose.public.yml` as `docker-compose.yml`, so the install is a plain `docker compose up -d`.

## Container engines

DeskChalk is plain OCI containers + a standard Compose file, so it runs on any of these — pick whichever you already have. The commands are interchangeable:

| Engine | Up | Down |
|---|---|---|
| **Docker** | `docker compose -f docker-compose.public.yml up -d` | `docker compose -f docker-compose.public.yml down` |
| **Podman** (rootless, daemonless) | `podman compose -f docker-compose.public.yml up -d` | `podman compose -f docker-compose.public.yml down` |
| **nerdctl** (containerd) | `nerdctl compose -f docker-compose.public.yml up -d` | `nerdctl compose -f docker-compose.public.yml down` |

The `--profile demos` flag works the same on all three.

**Podman / nerdctl notes:**
- **Podman compose:** Podman 4.1+ ships `podman compose`; on older versions install `podman-compose` and use that command instead.
- **Local Ollama:** Docker reaches the host at `host.docker.internal`; on Podman use `host.containers.internal` (set `LLM_BASE_URL=http://host.containers.internal:11434`). On nerdctl, add `--add-host=host.docker.internal:host-gateway` or use the host IP.
- **Rootless:** the default port `5608` is unprivileged, so rootless Podman/nerdctl work out of the box.

## Data sources

Pick whichever friction you're comfortable with — every path keeps the raw demos on your disk.

| Source | Setup | Notes |
|---|---|---|
| **FACEIT stats** | `FACEIT_API_KEY` + `FACEIT_NICKNAME` in `.env` | Lowest friction. Read-only, no demos. Pulls your recent matches in seconds. |
| **Steam matchmaking** | `STEAM_*` vars + `--profile demos` | Official MM. Fetches demos from Valve via a dedicated bot account *(see below)*. |
| **Manual demo drop** | drop a `.dem` into `./demos` + `--profile demos` | Fully offline — nothing touches the network. |

> **FACEIT and manual demo drop need no Steam account.** Only the auto-MM pipeline does.

### Do I need a second Steam account?

Only for the **auto-MM pipeline** (`--profile demos`). Valve only hands out matchmaking demo URLs to a logged-in CS2 client via the Game Coordinator, so the pipeline logs in as a Steam account to fetch them — and you should **never use your main account** for an unattended bot login.

The good news: **CS2 is free-to-play.** Just make a fresh Steam account, install CS2 on it once, and put its login in `.env` as the bot. Sharecodes are self-authorizing, so this throwaway account can fetch the demos for matches played on your *main* account. Notes:

- **Never your main account** — use a dedicated throwaway.
- **Steam Guard** — you'll complete a one-time Steam Guard step on first login (the standard for any bot account).
- This is a normal, ToS-compliant Steam login — **do not** add website session cookies/tokens; the bot uses proper Steam auth only.

If that's more setup than you want, skip it: **FACEIT** or **manual demo drop** give you coaching with zero Steam account.

Get a FACEIT server-side key at <https://developers.faceit.com/> → Apps.

## AI providers

Set `LLM_PROVIDER` in `.env`:

**Claude (Anthropic)** — best quality. Get a key at <https://console.anthropic.com/settings/keys>:
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-8
```

**Ollama (local, free, private)** — runs on your own machine, no API cost, no data leaves the box:
```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://host.docker.internal:11434
LLM_MODEL=llama3.1
```
```bash
ollama serve && ollama pull llama3.1
```

**Other providers** — set `LLM_PROVIDER` and a key (`LLM_API_KEY`, or the provider's own var):

| `LLM_PROVIDER` | Provider | Key var | Default model |
|---|---|---|---|
| `openai` | OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| `gemini` | Google Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| `mistral` | Mistral (EU) | `MISTRAL_API_KEY` | `mistral-large-latest` |
| `groq` | Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| `xai` | xAI / Grok | `XAI_API_KEY` | `grok-2-latest` |
| `openai_compatible` | any self-hosted OpenAI-compatible endpoint (vLLM, LM Studio, LocalAI) | `LLM_API_KEY` *(optional)* | set `LLM_MODEL` |

Override the model anytime with `LLM_MODEL`. For `openai_compatible`, set `LLM_BASE_URL` to your endpoint's `/v1` base.

> **Chinese AI providers (DeepSeek, Qwen, GLM, Kimi, Ernie, etc.) are intentionally not supported** and are refused at runtime.

The provider layer lives in [`app/llm.py`](app/llm.py) — all of the above share one OpenAI-compatible code path.

## What it does

- **Anti-coach focus loop** — one prioritized fix per session, with a drill to fix it.
- **AI coach + map fundamentals** — ask questions, get map-specific guidance grounded in your own stats.
- **Discord recaps** *(optional)* — session summaries to a webhook.

> Some features shown on the landing page (reverse-Elo honesty score, what-if simulator, tilt detector) are on the roadmap and not yet implemented.

## Requirements

- A container engine with Compose support: **Docker**, **Podman**, or **nerdctl/containerd** (see [Container engines](#container-engines)).
- `git` to clone the repo.
- The demo-parsing worker uses `demoparser2` (CPU-bound) — only needed for the `demos` profile.

### Installing a container engine

DeskChalk itself isn't a system package — you install an engine with your package manager, then `git clone` and run the Compose file above. Pick **Docker** *or* **Podman**:

| Distro | Docker | Podman |
|---|---|---|
| **Debian / Ubuntu** (`apt`) | `sudo apt install docker.io docker-compose-v2` | `sudo apt install podman podman-compose` |
| **Fedora** (`dnf`) | `sudo dnf install docker-ce docker-compose-plugin` | `sudo dnf install podman podman-compose` |
| **RHEL / CentOS / Rocky** (`yum`) | `sudo yum install docker-ce docker-compose-plugin` | `sudo yum install podman podman-compose` |
| **Arch / Manjaro** (`pacman`) | `sudo pacman -S docker docker-compose` | `sudo pacman -S podman podman-compose` |
| **openSUSE** (`zypper`) | `sudo zypper install docker docker-compose` | `sudo zypper install podman podman-compose` |
| **Alpine** (`apk`) | `sudo apk add docker docker-cli-compose` | `sudo apk add podman podman-compose` |

After installing Docker you may need `sudo systemctl enable --now docker` and to add yourself to the `docker` group. For the authoritative steps, see [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) or [podman.io/docs/installation](https://podman.io/docs/installation). **nerdctl** is in some distro repos (e.g. `pacman -S nerdctl`); otherwise grab the static binary from the [nerdctl releases](https://github.com/containerd/nerdctl/releases).

Then:

```bash
git clone https://github.com/verybusyowl/deskchalk
cd deskchalk
cp .env.example .env
docker compose -f docker-compose.public.yml up -d   # or: podman compose / nerdctl compose
```

## Troubleshooting

- **First screen says "Welcome to DeskChalk / connect…"** — expected on a fresh install. Set an AI provider and a data source in `.env`, then `docker compose up -d` and reload. The setup screen clears once both are connected.
- **Heatmaps render on a blank grid** — the `radars/` images ship with the repo and mount read-only into the app. Confirm `radars/` isn't empty and that `RADARS_DIR` is mounted.
- **App can't connect to the database / password authentication failed** — Postgres only applies `POSTGRES_PASSWORD` on the **first** boot of an empty volume. If you changed DB credentials after the first run, reset the volume: `docker compose down -v && docker compose up -d` (this wipes local data).
- **`env file .env not found`** — run `cp .env.example .env` first.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE). The network-copyleft terms mean any hosted fork must also publish its source — chosen deliberately so DeskChalk can't be relaunched as a closed SaaS. Not affiliated with Valve or any third-party coaching service.
