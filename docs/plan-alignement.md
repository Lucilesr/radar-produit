# Plan d’alignement — itération 2

Seule liste de travail à compter du 8 novembre 2026. Références : [règles](maquettes/iteration-2/README.md), [itération 2](iteration-2.md), [Signal](feuille-de-route.md#3-q0--design-system-radar-vivant). Préparation : maquettes fusionnées dans [#257](https://github.com/Lucilesr/radar-produit/pull/257) et [#259](https://github.com/Lucilesr/radar-produit/pull/259), annotations clarifiées dans [#260](https://github.com/Lucilesr/radar-produit/pull/260). À 390 px, la maquette mobile dédiée fait foi. Les blocs « Annotation · ne pas afficher » ne sont jamais des éléments d’interface ; ils décrivent des états alternatifs du même écran.

Un seul écran en cours. Le suivant commence après fusion **et** recette du précédent sur le staging privé. Aucune production sans validation explicite de cette version. Les anciennes livraisons constituent l’existant à comparer, pas une preuve d’alignement.

| Écran | Maquette | PR | État | Écarts restants |
| --- | --- | --- | --- | --- |
| a. Q2b — Balayage | [Ordinateur](maquettes/iteration-2/Balayage-v2.html) · [mobile](maquettes/iteration-2/Balayage-mobile.html) | [#258](https://github.com/Lucilesr/radar-produit/pull/258) · [grille et preuves](q2b-balayage-vivant/README.md) | fusionné | Aucun écart non justifié ; deux collecteurs réels, un écho par offre unique, cibles 44 px. Staging 84 vérifié, états remplacés sans annotations. |
| b. Aujourd’hui | [Ordinateur](maquettes/iteration-2/Aujourdhui-v2.html) · [mobile](maquettes/iteration-2/Aujourdhui-mobile.html) | [#261](https://github.com/Lucilesr/radar-produit/pull/261) · [grille et preuves](alignement-aujourdhui/README.md) | fusionné | Aucun écart non justifié ; chiffres et durées réels, bilan courant après actualisation, plan de deux à quatre engagements conservé. Staging 86 vérifié. |
| c. Offres | [Ordinateur](maquettes/iteration-2/Offre-fiche.html) · [mobile](maquettes/iteration-2/Offre-mobile.html) | [#262](https://github.com/Lucilesr/radar-produit/pull/262) · existant #256 · [grille](alignement-offres/README.md) | en cours | Grille préalable publiée avant le code ; fiche, décisions et états alternatifs. |
| d. Candidatures — ordinateur | [Ordinateur](maquettes/iteration-2/Candidatures.html) · [mobile](maquettes/iteration-2/Candidatures-mobile.html) | À ouvrir | à faire | Comparer tableau, cartes et tous les états de la bande. |
| e. C4 — Candidatures mobile | [Candidatures mobile](maquettes/iteration-2/Candidatures-mobile.html) | À ouvrir ; existant #254 | à faire | Comparer groupes, filtres, fiche et barre du bas. |
| f. Mon radar | [Ordinateur](maquettes/iteration-2/MonRadar.html) · [mobile](maquettes/iteration-2/MonRadar-mobile.html) | À ouvrir | à faire | Portée, trois sections, termes et tous les états de la bande. |
| g1. Mon compte | Composants et règles communs, adaptés à 390 px | À ouvrir | à faire | Grille au début du lot. |
| g2. Carnet détaillé | Composants et règles communs, adaptés à 390 px | À ouvrir | à faire | Grille au début du lot. |
| g3. Sources détaillées | Composants et règles communs, adaptés à 390 px | À ouvrir | à faire | Grille au début du lot. |
| h. Cohérence globale | [Règles visuelles](maquettes/iteration-2/README.md#règles-visuelles) | À ouvrir | à faire | Inventorier rayons, tailles de titre, couleurs et boutons principaux ; corriger les sorties des règles. |

Pour chaque ligne : grille numérotée publiée dans la PR avant le code ; captures avant / après / maquette côte à côte à 1360 et 390 px, chaque état inclus ; tests et types verts, aucune nouvelle erreur ESLint, console vide, clavier et focus, cibles mobiles 44 px, aide ≤ 120 mots, données fictives conservées. Le résultat et les choix justifiés figurent dans la PR. Les idées hors grille vont dans [idees.md](idees.md).
