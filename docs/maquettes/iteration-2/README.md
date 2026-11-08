# Maquettes de l'itération 2

Référence visuelle pour `docs/iteration-2.md`. Ces six maquettes statiques, à données fictives, s'ouvrent dans un navigateur. Chaque écran est suivi d'une bande « États à construire aussi » ; ces états font partie du lot au même titre que l'écran principal.

| Fichier | Écran | Lots |
| --- | --- | --- |
| `Aujourdhui-v2.html` | Accueil en trois blocs : séance, semaine, radar | P4, P6 |
| `Balayage-v2.html` | Balayage en cours, avec nouvelles offres ou sans rien de nouveau ; barres par source ; sources à visiter | Q2b |
| `Offre-fiche.html` | Fiche dans le lot du jour, barre de décision S/L/X, fiche mystère, offre archivée | Q1, S4 |
| `Candidatures.html` | Colonnes par étape, candidature soignée sur 4, relance à J+7, entonnoir en une ligne, leçons | C1, C2, L3, L4 |
| `Candidatures-mobile.html` | Liste groupée par étape, filtres en pastilles, barre du bas à 4 entrées | C4 |
| `MonRadar.html` | Portée en réglages, puis Ce que je cherche, Où chercher, Ce que je sais faire | P1, P2, P5 |

## Règles visuelles

- **Titres** : 40 px au plus sur ordinateur, 28 px sur mobile, en Bricolage Grotesque, interlettrage d'au moins −0,01em.
- **Rayons** : 20 px pour les grands blocs, 16 px pour les cartes, 10 px pour les boutons, 999 px pour les pastilles.
- **Un seul bouton principal** par zone : pétrole, ou citron sur fond pétrole.
- **Citron** : jamais en texte sur fond clair. **Corail** : réservé aux célébrations.
- **Fond sombre** : réservé aux moments (prochaine étape, nouvelles offres). Jamais pour un état « rien de nouveau ».
- **Aide** : une ligne au plus visible par bloc, le reste derrière ⓘ.

Le fichier `support.js` cité en tête de chaque maquette appartient à l'outil de maquettage. Il est absent ici, ce qui ne gêne pas la lecture.
