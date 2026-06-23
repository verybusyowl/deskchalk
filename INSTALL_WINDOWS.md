# Installing DeskChalk on Windows

A step-by-step guide to run DeskChalk on a Windows 10/11 PC (e.g. your gaming rig).
No command-line experience needed — copy/paste is enough.

> **Time:** ~15 minutes. Most of it is Docker Desktop installing.
> **Cost:** $0. (A Claude API key is optional — you can run a free local AI instead.)

---

## What you'll end up with

DeskChalk running in your browser at **http://localhost:5608**, pulling your
CS2 stats from FACEIT and giving you one thing to fix before your next session.

---

## Step 1 — Install Docker Desktop

Docker is the engine DeskChalk runs inside. You install it once.

1. Go to **<https://www.docker.com/products/docker-desktop/>**.
2. Click **Download for Windows (AMD64)**.
3. Run the downloaded **Docker Desktop Installer.exe**.
4. When asked, leave **"Use WSL 2 instead of Hyper-V"** checked. Click **OK**.
5. When it finishes, click **Close and restart** — your PC will reboot.

> `[Screenshot: Docker Desktop installer with "Use WSL 2" checked]`

After the reboot, Docker Desktop opens automatically.

6. Accept the service agreement. You can skip the sign-in (click **Continue without signing in**) — DeskChalk doesn't need a Docker account.
7. Wait until the whale icon in the bottom-left is **green** and says **"Engine running"**.

> `[Screenshot: Docker Desktop showing green "Engine running" status]`

**If Docker says "WSL 2 installation is incomplete":** click the link in the
error, or open PowerShell as Administrator and run `wsl --install`, then reboot
and reopen Docker Desktop.

---

## Step 2 — Download DeskChalk

You don't need Git. Just grab the ZIP.

1. Go to **<https://github.com/verybusyowl/deskchalk>**.
2. Click the green **`< > Code`** button → **Download ZIP**.

> `[Screenshot: GitHub "Code" dropdown with "Download ZIP" highlighted]`

3. Open your **Downloads** folder, right-click **deskchalk-main.zip** → **Extract All…**
4. Extract it somewhere easy to find, like `C:\deskchalk`. You should now have a
   folder `C:\deskchalk\deskchalk-main` containing files like
   `docker-compose.public.yml` and `.env.example`.

> `[Screenshot: extracted folder contents in File Explorer]`

---

## Step 3 — Get a FACEIT API key (free)

This is what lets DeskChalk read your match history. Takes 2 minutes.

1. Go to **<https://developers.faceit.com/>** and sign in with your FACEIT account.
2. Click your name (top-right) → **API Keys**.
3. Click **Create new key**. Give it any name (e.g. `deskchalk`).
4. Choose **Server-side** as the type, create it, and **copy the key** — a long
   string of letters and numbers. Keep it somewhere for the next step.

> `[Screenshot: FACEIT "Create API Key" dialog with Server-side selected]`

> **No FACEIT?** You can skip this and drop a `.dem` file into the `demos`
> folder instead — but FACEIT is the easiest start.

---

## Step 4 — Create your settings file

DeskChalk reads its settings from a file named **`.env`**. You make it by copying
the example.

1. Open the `deskchalk-main` folder in File Explorer.
2. Find **`.env.example`**. Copy it (Ctrl+C), paste it in the same folder (Ctrl+V),
   then rename the copy to exactly **`.env`** (no `.example`, no `.txt`).

> **Windows hides file extensions by default.** If you can't tell, click the
> **View** menu → check **File name extensions** so you can see the real name.

> `[Screenshot: File Explorer with .env file and "File name extensions" checked]`

3. Right-click **`.env`** → **Open with** → **Notepad**.
4. Fill in these two lines with your FACEIT key and your in-game FACEIT nickname:

   ```env
   FACEIT_API_KEY=paste-your-key-here
   FACEIT_NICKNAME=YourFaceitName
   ```

5. **Pick your AI** (the coach needs one). Easiest is Claude:

   ```env
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...your-key...
   ```

   Get a Claude key at <https://console.anthropic.com/settings/keys>.
   *(Prefer free + private? See "Run the AI locally" at the bottom.)*

6. **Save** the file (Ctrl+S) and close Notepad.

> `[Screenshot: .env open in Notepad with FACEIT + AI lines filled in]`

---

## Step 5 — Start DeskChalk

1. In File Explorer, open the `deskchalk-main` folder.
2. Click in the **address bar** at the top, type **`powershell`**, and press **Enter**.
   A blue PowerShell window opens, already pointed at the right folder.

> `[Screenshot: File Explorer address bar with "powershell" typed in]`

3. Copy-paste this line and press **Enter**:

   ```powershell
   docker compose -f docker-compose.public.yml up -d
   ```

4. The first run downloads the app (a few minutes). When it's done you'll see
   lines ending in **`Started`** or **`Running`**.

> `[Screenshot: PowerShell showing containers "Started"]`

5. Open your browser to **<http://localhost:5608>**.

> `[Screenshot: DeskChalk overview dashboard in the browser]`

It may take a minute for your first matches to appear while the FACEIT poller
pulls them in. Refresh the page.

🎉 **Done.** DeskChalk now updates itself as you play.

---

## Everyday use

You don't reinstall anything — just start and stop the stack.

| What | Do this |
|---|---|
| **Start it** | Open Docker Desktop (or run the `up -d` command again). |
| **Open the dashboard** | <http://localhost:5608> in your browser. |
| **Stop it** | In Docker Desktop, click the ■ stop button on the `deskchalk` stack. |
| **Update to a new version** | Download the new ZIP, copy your old `.env` into it, run the `up -d` command again. |

DeskChalk auto-starts with Docker Desktop, so once it's set up it's just there.

---

## Optional: run the AI locally (free, fully private)

Don't want to pay for a Claude key? Run a free model on your own PC with **Ollama**.

1. Install Ollama from **<https://ollama.com/download>** (Windows installer).
2. After it installs, open PowerShell and run:

   ```powershell
   ollama pull llama3.1
   ```

3. In your **`.env`**, use these lines instead of the Claude ones:

   ```env
   LLM_PROVIDER=ollama
   LLM_BASE_URL=http://host.docker.internal:11434
   LLM_MODEL=llama3.1
   ```

4. Save, then restart DeskChalk:

   ```powershell
   docker compose -f docker-compose.public.yml up -d
   ```

The coach now runs entirely on your machine — no API cost, nothing leaves your PC.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **`docker : command not found`** | Docker Desktop isn't running. Open it, wait for the green "Engine running", try again. |
| **Page won't load at localhost:5608** | Give it a minute after starting. Check the `deskchalk` stack is green in Docker Desktop. |
| **No matches showing** | Double-check `FACEIT_NICKNAME` is your exact FACEIT name and the key is a **Server-side** key. Then restart with the `up -d` command. |
| **".env" saved as ".env.txt"** | Turn on **File name extensions** (View menu) and rename it to just `.env`. |
| **Coach says no AI configured** | Re-check the `LLM_PROVIDER` + key lines in `.env`, save, and restart. |
| **WSL 2 error during Docker install** | Open PowerShell as Admin → `wsl --install` → reboot → reopen Docker Desktop. |

To see logs if something's wrong, in PowerShell (from the folder):

```powershell
docker compose -f docker-compose.public.yml logs --tail 50
```

---

## Want demos parsed too? (advanced)

The steps above use FACEIT stats — no demo files, no second Steam account, light
enough for any PC. If you also want DeskChalk to download and parse your **Steam
matchmaking demos**, that needs a dedicated throwaway Steam account and more CPU.
See the **Data sources** section of the main [README](README.md#data-sources).
