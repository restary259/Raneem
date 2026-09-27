#!/usr/bin/env python3
"""Compare Hebrew locale coverage against English for each namespace."""
import json, os, sys

ROOT = '/workspace/project/Raneem/public/locales'

def leaves(node, prefix=""):
    """Yield leaf paths. Arrays are indexed so structure must match."""
    if isinstance(node, dict):
        out = set()
        for k, v in node.items():
            out |= leaves(v, f"{prefix}.{k}" if prefix else k)
        return out
    if isinstance(node, list):
        out = set()
        for i, v in enumerate(node):
            out |= leaves(v, f"{prefix}[{i}]")
        return out
    return {prefix}

en_dir = os.path.join(ROOT, 'en')
total_missing = 0
for fn in sorted(os.listdir(en_dir)):
    if not fn.endswith('.json'):
        continue
    en = json.load(open(os.path.join(en_dir, fn)))
    en_keys = leaves(en)
    he_path = os.path.join(ROOT, 'he', fn)
    if not os.path.exists(he_path):
        print(f"{fn:20} ABSENT   missing={len(en_keys)}")
        total_missing += len(en_keys)
        continue
    he = json.load(open(he_path))
    he_keys = leaves(he)
    missing = en_keys - he_keys
    extra = he_keys - en_keys
    total_missing += len(missing)
    flag = 'OK ' if not missing else 'GAP'
    print(f"{fn:20} {flag} en={len(en_keys):>5} he={len(he_keys):>5} missing={len(missing):>5} extra={len(extra)}")
    if os.environ.get('SHOW') and missing:
        for k in sorted(missing)[:40]:
            print(f"    - {k}")
print(f"\nTOTAL Hebrew keys missing: {total_missing}")
sys.exit(1 if total_missing else 0)
