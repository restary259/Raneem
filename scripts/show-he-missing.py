#!/usr/bin/env python3
"""Print the en values for keys missing from he, so they can be translated."""
import json, os, sys

ROOT = '/workspace/project/Raneem/public/locales'

def leaves(node, prefix=""):
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            out.update(leaves(v, f"{prefix}.{k}" if prefix else k))
        return out
    if isinstance(node, list):
        out = {}
        for i, v in enumerate(node):
            out.update(leaves(v, f"{prefix}[{i}]"))
        return out
    return {prefix: node}

fn = sys.argv[1]
full = fn.endswith('.json')
fn = fn if full else fn + '.json'
en = json.load(open(os.path.join(ROOT, 'en', fn)))
en_leaves = leaves(en)
he_path = os.path.join(ROOT, 'he', fn)
he_leaves = leaves(json.load(open(he_path))) if os.path.exists(he_path) else {}
missing = {k: v for k, v in en_leaves.items() if k not in he_leaves}
for k, v in missing.items():
    print(f"### {k}\n{v}\n")
print(f"--- {len(missing)} missing in {fn}")
