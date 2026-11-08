# P8 — recette et comptage de l’aide

Staging privé, version finale 65, le 8 novembre 2026. Compte et documents fictifs, 1 000 offres et 50 candidatures. Aucun changement de données nécessaire à cette passe.

## Mots visibles sans ouvrir une aide

Comptage des explications dans le contenu de la page, y compris les quatre mots de la mention de confidentialité commune quand elle est présente. Les titres, commandes, valeurs, dates, noms de fichiers, textes de candidature et exemples de message sont du contenu métier ; les statuts de lecture et erreurs sont distingués. Les paragraphes cachés et infobulles fermées ne sont pas comptés. La ponctuation isolée reste comptée par prudence.

| Écran ou sous-vue | Mots d’aide |
| --- | ---: |
| Aujourd’hui, avec récit mensuel fictif | 60 |
| Offres, liste | 8 |
| Offres, explication d’une fiche incomplète et mentions communes | 29 |
| Candidatures, liste | 4 |
| Dossier, préparation sur quatre et relance | 44 |
| Entonnoir, période comprise | 28 |
| Carnet, expériences repliées | 36 |
| Portée, prochain réglage | 10 |
| Portée, réglages tous dépliés | 33 |
| Documents, compte réel vide : majoration statique avec les trois emplacements | 65 |
| Mon compte : démo / compte réel avec avertissement de suppression | 7 / 31 |
| Mes leçons, vide | 34 |
| Mes mois, historique partiel | 26 |
| Ma recherche, critères en jetons et sources | 35 |
| Ma recherche, édition complète du compte de recette et sources | 64 |
| Édition avec tous les critères : majoration statique des champs et de la tolérance | ≤ 109 |
| Recherche avec Autres pistes ouvertes, hors exemple de message à adapter | 56 |

Le tour ajoute au plus 32 mots pour l’écran présenté ; le bouton d’aide remplace ses anciennes explications longues. Les descriptions des formulaires sont à la demande. L’avertissement de suppression reste visible et aucune étape de confirmation n’est retirée.

## Vérifications

- 393 tests réussis, TypeScript réussi. ESLint : les 35 erreurs préexistantes restent distinctes de la passe ; les diagnostics des fichiers retouchés sont les mêmes après déplacement de lignes, aucun nouveau problème.
- Ordinateur 1 360 × 900 et mobile 390 × 844 : six vues principales et fiche, éditeur complet des critères, entonnoir et pistes.
- Aides du compte, des lieux, de l’entonnoir et des pistes : toucher et Entrée ; fermeture Échap et focus conservé. Cibles d’aide de 44 px.
- Aucun débordement horizontal. Cases et formulaires gardés ; niveau visé toujours enregistré avec Terminé. Aucune modification des calculs.
- Console : aucune erreur ni alerte pendant la recette nominale. Pas de migration, de service tiers ou de production.
- Les pannes API ne sont pas provoquées pour ce lot de textes ; les tests métier restent inchangés et réussissent.

## Captures

Les fichiers avant/après sont des captures réelles du staging, jamais des maquettes. Avant : version 62 pour les vues principales, 63 pour l’entonnoir et les pistes encore inchangés, 64 pour les aides de l’éditeur avant leur raccourcissement. Après : versions 63 à 65, avec recapture des vues affectées par le dernier ajustement en 65. La capture avant recherche sur ordinateur conserve son état de chargement ; la vue chargée avant P8 est également documentée dans [P1, recherche sur ordinateur](../p1-termes-compacts/apres-recherche-ordinateur.jpg) et [sur mobile](../p1-termes-compacts/apres-recherche-mobile.jpg). Cette partie était restée identique jusqu’à P8.

Les captures des pistes à leur ouverture montrent aussi leur position sous les sources ; celles des aides montrent leur contenu. Les dimensions des fichiers ont été vérifiées. La limite du titre de dossier étroit sur mobile relève de C4, conservé après P5.
