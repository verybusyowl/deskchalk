#!/usr/bin/env python3
"""
Seed pro kill positions from the ESTA dataset into the pro_kills table.

Usage (from the NAS, with DB accessible):
  DB_DSN="postgresql://cs2user:pass@postgres/cs2" python3 seed_pro_data.py

Or via docker exec:
  docker exec -i cs2-app python3 /dev/stdin < seed_pro_data.py  # won't work for large files
  docker cp seed_pro_data.py cs2-app:/tmp/
  docker exec cs2-app python3 /tmp/seed_pro_data.py

The script downloads ESTA .json.xz demo files one at a time, extracts attacker kill
positions, and inserts into pro_kills. Stops per-map when TARGET_KILLS_PER_MAP reached.
ESTA data is CSGO (2021-2022) pro matches — coordinate system matches CS2 for all
shared maps.
"""
import json, lzma, os, sys, time, urllib.request
import psycopg2, psycopg2.extras

DB_DSN = os.environ.get("DB_DSN", "")
if not DB_DSN:
    print("ERROR: DB_DSN env var not set", file=sys.stderr)
    sys.exit(1)

TARGET_MAPS = {
    "de_dust2", "de_mirage", "de_inferno", "de_nuke",
    "de_ancient", "de_anubis", "de_vertigo", "de_overpass", "de_train",
}
TARGET_PER_MAP = 3000
GITHUB_API_BASE = "https://api.github.com/repos/pnxenopoulos/esta/contents/data"
RAW_BASE        = "https://raw.githubusercontent.com/pnxenopoulos/esta/master/data"
FOLDERS         = ["online", "lan"]

def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "cs2owl-seeder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if binary else json.loads(r.read())

def list_files(folder):
    files = []
    for page in range(1, 10):
        batch = get(f"{GITHUB_API_BASE}/{folder}?per_page=1000&page={page}")
        if not batch:
            break
        files.extend(item["name"] for item in batch if item["name"].endswith(".json.xz"))
        if len(batch) < 1000:
            break
    return files

def main():
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False

    with conn.cursor() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS pro_kills (
                id   SERIAL PRIMARY KEY,
                map  TEXT  NOT NULL,
                x    FLOAT NOT NULL,
                y    FLOAT NOT NULL,
                side TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_pk_map ON pro_kills(map);
        """)
    conn.commit()

    counts = {m: 0 for m in TARGET_MAPS}
    with conn.cursor() as c:
        c.execute("SELECT map, COUNT(*) AS n FROM pro_kills WHERE map = ANY(%s) GROUP BY map",
                  (list(TARGET_MAPS),))
        for row in c.fetchall():
            counts[row["map"]] = int(row["n"])

    complete = {m for m, n in counts.items() if n >= TARGET_PER_MAP}
    print(f"Starting — already complete: {complete or 'none'}")
    for m, n in sorted(counts.items()):
        print(f"  {m}: {n}/{TARGET_PER_MAP}")

    processed = 0
    for folder in FOLDERS:
        if len(complete) >= len(TARGET_MAPS):
            break
        print(f"\nListing {folder}/ …")
        try:
            files = list_files(folder)
        except Exception as e:
            print(f"  Failed to list {folder}: {e}")
            continue
        print(f"  {len(files)} files found")

        for fname in files:
            if len(complete) >= len(TARGET_MAPS):
                break
            url = f"{RAW_BASE}/{folder}/{fname}"
            try:
                raw = get(url, binary=True)
                data = json.loads(lzma.decompress(raw))
            except Exception as e:
                print(f"  {fname}: download/parse error — {e}")
                continue

            map_name = (data.get("header") or {}).get("map_name", "")
            if map_name not in TARGET_MAPS:
                continue
            if map_name in complete:
                continue

            kills = data.get("kills") or []
            rows = []
            for k in kills:
                x, y = k.get("attackerX"), k.get("attackerY")
                if x is not None and y is not None:
                    rows.append((map_name, float(x), float(y), k.get("attackerSide", "")))

            if rows:
                with conn.cursor() as c:
                    psycopg2.extras.execute_values(
                        c, "INSERT INTO pro_kills (map, x, y, side) VALUES %s", rows)
                conn.commit()
                counts[map_name] = counts.get(map_name, 0) + len(rows)
                processed += 1
                print(f"  [{processed}] {map_name}: +{len(rows)} → total {counts[map_name]}")
                if counts[map_name] >= TARGET_PER_MAP:
                    complete.add(map_name)
                    print(f"  ✓ {map_name} complete!")
            time.sleep(0.3)  # be polite to GitHub

    conn.close()
    print("\n── Final counts ──")
    for m, n in sorted(counts.items()):
        status = "✓" if n >= TARGET_PER_MAP else f"{n}/{TARGET_PER_MAP}"
        print(f"  {m}: {status}")

if __name__ == "__main__":
    main()
