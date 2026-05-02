# Bureau Vallee - Espace Services Windows

Projet dedie a l'Espace Services Bureau Vallee Montaigu-Vendee.

## Structure

- `station-config.js` : configuration du poste Windows
- `index.html` : interface de la borne
- `styles.css` : habillage Bureau Vallee
- `app.js` : logique de la session d'impression
- `windows-builds/POSTE-COPIEUR-1` : logiciel du poste COPIEUR 1
- `windows-builds/POSTE-COPIEUR-2` : logiciel du poste COPIEUR 2

## Logique des deux postes

- Le package `POSTE-COPIEUR-1` est verrouille sur `COPIEUR 1`
- Le package `POSTE-COPIEUR-2` est verrouille sur `COPIEUR 2`

Chaque poste a :

- sa propre configuration Windows
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

## Installation sur Windows

1. Copier le dossier `windows-builds/POSTE-COPIEUR-1` ou `windows-builds/POSTE-COPIEUR-2` sur le PC cible
2. Verifier que Google Chrome est installe
3. Double-cliquer sur `CONFIGURER-SITE-RENDER.bat`
4. Coller l'adresse Render du site, exemple `https://bureau-vallee-espace-services.onrender.com`
5. Verifier que l'imprimante Windows porte bien le nom attendu
6. Lancer `LANCER-BUREAU-VALLEE.bat`

## Important

Le site officiel est l'adresse Render permanente.  
Le poste Windows se lance en mode application Chrome et se connecte a cette adresse Render.
