// Relais de connexion Firebase : beltchase.com/__/auth/* → goalzz-5354f.firebaseapp.com/__/auth/*.
// Méthode recommandée par Firebase quand le site n'est pas hébergé chez eux : la connexion Google
// se fait sur notre domaine (même origine, fenêtre « Continuer vers beltchase.com »).
const FIREBASE_HOST = 'goalzz-5354f.firebaseapp.com';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  url.hostname = FIREBASE_HOST;
  url.port = '';
  url.protocol = 'https:';
  return fetch(new Request(url, request));
}
