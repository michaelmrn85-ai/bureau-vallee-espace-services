Bureau Vallee - Espace Services
Base locale Windows 11

Projet dedie a l'Espace Services Bureau Vallee Montaigu-Vendee.

Fonctions V2 dans cette maquette :
- depot client par QR code / code de retrait
- source Cle USB
- PDF, Word, PNG et JPEG
- choix COPIEUR 1 / COPIEUR 2
- acces admin avec mot de passe BV558
- suppression automatique apres impression
- suppression automatique du depot distant

Pour le branchement reel Windows :
1. depot des fichiers depuis telephone via Render
2. recuperation sur la borne avec un code a 4 chiffres
3. conversion locale en PDF si necessaire
4. envoi du PDF a l'imprimante Windows nommee COPIEUR 1 ou COPIEUR 2
5. suppression des fichiers temporaires

Prochaine etape recommande :
- transformer cette interface en application Windows locale
- brancher la conversion locale Word/images vers PDF
- lancer l'impression reelle sur les copieurs Canon imageFORCE C5140

Lancement local de test :
1. npm install
2. npm start
3. ouvrir http://localhost:3100 pour la borne
4. ouvrir http://localhost:3100/upload.html pour le depot client
