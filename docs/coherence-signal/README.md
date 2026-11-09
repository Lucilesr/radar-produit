# Cohérence globale — grille avant code

Base : staging privé 114, après #270. [Inventaire par déclaration](inventaire-avant.tsv) des feuilles chargées par l’application, des classes de rayon et des actions principales en JSX. Les déclarations héritées ou écrasées sont conservées dans l’index ; les mesures ci-dessous viennent du rendu à 1360 et 390 px avec des données fictives.

| Écran | Avant 1360 px | Référence 1360 px | Avant 390 px | Référence 390 px |
| --- | --- | --- | --- | --- |
| Aujourd’hui | ![Avant](avant-aujourdhui-ordinateur.jpg) | ![Maquette](../alignement-aujourdhui/maquette-ordinateur.jpg) | ![Avant](avant-aujourdhui-mobile.jpg) | ![Maquette](../alignement-aujourdhui/maquette-mobile.jpg) |
| Offres | ![Avant](avant-offres-ordinateur.jpg) | ![Maquette](../alignement-offres/maquette-ordinateur.jpg) | ![Avant](avant-offres-mobile.jpg) | ![Maquette](../alignement-offres/maquette-mobile.jpg) |
| Candidatures | ![Avant](avant-candidatures-ordinateur.jpg) | ![Maquette](../alignement-candidatures/maquette-ordinateur.jpg) | ![Avant](avant-candidatures-mobile.jpg) | ![Maquette](../alignement-candidatures-mobile/maquette-mobile.jpg) |
| Mon radar | ![Avant](avant-mon-radar-ordinateur.jpg) | ![Maquette](../alignement-mon-radar/maquette-ordinateur.jpg) | ![Avant](avant-mon-radar-mobile.jpg) | ![Maquette](../alignement-mon-radar/maquette-mobile.jpg) |
| Balayage | ![Avant](avant-balayage-ordinateur.jpg) | ![Maquette](../q2b-balayage-vivant/maquette-ordinateur.jpg) | ![Avant](avant-balayage-mobile.jpg) | ![Maquette](../q2b-balayage-vivant/maquette-mobile.jpg) |
| Mon compte | ![Avant](avant-compte-ordinateur.jpg) | ![Référence](../alignement-compte/reference-ordinateur.jpg) | ![Avant](avant-compte-mobile.jpg) | ![Référence](../alignement-compte/reference-mobile.jpg) |
| Carnet | ![Avant](avant-carnet-ordinateur.jpg) | ![Référence](../alignement-carnet/reference-ordinateur.jpg) | ![Avant](avant-carnet-mobile.jpg) | ![Référence](../alignement-carnet/reference-mobile.jpg) |
| Sources | ![Avant](avant-sources-ordinateur.jpg) | ![Référence](../alignement-sources/reference-ordinateur.jpg) | ![Avant](avant-sources-mobile.jpg) | ![Référence](../alignement-sources/reference-mobile.jpg) |

1. [ ] **Rayons** : les contrôles, surfaces et pastilles de l’application utilisent 10, 16, 20 et 999 px. Sur les écrans mesurés, on retrouve aussi 2, 3, 4, 5, 6, 8 et 99 px : boutons et champs, badge du menu, états du carnet et des candidatures, colonnes, barre de progression, critères et aides. Remplacer les valeurs héritées dans les composants utilisés et leurs états (choix, toast, tiroir, dialogue, formulaires, guide). Conserver les coins carrés des pleins écrans, attaches de panneaux et géométrie des dessins.
2. [ ] **Titres** : Mon radar utilise encore Avenir Next et −1,26 px à 28 px ; le titre Offres est à −0,5 px pour 28 px. Le titre du récit mensuel mesure 72 / 32 px. Aligner les titres de page, de dossier et de moment sur la police d’affichage, une limite de 40 / 28 px et un interlettrage d’au moins −0,01em. Les petits libellés de section restent des libellés, les compteurs restent des chiffres.
3. [ ] **Couleurs** : ramener le bandeau de démo et les aides ordinaires à une surface claire avec texte pétrole. Rattacher les couleurs neutres héritées des champs, titres de dialogues et avatars aux variables Signal. Garder le contraste des signaux verts, ambre et rouges, le citron sur fond sombre ou en aplat, et le corail dans les célébrations. La Portée sombre et les moments restent selon les décisions du plan.
4. [ ] **Actions** : contrôler l’action principale de chaque zone, ses variantes et son état désactivé. Maintenir les secondaires de la même zone (navigation, actualisation, retour et annulation) ; n’ajouter aucune action. Garantir 44 px sur mobile pour les aides, commandes compactes, notifications, guide et fermeture des panneaux. Le retour Carnet et son libellé se placent sur la même colonne que le titre.
5. [ ] **Recette** : captures après aux deux formats, en particulier critères ouverts, catalogue, aide, toast, guide et moment. Vérifier clavier, focus, mouvement réduit, texte long et navigation de démo. Console, 435 tests, types, aucune nouvelle erreur ESLint et données intactes. Guide, changelog et plan à jour. Déploiement privé et fusion.

## Relevé avant

| Mesure | Valeurs et usage |
| --- | --- |
| Rayons observés | 2, 3, 4, 5, 6, 8, 10, 16, 20, 99, 999 px ; 50 % et rond complet de la bibliothèque ; coins composés 0/16 et 0/20. |
| Titres observés | H1 : 24, 28, 40 px ; H2 : 14, 15, 16, 18, 20, 21, 22, 24, 26, 32, 34, 36, 72 px ; H3 : 12, 14, 15, 15,2, 16, 18, 20, 22, 24 px. L’index liste les règles conditionnelles et les tailles intermédiaires. |
| Texte observé | Papier #fff, encre #203743, pétrole #193f50 / #24566b, gris #5b6b76, brume #eaf0f3, citron #e6ee53, succès #176947, attention #80551a ; hérités #333 et #535768. |
| Surfaces observées | #fff, #f3f5f6, #eaf0f3, #d4dfe5, #193f50, #24566b, #e6ee53, #edf5f0, #176947, #fff4df ; héritées #d8e4ea et #f7fafb. Rouge #be263d / #fff0f2 pour les erreurs ou actions destructives, corail #ff8a65 pour les célébrations. Nuances de bord, logos, halos et dégradés dans l’index. |
| Actions par zone | En-tête : Ajouter une offre. Aujourd’hui : lancer / reprendre la séance, ou définir le poste. Offres : sélectionner / coller l’annonce / restaurer selon la fiche ; enregistrer dans son éditeur. Candidatures : prochaine étape ; enregistrer le dossier, la relance ou le bilan dans leur éditeur. Mon radar : prochain réglage ; Terminé dans le bloc d’édition. Balayage : lot, retry global ou configuration selon le résultat. Carnet : ajouter / enregistrer, valider une histoire, ouvrir le récit. Sources : ajouter une source ; commandes de réglage séparées. Compte : commandes secondaires et confirmation destructive. Guide et moments : une action de progression. |

États transversaux avant : [critères ordinateur](avant-criteres-ordinateur.jpg) · [mobile](avant-criteres-mobile.jpg), [catalogue ordinateur](avant-catalogue-ordinateur.jpg) · [mobile](avant-catalogue-mobile.jpg), [récit ordinateur](avant-moment-ordinateur.jpg) · [mobile](avant-moment-mobile.jpg), [guide ordinateur](avant-guide-ordinateur.jpg) · [mobile](avant-guide-mobile.jpg). Les états propres à chaque écran restent dans les galeries du plan : ils ne sont pas ajoutés à l’interface.
