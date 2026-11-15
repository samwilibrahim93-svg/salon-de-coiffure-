# Site du salon de coiffure (Parakou, Albarika)

Contenu : `index.html` (site public + réservation), `admin.html` (espace de la gérante),
`config.js` (réglages publics), `api.js`, `common.js`, `site.js`, `admin.js`, `styles.css`, dossier `photos`.

## Ce qui est déjà fait côté base de données (projet Supabase « salon-coiffure-parakou »)
Tables : réglages du salon, prestations, réservations, créneaux bloqués, administratrices.
Sécurité : le public ne peut PAS lire les réservations ni les numéros des clientes. Il peut seulement
voir les prestations et les horaires, demander les créneaux libres et envoyer une demande de réservation.
Le serveur vérifie tout : horaires, jours fermés, créneau libre, chevauchement, téléphone, limite de 3 rendez-vous à venir par numéro.

## Créer le compte de la gérante (à faire une seule fois)
1. Ouvre https://supabase.com/dashboard, projet « salon-coiffure-parakou ».
2. Menu « Authentication » → « Users » → « Add user » → « Create new user ». Saisis son email et un mot de passe solide
   (fais-le toi-même, ne l'envoie à personne par chat). Coche « Auto Confirm User ».
3. Menu « SQL Editor » → colle et exécute (remplace l'email) :
   insert into public.admins (user_id) select id from auth.users where email = 'EMAIL_DE_LA_GERANTE';
4. Menu « Authentication » → « Sign In / Providers » → désactive « Allow new users to sign up ».
Ensuite elle se connecte sur `admin.html` et complète : nom du salon, adresse, numéro WhatsApp, règle d'annulation, prestations et prix.

## Mise en ligne (GitHub Pages)
1. Crée un dépôt public (par exemple `salon-parakou`), puis « Ajouter un fichier » → « Téléverser des fichiers ».
2. Glisse TOUT le contenu du dossier décompressé (pas le dossier lui-même), puis « Valider les modifications ».
3. « Paramètres » → « Pages » → source « Déployer à partir d'une branche », branche `principal` (ou `main`), dossier `/ (racine)` → « Sauvegarder ».
4. Ton lien : https://TON-NOM.github.io/salon-parakou/ et l'espace gérante : .../admin.html

## Nouveautés : Mes rendez-vous, heures libres, photos des prestations
- **Mes rendez-vous** : après une réservation, la référence et le numéro sont gardés sur le téléphone de la cliente. À chaque visite (même après actualisation), ses rendez-vous et leur état (en attente / confirmé / annulé) s'affichent. Une autre personne ne voit jamais les rendez-vous d'une autre cliente. Changement de téléphone : « Retrouver un rendez-vous » avec la référence + le numéro.
- **Jours et heures libres** : affichés sur la page pour les 7 prochains jours, à chaque visite. Toucher une heure la présélectionne.
- **Photos des prestations** : dans l'espace gérante > Prestations, choisir une photo parmi celles du site ou en envoyer une nouvelle (réduite automatiquement). La photo apparaît sur la carte de la prestation et dans le choix de réservation.
- Fichiers à remplacer sur GitHub : index.html, styles.css, config.js (inchangé), api.js, common.js, site.js, admin.js. La base de données est déjà à jour.

## Version 3 : annulation, nom à la place du code, espace photos, nouveau design
- **Annuler un rendez-vous** : la cliente peut l'annuler elle-même dans « Mes rendez-vous » (confirmation en 2 clics). Le créneau redevient libre et la gérante voit « Annulé ». Seuls les rendez-vous à venir peuvent être annulés, et il faut le bon numéro de téléphone. Un rendez-vous annulé ou passé peut être « retiré de la liste » sur l'appareil (il reste dans l'espace gérante).
- **Plus de code de référence** : le rendez-vous est retrouvé avec le **nom** écrit à la réservation + le numéro. (Un code technique existe toujours dans la base mais n'est plus montré.)
- **Espace Photos** (espace gérante > onglet Photos) : Yasmin ajoute ou supprime des photos de la galerie, sans toucher aux fichiers. Les photos ajoutées sont aussi proposées pour illustrer une prestation.
- **Nouveau design** moderne : accueil avec photos, prestations en grandes cartes photo, galerie en mosaïque.
- Fichiers à remplacer sur GitHub : index.html, styles.css, api.js, common.js, site.js, admin.js, admin.html.

## Limites connues
- Le nom écrit à la réservation sert à retrouver un rendez-vous : deux clientes avec le même nom ET le même numéro verraient les mêmes rendez-vous (cas très improbable).
- Les rendez-vous mémorisés sont liés à l'appareil : si la cliente vide son navigateur, elle utilise « Retrouver un rendez-vous ».
- Une demande « en attente » bloque le créneau tant que la gérante ne l'a pas confirmée ou annulée.
- Pas d'annulation en ligne par la cliente : elle contacte le salon.
- Pas de paiement en ligne (acompte non créé). À ajouter plus tard si le client le demande.
- Pas de captcha : la limite par numéro peut être contournée avec d'autres numéros.
