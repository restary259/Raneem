#!/usr/bin/env python3
"""Merge a TSV of `path<TAB>value` lines into a locale JSON file (path-safe).

Using a TSV avoids the JSON-escaping overhead when a whole section is
translated at once; values may contain any character except newline.
Lines starting with '#' and blank lines are ignored.
"""
import json
import re
import sys


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
            while len(cur) <= tok:
                cur.append(None)
            if last:
                cur[tok] = value
            else:
                if not isinstance(cur[tok], (dict, list)):
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
    target, tsv = sys.argv[1], sys.argv[2]
    root = json.load(open(target))
    n = 0
    for line in open(tsv):
        line = line.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        path, value = line.split('\t', 1)
        set_path(root, path.strip(), value)
        n += 1
    with open(target, 'w') as f:
        json.dump(root, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'merged {n} paths into {target}')


if __name__ == '__main__':
    main()
