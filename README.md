# RIProjection — Reprojection de coordonnées dans le navigateur

RIProjection (RIP) est une application web qui permet de reprojeter des coordonnées géographiques directement dans votre navigateur à partir de fichiers tabulaires (CSV, XLSX, XLS). Aucune installation n’est nécessaire côté utilisateur : tout se fait en JavaScript côté client.

> Dépôt GitHub : [https://github.com/GautierFerry/reprojection_web_app](https://github.com/GautierFerry/reprojection_web_app)

## Fonctionnalités

- Import de fichiers CSV, XLSX et XLS via glisser-déposer ou bouton de sélection.  
- Analyse automatique du fichier (nombre de colonnes, lignes, séparateur détecté) avec affichage de KPI.  
- Détection et sélection des champs X et Y dans les colonnes du fichier.  
- Choix du système de coordonnées source et cible parmi plusieurs EPSG courants.  
- Reprojection des coordonnées via proj4 et ajout optionnel d’une colonne `ND_Geom` (coordonnées X/Y regroupées).  
- Aperçu des 20 premières lignes du fichier pour vérification avant traitement.  
- Export des résultats reprojetés en CSV et en Excel (.xlsx) avec nom de base personnalisable.  
- Visualisation des points sur une carte Leaflet pour contrôler le résultat spatialement.  
- Interface moderne, responsive, avec thème orange et composants (sidebar, panels, KPI, dropzone, alerts, loader, etc.).  

## EPSG gérés par défaut

La liste des systèmes de coordonnées proposés est définie dans `app.js`. Par défaut, l’application inclut notamment :

- `EPSG:4326` — WGS 84 (lon/lat).  
- `EPSG:3857` — Web Mercator.  
- `EPSG:2154` — RGF93 / Lambert-93.  
- `EPSG:32631` — WGS 84 / UTM zone 31N.  
- `EPSG:32632` — WGS 84 / UTM zone 32N.  
- `EPSG:27572` — NTF / Lambert zone II étendu.  

Les définitions proj4 correspondantes sont déclarées en dur pour ces EPSG, ce qui permet de reprojeter sans dépendre d’un service externe.

## Technologies

- **HTML5** pour la structure de l’interface utilisateur (`index.html`).  
- **CSS3** pour le style, la mise en page responsive et le thème (variables CSS, Grid, Flexbox, animations, etc.).  
- **JavaScript** vanilla pour la logique métier : lecture des fichiers, parsing, reprojection, gestion de la carte, exports.  
- **proj4js** pour la transformation entre systèmes de coordonnées.  
- **Leaflet** pour l’affichage cartographique des points reprojetés.  
- Librairies de parsing / export (par exemple Papaparse, SheetJS) chargées depuis `index.html` via CDN.  

## Utilisation

1. Ouvrir l’application (via GitHub Pages ou en ouvrant `index.html` en local dans un navigateur récent).  
2. Glisser-déposer un fichier CSV/XLSX/XLS dans la zone « Déposez un fichier ici » ou cliquer pour le sélectionner.  
3. Vérifier l’aperçu du fichier (colonnes, nombre de lignes, séparateur) grâce aux KPI affichés.  
4. Choisir les colonnes correspondant au champ **X** et au champ **Y** dans les listes déroulantes.  
5. Sélectionner l’EPSG source et l’EPSG cible.  
6. Optionnel : cocher la case « Créer la colonne ND_Geom » pour générer une colonne combinant X/Y reprojetés.  
7. Cliquer sur « Lancer la reprojection » pour appliquer la transformation.  
8. Contrôler le résultat via l’aperçu des 20 premières lignes et la carte.  
9. Exporter le fichier transformé en CSV ou Excel (.xlsx) grâce aux boutons prévus.  

## Installation et développement

Le projet est entièrement statique et ne nécessite pas de backend.

- Cloner le dépôt :  
  ```bash
  git clone https://github.com/GautierFerry/reprojection_web_app.git
  ```
- Ouvrir le dossier du projet et éditer les fichiers `index.html`, `app.js`, `style.css` si besoin.  
- Ouvrir `index.html` dans un navigateur ou utiliser un petit serveur local (par exemple `npx serve`).  

## Déploiement

L’application peut être déployée très simplement sur n’importe quel hébergeur de fichiers statiques (GitHub Pages, Netlify, Vercel, hébergement perso, etc.). Il suffit de publier `index.html`, `app.js`, `style.css` ainsi que les dépendances référencées.  

## Support

En cas de problème ou de bug, vous pouvez ouvrir une issue sur le dépôt GitHub :  
[https://github.com/GautierFerry/reprojection_web_app/issues](https://github.com/GautierFerry/reprojection_web_app/issues)