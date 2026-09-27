#!/usr/bin/env python3
"""Merge a flat path -> value mapping into a locale JSON file (path-safe)."""
import json, re, sys


def parse(p):
    toks = []
    for part in p.split('.'):
        m = re.match(r'^([^\[]*)((?:\[\d+\])*)$', part)
        if not m:
            raise ValueError(f'bad path segment: {part!r}')
        name, idxs = m.group(1), m.group(2)
        if name:
            toks.append(name)
        for i in re.findall(r'\[(\d+)\]', idxs):
            toks.append(int(i))
    return toks


def set_path(root, path, value):
    toks = parse(path)
    cur = root
    for i, tok in enumerate(toks):
        last = i == len(toks) - 1
        if isinstance(tok, int):
            if not isinstance(cur, list):
                raise TypeError(f'expected list at {path}')
            while len(cur) <= tok:
                cur.append(None)
            if last:
                cur[tok] = value
            else:
                if cur[tok] is None or not isinstance(cur[tok], (dict, list)):
                    cur[tok] = [] if isinstance(toks[i + 1], int) else {}
                cur = cur[tok]
        else:
            if last:
                cur[tok] = value
            else:
                if tok not in cur or not isinstance(cur[tok], (dict, list)):
                    cur[tok] = [] if isinstance(toks[i + 1], int) else {}
                cur = cur[tok]


def main():
    target, frag = sys.argv[1], sys.argv[2]
    root = json.load(open(target))
    data = json.load(open(frag))
    for k, v in data.items():
        set_path(root, k, v)
    with open(target, 'w') as f:
        json.dump(root, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'merged {len(data)} paths into {target}')


if __name__ == '__main__':
    main()
