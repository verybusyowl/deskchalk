/**
 * CS2 Game Coordinator client.
 * Logs into a dedicated Steam bot account, launches CS2 (appid 730), connects
 * to the Game Coordinator, and exposes a small HTTP API used by the worker:
 *   POST /fetch   { matchid, outcomeid, token } -> { demo_url }
 *   GET  /health                                -> { status, gc_connected }
 *
 * Valve gives ~30s rate limit between GC requests; demo URLs expire within
 * minutes; bot account must have Steam Guard disabled and CS2 in its library.
 */
const express = require("express");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");

const PORT = 3000;
const APP_CS2 = 730;
const REQUEST_TIMEOUT_MS = 15_000;
const QUEUE_RETRY_MS = 60_000;
const GC_MIN_INTERVAL_MS = 30_000;

const log = (...args) =>
  console.log(`[${new Date().toISOString()}]`, ...args);
const logErr = (...args) =>
  console.error(`[${new Date().toISOString()}]`, ...args);

const USERNAME = process.env.STEAM_USERNAME;
const PASSWORD = process.env.STEAM_PASSWORD;
if (!USERNAME || !PASSWORD) {
  logErr("STEAM_USERNAME / STEAM_PASSWORD required in env");
  process.exit(1);
}

const steam = new SteamUser();
const csgo = new GlobalOffensive(steam);

let gcConnected = false;
let lastGcRequestAt = 0;

steam.on("loggedOn", () => {
  log("steam: logged on, setting persona and launching CS2");
  steam.setPersona(SteamUser.EPersonaState.Online);
  steam.gamesPlayed([APP_CS2]);
});

steam.on("error", (err) => {
  logErr("steam error:", err.message || err);
  process.exit(1);
});

steam.on("disconnected", (eresult, msg) => {
  logErr("steam disconnected:", eresult, msg);
  gcConnected = false;
});

csgo.on("connectedToGC", () => {
  gcConnected = true;
  log("gc: connected");
});

csgo.on("disconnectedFromGC", (reason) => {
  gcConnected = false;
  log("gc: disconnected", reason);
});

log(`steam: logging in as ${USERNAME}`);
steam.logOn({ accountName: USERNAME, password: PASSWORD });

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
  res.json({ status: "ok", gc_connected: gcConnected });
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
