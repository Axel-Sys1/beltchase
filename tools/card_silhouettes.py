#!/usr/bin/env python3
"""Silhouettes des cartes de combattants : icons/silhouettes/<id>.png et js/data/cardSilhouettes.js.

Les cartes n'affichent aucune photo (droit à l'image, droits des photographes) : seulement le contour du
combattant, en aplat, tiré d'une photo sous licence libre de Wikimedia Commons (jamais ESPN ni UFC).
Les licences CC BY-SA s'appliquent aussi à la silhouette tirée de la photo : auteur et licence sont
listés dans les mentions légales (#credits).

1. source : photo de la page Wikipédia du combattant, sinon recherche sur Commons (tools/card_photos.py) ;
2. détourage de la personne par macOS (Vision, tools/silhouette.swift), recadrage au buste ;
3. PNG blanc sur transparent (masque CSS des cartes, js/ui/cards.js).

Usage : python3 tools/card_silhouettes.py [--sources] [--detour]
  --sources : cherche les photos (≈ 3 min) → tools/silhouette_sources.json
  --detour  : télécharge et détoure les photos des sources → icons/silhouettes/, puis écrit le module
  (sans option : les deux). Une carte refusée à l'œil va dans REJECT.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from card_photos import CARDS, UA, commons_photo, wiki_photo, write_credits  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, 'tools', 'silhouette_sources.json')
OUT_DIR = os.path.join(ROOT, 'icons', 'silhouettes')
OUT_JS = os.path.join(ROOT, 'js', 'data', 'cardSilhouettes.js')
SWIFT = os.path.join(ROOT, 'tools', 'silhouette.swift')
# Silhouettes ratées à l'œil (tâche, bras levé coupé, deux personnes) et sans autre photo libre : carte
# avec la silhouette générique. Les ratées qui avaient une autre photo ont été changées dans silhouette_sources.json.
REJECT = {'mma-kayla-harrison', 'mma-kevin-holland', 'grappling-andre-galvao'}


def cards():
    text = open(CARDS, encoding='utf-8').read()
    return [json.loads(l.rstrip(',')) for l in text.splitlines() if l.startswith('{"id"')]


def find_sources():
    out = {}
    for i, c in enumerate(cards(), 1):
        found = None
        try:
            found = wiki_photo(c['name'], c['sport']) or commons_photo(c['name'])
        except Exception as err:
            print(f'  ! {c["name"]} : {err}', file=sys.stderr)
        if found:
            out[c['id']] = found
        print(f'{i:3} {c["name"]:<28} {"ok" if found else "—"}', flush=True)
        time.sleep(0.2)
    json.dump(out, open(SOURCES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n{len(out)} photos libres trouvées')


def detour():
    src = json.load(open(SOURCES, encoding='utf-8'))
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='bc-sil-')
    for cid, s in src.items():
        if cid in REJECT:
            continue
        path = os.path.join(tmp, cid + os.path.splitext(s['src'])[1].split('?')[0])
        try:
            req = urllib.request.Request(s['src'], headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r, open(path, 'wb') as f:
                f.write(r.read())
        except Exception as err:
            print(f'  ! téléchargement {cid} : {err}', file=sys.stderr)
        time.sleep(0.2)
    # SDK de la même version que le compilateur Swift (les outils en ligne de commande en installent plusieurs).
    sdk = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.sdk'
    env = {**os.environ, 'SDKROOT': sdk} if os.path.isdir(sdk) else None
    subprocess.run(['swift', SWIFT, tmp, OUT_DIR], check=True, env=env)
    done = {os.path.splitext(f)[0] for f in os.listdir(OUT_DIR) if f.endswith('.png')}
    sil = {cid: {k: s[k] for k in ('credit', 'license', 'page') if s.get(k)} for cid, s in src.items() if cid in done and cid not in REJECT}
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// Généré par tools/card_silhouettes.py : cartes qui ont une silhouette (icons/silhouettes/<id>.png),\n')
        f.write('// tirée d\'une photo libre de Wikimedia Commons (auteur, licence, page). Ne pas modifier à la main.\n')
        f.write('export const CARD_SILHOUETTES = ')
        json.dump(sil, f, ensure_ascii=False, indent=1)
        f.write(';\n')
    names = {c['id']: c['name'] for c in cards()}
    intro = ('Les cartes n\'affichent aucune photo : seulement la silhouette du combattant, tirée d\'une photo libre de\n'
             '        Wikimedia Commons. Ces silhouettes sont des adaptations de ces photos et suivent leur licence (CC BY-SA :\n'
             '        même licence). Drapeaux : flagcdn.com (domaine public). Logos des soirées : TheSportsDB et les organisateurs.\n'
             '        Photos d\'origine (auteur et licence) :')
    write_credits({k: {**v, 'kind': 'wiki'} for k, v in sil.items()}, names, intro)
    print(f'{len(sil)}/{len(names)} cartes avec silhouette')


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or '--sources' in args:
        find_sources()
    if not args or '--detour' in args:
        detour()
