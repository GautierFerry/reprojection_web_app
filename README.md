# RIProjection — Reprojection de coordonnées dans le navigateur

RIProjection (RIP) est une application web qui permet de reprojeter des coordonnées géographiques directement dans votre navigateur à partir de fichiers tabulaires (CSV, XLSX, XLS).[file:1][file:2] Aucune installation n’est nécessaire côté utilisateur : tout se fait en JavaScript côté client.

> Dépôt GitHub : [https://github.com/GautierFerry/reprojection_web_app](https://github.com/GautierFerry/reprojection_web_app)[file:1]

## Fonctionnalités

- Import de fichiers CSV, XLSX et XLS via glisser-déposer ou bouton de sélection.[file:1][file:2]  
- Analyse automatique du fichier (nombre de colonnes, lignes, séparateur détecté) avec affichage de KPI.[file:1][file:2][file:3]  
- Détection et sélection des champs X et Y dans les colonnes du fichier.[file:1][file:2]  
- Choix du système de coordonnées source et cible parmi plusieurs EPSG courants.[file:1][file:2]  
- Reprojection des coordonnées via proj4 et ajout optionnel d’une colonne `ND_Geom` (coordonnées X/Y regroupées).[file:1][file:2]  
- Aperçu des 20 premières lignes du fichier pour vérification avant traitement.[file:1][file:2]  
- Export des résultats reprojetés en CSV et en Excel (.xlsx) avec nom de base personnalisable.[file:1][file:2]  
- Visualisation des points sur une carte Leaflet pour contrôler le résultat spatialement.[file:2][file:3]  
- Interface moderne, responsive, avec thème orange et composants (sidebar, panels, KPI, dropzone, alerts, loader, etc.).[file:1][file:3]  

## EPSG gérés par défaut

La liste des systèmes de coordonnées proposés est définie dans `app-2.js`.[file:2] Par défaut, l’application inclut notamment :[file:2]

- `EPSG:4326` — WGS 84 (lon/lat).[file:2]  
- `EPSG:3857` — Web Mercator.[file:2]  
- `EPSG:2154` — RGF93 / Lambert-93.[file:2]  
- `EPSG:32631` — WGS 84 / UTM zone 31N.[file:2]  
- `EPSG:32632` — WGS 84 / UTM zone 32N.[file:2]  
- `EPSG:27572` — NTF / Lambert zone II étendu.[file:2]  

Les définitions proj4 correspondantes sont déclarées en dur pour ces EPSG, ce qui permet de reprojeter sans dépendre d’un service externe.[file:2]

## Technologies

- **HTML5** pour la structure de l’interface utilisateur (`index.html`).[file:1]  
- **CSS3** pour le style, la mise en page responsive et le thème (variables CSS, Grid, Flexbox, animations, etc.).[file:3]  
- **JavaScript** vanilla pour la logique métier : lecture des fichiers, parsing, reprojection, gestion de la carte, exports.[file:2]  
- **proj4js** pour la transformation entre systèmes de coordonnées.[file:2]  
- **Leaflet** pour l’affichage cartographique des points reprojetés.[file:2]  
- Librairies de parsing / export (par exemple Papaparse, SheetJS) chargées depuis `index.html` via CDN.[file:1][file:2]  

## Utilisation

1. Ouvrir l’application (via GitHub Pages ou en ouvrant `index.html` en local dans un navigateur récent).[file:1]  
2. Glisser-déposer un fichier CSV/XLSX/XLS dans la zone « Déposez un fichier ici » ou cliquer pour le sélectionner.[file:1][file:2]  
3. Vérifier l’aperçu du fichier (colonnes, nombre de lignes, séparateur) grâce aux KPI affichés.[file:1][file:2][file:3]  
4. Choisir les colonnes correspondant au champ **X** et au champ **Y** dans les listes déroulantes.[file:1][file:2]  
5. Sélectionner l’EPSG source et l’EPSG cible.[file:1][file:2]  
6. Optionnel : cocher la case « Créer la colonne ND_Geom » pour générer une colonne combinant X/Y reprojetés.[file:1][file:2]  
7. Cliquer sur « Lancer la reprojection » pour appliquer la transformation.[file:1][file:2]  
8. Contrôler le résultat via l’aperçu des 20 premières lignes et la carte.[file:1][file:2]  
9. Exporter le fichier transformé en CSV ou Excel (.xlsx) grâce aux boutons prévus.[file:1][file:2]  

## Installation et développement

Le projet est entièrement statique et ne nécessite pas de backend.[file:2]

- Cloner le dépôt :  
  ```bash
  git clone https://github.com/GautierFerry/reprojection_web_app.git
  ```
- Ouvrir le dossier du projet et éditer les fichiers `index.html`, `app-2.js`, `style-3.css` si besoin.[file:1][file:2][file:3]  
- Ouvrir `index.html` dans un navigateur ou utiliser un petit serveur local (par exemple `npx serve`).[file:1]  

## Déploiement

L’application peut être déployée très simplement sur n’importe quel hébergeur de fichiers statiques (GitHub Pages, Netlify, Vercel, hébergement perso, etc.).[file:1][file:2][file:3] Il suffit de publier `index.html`, `app-2.js`, `style-3.css` ainsi que les dépendances référencées.[file:1][file:2][file:3]  

## Support

En cas de problème ou de bug, vous pouvez ouvrir une issue sur le dépôt GitHub :  
[https://github.com/GautierFerry/reprojection_web_app/issues](https://github.com/GautierFerry/reprojection_web_app/issues)[file:1]