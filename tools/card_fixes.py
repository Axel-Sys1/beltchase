# Corrections vérifiées des cartes (pays et catégorie) : TheSportsDB a souvent des infos vieilles ou
# vides (« UFC », « Boxe »). Appliquées par build_cards.py ; relu le 01/11/2026.
# Lancer seul pour corriger js/data/cards.js sans tout regénérer : python3 tools/card_fixes.py
FIXES = {
  # MMA
  'Jon Jones': {'pos': 'Poids lourds'},
  'Alex Pereira': {'pos': 'Mi-lourds'},
  'Amanda Nunes': {'pos': 'Poids coqs'},
  'Tom Aspinall': {'pos': 'Poids lourds'},
  'Ciryl Gane': {'pos': 'Poids lourds'},
  'Khamzat Chimaev': {'team': 'Émirats arabes unis', 'pos': 'Poids moyens'},
  'Valentina Shevchenko': {'team': 'Kirghizistan'},
  'Zhang Weili': {'pos': 'Poids pailles'},
  'Max Holloway': {'pos': 'Poids légers'},
  'Cedric Doumbe|mma': {'team': 'France', 'pos': 'Mi-moyens · PFL'}, # sa carte kick garde « Kick / Muay Thaï »
  'Salahdine Parnasse': {'pos': 'Poids légers · KSW'},
  'Morgan Charriere': {'pos': 'Poids plumes'},
  'Shavkat Rakhmonov': {'team': 'Kazakhstan'},
  'Diego Lopes': {'pos': 'Poids plumes'},
  'Taylor Lapilus': {'pos': 'Poids coqs'},
  'Oumar Sy': {'pos': 'Mi-lourds'},
  'Kevin Jousset': {'pos': 'Mi-moyens'},
  # Boxe
  'Muhammad Ali': {'pos': 'Poids lourds'},
  'Naoya Inoue': {'pos': 'Poids super-coqs'},
  'Terence Crawford': {'pos': 'Poids super-moyens'},
  'Mike Tyson': {'pos': 'Poids lourds'},
  'Floyd Mayweather Jr.': {'pos': 'Mi-moyens'},
  'Floyd Mayweather': {'pos': 'Mi-moyens'},
  'Manny Pacquiao': {'pos': 'Mi-moyens'},
  'Vasyl Lomachenko': {'pos': 'Poids légers'},
  'Katie Taylor': {'pos': 'Poids super-légers'},
  'Jesse Rodriguez': {'pos': 'Poids super-mouches'},
  'Tony Yoka': {'pos': 'Poids lourds'},
  'Jai Opetaia': {'pos': 'Lourds-légers'},
  'Souleymane Cissokho': {'pos': 'Super-mi-moyens'},
  'Estelle Mossely': {'pos': 'Poids légers'},
  "Christian M'billi": {'pos': 'Poids super-moyens'},
  "Christian M'Billi": {'pos': 'Poids super-moyens'},
  'Bakary Samake': {'pos': 'Super-mi-moyens'},
  'Milan Prat': {'pos': 'Super-mi-moyens'},
}


def apply_fixes(card):
    # « Nom|sport » quand un combattant a des cartes dans plusieurs disciplines.
    fix = FIXES.get(f"{card['name']}|{card['sport']}") or FIXES.get(card['name'])
    if fix:
        card.update(fix)
    return card


if __name__ == '__main__':
    import json, os
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'js', 'data', 'cards.js')
    lines = open(path, encoding='utf-8').read().split('\n')
    n = 0
    for i, l in enumerate(lines):
        if l.startswith('{"id"'):
            comma = l.endswith(',')
            c = json.loads(l.rstrip(','))
            before = dict(c)
            apply_fixes(c)
            if c != before:
                n += 1
                lines[i] = json.dumps(c, ensure_ascii=False) + (',' if comma else '')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'{n} cartes corrigées')
