# C0 — Audit du suivi des candidatures

Audit de l’existant après Q0–Q6 et S5, avant C1–C4 et L1–L5. Document uniquement : aucune modification du comportement dans ce lot. L’utilisatrice a déjà demandé de poursuivre directement C1, C2, C3/L3 et C4 ; cet audit consigne les choix, sans nouvelle attente de validation. Radar seul, sans personnage, données privées, aucun envoi automatique de candidature ou relance.

## Ce qui existe

| Zone | Données et comportement actuels | Limite utile |
| --- | --- | --- |
| Candidatures | `ApplicationsWorkspace`, dans `today-workspace.tsx`, reçoit les offres qui ont une candidature. Tableau par défaut ; vues En cours, Closes, Toutes. | Les offres seulement sélectionnées restent dans Opportunités. La préparation et l’envoi sont distincts. |
| Kanban | `application-kanban.tsx`, `application-drag.tsx`, `use-personal-board.tsx`. Colonnes par compte, renommage et colonnes personnelles associées à une étape ; disposition dans `application_boards`. | Les colonnes restent horizontales sur téléphone ; la vue Tableau devient une pile de cartes, sans regroupement par étape. Les titres longs des fiches demandent aussi une correction de largeur mobile. |
| Statuts | `applied`, `interview`, `awaiting_response`, `next_step`, `offer`, `rejected`, `withdrawn` ; `closed` reste un ancien statut à reclasser. | Ne pas confondre une candidature close et les archives des annonces sans décision. Le sélecteur ne propose pas de créer un nouveau statut historique `closed`. |
| Déplacement | Souris, toucher et poignée clavier Entrée/Espace puis flèches. Clore demande Refus reçu ou J’arrête le processus. Enregistrement confirmé avant de déplacer visuellement la carte. | Un conflit conserve le dernier état lu et demande une relecture ; la fermeture n’efface ni notes ni entretiens. |
| Fiche | Offre, Ma candidature, Entretiens, Préparer/brief ; notes privées avec sauvegarde et historique. Annulation d’envoi sans entretien lié. | Pas de jauge de qualité propre au dossier. La présence d’un CV global ne prouve pas qu’il a été adapté à cette offre. |
| Questions | `application-questions.tsx` : questions reçues, réponses et limites de caractères, versions et variantes séparées dans les tables dédiées. | Une variante n’est pas une validation ; les droits du carnet restent distincts. Les questions du recruteur ne prouvent pas automatiquement que les questions de la personne sont préparées. |
| Tags | `application-tags.tsx`, par compte, couleurs Signal, affectation multiple, filtre du Kanban. | Ils organisent le suivi ; ils ne changent pas le statut ni les critères de recherche. |
| Entretiens | Table `interviews`, horaires avec fuseau explicite, rendez-vous prévus, annulés ou relus ; bilan après la fin, résultat, forces, points à améliorer, prochaine action et date de relance. | Une date manquante reste à renseigner. Les entretiens passés à relire sont proposés dans les actions du jour. |
| Relances | Date explicite d’un bilan d’entretien ; Q3 peut proposer cette relance et noter une confirmation pour la séance. | Avant L1/C2, cette confirmation ne constitue pas un historique durable de relance. Aucune relance de candidature proposée automatiquement à J+7. Aucun e-mail/push. |
| Brief | Préparation privée par offre, questions/réponses, faits validés et droits contrôlés. | Préparer, copier et envoyer sont des actes différents ; Radar n’atteste pas un envoi externe. |

## Cycle de vie et temps

- **Après un refus** : la candidature passe dans Closes, demeure consultable et peut être reclassée. Les notes, questions et entretiens sont conservés. Aucun questionnaire réflexif ni page Mes leçons aujourd’hui. Un refus ne déclenche pas d’encouragement Q6.
- **Après 30 jours sans réponse** : la candidature n’est ni supprimée, ni automatiquement refusée, ni archivée par la règle des 21 jours. `applicationAge` change seulement le repère visuel à 14 et 30 jours. Il n’existe ni rappel J+7/J+14 de candidature, ni clôture automatique.
- **Entretien passé** : `reviewDue` repère un rendez-vous prévu dont la fin est passée. La fiche propose de remplir son bilan. Les étapes terminales cessent d’alimenter les rappels globaux. La correction d’une date et la modification d’un bilan restent possibles.
- **Annonce ancienne** : les archives 21 jours concernent les annonces sans sélection ni candidature. Une candidature garde son dossier même si l’annonce source a été écartée. La Corbeille d’une annonce et une candidature refusée sont deux dimensions distinctes.
- **Fuseaux** : le rendez-vous utilise son fuseau enregistré. L’affichage de la date d’envoi impose encore Indian/Mauritius dans le tableau et le Kanban : gênant pour les autres comptes, à remplacer par le fuseau d’affichage dans C2. Les échéances doivent partir d’instants validés et rester cohérentes entre appareils.

## Erreurs, accès et confort

Les API authentifient le compte et contrôlent l’origine des écritures. Les changements de colonne transmettent statut et colonne attendus ; un autre onglet peut donc les faire refuser sans écraser son choix. Le Kanban annonce l’attente puis l’échec, garde la carte et redonne le focus. Recette réelle : Mira Services passée d’Offre reçue à Refus depuis un autre accès, puis tentative clavier Entrée/flèche gauche/Entrée depuis l’ancienne carte. Réponse409, carte conservée dans la colonne précédemment lue et focus à la poignée ; après rechargement, candidature bien dans Closes/Refus. Aucun écrasement. Les erreurs de lecture des colonnes, tags et questions proposent Réessayer ; la panne d’un sous-ensemble ne doit pas effacer la fiche.

Le mode réduit est déjà global, les menus et dialogues suivent Signal ; les bilans et éditeurs conservent leurs brouillons/versions. L’audit navigateur ne simule pas une coupure réseau complète ni la préférence de mouvement du système : les règles sont relues, sans prétendre à une capture de panne qui n’a pas été provoquée.

## Recette du staging

Staging privé39, code source `377fa24022e45da2c642d91b7a3d6e235c596716`. Compte entièrement fictif, indépendant des données personnelles. Formats 1360×900 et 390×844. [Captures et limites](candidatures/README.md).

| Vérification réelle | Résultat |
| --- | --- |
| Volume | Exactement 1 000 offres et 50 candidatures, confirmé par l’API du compte fictif. Le tableau Toutes rend 50 dossiers ; En cours en rend 49 et Closes 1 après le scénario de refus. |
| Kanban | 50 cartes : 48 Envoyées, 1 Entretien, 0 Proposition et 1 Close. Pas de débordement de page. À 390 px, la région de 358 px contient une largeur défilante de 1 454 px : les autres étapes demandent un balayage horizontal. |
| Titres et notes longs | Titre de 180 caractères lisible dans la liste, note de 2 000 caractères conservée et accessible par défilement dans la fiche. Défaut gênant constaté dans l’en-tête mobile : les actions laissent trop peu de largeur au titre, qui occupe presque un écran. À corriger dans C4. |
| Clavier | Déplacement Kanban par Entrée/flèche/Entrée, échec409 sans écrasement et retour du focus à la poignée. Fermeture de fiche par Échap et retour au bouton du dossier. |
| Refus | Candidature retrouvée dans Closes après relecture ; fiche encore disponible, aucun bilan réflexif proposé. |
| Entretiens | Rendez-vous Orion présent avec horaire et fuseau explicites. J+14/J+30 et entretiens passés sont relus dans les règles ; ils ne sont pas présentés comme des reproductions visuelles de cette recette C0. |
| Lot et réserve à 1 000 offres | Lot antérieur de 3 offres identique après recharge, 898 à examiner dont 895 dans la réserve, 50 archives, 2 sélections et 50 candidatures. Un groupe de 101 offres borne la confirmation à 50 ; écarter50 réduit la réserve 895→845, Annuler la restaure895. |
| Console nominale | Aucun avertissement ni erreur dans les parcours de volume. Le409 volontaire du déplacement périmé est attendu et isolé dans un onglet de recette. |

## Lots retenus et critères d’acceptation

| Lot | Changement retenu | Vérification rapide |
| --- | --- | --- |
| C1 — Candidature soignée | Quatre confirmations propres au dossier : CV adapté, lettre/message, contact identifié, questions préparées. Aucune coche déduite automatiquement. Jauge 0–4 et liste de ce qui manque, sans obliger l’envoi. | Cocher 3 éléments, voir « 3 sur 4 » et l’élément restant ; relire sur un autre accès. |
| C2 — Relances | Première proposition J+7 après envoi ; relance suivante facultative à J+14 ou après un report choisi. Un clic note une relance faite dans L1, sans envoyer de message. Intégration Aujourd’hui et séance Q3 ; dossiers clos/offre reçue exclus. | Retrouver une relance due, la noter, recharger : pas de même rappel répété. Vérifier les fuseaux. |
| C3 / L3 — Après refus | Proposition facultative Ce que je garde / Ce que je change et champ libre privé, dans le dossier et Mes leçons. Événement de progrès après sauvegarde du bilan. | Passer en Refus reçu, fermer sans répondre, puis rédiger un bilan et le retrouver. Aucune célébration du refus lui-même. |
| C4 — Mobile | Liste groupée par étape à 390 px, avec compteurs et une action principale par carte. Accès aux statuts, notes et entretiens conservé ; colonnes personnelles respectées. En-tête de fiche réorganisé pour les titres longs. | Parcourir 50 dossiers sans balayage horizontal des colonnes, ouvrir et retrouver le focus. |
| L4 — Ensuite | Entonnoir90 jours fondé sur les événements L1, pas sur un taux inventé à partir du statut courant. Pas de pourcentage avec moins de 5 candidatures. | Compte neuf : nombre restant explicite ; compte fictif renseigné : étapes et sources vérifiables. |

## Gravité et suites

**Bloquant** : aucun blocage général constaté dans les parcours vérifiés, y compris le volume et le conflit réel. La note longue reste accessible par défilement ; le défaut d’en-tête relève de la gêne, pas d’une perte de données.

**Gênant** : retour d’erreur trop affirmatif (« Vos données restent inchangées » alors qu’un autre onglet peut les avoir modifiées, ou qu’une réponse peut être perdue ; à corriger avec les écritures confirmées L1), relances absentes à J+7/J+14 (C2), confirmation de relance Q3 locale (L1/C2), absence de bilan après refus (L3/C3), Kanban horizontal, absence de groupes et en-tête de fiche trop étroit avec un titre long sur mobile (C4), fuseau d’envoi imposé (C2), absence de repère de qualité propre au dossier (C1).

**Cosmétique** : une proposition reçue peut encore afficher « En attente de retour » dans Suite, alors que son statut est Offre reçue. Corriger le libellé dans C4, puis harmoniser visuellement dans L6 sans changer les règles.

Aucune notification externe, transmission à un tiers, mesure d’usage tierce ni règle culpabilisante n’est proposée. Les taux et récits attendront les preuves L1 ; l’absence d’historique ne doit pas devenir un faux zéro présenté comme un résultat réel.

## C1 livré — préparation propre à chaque candidature

La jauge sur quatre est désormais reliée à quatre confirmations explicites, disponibles dans Préparer / brief et Ma candidature. Le CV global ne compte pas comme CV adapté. Trois sur quatre donne le libellé Soignée et le point manquant ; la jauge reste facultative et n’agit pas sur le statut. Tableau, Kanban et accueil montrent les mêmes choix confirmés. Les cases sont versionnées et sauvegardées ; un passage à trois repères écrit application_cared dans L1, sans texte privé. Recette : `c1-candidature/README.md`.

## C2 livré — relances J+7 et fuseaux

Les candidatures envoyées/en attente, sans entretien non annulé déjà enregistré, disposent d’une proposition J+7 depuis leur date d’envoi. Date modifiable sur Terminé, rappel retirable et déclaration faite persistante via L1. Aujourd’hui et Q3 utilisent les mêmes échéances ; une seconde relance reste facultative. Propositions reçues et dossiers clos exclus. Dates d’envoi affichées selon le fuseau de l’appareil, sans Indian/Mauritius imposé. Calendrier Signal partagé porté à44px sur mobile. Les limites historiques constatées dans l’audit restent décrites ci-dessus ; elles sont désormais corrigées pour ce périmètre. Recette : `c2-relances/README.md`.

L3 et C3 sont livrés ensemble : bilan privé facultatif après refus, deux questions et champ libre, brouillon et validation séparés ; Mes leçons dans le profil. Journal sans texte privé, sauvegarde des textes et versions, aucune nouvelle migration.

L4 ajoute la vue Entonnoir à partir du journal privé : cohorte de90jours, seuil5, sources au moment de l’envoi, conversions par cycle et limites d’historique explicites. Tableau et Kanban restent accessibles.
