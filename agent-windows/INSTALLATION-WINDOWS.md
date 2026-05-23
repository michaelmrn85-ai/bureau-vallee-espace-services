# Installation agent impression Windows

L'agent doit etre installe sur chaque poste Windows. Il relie le site Render au copieur deja installe sur le PC.

## 1. Installer les prerequis

Installez sur le poste :

- Node.js LTS
- SumatraPDF
- Le pilote original du copieur

Le copieur doit etre visible dans Windows dans `Parametres > Bluetooth et appareils > Imprimantes et scanners`.

## 2. Recuperer le nom exact du copieur

Le plus simple est de lancer :

```bat
diagnostic-poste.bat
```

Il affiche les imprimantes installees, Node.js, SumatraPDF et Chrome.

Sinon, ouvrez PowerShell puis lancez :

```powershell
Get-Printer | Select-Object Name
```

Copiez exactement le nom du copieur souhaite.

## 2 bis. Installer le logiciel d'origine du copieur

Si vous avez une cle USB ou un fichier `INSTALL.EXE` fourni avec le copieur, lancez-le sur Windows en administrateur avant de configurer l'agent.

Ce fichier doit servir uniquement a installer le pilote original du copieur. Une fois l'installation terminee, le copieur doit apparaitre dans la liste de `diagnostic-poste.bat`.

Si le copieur n'apparait pas dans Windows, notre agent ne pourra pas imprimer dessus.

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

## 4. Lancer le poste en mode client

Sur le poste 1 :

```bat
lancer-poste-1-complet.bat
```

Sur le poste 2 :

```bat
lancer-poste-2-complet.bat
```

Ces fichiers demarrent :

- l'agent d'impression en arriere-plan/minimise ;
- Chrome en plein ecran kiosk sur la bonne page du poste.

Pour relancer proprement l'ecran client :

```bat
relancer-poste-1.bat
```

ou :

```bat
relancer-poste-2.bat
```

## 5. Lancer seulement l'agent pour test

Sur le poste 1 :

```bat
lancer-agent-poste-1.bat
```

Sur le poste 2 :

```bat
lancer-agent-poste-2.bat
```

La fenetre doit rester ouverte. Quand le client clique sur `Imprimer ce PDF`, l'agent recupere la demande et l'envoie au copieur.

## 6. Mise en demarrage automatique

Quand le test est valide :

1. Appuyez sur `Windows + R`
2. Tapez `shell:startup`
3. Ajoutez un raccourci vers `lancer-poste-1-complet.bat` ou `lancer-poste-2-complet.bat`

## 7. Pour empecher le client de fermer

Le mode kiosk Chrome limite deja l'interface : pas de barre d'adresse, pas d'onglets visibles, plein ecran automatique.

Pour un vrai blocage magasin, creez un compte Windows dedie, par exemple `Client Impression`, sans mot de passe admin, puis utilisez ce compte sur le poste client.

Reglages recommandes :

- ne jamais donner le compte administrateur au client ;
- mettre le raccourci `lancer-poste-X-complet.bat` dans `shell:startup` du compte client ;
- masquer ou retirer les icones inutiles du bureau ;
- garder un compte administrateur separe pour sortir du mode client ;
- si disponible sur votre edition Windows, activer `Acces affecte` / `Kiosque` dans Windows pour verrouiller l'usage a Chrome.

Important : aucun site web ne peut empecher a 100 % `Alt+F4`, `Ctrl+Alt+Suppr`, le bouton marche/arret ou un raccourci systeme Windows. Le vrai verrouillage se fait avec un compte Windows limite et le mode Kiosque/Acces affecte.

## Important

Les options d'impression dependent du pilote et de SumatraPDF. Si un copieur ignore une option comme couleur, A3 ou recto-verso, il faudra regler les preferences par defaut dans le pilote Windows du poste.
