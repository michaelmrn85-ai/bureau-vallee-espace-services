# Bureau Vallee - Espace Services

Site simple pour l'impression client :

1. le client flashe le QR code ;
2. il envoie ses fichiers depuis son telephone ;
3. il obtient un code a 4 chiffres ;
4. le code est saisi sur le site principal ;
5. les PDF reviennent sur le site avec les reglages d'impression ;
6. l'agent Windows du poste envoie le PDF au copieur installe localement.

## Adresses

- Site principal : `https://bureau-vallee-espace-services.onrender.com`
- Upload mobile : `https://bureau-vallee-espace-services.onrender.com/upload`
- Poste 1 : `https://bureau-vallee-espace-services.onrender.com/poste-1`
- Poste 2 : `https://bureau-vallee-espace-services.onrender.com/poste-2`
- Admin : `https://bureau-vallee-espace-services.onrender.com/admin`

## Formats acceptes

PDF en impression autonome. Word, PNG et JPEG au comptoir.

## Agent impression Windows

Le site Render ne peut pas imprimer directement sur un copieur local. Chaque poste Windows doit lancer l'agent dans `agent-windows`.

Notice : `agent-windows/INSTALLATION-WINDOWS.md`

Variables Render recommandees :

```text
PUBLIC_BASE_URL=https://bureau-vallee-espace-services.onrender.com
PRINT_AGENT_TOKEN=mot-de-passe-agent-a-changer
```

## Logo

Logo Bureau Vallee 2021 utilise depuis Wikimedia Commons :
`https://commons.wikimedia.org/wiki/File:Logo-bureau-vallee-2021.png`

## Important

Le site officiel est uniquement l'adresse Render :

```text
https://bureau-vallee-espace-services.onrender.com
```

Le QR code pointe toujours vers :

```text
https://bureau-vallee-espace-services.onrender.com/upload
```


## Reception par mail Outlook

Le bouton "Envoi par mail" utilise l'adresse `es.bvm@outlook.fr`.
Pour activer la lecture automatique des pieces jointes, definir les variables d'environnement :

```
MAIL_POLLING_ENABLED=1
MAIL_ADDRESS=es.bvm@outlook.fr
MAIL_PASSWORD=mot_de_passe_ou_mot_de_passe_application
MAIL_IMAP_HOST=outlook.office365.com
MAIL_IMAP_PORT=993
MAIL_SMTP_HOST=smtp-mail.outlook.com
MAIL_SMTP_PORT=587
```

Le serveur lit les mails non lus, accepte 5 pieces jointes maximum, cree un code dossier, puis repond au client avec ce code.
