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
