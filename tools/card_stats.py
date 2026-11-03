#!/usr/bin/env python3
"""Fiches des cartes de combattants : js/data/cardStats.js (affichées en touchant une carte de l'album).

Pour chaque carte de js/data/cards.js :
1. MMA : fiche ESPN (même recherche que tools/card_photos.py) : bilan V-D-N, victoires par KO et par
   soumission, date de naissance, taille, poids, allonge, garde, surnom, club, id ESPN (fiche complète) ;
2. sinon (et en complément) : Wikidata, via la page Wikipédia du combattant : date de naissance, taille,
   poids, victoires / défaites / nuls quand ils y sont, surnom, lien de la page.

Seulement des faits publics (pas de photo, pas de texte recopié). L'âge est calculé à l'affichage.
Usage : python3 tools/card_stats.py   (≈ 3 min ; à relancer de temps en temps pour mettre les bilans à jour)
"""
import json
import os
import re
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from card_photos import CARDS, FIGHTER, get_json, plain, wiki_titles  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'data', 'cardStats.js')
STANCE = {'orthodox': 'Droitier', 'southpaw': 'Gaucher', 'switch': 'Ambidextre'}


def num(s):
    try:
        return float(str(s).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def espn_id(name):
    q = urllib.parse.quote(name)
    data = get_json(f'https://site.web.api.espn.com/apis/search/v2?query={q}&limit=5&type=player')
    for group in data.get('results', []):
        for c in group.get('contents', []):
            if c.get('sport') == 'mma' and plain(c.get('displayName', '')) == plain(name):
                aid = c.get('uid', '').split('~a:')[-1]
                if aid.isdigit():
                    return aid
    return None


def espn_stats(aid):
    a = get_json(f'https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{aid}').get('athlete', {})
    stats = {s.get('name'): s.get('displayValue') for s in (a.get('statsSummary') or {}).get('statistics', [])}
    rec = re.match(r'(\d+)-(\d+)-(\d+)', stats.get('wins-losses-draws') or '')
    first = lambda v: int(v.split('-')[0]) if v and re.match(r'\d+-', v) else None  # « 10-2 » → 10
    h = re.match(r"(\d+)'\s*(\d+(?:\.\d+)?)?", a.get('displayHeight') or '')
    w = re.search(r'(\d+(?:\.\d+)?)\s*lbs?', a.get('displayWeight') or '')
    r = re.search(r'(\d+(?:\.\d+)?)"', a.get('displayReach') or '')
    out = {
        'src': 'espn', 'espnId': aid,
        'wins': int(rec.group(1)) if rec else None, 'losses': int(rec.group(2)) if rec else None,
        'draws': int(rec.group(3)) if rec else None,
        'kos': first(stats.get('tkos-tkoLosses')), 'subs': first(stats.get('submissions-submissionLosses')),
        'birth': (a.get('dateOfBirth') or '')[:10] or None,
        'heightCm': round((num(h.group(1)) * 12 + (num(h.group(2)) or 0)) * 2.54) if h else None,
        'weightKg': round(num(w.group(1)) * 0.4536) if w else None,
        'reachCm': round(num(r.group(1)) * 2.54) if r else None,
        'stance': STANCE.get(str((a.get('stance') or {}).get('text', '')).lower()),
        'nickname': a.get('nickname') or None,
        'team': (a.get('association') or {}).get('name') or None,
    }
    return {k: v for k, v in out.items() if v not in (None, '')}


def claim(entity, prop):
    for c in entity.get('claims', {}).get(prop, []):
        v = c.get('mainsnak', {}).get('datavalue', {}).get('value')
        if v is not None:
            return v
    return None


def wiki_stats(name, sport):
    for lang, page in wiki_titles(name, sport):
        try:
            s = get_json(f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(page.replace(" ", "_"))}')
        except Exception:
            continue
        if not s.get('wikibase_item') or not FIGHTER.search(f"{s.get('description', '')} {s.get('extract', '')}"):
            continue
        qid = s['wikibase_item']
        e = get_json(f'https://www.wikidata.org/wiki/Special:EntityData/{qid}.json')['entities'][qid]
        birth = claim(e, 'P569')
        height = claim(e, 'P2048')
        mass = claim(e, 'P2067')
        qty = lambda v: num(v.get('amount')) if isinstance(v, dict) else None
        unit = lambda v: (v or {}).get('unit', '') if isinstance(v, dict) else ''
        h = qty(height)
        if h and unit(height).endswith('Q11573'):  # mètre
            h *= 100
        m = qty(mass)
        out = {
            'src': 'wiki', 'page': s.get('content_urls', {}).get('desktop', {}).get('page'),
            'birth': birth['time'][1:11] if isinstance(birth, dict) and birth.get('time') else None,
            'heightCm': round(h) if h and 120 < h < 230 else None,
            'weightKg': round(m) if m and 40 < m < 200 else None,
            'wins': int(qty(claim(e, 'P1355')) or 0) or None,
            'losses': int(qty(claim(e, 'P1356')) or 0) if claim(e, 'P1356') else None,
            'draws': int(qty(claim(e, 'P1357')) or 0) if claim(e, 'P1357') else None,
        }
        en = (e.get('sitelinks') or {}).get('enwiki', {}).get('title')
        if en and out.get('wins') is None:
            out.update(infobox_record(en, sport))
        return {k: v for k, v in out.items() if v not in (None, '')}
    return {}


# Palmarès de l'infobox de Wikipédia en anglais : boxe (« wins = 62 », « ko = 39 »…) ou kick
# (« kickboxingwins = … »). Champs absents → rien.
FIELDS = {
    'boxing': {'wins': ['wins'], 'kos': ['ko', 'wins_ko', 'koes'], 'losses': ['losses'], 'draws': ['draws']},
    'kickboxing': {'wins': ['kickbox_win', 'kickboxingwins'], 'kos': ['kickbox_ko_win', 'kickboxingkowins'],
                   'losses': ['kickbox_loss', 'kickboxinglosses'], 'draws': ['kickbox_draw', 'kickboxingdraws']},
}


def infobox_record(title, sport):
    fields = FIELDS.get(sport)
    if not fields:
        return {}
    q = urllib.parse.quote(title)
    data = get_json(f'https://en.wikipedia.org/w/api.php?action=parse&page={q}&prop=wikitext&section=0&format=json&redirects=1')
    wt = data.get('parse', {}).get('wikitext', {}).get('*', '')
    out = {}
    for key, names in fields.items():
        for n in names:
            m = re.search(r'\|\s*' + n + r'\s*=\s*(\d+)', wt, re.I)
            if m:
                out[key] = int(m.group(1))
                break
    if 'wins' in out:
        out.setdefault('losses', 0)
    return out if 'wins' in out else {}


def main():
    text = open(CARDS, encoding='utf-8').read()
    cards = [json.loads(l.strip().rstrip(',')) for l in text.splitlines() if l.startswith('{"id"')]
    stats = {}
    for i, c in enumerate(cards, 1):
        st = {}
        try:
            if c['sport'] == 'mma':
                aid = espn_id(c['name'])
                if aid:
                    st = espn_stats(aid)
            wk = wiki_stats(c['name'], c['sport'])
            for k, v in wk.items():  # Wikidata complète ce qu'ESPN n'a pas
                st.setdefault(k, v)
        except Exception as err:  # une carte en erreur n'arrête pas les autres
            print(f'  ! {c["name"]} : {err}', file=sys.stderr)
        if st:
            stats[c['id']] = st
        print(f'{i:3}/{len(cards)} {c["name"]:<28} {st.get("src", "—"):<5} {st.get("wins", "")}-{st.get("losses", "")}-{st.get("draws", "")}')
        time.sleep(0.15)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Généré par tools/card_stats.py : faits publics de chaque carte (ESPN pour le MMA, Wikidata sinon).\n')
        f.write('// Ne pas modifier à la main. Pas de photo : les cartes n\'affichent que le drapeau.\n')
        f.write('export const CARD_STATS = ')
        json.dump(stats, f, ensure_ascii=False, indent=0)
        f.write(';\n')
    print(f'\n{len(stats)}/{len(cards)} cartes avec une fiche')


if __name__ == '__main__':
    main()
