# Cohérence globale — grille et recette

Base : staging privé 114, après #270. [Inventaire avant](inventaire-avant.tsv) et [inventaire après](inventaire-apres.tsv) des feuilles chargées par l’application, des classes de rayon et des actions principales en JSX. Les déclarations héritées ou écrasées sont conservées dans l’index ; les mesures ci-dessous viennent du rendu à 1360 et 390 px avec des données fictives.

### 1360 px

| Écran | Avant | Après | Référence |
| --- | --- | --- | --- |
| Aujourd’hui | ![Avant](avant-aujourdhui-ordinateur.jpg) | ![Après](apres-aujourdhui-ordinateur.jpg) | ![Maquette](../alignement-aujourdhui/maquette-ordinateur.jpg) |
| Offres | ![Avant](avant-offres-ordinateur.jpg) | ![Après](apres-offres-ordinateur.jpg) | ![Maquette](../alignement-offres/maquette-ordinateur.jpg) |
| Candidatures | ![Avant](avant-candidatures-ordinateur.jpg) | ![Après](apres-candidatures-ordinateur.jpg) | ![Maquette](../alignement-candidatures/maquette-ordinateur.jpg) |
| Mon radar | ![Avant](avant-mon-radar-ordinateur.jpg) | ![Après](apres-mon-radar-ordinateur.jpg) | ![Maquette](../alignement-mon-radar/maquette-ordinateur.jpg) |
| Balayage | ![Avant](avant-balayage-ordinateur.jpg) | ![Après](apres-balayage-ordinateur.jpg) | ![Maquette](../q2b-balayage-vivant/maquette-ordinateur.jpg) |
| Mon compte | ![Avant](avant-compte-ordinateur.jpg) | ![Après](apres-compte-ordinateur.jpg) | ![Référence](../alignement-compte/reference-ordinateur.jpg) |
| Carnet | ![Avant](avant-carnet-ordinateur.jpg) | ![Après](apres-carnet-ordinateur.jpg) | ![Référence](../alignement-carnet/reference-ordinateur.jpg) |
| Sources | ![Avant](avant-sources-ordinateur.jpg) | ![Après](apres-sources-ordinateur.jpg) | ![Référence](../alignement-sources/reference-ordinateur.jpg) |

### 390 px

| Écran | Avant | Après | Référence |
| --- | --- | --- | --- |
| Aujourd’hui | ![Avant](avant-aujourdhui-mobile.jpg) | ![Après](apres-aujourdhui-mobile.jpg) | ![Maquette](../alignement-aujourdhui/maquette-mobile.jpg) |
| Offres | ![Avant](avant-offres-mobile.jpg) | ![Après](apres-offres-mobile.jpg) | ![Maquette](../alignement-offres/maquette-mobile.jpg) |
| Candidatures | ![Avant](avant-candidatures-mobile.jpg) | ![Après](apres-candidatures-mobile.jpg) | ![Maquette](../alignement-candidatures-mobile/maquette-mobile.jpg) |
| Mon radar | ![Avant](avant-mon-radar-mobile.jpg) | ![Après](apres-mon-radar-mobile.jpg) | ![Maquette](../alignement-mon-radar/maquette-mobile.jpg) |
| Balayage | ![Avant](avant-balayage-mobile.jpg) | ![Après](apres-balayage-mobile.jpg) | ![Maquette](../q2b-balayage-vivant/maquette-mobile.jpg) |
| Mon compte | ![Avant](avant-compte-mobile.jpg) | ![Après](apres-compte-mobile.jpg) | ![Référence](../alignement-compte/reference-mobile.jpg) |
| Carnet | ![Avant](avant-carnet-mobile.jpg) | ![Après](apres-carnet-mobile.jpg) | ![Référence](../alignement-carnet/reference-mobile.jpg) |
| Sources | ![Avant](avant-sources-mobile.jpg) | ![Après](apres-sources-mobile.jpg) | ![Référence](../alignement-sources/reference-mobile.jpg) |

1. [x] **Rayons** : les contrôles, surfaces et pastilles de l’application utilisent 10, 16, 20 et 999 px. Sur les écrans mesurés, on retrouve aussi 2, 3, 4, 5, 6, 8 et 99 px : boutons et champs, badge du menu, états du carnet et des candidatures, colonnes, barre de progression, critères et aides. Remplacer les valeurs héritées dans les composants utilisés et leurs états (choix, toast, tiroir, dialogue, formulaires, guide). Conserver les coins carrés des pleins écrans, attaches de panneaux et géométrie des dessins.
2. [x] **Titres** : Mon radar utilise encore Avenir Next et −1,26 px à 28 px ; le titre Offres est à −0,5 px pour 28 px. Le titre du récit mensuel mesure 72 / 32 px. Aligner les titres de page, de dossier et de moment sur la police d’affichage, une limite de 40 / 28 px et un interlettrage d’au moins −0,01em. Les petits libellés de section restent des libellés, les compteurs restent des chiffres.
3. [x] **Couleurs** : ramener le bandeau de démo et les aides ordinaires à une surface claire avec texte pétrole. Rattacher les couleurs neutres héritées des champs, titres de dialogues et avatars aux variables Signal. Garder le contraste des signaux verts, ambre et rouges, le citron sur fond sombre ou en aplat, et le corail dans les célébrations. La Portée sombre et les moments restent selon les décisions du plan.
4. [x] **Actions** : contrôler l’action principale de chaque zone, ses variantes et son état désactivé. Maintenir les secondaires de la même zone (navigation, actualisation, retour et annulation) ; n’ajouter aucune action. Garantir 44 px sur mobile pour les aides, commandes compactes, notifications, guide et fermeture des panneaux. Le retour Carnet et son libellé se placent sur la même colonne que le titre.
5. [x] **Recette** : captures après aux deux formats, en particulier critères ouverts, catalogue, aide, toast, guide et moment. Vérifier clavier, focus, mouvement réduit, texte long et navigation de démo. Console, 435 tests, types, aucune nouvelle erreur ESLint et données intactes. Guide, changelog et plan à jour. Déploiement privé et fusion.

## Relevé avant

| Mesure | Valeurs et usage |
| --- | --- |
| Rayons observés | 2, 3, 4, 5, 6, 8, 10, 16, 20, 99, 999 px ; 50 % et rond complet de la bibliothèque ; coins composés 0/16 et 0/20. |
| Titres observés | H1 : 24, 28, 40 px ; H2 : 14, 15, 16, 18, 20, 21, 22, 24, 26, 32, 34, 36, 72 px ; H3 : 12, 14, 15, 15,2, 16, 18, 20, 22, 24 px. L’index liste les règles conditionnelles et les tailles intermédiaires. |
| Texte observé | Papier #fff, encre #203743, pétrole #193f50 / #24566b, gris #5b6b76, brume #eaf0f3, citron #e6ee53, succès #176947, attention #80551a ; hérités #333 et #535768. |
| Surfaces observées | #fff, #f3f5f6, #eaf0f3, #d4dfe5, #193f50, #24566b, #e6ee53, #edf5f0, #176947, #fff4df ; héritées #d8e4ea et #f7fafb. Rouge #be263d / #fff0f2 pour les erreurs ou actions destructives, corail #ff8a65 pour les célébrations. Nuances de bord, logos, halos et dégradés dans l’index. |
| Actions par zone | En-tête : Ajouter une offre. Aujourd’hui : lancer / reprendre la séance, ou définir le poste. Offres : sélectionner / coller l’annonce / restaurer selon la fiche ; enregistrer dans son éditeur. Candidatures : prochaine étape ; enregistrer le dossier, la relance ou le bilan dans leur éditeur. Mon radar : prochain réglage ; Terminé dans le bloc d’édition. Balayage : lot, retry global ou configuration selon le résultat. Carnet : ajouter / enregistrer, valider une histoire, ouvrir le récit. Sources : ajouter une source ; commandes de réglage séparées. Compte : commandes secondaires et confirmation destructive. Guide et moments : une action de progression. |

États transversaux avant : [critères ordinateur](avant-criteres-ordinateur.jpg) · [mobile](avant-criteres-mobile.jpg), [catalogue ordinateur](avant-catalogue-ordinateur.jpg) · [mobile](avant-catalogue-mobile.jpg), [récit ordinateur](avant-moment-ordinateur.jpg) · [mobile](avant-moment-mobile.jpg), [guide ordinateur](avant-guide-ordinateur.jpg) · [mobile](avant-guide-mobile.jpg). Les états propres à chaque écran restent dans les galeries du plan : ils ne sont pas ajoutés à l’interface.


## Recette sur le staging privé 116

Source Sites : `5f9721b67806025dc6c1f53e107ab6f77491a3eb`. Les captures des écrans inchangés entre 115 et 116 restent identiques ; Sources, critères et mouvement réduit ont été repris sur 116.

| État | 1360 px | 390 px |
| --- | --- | --- |
| Critères ouverts | [Avant](avant-criteres-ordinateur.jpg) · [Après](apres-criteres-ordinateur.jpg) | [Avant](avant-criteres-mobile.jpg) · [Après](apres-criteres-mobile.jpg) |
| Catalogue | [Avant](avant-catalogue-ordinateur.jpg) · [Après](apres-catalogue-ordinateur.jpg) | [Avant](avant-catalogue-mobile.jpg) · [Après](apres-catalogue-mobile.jpg) |
| Aide | [Avant](avant-aide-ordinateur.jpg) · [Après](apres-aide-ordinateur.jpg) | [Avant](avant-aide-mobile.jpg) · [Après](apres-aide-mobile.jpg) |
| Récit mensuel | [Avant](avant-moment-ordinateur.jpg) · [Après](apres-moment-ordinateur.jpg) | [Avant](avant-moment-mobile.jpg) · [Après](apres-moment-mobile.jpg) |
| Guide et visite | [Avant](avant-guide-ordinateur.jpg) · [Après](apres-guide-ordinateur.jpg) · [Visite](apres-visite-ordinateur.jpg) | [Avant](avant-guide-mobile.jpg) · [Après](apres-guide-mobile.jpg) · [Visite](apres-visite-mobile.jpg) |
| Fiche Offres | [Après](apres-fiche-offre-ordinateur.jpg) | [Après](apres-fiche-offre-mobile.jpg) |
| Notification de visite | [Après](apres-toast-ordinateur.jpg) | [Après](apres-toast-mobile.jpg) |
| Compte neuf, mouvement réduit | [Après](apres-reduit-ordinateur.jpg) | [Après](apres-reduit-mobile.jpg) |

- Les titres de page mesurés sont en Bricolage Grotesque : 40/28 px pour les espaces principaux, 28/28 pour Offres, 40/24 pour Balayage. Le titre du récit et ses variantes partagées sont plafonnés à 40/28 px. Les quatre rayons sont appliqués aux composants courants ; les panneaux accrochés et les pleins écrans gardent leurs coins carrés côté bord. L’index recense aussi les règles historiques écrasées ; il ne présente pas toutes ces règles comme des valeurs rendues.
- Bandeau de démo brume, aide blanche et texte pétrole mesurés ; citron réservé au contraste sur pétrole et aux aplats. Les variantes de statut conservent leurs libellés et leurs couleurs. L’aide et la fermeture du toast mesurent 44 × 44 px ; les trois décisions de la fiche mesurent 52 px de haut sur mobile. Les critères ouverts n’ont aucun contrôle bouton en dessous de 44 px à 390 px.
- Entrée et Échap testés dans les aides, listes de critères, catalogue et récit. Navigation de démo et entrée dans le guide vérifiées. Le mouvement réduit coupe animations et transitions. Aucun débordement horizontal dans les vues mesurées. Aucun nouveau texte d’aide, plafond de 120 mots conservé. Une action principale par zone ; les actions et leurs données ne changent pas.
- 435 tests réussis, vérification des types et ESLint ciblé sans nouvelle erreur, console vide. Offres, candidatures, fichiers, profil, sources, expériences et journal de référence identiques. Visite fictive faite sur un compte distinct. Staging privé, aucun changement en production.
