#!/usr/bin/env python3
"""Fusionne des traductions dans js/i18n/<langue>.js.

  python3 tools/i18n_build.py <langue> <textes.json> <traductions.txt>

<textes.json> : liste des textes source (python3 tools/i18n_check.py --list > textes.json) ;
<traductions.txt> : une traduction par ligne, dans le même ordre. Les traductions déjà présentes dans
le fichier de la langue sont gardées sauf si une nouvelle les remplace. Refuse le tout si le nombre de
lignes ne correspond pas ou si une ligne perd ou invente une variable {x} ou une balise HTML.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def marks(s):
    return sorted(re.findall(r'\{\w+\}', s)), sorted(re.findall(r'</?\w+>', s))


def main():
    lang, keys_path, txt_path = sys.argv[1:4]
    keys = json.load(open(keys_path, encoding='utf-8'))
    lines = open(txt_path, encoding='utf-8').read().split('\n')
    if lines and lines[-1] == '':
        lines.pop()
    if len(lines) != len(keys):
        sys.exit(f'{len(lines)} lignes pour {len(keys)} textes')
    errors = [f'{i}: {k!r} → {v!r}' for i, (k, v) in enumerate(zip(keys, lines)) if not v.strip() or marks(k) != marks(v)]
    if errors:
        sys.exit('Variables ou balises différentes :\n' + '\n'.join(errors))
    path = os.path.join(ROOT, 'js', 'i18n', f'{lang}.js')
    old = {}
    if os.path.exists(path):
        text = open(path, encoding='utf-8').read()
        old = json.loads(text[text.index('{'):text.rindex('}') + 1])
    old.update(dict(zip(keys, lines)))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f'// Traductions ({lang}) : texte source en français → traduction. Généré par tools/i18n_build.py,\n')
        f.write('// vérifié par tools/i18n_check.py (textes manquants, variables).\n')
        f.write('export default ')
        json.dump(old, f, ensure_ascii=False, indent=0, sort_keys=False)
        f.write(';\n')
    print(f'{lang} : {len(old)} traductions')


if __name__ == '__main__':
    main()
