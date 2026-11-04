#!/usr/bin/env bash
# Checks the App Store text in docs/ios-app-store-listing.md against Apple's limits.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re, sys
src = open('docs/ios-app-store-listing.md', encoding='utf-8').read()

def block_after(heading):
    m = re.search(r'^## ' + re.escape(heading) + r'.*?```\n(.*?)```', src, re.S | re.M)
    return m.group(1).strip() if m else None

def table_value(label):
    m = re.search(r'^\| ' + re.escape(label) + r' \| `(.*?)` \|', src, re.M)
    return m.group(1) if m else None

checks = [
    ('Name', table_value('Name'), 30),
    ('Subtitle', table_value('Subtitle'), 30),
    ('Promotional text', block_after('Promotional text'), 170),
    ('Description', block_after('Description'), 4000),
    ('Keywords', block_after('Keywords'), 100),
    ("What's new", block_after("What's new"), 4000),
]
bad = False
for name, text, limit in checks:
    if text is None:
        print(f'MISSING  {name}'); bad = True; continue
    n = len(text)
    ok = n <= limit
    bad |= not ok
    print(f'{"ok  " if ok else "OVER"}  {name}: {n}/{limit}')
sys.exit(1 if bad else 0)
PY
