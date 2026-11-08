# Candidatures — décisions à intégrer à la grille préalable

Lot à commencer après Offres, A puis B. Les captures actuelles, les maquettes côte à côte et les autres écarts numérotés seront ajoutés à l’ouverture de la PR, avant le code. Références : Candidatures.html et Candidatures-mobile.html ; à 390 px, la maquette mobile fait foi.

- [ ] C1. Une seule vue par défaut : colonnes par étape. Retirer les onglets Tableau / Kanban / Entonnoir / Mes leçons et En cours / Closes / Toutes. Replier les closes en bas dans « Terminées (N) ▸ ». Une liste peut rester dans un petit sélecteur discret si utile.
- [ ] C2. Entonnoir en une ligne en haut, avec ⓘ pour le détail. Sous cinq candidatures : « Encore N candidatures pour voir votre entonnoir ».
- [ ] C3. « Mes leçons » devient un lien, pas un onglet.
- [ ] C4. Retirer le paragraphe d’instructions au-dessus des colonnes : une ligne au plus, détails en ⓘ. Déplacer « Filtrer par tag » et « Ajouter une colonne » dans « … ».
- [ ] C5. Afficher la prochaine étape et sa cible en haut, comme dans la maquette.

Ces décisions s’appliquent aux lots ordinateur et mobile. Préserver les données, colonnes personnalisées et comportements existants ; justifier tout conflit avec les maquettes dans la PR. États des bandes, clavier, focus, cibles 44 px, captures avant / après / maquette, tests et staging requis.

## Grille préalable — ordinateur

Captures avant du staging 99, à 1360 et 390 px. La PR ordinateur traite les commandes communes ; l’alignement visuel des groupes mobiles vient dans la PR suivante.

| Format | Avant | Maquette |
| --- | --- | --- |
| 1360 px | ![Avant](avant-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |
| 390 px | ![Avant](avant-mobile.jpg) | ![Maquette](maquette-mobile.jpg) |

1. [x] C1 : colonnes comme vue unique, aucune ancienne barre d’onglets ; terminées repliées en bas. Conserver les colonnes personnelles et leur ordre. Montrer « À envoyer » pour les offres sélectionnées non envoyées, sans les déclarer candidatures envoyées.
2. [x] C2 : une ligne d’entonnoir sur 90 jours, seuil réel du journal et dialogue de détail accessible par ⓘ.
3. [x] C3 : Mes leçons devient un lien et une sous-page avec retour.
4. [x] C4 : une ligne d’aide, détails en ⓘ ; filtre par tag et ajout de colonne dans « … ». Déplacement accessible sur chaque carte ; motif de clôture conservé.
5. [x] C5 : prochaine étape réelle et nommée, issue de la file existante, au-dessus des colonnes ; pas de tâche inventée quand aucune n’est due.
6. [x] Hiérarchie de la maquette : titre 40 px / 28 px, contenu sur une colonne commune, cartes 16 px, contrôles 10 px / 44 px ; quatre repères de préparation et dates réelles. Trois cartes par colonne puis « + N autres ».
7. [x] États de la bande : vide avec accès au lot, seuil de cinq, bilan facultatif après refus, bilan enregistré et lien vers carnet, déplacement échoué et reprise sans perte, cinquante candidatures. Aucun bloc d’annotation affiché.
8. [x] Captures avant / après / maquette ordinateur et mobile, textes longs, clavier / focus, absence d’erreur console et de nouvelle erreur ESLint ; tests, types, données et staging privé vérifiés.

### Choix avant code

- Les étapes conservées sont celles du modèle et des colonnes personnelles. « Propositions » ne devient pas « Réponse attendue » : une offre reçue ne doit pas changer de sens pour copier un exemple. « À envoyer » est une vue des offres sélectionnées ; leur envoi reste une déclaration explicite.
- La commande d’ajout mène aux offres, comme le flux existant ; son texte précise « Ajouter depuis une offre » plutôt que de promettre un envoi automatique.
- Les chiffres de l’entonnoir restent ceux du journal : les dossiers historiques sans événement ne sont pas reconstitués. Les nombres et entreprises de la maquette sont des exemples.
- Pour l’échec d’un déplacement, on conserve le dernier état confirmé. On ne promet pas « Rien n’a changé » si une réponse réseau a été perdue ; la reprise est explicite.

## Résultat du lot ordinateur

Staging privé **101**, code public `9e069b8`, source `4de36c86a6ff59db999546ac67b1bf80888343fa`. [Galerie avant / après / maquette](galerie.html). Les captures finales viennent du staging, par le relais privé sans modification de l’interface, avec des données entièrement fictives. Les captures avant donnent le contexte général ; les états auxiliaires sont détaillés après réalisation, sans reconstituer de faux « avant ».

- Vue unique, trois cartes au plus par colonne puis dépliage : le cas de cinquante candidatures montre trois cartes « Envoyées », puis **+ 42 autres**. Les 45 deviennent accessibles au clavier. La colonne personnelle « Échange fictif » et l’ordre sont conservés. Les terminées restent fermées au chargement.
- Prochaine étape issue de la vraie file, entreprise nommée ; entonnoir compact, seuil du journal, détail avec sources et retour du focus. Le cas vide propose le lot du jour, lien vérifié.
- Déplacement par choix ou Entrée / flèches / Entrée ; erreur injectée sur la seule candidature créée pour la recette, carte conservée, reprise explicite, puis focus sur la carte confirmée. Clôture avec motif, invitation facultative à deux questions, bilan enregistré et retrouvé dans Mes leçons ; lien « En faire une histoire » présent.
- 431 tests et types verts ; aucune nouvelle erreur ESLint. Console sans erreur ni avertissement pendant la recette, y compris l’erreur contrôlée. Textes de 180 caractères sans débordement ; titres 40 / 28 px, cibles 44 px, rayons Signal et aide limitée. Préférence de mouvement réduit respectée.
- **1 003 offres, cinquante candidatures, deux fichiers et tableau personnel du grand cas : inchangés à l’identique.** Les huit offres, deux fichiers et colonnes de la petite recette sont aussi intacts. Les transitions et le bilan ne concernent que la candidature fictive ajoutée pour ce test.

Composants réutilisés : ApplicationDrag, ChoiceSelect (menu / tiroir mobile), WorkspaceButton, HelpTooltip, Dialog, Popover, ApplicationCareBadge, SignalCounter et SignalProgress dans le détail. Guide de prise en main et changelog à jour. Aucune migration, production inchangée.

### Lot mobile suivant

Les décisions C1–C5 ci-dessus restent la cible commune. Ce lot livre l’ordinateur et vérifie les régressions mobiles : mêmes données, entonnoir, leçons, refus et bilans. L’alignement visuel de la liste mobile, son groupe « À envoyer », ses limites de cartes, ses outils et la reprise explicite de son erreur seront traités dans la PR mobile suivante. Les captures mobiles présentes montrent cet état intermédiaire ; elles ne prétendent pas valider la maquette mobile entière.
