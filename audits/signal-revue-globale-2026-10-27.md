# Signal — revue globale de concordance (27–28 octobre 2026)

Base : main après la MEP Aujourd’hui #43 (`c35a96d`). Référence : dernière version locale du prototype Signal et arbitrages validés. Travail dans une copie isolée avec données fictives, sans accès à la base privée ni déploiement privé.

## Concordance examinée

| Périmètre | Points de concordance |
| --- | --- |
| Cadre commun | Logo Orbite, palette pétrole/minérale/citron, une navigation, titres de page à la même hauteur, mêmes marges par largeur et même police |
| Aujourd’hui | Carte pétrole compacte, titre direct, filigrane blanc/citron en bas à droite, agenda et statut dans l’en-tête |
| Opportunités | Sélection citron avec coche, annonce à côté, suivi en haut à droite, Écarter et confirmation rouge, critères compacts, lecture en colonnes indépendantes, état vide aux mêmes marges |
| Candidatures | Liste continue sans initiales décoratives, dates et tags centrés en police commune, statut regroupé, ancienneté conservée |
| Dossier | Largeur 870 px sur bureau, quatre sections, fermeture unique, notes avec emphases/listes, planification et bilan avec sauvegarde commune |
| Carnet | Crayons dans les en-têtes, statuts auprès des titres, une action Enregistrer, entreprise/produits séparés des réalisations, droits regroupés |
| Documents et présentation | Lignes de documents, versions repliées, mêmes en-têtes/CTA, formulaire de présentation partagé |
| Sources | Cartes, filtres et réglages harmonisés ; notes conservées entre vues ; actions et recherches existantes disponibles |

Les sections principales, sous-onglets du profil et vues du dossier conservent leurs données et destinations. La distinction entre correspondance calculée et sélection manuelle reste explicite. Les mentions secondaires restent en fin de lecture.

## Écart corrigé : Préparer / brief

Le panneau de questions était resté dans l’ancienne présentation, avec des cartes imbriquées, une limite séparée et les commandes de variantes écartées pendant le prototype. L’écran reprend le prompt copiable en tête, l’aperçu replié, les questions à plat, Ma réponse et le compteur éditable.

Boutons, erreurs et notifications partagés, hiérarchie H3/H4 et états responsive. Les commandes, versions, limites et payloads des questions restent identiques. Une limite indicative dépassée reste signalée sans empêcher la sauvegarde d’un brouillon, comme auparavant. Une limite hors de 1–10 000 est refusée sans effacer la saisie ; vide signifie sans limite.

L’ancien panneau de propositions et son polling ne sont plus rendus. Les variantes enregistrées, leur stockage, les routes et les outils MCP restent conservés. Le test de contrat garde l’authentification et l’absence de moteur payant ; les assertions sur les anciens libellés UI ont été retirées. Les tests de persistance, versions, isolation et propositions sont conservés.

## Recette globale

- Douze vues à 1440, 900, 390 et 320 px : Aujourd’hui, Opportunités, recherche vide, Candidatures, carnet, documents, présentation, Sources, détail d’offre, brief, notes, entretiens. Soit 48 relevés sans débordement horizontal détecté. Titres H1 de même police, même taille et même position verticale entre les cinq onglets à chaque largeur.
- Huit états supplémentaires à 1440 et 320 px : ajouter/modifier une expérience, ajouter/modifier une réalisation, droits d’usage, bilan, planification et ajout d’offre. Soit 16 relevés supplémentaires, aucun débordement relevé. Une seule action Enregistrer dans chaque formulaire du carnet. Ces formulaires ont été ouverts puis annulés sans sauvegarder.
- Question fictive : création avec limite 120, réponse enregistrée, erreur de limite invalide sans perte, dépassement signalé, limite supprimée puis enregistrée, historique, retrait récupérable et restauration avec réponse conservée. Copie du prompt vérifiée.
- Une seule notification commune après copie, surface blanche, top/right 20 px, largeur maximale 340 px. La touche Tab depuis sa fermeture revient au lien d’annonce du dossier.

Les captures et relevés, dont les supports locaux de recette, restent hors du dépôt public. Les contrôles des lots précédents complètent cette passe : écriture de notes/entretiens, import de documents par API et droits d’usage persistés avaient déjà été exercés avec données fictives.

## Automatisation, conservation et limites

Les 109 tests, TypeScript et la compilation publique finale passent (104 tests existants et cinq tests du Kanban). Questions et compteur passent le lint ciblé. Les trois erreurs hooks héritées dans le dossier restent identiques à la base ; le lint global n’est pas annoncé résolu. Aucun test applicatif supplémentaire pour les seuls espacements.

Les lectures API avant/après confirment que les offres et leurs notes/entretiens, sources, profil, expériences et documents fictifs sont identiques. Une question fictive dédiée a été ajoutée pour la recette du brief ; aucun contenu préexistant n’a été supprimé. Les empreintes de code et les travaux Git privés restent inchangés. Aucun changement d’API, schéma, migration, permission serveur, dépendance ou logique métier.

Recette Chromium locale, sans certification d’accessibilité ni CI distante configurée. Le sélecteur système de fichier, les flux distants actifs et Safari/Firefox restent hors de cette passe ; les limites de leurs recettes précédentes ne sont pas déclarées levées.

## Évolution complémentaire validée : Kanban

L’utilisateur a choisi une seule colonne Entretiens avec le rang et le prochain rendez-vous sur la carte. Une PR distincte ajoute l’affichage Kanban, en complément du tableau : Envoyées, Entretiens, Propositions, Closes. Refus et arrêt volontaire restent explicités. Un groupe À préciser conserve les statuts historiques hors de ces quatre catégories lorsqu’ils existent.

Le passage au Kanban ouvre Toutes ; les trois filtres restent disponibles. Le rang est dérivé des rendez-vous datés non annulés. Aucun nouveau statut, migration ou écriture de reclassement automatique. Les propositions ouvrent les notes ; le dossier et le sélecteur commun sont réutilisés. Le choix d’affichage reste en mémoire du composant ; recharger revient au tableau. Pas de glisser-déposer dans ce lot.

Cinq tests couvrent les regroupements, les rangs, dates invalides, priorités de destination et la conservation des données source. Douze contrôles supplémentaires : scénario mixte sans API, état vide et vraie application de recette à quatre largeurs. Après correction du positionnement des libellés accessibles, aucun débordement horizontal de page ; le Kanban garde son défilement interne. Le déplacement au clavier fait défiler le tableau, sans déplacement horizontal de la page. Le sélecteur mobile est exercé.

Le scénario mixte contient dix candidatures, dont un deuxième entretien avec un rendez-vous annulé intercalé, deux clôtures explicites, une ancienne archive, une offre en corbeille et un statut à préciser. Changement de statut simulé, reclassement, filtres et retour au tableau vérifiés ; un refus de sauvegarde simulé conserve la valeur confirmée. Aucun appel API d’écriture dans ces scénarios. Dans l’application réelle fictive, ouvrir une proposition mène à Ma candidature avec focus sur les notes privées, sans sauvegarde.

Au total : 64 états de concordance et 12 états Kanban. Les limites de recette mentionnées plus haut restent applicables.
