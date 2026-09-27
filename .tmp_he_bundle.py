import json
import os

# src/locales/{en,ar} are the eagerly-bundled copies of the namespaces every
# route needs. Hebrew had only contact, so a Hebrew visitor's first paint used
# the English bundle before the HTTP backend caught up. Mirror the authoritative
# public/locales/he files into src/locales/he so the two always agree.
SRC = 'src/locales'
PUBLIC = 'public/locales'
NAMESPACES = ['common', 'landing', 'contact', 'broadcast', 'legal']

os.makedirs(os.path.join(SRC, 'he'), exist_ok=True)
for ns in NAMESPACES:
    data = json.load(open(os.path.join(PUBLIC, 'he', f'{ns}.json')))
    out = os.path.join(SRC, 'he', f'{ns}.json')
    with open(out, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'wrote {out}')
