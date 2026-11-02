# Génère js/data/cards.js : catalogue des cartes joueurs (photos détourées de TheSportsDB).
# Lancer : python3 tools/build_cards.py   (≈ 4 min : l'API gratuite limite le nombre de requêtes)
# M = mythique, L = légendaire, E = épique, R = rare, C = commun. Un nom de pays après « @ » fait
# une carte de sélection nationale (même joueur, maillot de son pays).
import json, re, sys, time, unicodedata, urllib.parse, urllib.request, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from card_fixes import apply_fixes

SETS = [
  # Ids de collection 'mma' et 'boxe' gardés : les cartes déjà gagnées gardent leur identifiant.
  ('mma', 'MMA', 'mma', '''
    Islam Makhachev M; Ilia Topuria M; Khabib Nurmagomedov M #Russie; Jon Jones L #États-Unis; Alex Pereira L; Merab Dvalishvili L;
    Francis Ngannou L; Georges St-Pierre L; Amanda Nunes L; Tom Aspinall E; Ciryl Gane E; Benoit Saint-Denis E;
    Dricus du Plessis E; Khamzat Chimaev E; Conor McGregor E; Kayla Harrison E; Valentina Shevchenko E; Zhang Weili E;
    Israel Adesanya E; Alexander Volkanovski E; Usman Nurmagomedov E; Alexandre Pantoja R; Belal Muhammad R;
    Max Holloway R; Sean O'Malley R; Manon Fiorot R; Nassourdine Imavov R; Charles Oliveira R; Cedric Doumbe R;
    Salahdine Parnasse R #France; Morgan Charriere R; Leon Edwards R; Jack Della Maddalena R; Shavkat Rakhmonov R;
    Arman Tsarukyan R; Paddy Pimblett R; Ian Machado Garry R; Diego Lopes R #Brésil; Patricio Freire R; Justin Gaethje C;
    Dustin Poirier C; Taylor Lapilus C; William Gomis C; Fares Ziam C; Nora Cornolle C; Oumar Sy C #France; Kevin Jousset C;
    Bo Nickal C; Kevin Holland C; Johnny Eblen C'''),
  ('boxe', 'Boxe', 'boxing', '''
    Oleksandr Usyk M; Muhammad Ali M; Canelo Alvarez L; Naoya Inoue L; Terence Crawford L; Mike Tyson L;
    Floyd Mayweather L; Tyson Fury E; Anthony Joshua E; Gervonta Davis E; Manny Pacquiao E; Vasyl Lomachenko E;
    Claressa Shields E; Katie Taylor E; Jesse Rodriguez E; Tony Yoka E #France; Shakur Stevenson R; Dmitry Bivol R;
    Artur Beterbiev R; Daniel Dubois R; David Benavidez R; Moses Itauma R; Jai Opetaia R; Junto Nakatani R;
    Souleymane Cissokho R #France; Estelle Mossely R #France; Christian M'Billi R #France; Jake Paul C; Devin Haney C;
    Ryan Garcia C; Joseph Parker C; Zhilei Zhang C; Bakary Samake C #France; Milan Prat C #France'''),
  ('kick', 'Kick & Muay Thaï', 'kickboxing', '''
    Rico Verhoeven M #Pays-Bas; Rodtang Jitmuangnon M #Thaïlande; Superlek Kiatmoo9 L #Thaïlande;
    Tawanchai PK Saenchai L #Thaïlande; Buakaw Banchamek L #Thaïlande; Giorgio Petrosyan L #Italie;
    Takeru Segawa E #Japon; Jonathan Haggerty E #Royaume-Uni; Nadaka Yoshinari E #Japon; Chingiz Allazov E #Azerbaïdjan;
    Tenshin Nasukawa E #Japon; Cedric Doumbe E #France; Sitthichai Sitsongpeenong R #Thaïlande; Marat Grigorian R #Arménie;
    Tayfun Ozcan R #Pays-Bas; Levi Rigters R #Pays-Bas; Artem Vakhitov R #Russie; Yohan Lidon R #France;
    Jimmy Vienot R #France; Ilias Bulaid R #Maroc; Nong-O Hama C #Thaïlande; Petchmorakot Petchyindee C #Thaïlande;
    Abdellah Ezbiri C #France; Smokin Jo Nattawut C #Thaïlande'''),
  ('grappling', 'JJB & Grappling', 'bjj', '''
    Gordon Ryan M #États-Unis; Marcus Almeida L #Brésil; Mica Galvao L #Brésil; Ffion Davies L #Royaume-Uni;
    Roger Gracie L #Brésil; Kaynan Duarte E #Brésil; Nicholas Meregali E #Brésil; Craig Jones E #Australie;
    Mikey Musumeci E #États-Unis; Tainan Dalpra E #Brésil; Andre Galvao E #Brésil; Kade Ruotolo E #États-Unis;
    Tye Ruotolo E #États-Unis; Felipe Pena R #Brésil; Pedro Marinho R #Brésil; Adele Fornarino R #Australie;
    Gabi Garcia R #Brésil; Lachlan Giles R #Australie; Giancarlo Bodoni R #États-Unis; Cole Abate R #États-Unis;
    Diogo Reis R #Brésil; Josh Hinger C #États-Unis; Victor Hugo C #Brésil; Kennedy Maciel C #Brésil'''),
  ('lutte', 'Lutte', 'wrestling', '''
    Aleksandr Karelin M #Russie; Kyle Snyder L #États-Unis; David Taylor L #États-Unis; Mijain Lopez L #Cuba;
    Hassan Yazdani L #Iran; Abdulrashid Sadulaev E #Russie; Gable Steveson E #États-Unis; Zavur Uguev E #Russie;
    Kaori Icho E #Japon; Yui Susaki E #Japon; Amit Elor E #États-Unis; Zelimkhan Khadjiev R #France;
    Koumba Larroque R #France; Melonin Noumonvi R #France; Spencer Lee R #États-Unis; Aaron Brooks R #États-Unis;
    Mamadassa Sylla C #France; Pauline Lecarpentier C #France; Kollin Moore C #États-Unis'''),
]
RAR = {'M': 'mythique', 'L': 'legendaire', 'E': 'epique', 'R': 'rare', 'C': 'commun'}
POS = [
  (r'goal', 'Gardien'), (r'back|defen', 'Défenseur'), (r'midfield', 'Milieu'), (r'wing|forward|striker', 'Attaquant'),
  (r'point guard', 'Meneur'), (r'shooting guard|guard', 'Arrière'), (r'power forward', 'Ailier fort'),
  (r'small forward', 'Ailier'), (r'center|centre', 'Pivot'),
]
SPORT = {'football': 'Soccer', 'basketball': 'Basketball', 'tennis': 'Tennis', 'mma': 'Fighting', 'boxing': 'Fighting',
         'kickboxing': 'Fighting', 'bjj': 'Fighting', 'wrestling': 'Fighting',
         'rugby': 'Rugby', 'hockey': 'Ice Hockey', 'americanfootball': 'American Football'}
# Sports individuels : la carte montre le pays du joueur (et sa catégorie de poids), pas un club.
SOLO = {'tennis', 'mma', 'boxing', 'kickboxing', 'bjj', 'wrestling'}
# Discipline affichée sur les cartes sans catégorie de poids connue.
DISCIPLINE = {'kickboxing': 'Kick / Muay Thaï', 'bjj': 'JJB', 'wrestling': 'Lutte'}
NAT_FR = {'Italy': 'Italie', 'Spain': 'Espagne', 'Serbia': 'Serbie', 'Belarus': 'Biélorussie', 'Poland': 'Pologne',
  'United States': 'États-Unis', 'USA': 'États-Unis', 'Germany': 'Allemagne', 'Russia': 'Russie', 'England': 'Angleterre',
  'Great Britain': 'Royaume-Uni', 'United Kingdom': 'Royaume-Uni', 'Denmark': 'Danemark', 'France': 'France', 'Kazakhstan': 'Kazakhstan',
  'Australia': 'Australie', 'Ukraine': 'Ukraine', 'Mexico': 'Mexique', 'Japan': 'Japon', 'Georgia': 'Géorgie', 'Brazil': 'Brésil',
  'South Africa': 'Afrique du Sud', 'New Zealand': 'Nouvelle-Zélande', 'Scotland': 'Écosse', 'Canada': 'Canada', 'Sweden': 'Suède',
  'Czech Republic': 'Tchéquie', 'Norway': 'Norvège', 'Netherlands': 'Pays-Bas', 'Haiti': 'Haïti', 'Switzerland': 'Suisse',
  'Ireland': 'Irlande', 'Brazil ': 'Brésil', 'Cameroon': 'Cameroun', 'Samoa': 'Samoa', 'Tonga': 'Tonga', 'Fiji': 'Fidji',
  'Thailand': 'Thaïlande', 'Cuba': 'Cuba', 'Iran': 'Iran', 'Armenia': 'Arménie', 'Azerbaijan': 'Azerbaïdjan', 'Nigeria': 'Nigeria',
  'China': 'Chine', 'Kyrgyzstan': 'Kirghizistan', 'Uzbekistan': 'Ouzbékistan', 'Morocco': 'Maroc', 'Argentina': 'Argentine',
  'Puerto Rico': 'Porto Rico', 'Dominican Republic': 'Rép. dominicaine', 'Wales': 'Pays de Galles', 'Philippines': 'Philippines',
  'Lithuania': 'Lituanie', 'Dagestan': 'Russie', 'Chechnya': 'Russie', 'Peru': 'Pérou', 'Venezuela': 'Venezuela', 'Italy ': 'Italie'}
WEIGHT_FR = [('light heavyweight', 'Mi-lourds'), ('super middleweight', 'Super-moyens'), ('cruiserweight', 'Lourds-légers'),
  ('heavyweight', 'Lourds'), ('super lightweight', 'Super-légers'), ('middleweight', 'Moyens'), ('welterweight', 'Mi-moyens'),
  ('lightweight', 'Légers'), ('featherweight', 'Plumes'), ('bantamweight', 'Coqs'), ('flyweight', 'Mouches'), ('strawweight', 'Pailles')]
POS_SPORT = {
  'rugby': [('scrum', 'Demi de mêlée'), ('fly', "Demi d'ouverture"), ('wing', 'Ailier'), ('centre|center', 'Centre'), ('full', 'Arrière'),
            ('hooker', 'Talonneur'), ('prop', 'Pilier'), ('lock', 'Deuxième ligne'), ('flanker|back row', 'Troisième ligne'), ('number 8|no. 8', 'Numéro 8')],
  'hockey': [('left wing', 'Ailier gauche'), ('right wing', 'Ailier droit'), ('center|centre', 'Centre'), ('defen', 'Défenseur'), ('goal', 'Gardien')],
  'americanfootball': [('quarterback', 'Quarterback'), ('running', 'Running back'), ('wide', 'Receveur'), ('tight', 'Tight end'),
            ('linebacker', 'Linebacker'), ('defensive end|edge', 'Defensive end'), ('safety', 'Safety'), ('corner', 'Cornerback')],
}
# Noms tels que TheSportsDB les connaît, quand la recherche simple tombe sur un homonyme.
ALIASES = {'Pedri': 'Pedri Gonzalez', 'Rodri': 'Rodrigo Hernandez', 'Kenan Yildiz': 'Kenan Yıldız', 'Alexandre Sarr': 'Alex Sarr'}
# Club actuel quand TheSportsDB ne connaît que la sélection (vérifié chez ESPN, oct. 2026).
TEAM_FIX = {'Thibaut Courtois': 'Real Madrid', 'Kevin De Bruyne': 'Napoli', 'Jeremy Doku': 'Manchester City'}
NATIONS = {'France', 'Belgium', 'Spain', 'England', 'Brazil', 'Argentina', 'Portugal', 'Germany', 'Netherlands', 'Italy', 'Croatia', 'Morocco', 'Norway', 'Egypt'}
# Club actuel → collection (un joueur parti ailleurs change de collection ; hors grands championnats : « Ailleurs »).
LEAGUE_OF = {
  'ligue1': {'Paris SG', 'Marseille', 'Monaco', 'Lyon', 'Lille', 'Lens', 'Nice', 'Rennes', 'Strasbourg', 'Nantes', 'Toulouse', 'Brest', 'Reims', 'Montpellier', 'Auxerre', 'Angers', 'Le Havre', 'Lorient', 'Metz', 'Paris FC'},
  'pl': {'Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham Hotspur', 'Newcastle United', 'Aston Villa', 'Brighton and Hove Albion', 'West Ham United', 'Crystal Palace', 'Brentford', 'Fulham', 'Everton', 'Nottingham Forest', 'Bournemouth', 'Wolverhampton Wanderers', 'Leeds United', 'Sunderland', 'Burnley'},
  'liga': {'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Atlético Madrid', 'Athletic Bilbao', 'Real Sociedad', 'Villarreal', 'Real Betis', 'Sevilla', 'Valencia', 'Girona', 'Celta Vigo'},
  'europe': {'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig', 'Eintracht Frankfurt', 'Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta'},
}
CLUB_SETS = set(LEAGUE_OF)

def slug(s):
  s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
  return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def pos_fr(p, sport, team=''):
  if sport == 'tennis': return 'WTA' if 'women' in (team or '').lower() or 'wta' in (team or '').lower() else 'ATP'
  if sport in DISCIPLINE: return DISCIPLINE[sport]
  if sport in ('mma', 'boxing'):
    t = (team or '').lower()
    fr = next((v for k, v in WEIGHT_FR if k in t), '')
    return ('Poids ' + fr.lower()) if fr else ('UFC' if sport == 'mma' else 'Boxe')
  if sport in POS_SPORT:
    low = (p or '').lower()
    return next((v for k, v in POS_SPORT[sport] if re.search(k, low)), p or '')
  p = (p or '').lower()
  for pat, fr in POS:
    if sport == 'basketball' and fr in ('Gardien', 'Défenseur', 'Milieu', 'Attaquant'): continue
    if sport == 'football' and fr in ('Meneur', 'Arrière', 'Ailier fort', 'Ailier', 'Pivot'): continue
    if re.search(pat, p): return fr
  return ''

cache_file = os.path.join(os.path.dirname(__file__), '.cards_cache.json')
cache = json.load(open(cache_file)) if os.path.exists(cache_file) else {}

def search(name, sport):
  if name in cache: return cache[name]
  url = 'https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=' + urllib.parse.quote(ALIASES.get(name, name))
  for attempt in range(6):
    try:
      with urllib.request.urlopen(url, timeout=20) as r: d = json.load(r)
      break
    except Exception as e:
      print('  retry', name, e, file=sys.stderr); time.sleep(20 * (attempt + 1))
  else:
    # Réseau ou limite de débit : on s'arrête (le cache garde ce qui est déjà trouvé, relancer suffit)
    # plutôt que de prendre un combattant introuvable pour une silhouette.
    json.dump(cache, open(cache_file, 'w')); sys.exit(f'TheSportsDB ne répond pas ({name}) : relancer plus tard.')
  time.sleep(4)
  cands = [p for p in (d.get('player') or []) if p.get('strSport') == SPORT[sport]]
  cands.sort(key=lambda p: ((p.get('strTeam') or '').startswith('_'), (p.get('strTeam') or '') in NATIONS, not p.get('strCutout')))
  hit = cands[0] if cands else None
  cache[name] = hit and {k: hit.get(k) for k in ('idPlayer', 'strPlayer', 'strTeam', 'strNationality', 'strPosition', 'strNumber', 'strCutout', 'strThumb')}
  json.dump(cache, open(cache_file, 'w'))
  return cache[name]

cards, sets, missing = [], [], []
for key, label, sport, spec in SETS:
  for entry in [e.strip() for e in spec.split(';') if e.strip()]:
    m = re.match(r'(.+?)\s+([MLERC])(?:\s+@(.+?))?(?:\s+#(.+))?$', entry)
    name, r, nation, country = m.group(1), m.group(2), m.group(3), m.group(4)
    p = search(name, sport)
    if not p and sport in SOLO and country:
      # Inconnu de TheSportsDB (grappleurs, lutteurs, kick…) : carte silhouette avec son pays.
      p = {'strPlayer': name, 'strTeam': '', 'strNationality': country, 'strPosition': '', 'strNumber': None, 'strCutout': None, 'strThumb': None}
    if not p: missing.append(name); print('MISSING', name, file=sys.stderr); continue
    if country and sport in SOLO: p = {**p, 'strNationality': country}
    if name in TEAM_FIX and not nation: p = {**p, 'strTeam': TEAM_FIX[name]}
    if (p.get('strTeam') or '').startswith('_Free'): p = {**p, 'strTeam': 'Agent libre'}
    setid = key
    if key in CLUB_SETS:
      setid = next((k for k, teams in LEAGUE_OF.items() if p['strTeam'] in teams), 'ailleurs')
    cid = f'{setid}-{slug(name)}'
    if any(c['id'] == cid for c in cards): continue
    cards.append({
      'id': cid, 'set': setid, 'sport': sport, 'name': p['strPlayer'], 'rarity': RAR[r],
      'team': nation or (NAT_FR.get(p.get('strNationality') or '', p.get('strNationality') or '') if sport in SOLO else p['strTeam']), 'national': bool(nation) or sport in SOLO, 'pos': pos_fr(p.get('strPosition'), sport, p.get('strTeam')),
      'num': None if nation or sport in SOLO else (p.get('strNumber') or None),
      'img': p.get('strCutout') or p.get('strThumb') or None, 'cutout': bool(p.get('strCutout')),
    })
    print(f"{cid:45} {p['strTeam']:25} {p.get('strPosition')} {'cutout' if p.get('strCutout') else 'thumb' if p.get('strThumb') else 'NO IMG'}")
  sets.append({'id': key, 'name': label, 'sport': sport})
  if key == 'europe': sets.append({'id': 'ailleurs', 'name': 'Ailleurs dans le monde', 'sport': 'football'})

out = os.path.join(os.path.dirname(__file__), '..', 'js', 'data', 'cards.js')
os.makedirs(os.path.dirname(out), exist_ok=True)
sets = [st for st in sets if any(c['set'] == st['id'] for c in cards)]
with open(out, 'w') as f:
  f.write('// Généré par tools/build_cards.py (photos : TheSportsDB). Ne pas modifier à la main.\n')
  f.write('export const CARD_SETS = ' + json.dumps(sets, ensure_ascii=False, indent=1) + ';\n')
  cards = [apply_fixes(c) for c in cards]  # pays et catégories vérifiés (tools/card_fixes.py)
  f.write('export const CARDS = [\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in cards) + ',\n];\n')
print(len(cards), 'cartes;', 'introuvables:', missing)
