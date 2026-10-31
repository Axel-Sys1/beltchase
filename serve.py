#!/usr/bin/env python3
"""Serveur de développement de BeltChase.

- Sert les fichiers de l'appli (sans cache, pour voir les modifications tout de suite).
- POST /__snapshot (depuis cette machine uniquement) enregistre data/real-matches.json,
  l'instantané des vrais matchs utilisé par la version publiée en ligne.

Usage : python3 serve.py [port]   (5173 par défaut)
"""
import http.server
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
# Flux d'actus relayés (même liste que functions/api/rss.js, qui fait ce travail en ligne).
RSS_ALLOWED = {
    'https://rmcsport.bfmtv.com/rss/sports-de-combat/',
    'https://lasueur.com/wp-json/wp/v2/posts?per_page=20&_fields=link,title,date_gmt,excerpt,jetpack_featured_media_url,class_list',
}
SNAPSHOT = os.path.join(ROOT, 'data', 'real-matches.json')
MAX_BYTES = 15_000_000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        # Comme Cloudflare Pages : /legal sert legal.html.
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.exists(local + '.html'):
            return local + '.html'
        return local

    def do_GET(self):
        # /api/rss?u=<flux> : comme la Pages Function en ligne.
        if self.path.startswith('/api/rss?'):
            target = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('u', [''])[0]
            if target not in RSS_ALLOWED:
                self.send_error(403, 'Flux non autorisé')
                return
            try:
                req = urllib.request.Request(target, headers={'User-Agent': 'Mozilla/5.0 (BeltChase)'})
                with urllib.request.urlopen(req, timeout=15) as res:
                    body = res.read()
            except Exception as err:  # flux injoignable
                self.send_error(502, str(err))
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path != '/__snapshot':
            self.send_error(404)
            return
        if self.client_address[0] not in ('127.0.0.1', '::1'):
            self.send_error(403, 'Réservé à cette machine')
            return
        length = int(self.headers.get('Content-Length') or 0)
        if not 0 < length <= MAX_BYTES:
            self.send_error(413)
            return
        try:
            data = json.loads(self.rfile.read(length))
            if not isinstance(data.get('matches'), list):
                raise ValueError('matches manquant')
        except (ValueError, json.JSONDecodeError) as err:
            self.send_error(400, str(err))
            return
        os.makedirs(os.path.dirname(SNAPSHOT), exist_ok=True)
        tmp = SNAPSHOT + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, SNAPSHOT)
        self.send_response(204)
        self.end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'BeltChase sur http://localhost:{port}')
    http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
