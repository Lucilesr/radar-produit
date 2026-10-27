# Signal — Aujourd’hui

Base : main après la MEP Sources #40 (`03bca95`). Reprise du prototype validé, dans une copie de recette isolée avec données fictives. Aucune migration, modification d’API ou écriture dans la base privée.

## Présentation

Carte prioritaire pétrole compacte, sans le libellé « À faire maintenant ». Filigrane Orbite partagé avec le logo : trait fin blanc/citron, en bas à droite et recadré dans la carte. Décor non interactif et masqué aux lecteurs d’écran. Titre H2 direct et bouton commun blanc/pétrole.

Actions suivantes et agenda utilisent les en-têtes et surfaces communs. Compteurs en police de l’interface. Statut Planifié en haut à droite, dates et fuseaux préservés. Les états vides et l’affichage de trois actions suivantes / trois entretiens sont conservés.

## Règles conservées

Les fonctions de triage, vues d’opportunités et agenda restent inchangées. Priorité au bilan puis à l’entretien sans date ; ensuite aux opportunités à examiner ou sélectionnées, puis à l’ajout d’une offre. Les autres actions gardent leur destination : entretien, candidature ou préparation. Les compteurs gardent leurs règles de calcul et la candidature active reste une donnée non cliquable.

Le premier calcul d’heure utilise l’initialisation paresseuse de React ; son actualisation à l’entrée et au changement des offres reste inchangée. Le formulaire Candidatures partagé reste conservé.

## Recette sans écriture

Un écran local temporaire monte le vrai composant avec six jeux de données fictifs : vide, opportunité à examiner, sélection, bilan dû, entretien sans date et cas mixte. Il affiche uniquement les callbacks reçus ; aucun appel API d’écriture. Six CTA prioritaires, trois actions suivantes, l’agenda et deux compteurs sont vérifiés.

Cet écran et le support de captures responsive ne sont ni suivis par Git ni exportés. Ils seront archivés hors du code à la fin de la recette. Les captures et empreintes du code privé restent également hors du dépôt public.

## Vérifications visuelles et navigation

Six scénarios plus le tableau réel de la copie fictive à 1440, 900, 390 et 320 px : 28 états, aucun débordement horizontal relevé, compteurs et nombres d’actions conformes aux cas attendus. Les trois rendez-vous les plus proches sont affichés dans le scénario mixte ; entretiens annulés et candidatures closes exclus. Le filigrane est décoratif, non cliquable et coupé dans la carte ; le CTA reste dans son cadre, à 44 px nominaux sur mobile. Les contrastes calculés du titre, de l’aide et du bouton sur leurs fonds dépassent 4,5:1.

Dans l’application réelle de recette : Examiner les offres mène à À examiner ; le compteur de sélection ouvre Ma sélection même vide ; l’action de candidature ouvre les notes privées et l’agenda ouvre la vue Entretiens du bon dossier. Aucun enregistrement demandé pendant ces parcours.

Les 104 tests existants, TypeScript et la compilation de la copie publique ont réussi. Le rendu du logo passe le lint ciblé ; une erreur hooks héritée dans l’écran partagé demeure, contre deux avant le lot. Aucune erreur supplémentaire ajoutée dans ce périmètre ; la dette globale n’est pas déclarée résolue.

## Conservation et limites

Les données fictives sont comparées avant/après via les API de lecture : sources, offres avec leurs notes/entretiens, profil, expériences et documents restent identiques. Les empreintes de code et le statut Git privés sont vérifiés séparément ; aucune lecture ou écriture de la base privée n’est nécessaire.

Les règles de triage, d’agenda et de statut ne changent pas ; aucun changement de schéma, migration, permission serveur, dépendance ou route API. Aucun déploiement privé. Contrôles Chromium ; les mesures de contraste et les essais clavier ne constituent pas une certification d’accessibilité. Pas de CI distante configurée : les résultats sont locaux.
