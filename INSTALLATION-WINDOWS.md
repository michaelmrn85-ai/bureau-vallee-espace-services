# Installation agent impression Windows

L'agent doit etre installe sur chaque poste Windows. Il relie le site Render au copieur deja installe sur le PC.

## 1. Installer les prerequis

Installez sur le poste :

- Node.js LTS
- SumatraPDF
- Le pilote original du copieur

Le copieur doit etre visible dans Windows dans `Parametres > Bluetooth et appareils > Imprimantes et scanners`.

## 2. Recuperer le nom exact du copieur

Ouvrez PowerShell puis lancez :

```powershell
Get-Printer | Select-Object Name
```

Copiez exactement le nom du copieur souhaite.

## 3. Configurer le poste

Dans le dossier `agent-windows` :

- pour le poste 1, copiez `config-poste-1.example.json` en `config-poste-1.json`
- pour le poste 2, copiez `config-poste-2.example.json` en `config-poste-2.json`

Modifiez ensuite :

```json
"printerName": "NOM EXACT DU COPIEUR"
```

Si SumatraPDF n'est pas installe dans le chemin par defaut, modifiez aussi :

```json
"sumatraPath": "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe"
```

## 4. Lancer l'agent

Sur le poste 1 :

```bat
lancer-agent-poste-1.bat
```

Sur le poste 2 :

```bat
lancer-agent-poste-2.bat
```

La fenetre doit rester ouverte. Quand le client clique sur `Imprimer ce PDF`, l'agent recupere la demande et l'envoie au copieur.

## 5. Mise en demarrage automatique

Quand le test est valide :

1. Appuyez sur `Windows + R`
2. Tapez `shell:startup`
3. Ajoutez un raccourci vers `lancer-agent-poste-1.bat` ou `lancer-agent-poste-2.bat`

## Important

Les options d'impression dependent du pilote et de SumatraPDF. Si un copieur ignore une option comme couleur, A3 ou recto-verso, il faudra regler les preferences par defaut dans le pilote Windows du poste.
