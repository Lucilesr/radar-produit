# Aujourd’hui — grille avant code

Références : [ordinateur](../maquettes/iteration-2/Aujourdhui-v2.html), [mobile 390 px faisant foi](../maquettes/iteration-2/Aujourdhui-mobile.html). Existant : staging 84. Les annotations décrivent des états qui remplacent les blocs, jamais une bande affichée.

| Format | Avant | Maquette |
| --- | --- | --- |
| Ordinateur 1360 px | ![Avant](avant-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |
| Mobile 390 px | ![Avant](avant-mobile.jpg) | ![Maquette](maquette-mobile.jpg) |

1. [ ] **En-tête et colonne** : reprendre l’en-tête horizontal déjà aligné sur Balayage, sur Aujourd’hui uniquement ; date et « Bonjour prénom » (40 px ordinateur / 28 px mobile), durée de la séance sur ordinateur. Mobile : date/titre et compte dans un seul en-tête blanc, sans recherche ni ajout ; barre Accueil/Offres/Suivi/Mon radar, cibles 44 px. Contenu 1120 px, marge 32 px ordinateur / 16 px mobile, blocs espacés de 20 / 14 px.
2. [ ] **Séance** : titre 32 / 24 px, mention « Prochaine étape », bouton citron 52 px à droite sur ordinateur et pleine largeur sur mobile. Les deux étapes suivantes passent dessous : puces sur ordinateur, liste mobile. Le titre de tri décrit le lot réel et ses offres très proches. L’entretien sous 48 h garde sa priorité et précise la préparation de l’histoire proposée. Aucun changement de classement ni de durée calculée.
3. [ ] **Semaine** : carte blanche rayon 16, titre et série sur une ligne, progression puis engagements compacts ; les tenus barrés sur ordinateur, repliés sur mobile, en attente visibles avec coche 44 px. Déplacer/modifier/pauses/jokers restent accessibles dans un repli de réglages ; aucun changement de sauvegarde ou de calcul de série. Sans plan, texte « Nouvelle semaine, page blanche » et action « Poser mes 3 engagements · 3 min », non bloquante ; rythme réellement ajustable de deux à quatre.
4. [ ] **Radar** : titre et « Voir le bilan » alignés, dernière lecture et chiffres disponibles, sans grand radar décoratif animé ; synthèse de l’entonnoir séparée sur ordinateur, repliée sur mobile. Ne pas inventer un nombre depuis hier ou un total parcouru après rechargement : libellé explicite du dernier balayage / des offres à examiner. Le récit mensuel déjà livré reste accessible.
5. [ ] **États alternatifs** : journée terminée = séance blanche, message « C’est tout pour aujourd’hui. Le radar veille. », aucun bouton dans ce bloc ; compte sans poste choisi = trois étapes de réglage (poste, trois sources, premier balayage), semaine/radar masqués ; chargement = squelettes aux dimensions finales, sans radar animé ; erreur de lecture = « Votre journée n’a pas pu être lue. Vos données sont intactes. » avec Réessayer. Panne d’une source/carnet = message local, autres blocs utilisables. Scénarios fictifs reproductibles pour capturer ces rendus, sans toucher aux comptes réels.
6. [ ] **Cohérence et vérification** : rayons 20/16/10/999, interlettrage ≥−0,01em, couleurs Signal, un bouton principal par zone et une ligne d’aide par bloc, ≤120 mots ; captures avant/après/maquette de chaque état à 1360/390 ; clavier/focus et cibles 44 px ; tests/types verts, aucune nouvelle erreur ESLint, console vide, données fictives d’origine intactes ; guide, changelog et plan à jour, staging privé vérifié.

## Choix explicites

Le classement des prochaines étapes et les durées existants restent inchangés : la maquette illustre 12 minutes pour 20 offres, tandis que le calcul réel prévoit une minute par offre. Les compteurs et l’entonnoir ne sont jamais inventés. Le compte neuf est reconnu par l’absence de poste recherché, même si des exemples fictifs sont présents. Les actions de la semaine restent disponibles sans alourdir la carte principale. Le scénario « sans plan » couvre aussi le lundi sans simuler une date réelle dans le produit.

Composants réutilisés : navigation de Balayage, RadarAccountMenu, WorkspaceButton, WorkspacePanelHeader, WorkspaceState, SignalProgress, HelpTooltip, contrôles et sauvegarde du plan existants. Aucun nouveau contrôle natif isolé.
