# Bureau Vallee - Espace Services Windows

Projet dedie a l'Espace Services Bureau Vallee Montaigu-Vendee.

## Structure

- `station-config.js` : configuration locale du poste
- `index.html` : interface de la borne
- `styles.css` : habillage Bureau Vallee
- `app.js` : logique locale de la borne
- `windows-builds/POSTE-COPIEUR-1` : package local pour le poste COPIEUR 1
- `windows-builds/POSTE-COPIEUR-2` : package local pour le poste COPIEUR 2

## Logique des deux postes

- Le package `POSTE-COPIEUR-1` est verrouille sur `COPIEUR 1`
- Le package `POSTE-COPIEUR-2` est verrouille sur `COPIEUR 2`

Chaque poste a :

- sa propre configuration locale
- son propre cache temporaire
- son propre lancement Windows
- sa propre impression cible

## Ce qui est pret

- accueil Bureau Vallee clavier + souris
- depot client par QR code / code de retrait
- source cle USB
- acces admin `BV558`
- verrouillage possible sur un copieur unique

## Ce qui reste a brancher pour la vraie prod

- conversion locale Word/images vers PDF
- envoi reel au pilote Windows Canon imageFORCE C5140
- suppression physique des fichiers temporaires apres impression

## Installation de test sur Windows

1. Copier le dossier `windows-builds/POSTE-COPIEUR-1` ou `windows-builds/POSTE-COPIEUR-2` sur le PC cible
2. Verifier que Microsoft Edge est installe
3. Verifier que l'imprimante Windows porte bien le nom attendu
4. Lancer `LANCER-BUREAU-VALLEE.bat`

## Test du depot client

1. Lancer `npm install`
2. Lancer `npm start`
3. Ouvrir la borne sur `http://localhost:3100`
4. Ouvrir le depot client sur `http://localhost:3100/upload.html`
5. Envoyer un fichier, noter le code, puis le saisir sur la borne

## Important

Cette version ouvre une interface locale HTML en mode application Edge.  
Ce n'est pas encore l'integration impression Windows finale, mais la structure de deploiement est deja prete.
