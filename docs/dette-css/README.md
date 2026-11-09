# Dette CSS — rangement sans changement visible

Suite de la cohérence Signal (#271). Objectif : aucune différence à l’écran, une base de styles plus simple à faire évoluer.

## Ce qui change

1. **`signal-coherence.css` supprimé.** Ce fichier, chargé en dernier, réécrasait des règles d’autres feuilles. Chaque règle est reportée à sa source :
   - soit la valeur d’origine prend la variable Signal (85 règles de rayon harmonisées) ;
   - soit la règle rejoint la feuille du composant : bulles, menus, dialogues et tiroirs dans `signal-controls.css`, recherche et compte dans `signal-global-header.css`, titre de Mon radar, visite guidée, moments, critères, carnet, kanban, notes.
2. **Rayons et couleurs reliés aux variables.**
   - 197 rayons écrits en dur (10, 16, 20, 999 px) utilisent désormais `--signal-radius-control`, `-card`, `-panel` et `-pill` ;
   - deux nouvelles variables : `--signal-mist-strong` (#dce6eb, survol de navigation) et `--signal-danger-strong` (#a21e33, survol du bouton de suppression).
3. **Styles morts supprimés.** Les règles des classes qu’aucun composant n’utilise plus sont retirées : ancien tableau de bord, anciennes cartes d’offres, résumé d’entonnoir, ancienne liste de critères, etc. Les classes construites dynamiquement (`is-${…}`, `"fact-" + id`…) et celles des bibliothèques sont conservées.
4. **Garde-fous** (`tests/css-signal.test.mjs`) :
   - aucune feuille de surcharge ;
   - aucun rayon Signal en dur ;
   - aucune couleur de survol en dur ;
   - chaque classe stylée existe dans le code.

## Mesures

| | Avant (`main`) | Après |
| --- | --- | --- |
| Feuilles CSS | 49 | 48 |
| Règles | 4 111 | 3 562 |
| Déclarations | 12 066 | 10 399 |
| Taille | 426,7 ko | ≈ 371,7 ko |
| Rayons Signal en dur | 229 | 0 |

## Vérification « rien ne bouge »

Les styles calculés de chaque élément visible ont été relevés avant et après, puis comparés propriété par propriété : rayons, couleurs, polices, interlignage, marges intérieures, tailles minimales, largeur et hauteur. Les relevés couvrent 29 états, à 1360 et 390 px :

- les écrans Aujourd’hui, Offres, Candidatures, Mon radar, Compte, Carnet et Sources ;
- une aide ouverte, le menu du compte, la modale du plan et son menu, le menu de colonne du kanban ;
- la visite guidée, la fiche candidature et l’ajout au carnet.

**Résultat : aucune différence.** Deux exceptions sans effet visible :

- la poignée du tiroir mobile reste totalement arrondie, mais son rayon passe de 999 px à la valeur « infinie » de Tailwind ;
- trois largeurs varient de quelques fractions de pixel dans Sources (horodatage « il y a… »), une variation déjà observée entre deux relevés identiques.
