/**
 * CS2 Game Coordinator client.
 * Logs into a dedicated Steam bot account, launches CS2 (appid 730), connects
 * to the Game Coordinator, and exposes a small HTTP API used by the worker:
 *   POST /fetch   { sharecode } -> { demo_url, matchid }
 *   GET  /health                -> { status, gc_connected, logged_on }
 *
 * Reliability: Steam connections drop routinely (Valve maintenance, network
 * blips). This client self-heals — it re-logs in with backoff after any
 * disconnect and re-launches CS2 so the GC reconnects, instead of dying. A
 * watchdog exits (letting Docker's restart policy recover) if the GC stays
 * down too long. Fatal setup problems (bad password, Steam Guard with no
 * shared secret) exit immediately with a clear message rather than looping.
 *
 * Valve gives ~30s rate limit between GC requests; demo URLs expire within
 * minutes; the bot account must own CS2 (it's free) and — for unattended use —
 * provide its Steam Guard shared secret so 2FA codes can be generated.
 */
const express = require("express");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const SteamTotp = require("steam-totp");

const PORT = 3000;
const APP_CS2 = 730;
const REQUEST_TIMEOUT_MS = 15_000;
const QUEUE_RETRY_MS = 60_000;
const GC_MIN_INTERVAL_MS = 30_000;
// Reconnect backoff bounds and the watchdog ceiling.
const RECONNECT_MIN_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
// If the GC has been unreachable this long while we believe we're logged on,
// give up and exit so the container restarts clean.
const WATCHDOG_MS = 10 * 60_000;

const log = (...args) =>
  console.log(`[${new Date().toISOString()}]`, ...args);
const logErr = (...args) =>
  console.error(`[${new Date().toISOString()}]`, ...args);

const USERNAME = process.env.STEAM_USERNAME;
const PASSWORD = process.env.STEAM_PASSWORD;
// Steam Guard shared secret (base64). Required for an unattended bot whose
// account has the mobile authenticator enabled — lets us generate 2FA codes.
const SHARED_SECRET =
  process.env.STEAM_GUARD_SHARED_SECRET || process.env.STEAM_SHARED_SECRET || "";
if (!USERNAME || !PASSWORD) {
  logErr(
    "FATAL: STEAM_USERNAME / STEAM_PASSWORD required in env. " +
      "Use a dedicated throwaway account (never your main); CS2 is free to add."
  );
  process.exit(1);
}

// steam-user auto-relogins on its own, but we add an explicit, logged backoff
// path so a hard "NoConnection" can't leave us idle forever.
const steam = new SteamUser({ autoRelogin: true });
const csgo = new GlobalOffensive(steam);

let gcConnected = false;
let loggedOn = false;
let lastGcRequestAt = 0;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer = null;
let gcDownSince = 0; // 0 = up; otherwise ms timestamp the GC went/stayed down

function buildLogonOptions() {
  const opts = { accountName: USERNAME, password: PASSWORD };
  if (SHARED_SECRET) {
    opts.twoFactorCode = SteamTotp.generateAuthCode(SHARED_SECRET);
  }
  return opts;
}

function doLogin() {
  reconnectTimer = null;
  log(`steam: logging in as ${USERNAME}${SHARED_SECRET ? " (with Steam Guard)" : ""}`);
  try {
    steam.logOn(buildLogonOptions());
  } catch (err) {
    scheduleReconnect(`logOn threw: ${err.message || err}`);
  }
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return; // already scheduled
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  logErr(`steam: ${reason} — reconnecting in ${Math.round(delay / 1000)}s`);
  reconnectTimer = setTimeout(doLogin, delay);
}

steam.on("loggedOn", () => {
  loggedOn = true;
  reconnectDelay = RECONNECT_MIN_MS; // reset backoff on a clean login
  log("steam: logged on, setting persona and launching CS2");
  steam.setPersona(SteamUser.EPersonaState.Online);
  steam.gamesPlayed([APP_CS2]); // re-launching is what reconnects us to the GC
});

steam.on("steamGuard", (domain, callback, lastCodeWrong) => {
  if (SHARED_SECRET) {
    if (lastCodeWrong) logErr("steam guard: last 2FA code rejected, regenerating");
    callback(SteamTotp.generateAuthCode(SHARED_SECRET));
    return;
  }
  logErr(
    "FATAL: this bot account has Steam Guard enabled but no shared secret was " +
      "provided. Set STEAM_GUARD_SHARED_SECRET in .env, or disable Steam Guard " +
      "on the bot account. (Email-domain prompt: " + (domain || "mobile app") + ")"
  );
  process.exit(1);
});

steam.on("error", (err) => {
  const result = err && err.eresult;
  // Fatal misconfigurations — looping won't help; exit so the user sees it.
  const FATAL = new Set([
    SteamUser.EResult.InvalidPassword,
    SteamUser.EResult.AccountLogonDenied, // Steam Guard code required (email)
    SteamUser.EResult.AccountLoginDeniedNeedTwoFactor,
    SteamUser.EResult.AccountDisabled,
    SteamUser.EResult.Banned,
  ]);
  loggedOn = false;
  gcConnected = false;
  if (FATAL.has(result)) {
    logErr(
      `FATAL steam error: ${err.message || err} (eresult ${result}). ` +
        "Check STEAM_USERNAME/STEAM_PASSWORD and STEAM_GUARD_SHARED_SECRET."
    );
    process.exit(1);
  }
  // Transient (RateLimitExceeded, ServiceUnavailable, NoConnection, etc.) —
  // back off and retry instead of crashing.
  scheduleReconnect(`error: ${err.message || err} (eresult ${result})`);
});

steam.on("disconnected", (eresult, msg) => {
  loggedOn = false;
  gcConnected = false;
  scheduleReconnect(`disconnected (${eresult}${msg ? " " + msg : ""})`);
});

csgo.on("connectedToGC", () => {
  gcConnected = true;
  gcDownSince = 0;
  log("gc: connected");
});

csgo.on("disconnectedFromGC", (reason) => {
  gcConnected = false;
  log("gc: disconnected", reason);
});

// Watchdog: if the GC is down for too long while we think we're online, exit
// and let Docker's restart policy give us a fresh process.
setInterval(() => {
  if (gcConnected) {
    gcDownSince = 0;
    return;
  }
  if (gcDownSince === 0) {
    gcDownSince = Date.now();
    return;
  }
  if (Date.now() - gcDownSince > WATCHDOG_MS) {
    logErr(
      `watchdog: GC unreachable for >${Math.round(WATCHDOG_MS / 60000)}m — ` +
        "exiting for a clean restart"
    );
    process.exit(1);
  }
}, 30_000).unref();

doLogin();

function waitForGc(timeoutMs) {
  return new Promise((resolve, reject) => {
    if (gcConnected) return resolve();
    const start = Date.now();
    const interval = setInterval(() => {
      if (gcConnected) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("gc_not_ready"));
      }
    }, 500);
  });
}

async function respectRateLimit() {
  const elapsed = Date.now() - lastGcRequestAt;
  if (elapsed < GC_MIN_INTERVAL_MS) {
    const wait = GC_MIN_INTERVAL_MS - elapsed;
    log(`gc: rate-limit wait ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastGcRequestAt = Date.now();
}

function requestDemoUrl(sharecode) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const onMatchList = (matches) => {
      if (settled) return;
      try {
        // matchList may return one match (the one we asked for); take the last
        const match = Array.isArray(matches) && matches.length
          ? matches[matches.length - 1]
          : null;
        if (!match) return;
        const roundstats =
          match.roundstatsall && match.roundstatsall.length
            ? match.roundstatsall[match.roundstatsall.length - 1]
            : match.roundstats_legacy;
        const url = roundstats && roundstats.map;
        if (!url) {
          settled = true;
          csgo.removeListener("matchList", onMatchList);
          return reject(new Error("no_demo_url_in_matchlist"));
        }
        settled = true;
        csgo.removeListener("matchList", onMatchList);
        resolve({ demo_url: url, matchid: match.matchid });
      } catch (err) {
        settled = true;
        csgo.removeListener("matchList", onMatchList);
        reject(err);
      }
    };

    csgo.on("matchList", onMatchList);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      csgo.removeListener("matchList", onMatchList);
      reject(new Error("timeout"));
    }, REQUEST_TIMEOUT_MS);

    try {
      log(`gc: requestGame sharecode=${sharecode}`);
      csgo.requestGame(sharecode);
    } catch (err) {
      clearTimeout(timer);
      settled = true;
      csgo.removeListener("matchList", onMatchList);
      reject(err);
    }
  });
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  // 503 when the GC isn't usable so the container healthcheck reflects reality.
  res
    .status(gcConnected ? 200 : 503)
    .json({ status: gcConnected ? "ok" : "degraded", gc_connected: gcConnected, logged_on: loggedOn });
});

app.post("/fetch", async (req, res) => {
  const { sharecode } = req.body || {};
  if (!sharecode) {
    return res.status(400).json({ error: "sharecode required" });
  }

  try {
    await waitForGc(QUEUE_RETRY_MS);
  } catch (err) {
    logErr("gc not ready after queue wait");
    return res.status(503).json({ error: "gc_not_ready" });
  }

  try {
    await respectRateLimit();
    const { demo_url, matchid } = await requestDemoUrl(sharecode);
    log(`gc: demo_url for sharecode=${sharecode} matchid=${matchid} obtained`);
    return res.json({ demo_url, matchid: String(matchid) });
  } catch (err) {
    const msg = err.message || String(err);
    logErr(`gc: fetch failed sharecode=${sharecode}: ${msg}`);
    if (msg === "timeout") return res.status(500).json({ error: "timeout" });
    return res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => log(`http: listening on :${PORT}`));
