# BeltChase 🥋🥊

Pronos **MMA, boxe et sports de combat** pour le fun avec une monnaie 100 % virtuelle :
le Gold. **Jeu gratuit, sans argent réel.** Le Gold ne s'achète pas et ne s'échange pas contre de
l'argent ou des lots.

- **Vrais combats** : MMA (UFC, PFL, via ESPN, avec les cotes des bookmakers la semaine du combat),
  boxe (TheSportsDB), et les soirées saisies à la main sur la page admin (`#admin`, comptes
  `CONFIG.ADMIN_EMAILS`) : JJB, lutte, kick, Muay Thaï, ONE, ARES, Hexagone… (Firestore `fights`,
  `js/providers/beltchase.js`).
- **Paris** : vainqueur, vainqueur + méthode (KO/TKO, soumission, décision…) et fin du combat
  (round ou décision), voir `js/services/markets.js`. Méthode inconnue : paris méthode / round remboursés.
- **Combats éclair** : combats fictifs de 2 minutes, simulés round par round.
- **Cartes** : combattants par discipline (`tools/build_cards.py`).

Règles Firestore à ajouter pour la page admin (dans `match /databases/{database}/documents`) :

```
match /fights/{id} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.email_verified == true
    && request.auth.token.email in ['axel.sirieys@gmail.com'];
}
```

## Pré-inscription (jusqu'au lancement)

Avant `CONFIG.LAUNCH_AT` (1er décembre 2026, minuit à Paris), l'accueil de beltchase.com sert
`bientot.html` (compte à rebours + inscription par e-mail, `js/bientot.js`, `css/bientot.css`) à la
place du jeu (`functions/_middleware.js`). `https://beltchase.com/?app` ouvre le jeu et s'en souvient
30 jours (cookie) : aperçu, page admin. À l'heure du lancement, la page bascule seule sur le jeu.
En local (`serve.py`), l'accueil reste le jeu : la page est sur <http://localhost:5173/bientot>.

Chaque pré-inscrit reçoit `CONFIG.PRELAUNCH_BONUS` Gold et le titre exclusif « Pionnier » à sa première
connexion avec la même adresse (`js/services/prelaunch.js`). Liste des adresses : page `#admin` →
« Télécharger la liste » (CSV, pour l'e-mail du lancement). Lien à suivre : `?src=instagram`, `?src=tiktok`…

Règles Firestore (dans `match /databases/{database}/documents`) :

```
match /preinscriptions/{email} {
  allow create: if request.resource.data.keys().hasOnly(['email', 'lang', 'src', 'at'])
    && request.resource.data.email == email
    && email.size() <= 120 && email.matches('^[^@\\s/]+@[^@\\s/]+\\.[^@\\s/]+$')
    && request.resource.data.lang is string && request.resource.data.lang.size() <= 5
    && request.resource.data.src is string && request.resource.data.src.size() <= 20
    && request.resource.data.at == request.time
    && getAfter(/databases/$(database)/documents/stats/preinscriptions).data.last == email;
  allow get: if request.auth != null && request.auth.token.email.lower() == email;
  allow list: if request.auth != null && request.auth.token.email_verified == true
    && request.auth.token.email in ['axel.sirieys@gmail.com'];
}
match /stats/preinscriptions {
  allow read: if true;
  allow write: if request.resource.data.keys().hasOnly(['count', 'last'])
    && request.resource.data.count == (resource == null ? 0 : resource.data.count) + 1
    && !exists(/databases/$(database)/documents/preinscriptions/$(request.resource.data.last))
    && existsAfter(/databases/$(database)/documents/preinscriptions/$(request.resource.data.last));
}
```

## Langues

Le site est en 10 langues : français (texte source), anglais, espagnol, portugais (Brésil), russe,
arabe et ourdou (de droite à gauche), chinois, hindi, bengali. Langue choisie : `?lang=xx`, sinon le
choix enregistré, sinon celle du navigateur (anglais par défaut) ; sélecteur dans Profil → Réglages,
sur l'accueil et en pied de page. Moteur : `js/i18n.js` (`t('Texte en français')`, `tParts` pour les
libellés de données, `tn` pour le pluriel) ; traductions : `js/i18n/<langue>.js`.

Après avoir ajouté ou changé un texte :
`python3 tools/i18n_check.py` (textes manquants par langue), puis
`python3 tools/i18n_check.py --missing en > textes.json` et une traduction par ligne dans un fichier
texte, fusionnée par `python3 tools/i18n_build.py en textes.json traductions.txt` (vérifie les
variables `{n}` et les balises). Les actus et les pages /pronos restent en français.

## Lancer l'appli en local

Aucune installation : HTML, CSS et JavaScript (modules ES), sans dépendance.

```bash
cd beltchase
python3 serve.py
```

Puis ouvrir <http://localhost:5173>. En local, les vrais matchs sont lus **en direct** chez ESPN.

## Version en ligne

<https://beltchase.com> (domaine et DNS chez Cloudflare, Cloudflare Pages).

- Le site est servi depuis le dépôt GitHub du projet (branche `main`, sans étape
  de build) : chaque `git push` le remet en ligne en une minute environ.
- Publier depuis ce Mac : `./tools/deploy.sh "message"` (commit + push en HTTPS ; l'accès
  GitHub est géré par GitHub CLI, `~/.local/bin/gh`, connecté au compte Axel-Sys1).
- En ligne, les vrais matchs sont lus **en direct** depuis le navigateur de chaque visiteur (ESPN et
  TheSportsDB autorisent la lecture directe). Le relais `functions/api/fetch.js` (Pages Function,
  cache partagé) ne sert que de secours si ESPN ne répond pas : chaque appel compte dans le quota
  gratuit de 100 000 appels de Functions par jour. L'instantané
  `data/real-matches.json` ne sert que de secours si ces sources ne répondent pas.

### Comptes (Firebase, projet `goalzz-5354f`)

Connexion facultative (email + mot de passe ou Google) : sauvegarde de la partie
(`users/<uid>`), classement par division (`leaderboard/<uid>`) et pseudos uniques
(`pseudos/<pseudo>`), ligues privées (`leagues/<CODE>`). Les règles Firestore limitent chacun
à ses propres documents. Pour tenir dans le plan gratuit : sauvegarde au plus toutes les 30 s,
classements rechargés au plus toutes les 5 min, 200 derniers paris réglés gardés en ligne par
joueur (les RR des plus anciens sont résumés dans `rrBase`). Pseudos filtrés par
`js/services/moderation.js`.

### Publicité

Trois emplacements, réglés dans `CONFIG.ADS` (`js/config.js`) et dessinés par `js/ui/ads.js` :
bannière sous l'en-tête (320×50, 728×90 dès 728 px de large), pavé 300×250 au-dessus du panier
(ordinateur) et bas de page (300×250 ou 728×90). Aucun sur l'accueil ni sur l'écran Panier. Ils
vivent dans la coque de l'appli, jamais dans les écrans redessinés en continu : une annonce n'est
ainsi jamais rechargée toute seule. Sans régie, ils affichent un encart « Espace publicitaire »
(lien vers `contact` si renseigné, sans annonceur de jeux d'argent ni de casino) ;
`enabled: false` les retire.

Passer à Google AdSense :

1. Compte AdSense (titulaire majeur), site `beltchase.com`, vérifié par la balise
   `<meta name="google-adsense-account" content="ca-pub-…">` dans le `<head>` d'`index.html` (le
   script n'est chargé qu'après le choix d'un pseudo : le robot de Google ne le voit pas).
2. Fichier `ads.txt` donné par AdSense à la racine du dépôt.
3. Confidentialité et messages : message RGPD en français avec le bouton « Ne pas autoriser ».
4. Annonces automatiques désactivées : seuls les trois blocs de la coque sont prévus.
5. Contrôles de blocage : laisser bloquée la catégorie « Jeux d'argent et paris » et bloquer les
   sites des opérateurs de paris (public dès 15 ans).
6. Créer trois blocs d'annonces display, coller l'identifiant éditeur dans `client` et leurs id
   dans `slots`. Les vraies annonces ne s'affichent que sur les domaines de `hosts` ; ailleurs
   (local, miroir GitHub Pages), les encarts restent.
7. Mettre à jour `legal.html#confidentialite`, qui dit aujourd'hui « pas de publicité ciblée,
   pas de cookies publicitaires » : section Publicité (Google, cookies, consentement et comment le
   retirer, liens policies.google.com/technologies/partner-sites et adssettings.google.com).
   Avec des revenus réguliers, l'éditeur n'est plus « non professionnel » (mentions légales).

Cookies (consentement) : message RGPD de Google, créé dans AdSense → Confidentialité et messages.
Une fois publié, passer `CONFIG.ADS.consent: true` : la balise AdSense se charge dès l'ouverture sur
beltchase.com et le message s'affiche ; le lien « Cookies » du pied de page le rouvre (`openCookieSettings`).

Pub récompensée (`CONFIG.ADS.rewarded`, `js/services/rewardAd.js`, `js/ui/rewardAd.js`) : bouton
« Bonus vidéo » dans « Ta journée », `gold` Gold par pub vue jusqu'au bout, `perDay` fois par
jour. Avec `live: false`, c'est une pub simulée (encart + compte à rebours de `seconds` secondes).
Pour de vraies pubs : demander « H5 Games Ads » (annonces pour jeux) dans AdSense, passer
`test: true` pour vérifier avec les pubs de test de Google, puis `live: true` et `test: false`.

### Instantané de secours

Pour rafraîchir `data/real-matches.json` à la main : `python3 tools/update_snapshot.py`.
`tools/update_snapshot.py` n'a besoin de rien d'installer : il exécute les providers
JavaScript avec le moteur de macOS (`jsc`) et se charge lui-même du réseau. Chaque résultat
est lu deux fois, à 25 secondes d'écart, avant d'être validé.

## Règles de règlement des paris

- Les paris d'avant-match ferment au coup d'envoi (la sélection quitte le panier).
- Paris en direct (foot, basket, hockey, foot US, rugby, tennis ; pas MMA ni boxe) : cotes recalculées
  par BeltChase selon le score et le temps restant (`js/providers/liveOdds.js`), à partir des cotes figées
  au coup d'envoi, avec la même marge de 7 %. En simple uniquement. Une cote qui bouge doit être
  acceptée. Issue sous 1,25 ou au-dessus de 15 non proposée ; marché suspendu juste après un but,
  si la source se tait, et en fin de match (foot dès 85', rugby dès 75', 2 dernières minutes au
  basket, hockey et foot US, prolongations). Vrais matchs : le pari n'est validé que si le score ne
  bouge pas pendant 60 s (la source a du retard sur la télé), sinon il est remboursé ; scores lus
  toutes les 30 s. Matchs éclair : le score se joue en direct pendant les 2 minutes.
- Un résultat n'est validé que s'il est officiel et lu deux fois de suite.
- Foot : le 1N2 se règle sur le score à 90 minutes (prolongations et tirs au but exclus).
- Basket, hockey, foot US, tennis, MMA : pari à 2 issues, prolongations comprises. Un nul
  (rare) est **remboursé**.
- Match reporté, annulé ou abandonné, combat annulé ou « no contest », forfait au tennis :
  **remboursé**. Abandon en cours de match au tennis : réglé sur le vainqueur officiel.
- Sans résultat 48 h après le début : remboursé.
- Cotes : celles des bookmakers quand ESPN les publie (ramenées à la marge BeltChase de 7 %),
  sinon estimées par BeltChase à partir des classements et bilans (« cotes estimées »).

## Architecture

```
serve.py                   serveur local (sans cache) + enregistrement de l'instantané
tools/update_snapshot.py   mise à jour de l'instantané sans navigateur
data/real-matches.json     instantané des vrais matchs
tests/                     tests des providers (jsc), avec de vraies réponses ESPN
js/
├── config.js  sports.js  store.js  util.js
├── providers/
│   ├── index.js           contrat des providers + choix direct / instantané
│   ├── odds.js            conversion des cotes et modèle maison
│   ├── espn/              foot & sports d'équipe, tennis, MMA
│   ├── thesportsdb/       boxe (TheSportsDB, clé gratuite)
│   ├── snapshotProvider.js
│   └── fakeProvider.js    matchs éclair
├── services/              logique métier (synchro, paris, badges, ligues…)
├── tools/                 génération de l'instantané
└── ui/                    écrans, effets, événements, emplacements pub (ads.js)
```

### Tests

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/teamSports.test.mjs
```

(idem pour `tennis`, `mma`, `boxing`).

## Limites

- Tout est stocké dans le navigateur de chaque joueur : les ligues privées fonctionnent
  entre profils d'un même appareil. Un classement partagé entre téléphones demandera un serveur.
- Le classement général inclut 12 joueurs simulés (marqués « simulé »).
- Données ESPN : API publique non officielle, qui peut changer sans préavis.
- Boxe (TheSportsDB gratuit) : au plus 3 combats par jour, cotes neutres (1,86 / 1,86), et
  certains résultats ne sont jamais publiés : le pari est alors remboursé après 4 jours.
