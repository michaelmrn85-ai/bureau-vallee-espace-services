# Bureau Vallee Espace Services - Installation finale

Ce projet fonctionne avec deux parties uniquement :

1. un site permanent Render pour l'admin, les sessions et l'upload mobile ;
2. un logiciel Windows sur chaque poste copieur, connecte au site Render.

## 1. Site permanent

Le site permanent doit etre publie sur Render depuis GitHub.

Adresses apres publication :

- Admin base : `https://ADRESSE-RENDER/admin`
- Sessions d'impression : `https://ADRESSE-RENDER/sessions`
- Upload mobile : `https://ADRESSE-RENDER/upload`
- Page test poste 1 : `https://ADRESSE-RENDER/poste-1`
- Page test poste 2 : `https://ADRESSE-RENDER/poste-2`

Le QR code doit toujours pointer vers :

```text
https://ADRESSE-RENDER/upload
```

Important : un QR code qui pointe vers `file:///...` ne peut pas fonctionner sur un telephone.

## 2. Preparation sur Mac

Le Mac sert seulement a preparer les fichiers du projet avant GitHub et Render.
Le site utilise en magasin doit etre l'adresse Render permanente.

## 3. Installation sur Windows

Copier le bon dossier sur chaque poste :

- `windows-builds/POSTE-COPIEUR-1` sur le PC du copieur 1
- `windows-builds/POSTE-COPIEUR-2` sur le PC du copieur 2

Sur chaque poste Windows :

1. double-cliquer sur `CONFIGURER-SITE-RENDER.bat` ;
2. coller l'adresse Render du site, sans `/admin` ni `/upload` ;
3. exemple : `https://bureau-vallee-espace-services.onrender.com` ;
4. double-cliquer sur `LANCER-BUREAU-VALLEE.bat`.

Le poste affichera ensuite un QR code vers le depot client Render.

## 4. Role de chaque partie

- Render garde le site admin et le depot client accessibles en permanence.
- Le client envoie ses fichiers depuis son telephone via le QR code.
- Le poste Windows recupere les fichiers et reste verrouille sur son copieur.
- Le pilote d'impression original reste installe sur Windows.

## 5. Mot de passe admin

Mot de passe actuel :

```text
BV558
```
