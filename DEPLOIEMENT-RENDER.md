# Deploiement Render

Le projet doit etre publie sur GitHub, puis connecte a Render.

## Adresses finales

Apres creation du service Render :

- Accueil : `https://ADRESSE-RENDER/`
- Admin base : `https://ADRESSE-RENDER/admin`
- Sessions d'impression : `https://ADRESSE-RENDER/sessions`
- Upload mobile : `https://ADRESSE-RENDER/upload`

Le QR code des postes Windows doit pointer vers :

```text
https://ADRESSE-RENDER/upload
```

## Render

Configuration prevue dans `render.yaml` :

- type : Web Service
- environnement : Node
- build : `npm install`
- start : `npm start`

## Postes Windows

Sur chaque poste :

1. copier le dossier `POSTE-COPIEUR-1` ou `POSTE-COPIEUR-2` ;
2. lancer `CONFIGURER-SITE-RENDER.bat` ;
3. coller l'adresse Render sans chemin, exemple `https://bureau-vallee-espace-services.onrender.com` ;
4. lancer `LANCER-BUREAU-VALLEE.bat`.
