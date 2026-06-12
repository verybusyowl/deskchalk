#!/usr/bin/env python3
"""
Polls Steam Web API for new CS2 match sharecodes.
Walks the chain from SEED_SHARECODE forward, writing new codes to Postgres.
Does NOT download demos. The worker handles that.
"""
import os, time, sys, requests, psycopg2

STEAM_API_KEY = os.environ["STEAM_API_KEY"]
STEAM_ID64    = os.environ["STEAM_ID64"]
AUTH_CODE     = os.environ["MATCH_AUTH_CODE"]
DB_DSN        = os.environ["DB_DSN"]
POLL_SECONDS  = int(os.environ.get("POLL_SECONDS", "600"))
NEXT_CODE_URL = "https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1/"

def db():
    return psycopg2.connect(DB_DSN)

def get_last_known_code(conn):
    with conn.cursor() as c:
        # Prefer the most recent parsed code; skip expired ones since Steam API
        # still walks forward from them but they can stall the chain if the demo
        # is unavailable. Fall back to SEED_SHARECODE from env if none found.
        c.execute("""
            SELECT code FROM sharecodes
            WHERE status IN ('parsed', 'pending')
            ORDER BY discovered_at DESC LIMIT 1
        """)
        row = c.fetchone()
        if not row:
            # Fall back to any code (including expired) as last resort
            c.execute("SELECT code FROM sharecodes ORDER BY discovered_at DESC LIMIT 1")
            row = c.fetchone()
    return row[0] if row else os.environ["SEED_SHARECODE"]

def store_code(conn, code):
    with conn.cursor() as c:
        c.execute("INSERT INTO sharecodes(code) VALUES (%s) ON CONFLICT DO NOTHING", (code,))
    conn.commit()

def fetch_next(known_code):
    r = requests.get(NEXT_CODE_URL, params={
        "key": STEAM_API_KEY, "steamid": STEAM_ID64,
        "steamidkey": AUTH_CODE, "knowncode": known_code,
    }, timeout=20)
    if r.status_code != 200:
        return None
    nxt = r.json().get("result", {}).get("nextcode")
    return None if not nxt or nxt in ("n/a", "") else nxt

def main():
    print("[poller] starting", flush=True)
    while True:
        try:
            conn = db()
            known = get_last_known_code(conn)
            discovered = 0
            while True:
                nxt = fetch_next(known)
                if not nxt:
                    break
                store_code(conn, nxt)
                known = nxt
                discovered += 1
                time.sleep(1.5)
            print(f"[poller] discovered {discovered} new sharecode(s)", flush=True)
            conn.close()
        except Exception as e:
            print(f"[poller] ERROR: {e}", file=sys.stderr, flush=True)
        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()
