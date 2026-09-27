#!/usr/bin/env python3
"""Mirror the authoritative Hebrew namespaces into the eagerly-bundled copies.

`public/locales/he/*` is the source of truth served to i18next's HTTP backend.
`src/locales/he/*` holds the copies bundled at build time for the namespaces
every route needs at first paint (mirroring src/locales/en and src/locales/ar).
The two must stay byte-identical, or a Hebrew visitor's first paint disagrees
with the on-demand load.

Run from the repository root after editing any public/locales/he file:

    python3 scripts/mirror-he-bundled-locales.py

`src/lib/hebrewLocaleCoverage.test.ts` fails the suite if they drift.
"""
import json
import os

SRC = 'src/locales'
PUBLIC = 'public/locales'
NAMESPACES = ['common', 'landing', 'contact', 'broadcast', 'legal']

os.makedirs(os.path.join(SRC, 'he'), exist_ok=True)
for ns in NAMESPACES:
    with open(os.path.join(PUBLIC, 'he', f'{ns}.json'), encoding='utf-8') as f:
        data = json.load(f)
    out = os.path.join(SRC, 'he', f'{ns}.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'wrote {out}')
