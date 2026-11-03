#!/usr/bin/env python3
"""Textes à traduire : relève les t('…') / tr('…') / tn(n, '…', '…') du code (texte source en français)
et les libellés de données affichés traduits (catégories, pays, disciplines : listes ci-dessous),
puis compare avec chaque js/i18n/<langue>.js.

Usage :
  python3 tools/i18n_check.py            résumé : textes manquants par langue
  python3 tools/i18n_check.py --list     tous les textes source, un par ligne (JSON)
  python3 tools/i18n_check.py --missing en   textes manquants en anglais (JSON)
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'js')
LANGS = ['en', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'bn', 'ur']
SKIP = ('js/data/', 'js/tools/', 'js/seo/', 'js/i18n/')

# Chaîne JS littérale : '…', "…" ou `…` sans ${…}.
STR = r"""'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`"""
CALL = re.compile(r"\b(?:t|tr)\(\s*(?:" + STR + r")")
PLURAL = re.compile(r"\btn\([^,]+,\s*(?:" + STR + r")\s*,\s*(?:" + STR + r")")


def unescape(s):
    return re.sub(r"\\(.)", lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), s)


def code_keys():
    keys = []
    for dirpath, _, files in os.walk(JS):
        for f in sorted(files):
            if not f.endswith('.js'):
                continue
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, ROOT)
            if rel.startswith(SKIP) or rel == 'js/i18n.js':
                continue
            text = open(path, encoding='utf-8').read()
            for m in CALL.finditer(text):
                keys.append(unescape(next(g for g in m.groups() if g is not None)))
            for m in PLURAL.finditer(text):
                groups = [g for g in m.groups() if g is not None]
                keys.extend(unescape(g) for g in groups[:2])
    return keys


def data_keys():
    """Libellés de données traduits à l'affichage (tParts / t(variable)) : pays et catégories des cartes."""
    keys = []
    cards = open(os.path.join(JS, 'data', 'cards.js'), encoding='utf-8').read()
    for line in cards.splitlines():
        if line.startswith('{"id"'):
            c = json.loads(line.strip().rstrip(','))
            keys.append(c['team'])
            keys.extend(c['pos'].split(' · '))
    extra = os.path.join(ROOT, 'tools', 'i18n_data_keys.json')
    if os.path.exists(extra):
        keys.extend(json.load(open(extra, encoding='utf-8')))
    return keys


def all_keys():
    seen, out = set(), []
    for k in code_keys() + data_keys():
        if k and k not in seen and re.search(r'[A-Za-zÀ-ÿ]', k):
            seen.add(k)
            out.append(k)
    return out


def load_lang(lang):
    path = os.path.join(JS, 'i18n', f'{lang}.js')
    if not os.path.exists(path):
        return {}
    text = open(path, encoding='utf-8').read()
    body = text[text.index('{'):text.rindex('}') + 1]
    return json.loads(body)


def main():
    keys = all_keys()
    if '--list' in sys.argv:
        print(json.dumps(keys, ensure_ascii=False, indent=0))
        return
    if '--missing' in sys.argv:
        lang = sys.argv[sys.argv.index('--missing') + 1]
        have = load_lang(lang)
        print(json.dumps([k for k in keys if k not in have], ensure_ascii=False, indent=0))
        return
    print(f'{len(keys)} textes source')
    for lang in LANGS:
        have = load_lang(lang)
        missing = [k for k in keys if k not in have]
        bad = [k for k in keys if k in have and set(re.findall(r'\{\w+\}', k)) != set(re.findall(r'\{\w+\}', have[k]))]
        print(f'  {lang} : {len(keys) - len(missing)}/{len(keys)} traduits'
              + (f', {len(bad)} avec variables différentes : {bad[:3]}' if bad else ''))


if __name__ == '__main__':
    main()
