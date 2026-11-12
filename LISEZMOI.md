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

## Limites connues
- Une demande « en attente » bloque le créneau tant que la gérante ne l'a pas confirmée ou annulée.
- Pas d'annulation en ligne par la cliente : elle contacte le salon.
- Pas de paiement en ligne (acompte non créé). À ajouter plus tard si le client le demande.
- Pas de captcha : la limite par numéro peut être contournée avec d'autres numéros.
