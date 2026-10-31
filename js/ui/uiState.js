// État d'affichage non persisté (filtres, onglets).
export const ui = {
  sport: 'all',          // filtre de sport de la liste des combats
  gender: 'all',         // foot : all | men | women
  day: null,             // jour sélectionné (YYYY-MM-DD) pour les vrais combats
  betsTab: 'pending',    // pending | won | lost | void
  newsSport: 'all',      // filtre de l'écran Actus (services/news.js : NEWS_SPORTS)
  installPrompt: null,   // proposition d'installation du navigateur (Android, ordinateur)
  profileTab: 'stats',   // stats | settings (Profil)
  challengesOpen: false,  // défis du jour dépliés sur l'écran Combats
  openMarkets: new Set(), // combats dont les paris méthode / round sont dépliés
  guestOpen: false,      // accueil : « Jouer sans compte » déplié (gardé quand l'écran se redessine)
  emailOpen: false,      // inscription : formulaire email déplié (Google en avant)
  shopTab: 'daily',      // boutique : daily (cartes du jour) | album | boost | style
  albumSet: null,        // sport affiché dans l'album (null : le premier, Foot)
  topScope: 'season',     // classement : season (mois en cours) | all (tous les temps)
  rankTab: 'top',        // top (classement général) | division | leagues
};
