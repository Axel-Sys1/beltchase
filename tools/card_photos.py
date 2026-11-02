#!/usr/bin/env python3
"""Photos des cartes de combattants : js/data/cardPhotos.js.

Pour chaque carte de js/data/cards.js :
1. MMA : portrait officiel ESPN (détouré), trouvé par la recherche ESPN (même nom, sport MMA, image) ;
2. sinon : photo de la page Wikipédia (français puis anglais), seulement si la page parle bien d'un
   combattant ; auteur et licence lus sur Wikimedia Commons (crédits affichés dans les mentions légales).

Usage : python3 tools/card_photos.py [--manquantes]   (≈ 2 min ; --manquantes : seulement les cartes sans photo)
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, 'js', 'data', 'cards.js')
OUT = os.path.join(ROOT, 'js', 'data', 'cardPhotos.js')
UA = {'User-Agent': 'BeltChase/1.0 (https://beltchase.com; contact@beltchase.com)'}
FIGHTER = re.compile(r'box|mma|arts? martiaux|mixed martial|kick|muay|judo|lutt|wrestl|jiu|grappl|combat|fighter|ufc|k-1|glory|savate|karat|sambo', re.I)
# Plus strict (mots entiers) pour Commons, où les fichiers parlent de tout.
COMBAT = re.compile(r'\b(box(e|er|ers|eur|ing)|mma|mixed martial|kick-?box\w*|muay thai|wrestl\w*|lutte|jiu-?jitsu|bjj|grappl\w*|ufc|glory|one championship)\b', re.I)

# Photos trouvées mais refusées à l'œil (combattant minuscule au loin, etc.) : carte avec silhouette.
REJECT = {'lutte-melonin-noumonvi'}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)


def exists(url):
    try:
        req = urllib.request.Request(url, headers=UA, method='HEAD')
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status == 200
    except Exception:
        return False


def plain(s):
    s = unicodedata.normalize('NFD', s)
    return re.sub(r'[^a-z ]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()).strip()


def espn_photo(name):
    q = urllib.parse.quote(name)
    data = get_json(f'https://site.web.api.espn.com/apis/search/v2?query={q}&limit=5&type=player')
    for group in data.get('results', []):
        for c in group.get('contents', []):
            if c.get('sport') != 'mma' or plain(c.get('displayName', '')) != plain(name):
                continue
            aid = c.get('uid', '').split('~a:')[-1]
            url = f'https://a.espncdn.com/i/headshots/mma/players/full/{aid}.png'
            if aid.isdigit() and exists(url):
                return {'src': url, 'kind': 'espn', 'credit': 'ESPN'}
    return None


def commons_credit(file_title):
    q = urllib.parse.quote(file_title)
    data = get_json(f'https://commons.wikimedia.org/w/api.php?action=query&titles=File:{q}&prop=imageinfo&iiprop=extmetadata&format=json')
    for page in data.get('query', {}).get('pages', {}).values():
        meta = (page.get('imageinfo') or [{}])[0].get('extmetadata', {})
        artist = re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value', '')).strip()
        lic = meta.get('LicenseShortName', {}).get('value', '').strip()
        return artist[:80], lic
    return '', ''


SPORT_WORDS = {'mma': 'MMA', 'boxing': 'boxer', 'kickboxing': 'kickboxer', 'bjj': 'jiu-jitsu', 'wrestling': 'wrestler'}


def wiki_titles(name, sport):
    """Titres de pages candidats : le nom exact, puis la recherche Wikipédia « nom + discipline »
    (accents et homonymes : « Mica Galvão », « David Taylor (wrestler) »)."""
    for lang in ('fr', 'en'):
        yield lang, name
    for lang in ('en', 'fr'):
        q = urllib.parse.quote(f'{name} {SPORT_WORDS.get(sport, "")}')
        try:
            hits = get_json(f'https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&srlimit=3&format=json')
        except Exception:
            continue
        # Tous les mots du nom dans le titre (sinon le frère, Karol Itauma pour Moses, passe).
        words = [w for w in plain(name).split() if len(w) >= 3]
        for h in hits.get('query', {}).get('search', []):
            if all(w in plain(h['title']) for w in words):
                yield lang, h['title']


def wiki_photo(name, sport=''):
    seen = set()
    for lang, page in wiki_titles(name, sport):
        if (lang, page) in seen:
            continue
        seen.add((lang, page))
        title = urllib.parse.quote(page.replace(' ', '_'))
        try:
            d = get_json(f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}')
        except Exception:
            continue
        thumb = (d.get('thumbnail') or {}).get('source')
        if re.search(r'\bvs\.?\b|academy|gym\b|\bteam\b', d.get('title', ''), re.I):  # combat ou club : pas un portrait
            continue
        text = f"{d.get('description', '')} {d.get('extract', '')}"
        if not thumb or not FIGHTER.search(text):
            continue
        # Vignette Wikimedia en 500 px (tailles standard seulement : 600 px → erreur 400), sans le suivi
        # « utm » ajouté par l'API ; image d'origine si elle est plus petite que 500 px.
        thumb = 'https://upload.wikimedia.org/' + thumb.split('?')[0].split('wikimedia.org/', 1)[1]
        orig = (d.get('originalimage') or {})
        src = re.sub(r'/(\d+)px-', '/500px-', thumb) if '/thumb/' in thumb else thumb
        if (orig.get('width') or 0) < 500 or not exists(src):
            src = 'https://upload.wikimedia.org/' + orig.get('source', thumb).split('?')[0].split('wikimedia.org/', 1)[1]
        if not exists(src):
            continue
        file_title = urllib.parse.unquote(thumb.split('/thumb/')[-1].split('/')[2]) if '/thumb/' in thumb else urllib.parse.unquote(thumb.rsplit('/', 1)[-1])
        artist, lic = commons_credit(file_title)
        if not lic:  # image non libre (affiche hébergée sur Wikipédia seulement) : interdite
            continue
        return {'src': src, 'kind': 'wiki', 'credit': artist or 'Wikimedia Commons', 'license': lic, 'page': d.get('content_urls', {}).get('desktop', {}).get('page', '')}
    return None


def commons_photo(name):
    """Dernier recours : une photo sur Wikimedia Commons dont le nom de fichier contient le prénom et le nom."""
    q = urllib.parse.quote(f'"{name}" filetype:bitmap')
    hits = get_json(f'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={q}&srnamespace=6&srlimit=10&format=json')
    words = plain(name).split()
    for h in hits.get('query', {}).get('search', []):
        title = h['title'][5:]  # sans « File: »
        if not all(w in plain(title) for w in words) or not re.search(r'\.(jpe?g|png|webp)$', title, re.I):
            continue
        info = get_json('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500&format=json&titles=File:' + urllib.parse.quote(title))
        ii = (next(iter(info['query']['pages'].values())).get('imageinfo') or [{}])[0]
        meta = ii.get('extmetadata', {})
        about = f"{title} {meta.get('Categories', {}).get('value', '')} {meta.get('ImageDescription', {}).get('value', '')}"
        src = ii.get('thumburl') or ii.get('url')
        # Homonymes (Victor Hugo l'écrivain, Craig Jones de Slipknot) : la photo doit parler de sport de combat.
        if not src or not COMBAT.search(about) or not exists(src):
            continue
        artist, lic = commons_credit(title)
        return {'src': src, 'kind': 'wiki', 'credit': artist or 'Wikimedia Commons', 'license': lic, 'page': ii.get('descriptionurl', '')}
    return None


def write_credits(photos, names):
    """Section « Crédits photos » de legal.html (auteur et licence des photos Wikimedia, obligatoires)."""
    import html
    path = os.path.join(ROOT, 'legal.html')
    wiki = sorted((names.get(k, k), v) for k, v in photos.items() if v['kind'] == 'wiki')
    items = '\n'.join(
        f'        <li>{html.escape(n)} : <a href="{html.escape(v.get("page", ""))}" rel="noopener">photo</a> de {html.escape(v["credit"])}'
        f'{", " + html.escape(v["license"]) if v.get("license") else ""}</li>' for n, v in wiki)
    block = ('    <section id="credits" class="card">\n      <h2>Crédits photos</h2>\n'
             '      <p>Portraits des combattants de MMA : ESPN. Logos et affiches des soirées : TheSportsDB et les organisateurs.\n'
             '        Les photos suivantes viennent de Wikimedia Commons, sous licence libre (auteur et licence indiqués) :</p>\n'
             f'      <ul class="credits-list">\n{items}\n      </ul>\n    </section>\n')
    text = open(path, encoding='utf-8').read()
    text = re.sub(r'    <section id="credits" class="card">.*?</section>\n', '', text, flags=re.S)
    i = text.rindex('  </main>')
    open(path, 'w', encoding='utf-8').write(text[:i] + block + text[i:])


def main():
    text = open(CARDS, encoding='utf-8').read()
    cards = [json.loads(l.rstrip(',')) for l in text.splitlines() if l.startswith('{"id"')]
    # --manquantes : garde les photos déjà trouvées, ne cherche que pour les cartes sans photo.
    old = {}
    if '--manquantes' in sys.argv:
        t = open(OUT, encoding='utf-8').read()
        old = json.loads(t[t.index('{'):t.rindex('}') + 1])
    photos = {}
    for i, c in enumerate(cards, 1):
        found = old.get(c['id'])
        try:
            if found or c['id'] in REJECT:
                pass
            elif c['sport'] == 'mma':
                found = espn_photo(c['name'])
            found = found or wiki_photo(c['name'], c['sport']) or commons_photo(c['name'])
        except Exception as err:  # une carte en erreur n'arrête pas les autres
            print(f'  ! {c["name"]} : {err}', file=sys.stderr)
        if found:
            photos[c['id']] = found
        print(f'{i:3}/{len(cards)} {c["name"]:<28} {found["kind"] if found else "—"}')
        time.sleep(0.15)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Généré par tools/card_photos.py : photo de chaque carte (ESPN pour le MMA, sinon Wikipédia\n')
        f.write('// avec auteur et licence). Ne pas modifier à la main.\n')
        f.write('export const CARD_PHOTOS = ')
        json.dump(photos, f, ensure_ascii=False, indent=1)
        f.write(';\n')
    write_credits(photos, {c['id']: c['name'] for c in cards})
    kinds = [p['kind'] for p in photos.values()]
    print(f'\n{len(photos)}/{len(cards)} cartes avec photo : {kinds.count("espn")} ESPN, {kinds.count("wiki")} Wikipédia')


if __name__ == '__main__':
    main()
