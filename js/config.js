// Réglages du jeu. Tout ce qui touche à l'équilibrage est ici.
export const CONFIG = {
  STORAGE_KEY: 'beltchase:v1',
  CONTACT_EMAIL: 'contact@beltchase.com', // pied de page et mentions légales (redirection e-mail Cloudflare)
  // Comptes admin (page #admin : combats saisis à la main). Doit correspondre aux règles Firestore.
  ADMIN_EMAILS: ['axel.sirieys@gmail.com'],
  // Lancement officiel. Avant cette date, beltchase.com affiche la page de pré-inscription (bientot.html,
  // functions/_middleware.js) ; ?app dans l'adresse ouvre quand même le jeu (aperçu, admin).
  LAUNCH_AT: '2026-12-01T00:00:00+01:00',
  PRELAUNCH_BONUS: 1000, // Gold offerts à chaque pré-inscrit, à sa première connexion avec le même e-mail
  INSTAGRAM: 'https://www.instagram.com/beltchase.officiel/',
  STARTING_BALANCE: 100,  // monnaie rare : on démarre petit et on gagne en pariant juste
  DAILY_BONUS: 50,
  MIN_STAKE: 1,
  DEFAULT_STAKE: 10,
  QUICK_STAKES: [5, 10, 25], // boutons de mise rapide du panier (+ Max)
  // Habillage saisonnier du site (couleurs, logo, décor), du `from` au `until` inclus ; [] : aucun.
  // Aperçu avant l'heure : ajouter ?theme=noel à l'adresse (js/ui/season.js).
  EVENTS: [
    { id: 'halloween', name: 'Halloween', emoji: '🎃', from: '2026-10-01', until: '2026-11-02' },
    { id: 'noel', name: 'Noël', emoji: '🎄', from: '2026-12-01', until: '2027-01-02' },
  ],
  CARD_PHOTOS: false,      // photos des combattants sur les cartes ; false (choix du 03/11/2026, droit à l'image et droits
                           // des photos) : drapeau + silhouette, stats en touchant la carte dans l'album
  // Fond de l'accueil des nouveaux visiteurs : combattants détourés (photo de leur carte, ou `img`),
  // façon affiche de combat. crop : photo en pied recadrée au buste. Masqué avec CARD_PHOTOS: false.
  // 1 combattant : seul, en grand (.landing-solo) ; 2 : face à face, à gauche et à droite (.landing-duo).
  LANDING_FIGHTERS: ['boxe-ryan-garcia', 'mma-ciryl-gane'],
  RENAME_COST: 1000,       // prix d'un changement de pseudo (gratuit si le pseudo est déjà pris)
  UPCOMING_TARGET: 18,   // matchs fictifs "à venir" maintenus dans la liste
  TICK_MS: 3000,         // fréquence à laquelle on vérifie si un provider doit être rappelé
  FAST_FORWARD_MIN: 15,  // bouton "avancer le temps" (matchs fictifs uniquement)
  RECENT_FINISHED: 12,   // matchs fictifs terminés conservés hors paris
  REAL_DAYS_AHEAD: 28,   // fenêtre des vrais combats (les soirées s'annoncent des semaines avant)
  REAL_FINISHED_KEEP_H: 36, // vrais matchs terminés gardés pour l'affichage (hors paris)
  REAL_STALE_H: 8,       // vrai match jamais terminé après ce délai et sans pari : supprimé

  // Paris en direct (cotes recalculées par Gold selon le score et le temps restant).
  LIVE: {
    MIN_ODDS: 1.25,        // issue plus probable que ça : non proposée (fin de match jouée d'avance)
    MAX_ODDS: 15,          // issue moins probable : non proposée
    CONFIRM_MS: 60_000,    // vrais matchs : un pari n'est validé que si le score n'a pas bougé pendant ce délai
    SUSPEND_MS: { real: 60_000, fake: 4_000 }, // marché suspendu après un changement de score
    STALE_MS: 180_000,     // vrais matchs : source muette depuis ce délai → marché suspendu
  },

  // Emplacements publicitaires : bannière sous l'en-tête, pavé au-dessus du panier (ordinateur) et
  // bas de page ; aucun sur l'accueil ni sur l'écran Panier. Sans régie, chacun affiche un encart
  // « Espace publicitaire » à sa taille. Passer à Google AdSense : voir README.md, « Publicité ».
  ADS: {
    enabled: true,                       // false : aucun emplacement
    client: '',                          // identifiant éditeur AdSense « ca-pub-… » (vide : encarts seulement, rien chez Google)
    slots: { top: '', side: '', bottom: '' }, // id des blocs d'annonces
    hosts: ['beltchase.com', 'www.beltchase.com'], // vraies annonces seulement ici (ailleurs : encarts)
    personalized: false,                 // public dès 15 ans : annonces non personnalisées
    // Message de consentement (cookies) de Google, créé dans AdSense → Confidentialité et messages.
    // true : la balise AdSense se charge dès l'ouverture sur `hosts`, pour que le message s'affiche.
    consent: false,
    contact: '',                         // lien des encarts (ex. 'mailto:…') ; vide : pas de lien
    // Pub récompensée : le joueur regarde une pub et gagne des Gold, quelques fois par jour.
    // live: false → pub simulée (encart + compte à rebours), partout. live: true → vraie pub Google
    // (« H5 Games Ads », à demander dans AdSense) sur `hosts`. test: true → pubs de test de Google.
    rewarded: { enabled: true, gold: 500, perDay: 5, seconds: 15, live: false, test: false },
  },

  // Compte en ligne (connexion par email + sauvegarde de la partie). Coller ici la config
  // « Web app » du projet Firebase ; laissé vide, l'appli reste 100 % locale.
  // Ces valeurs sont publiques par nature : la protection vient des règles Firestore.
  FIREBASE: {
    apiKey: 'AIzaSyA8NTHTF1M42L6p9mbzwrj0e8XEglFtufM',
    // Sur beltchase.com, la connexion passe par le site lui-même (relais functions/__/auth) : la fenêtre
    // Google affiche « beltchase.com » et non l'identifiant technique du projet Firebase.
    authDomain: typeof location !== 'undefined' && /(^|\.)beltchase\.com$/.test(location.hostname) ? location.hostname : 'goalzz-5354f.firebaseapp.com',
    projectId: 'goalzz-5354f',
    appId: '1:666078573502:web:58e89339040b15bf987fef', // application web « BeltChase » (créée le 31/10/2026)
  },
};
