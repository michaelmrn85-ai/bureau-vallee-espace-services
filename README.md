# Bureau Vallee - Espace Services

Application Espace Services pour Bureau Vallee Montaigu-Vendee.

Le projet est separe en trois espaces :

- Admin base : `/admin`
- Sessions d'impression : `/sessions`
- Upload mobile : `/upload`

## Deploiement

Le site officiel doit etre publie sur Render depuis GitHub.

Render utilise :

- build : `npm ci`
- start : `npm start`
- health check : `/health`

## Postes Windows

Les postes sont prepares dans :

- `windows-builds/POSTE-COPIEUR-1`
- `windows-builds/POSTE-COPIEUR-2`

Sur chaque poste Windows :

1. lancer `CONFIGURER-SITE-RENDER.bat` ;
2. coller l'adresse Render du site ;
3. lancer `LANCER-BUREAU-VALLEE.bat`.

## Mot de passe admin

```text
BV558
```
