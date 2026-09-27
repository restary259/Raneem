#!/usr/bin/env python3
"""Flag Hebrew strings that contain Latin letters mixed into a Hebrew word.

A Latin run adjacent to Hebrew letters usually means an accidental
half-translated word (e.g. 'סimulator'). Latin runs surrounded by spaces or
punctuation are legitimate (brand names, URLs, placeholders).
"""
import json
import re
import sys
import os

LATIN = re.compile(r'[A-Za-z]{2,}')
HEB = re.compile(r'[\u0590-\u05FF]')

bad = 0
for fn in sorted(os.listdir(sys.argv[1])):
    if not fn.endswith('.json'):
        continue
    path = os.path.join(sys.argv[1], fn)
    data = json.load(open(path))

    def walk(node, prefix=""):
        global bad
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{prefix}.{k}" if prefix else k)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{prefix}[{i}]")
        elif isinstance(node, str) and HEB.search(node):
            for m in LATIN.finditer(node):
                s, e = m.start(), m.end()
                # A Latin run with Hebrew on BOTH sides is a half-translated
                # word (e.g. 'סimulator'). One side only is a Hebrew prefix or
                # suffix next to a brand/proper noun ('ו-Studienkolleg').
                before = node[s - 1] if s > 0 else " "
                after = node[e] if e < len(node) else " "
                if HEB.match(before) and HEB.match(after):
                    print(f"{fn}:{prefix}: {node!r}")
                    bad += 1
                    break

    walk(data)
print(f"\n{bad} suspicious mixed strings")
sys.exit(1 if bad else 0)
