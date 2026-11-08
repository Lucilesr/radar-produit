# A — Menu horizontal partout : grille préalable

Décision de l’utilisatrice du 8 novembre. Un seul lot transversal de navigation, avant B. Référence : en-tête des maquettes de l’itération 2. À 390 px, la navigation du bas à quatre entrées reste inchangée.

## Écarts à coder

1. [x] Aujourd’hui, Offres et Balayage ont un en-tête horizontal, Candidatures / Mon radar / Mon compte une barre latérale : fournir le même en-tête horizontal sur tous les écrans d’ordinateur.
2. [x] Placer Aujourd’hui, Offres, Candidatures et Mon radar dans cet ordre ; à droite, la recherche, Ajouter une offre, puis l’avatar. Réutiliser la recherche et ses règles existantes, le dialogue d’ajout et RadarAccountMenu.
3. [x] Retirer la barre latérale sur ordinateur, conserver les quatre entrées mobiles et la fiche Offres mobile plein écran. Les tailles intermédiaires gardent les quatre libellés dans l’en-tête, avec commandes compactes si nécessaire.
4. [x] Sur ordinateur, supprimer le doublon de recherche / ajout replié d’Offres ; le conserver sur mobile. Le clavier suit l’ordre visible et le retour après effacement de recherche vise le champ visible.
5. [x] L’avatar propose Mon compte et le guide sur chaque écran ; vérifier ouverture, clavier, focus et ajout sans écriture involontaire.
6. [x] Le guide cible le menu effectivement visible, y compris après changement de largeur, en démo et pendant l’onboarding.
7. [x] Captures avant / après / maquette à 1360 et 390 px pour les écrans ; vérifier les quatre destinations, le compte, le balayage, les sous-vues, la démo et le guide. Aucune modification des comportements métiers ou données.
8. [x] Tests et types verts, aucune nouvelle erreur ESLint, console sans erreur, cibles mobiles 44 px, composants et rayons Signal, staging privé vérifié.

## Comparaison préalable

Captures du staging 94 avant le code. Les commandes du compte et le dialogue d’ajout sont conservés.

| Format | Menu actuel dans Candidatures | Menu de référence |
| --- | --- | --- |
| 1360 px | ![Avant](avant-candidatures-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |
| 390 px | ![Avant](avant-candidatures-mobile.jpg) | ![Maquette](maquette-mobile.jpg) |

Les captures avant couvrent aussi Aujourd’hui, Offres, Mon radar, Mon compte, Balayage et le menu de l’avatar, dans les deux formats. Les annotations des maquettes ne sont pas des éléments d’interface. Les commandes du compte et le dialogue d’ajout sont conservés. La recherche ouvre déjà Offres : sa logique est réutilisée.

## Résultat

Staging privé **95**, source `d41cff11766da6436bcf4fc02dff6a0a6eb38b7a`, code public `663c662`. [Galerie avant / après / maquette](galerie.html). Les captures viennent du staging via le relais privé de recette : seuls l’authentification et les en-têtes sont transmis, sans transformation de l’interface ; données entièrement fictives.

Les six écrans, l’avatar et le guide sont capturés dans les deux formats. Recherche depuis Mon compte : ouvre Offres, garde le focus et filtre Solstice. Ajout : aucun enregistrement, fermeture et retour au bouton d’origine vérifiés. Le guide cible le premier élément réellement visible, y compris après redimensionnement ; le même mécanisme sert à l’onboarding. Une seule navigation visible ; sur mobile, les quatre cibles mesurent 52 px, sans débordement. Console : aucune erreur ni avertissement.

428 tests et types au vert ; aucune nouvelle erreur ESLint par rapport à l’existant. Vérification intermédiaire à 641 et 1024 px, clavier et focus du guide / dialogue / recherche en local, puis commandes et captures sur staging. Les variantes d’écrans métier restent dans leurs lots respectifs ; ce lot ne modifie que leur navigation commune.

Données : 1 003 offres, 50 candidatures, deux fichiers, tableau et plan conservés à l’identique. Le passage au lundi a recalculé la date/verrou du lot et l’accueil de semaine ; la visite d’Aujourd’hui a actualisé les horodatages des deux sources. Aucune offre, pièce jointe ou configuration de source supprimée. Export public contrôlé avec `prepare.py --check` (275 fichiers, aucune écriture). Production inchangée.
