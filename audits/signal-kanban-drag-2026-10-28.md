# Kanban — déplacer les candidatures sans perte du dossier

Base : main après la MEP de revue globale #47 (`d0b086d`). Demande : changer l’étape par glisser-déposer, tout en conservant les notes et les entretiens. Copie de travail et données de recette isolées ; aucun accès à la base privée ni déploiement privé.

## Gestes et persistance

Une poignée distincte du titre active le déplacement après 8 px. Le titre continue d’ouvrir le dossier. Le sélecteur de statut et la vue tableau sont conservés. Les colonnes ciblables sont Envoyées, Entretiens, Propositions et Closes ; À préciser est un groupe historique dont les cartes peuvent sortir, sans être une destination de sauvegarde.

Envoyées demande `applied`, Entretiens `interview`, Propositions `offer`. Closes demande de choisir Refus reçu (`rejected`) ou J’arrête le processus (`withdrawn`), sans présélection. Le dialogue se ferme avec Annuler ou Échap sans écriture ; pendant l’enregistrement, les actions sont verrouillées. Il ne déplace pas l’offre à la corbeille et ne supprime aucun contenu.

Le statut explicite `applied` prime désormais sur la présence d’un historique dans le regroupement : une carte peut revenir dans Envoyées sans effacer ses entretiens. Les rendez-vous restent disponibles dans le dossier et l’agenda selon les règles existantes. Rang et prochain rendez-vous ne sont pas réécrits par le geste. Aucune date ni aucun rendez-vous n’est inventé.

Le changement utilise uniquement la commande de statut existante. Le retour de confirmation booléen est partagé avec le sélecteur. Les verrous empêchent un second enregistrement pendant une écriture. La carte n’est pas déplacée par anticipation ; un refus conserve la dernière valeur confirmée. Une réponse réseau non confirmée demande une vérification, sans écriture inverse automatique qui pourrait écraser un changement déjà enregistré.

Même colonne, absence de cible ou annulation : aucune requête. Le tri manuel à l’intérieur d’une colonne n’est pas inclus.

## Clavier, tactile et présentation

Entrée ou Espace saisit et dépose ; gauche/droite choisit la colonne, y compris quand le tableau doit défiler. Échap ou Tab annule. Les annonces sont en français et le focus revient sur la carte, ou sur le titre de page si elle sort du filtre courant. Le dialogue de clôture réutilise Radix pour le focus et la fermeture, les boutons et erreurs Signal, ainsi que le fond flouté neutre.

Poignée de 32 px sur bureau, 44 px nominaux sur mobile. Le blocage du défilement tactile est limité à la poignée (`touch-action: none`) ; le corps de carte conserve le défilement. Aperçu flottant, cible surlignée et emplacement source atténué pendant le geste. Dépendance UI épinglée : `@dnd-kit/core` 6.3.1, avec ses deux sous-paquets. La documentation de référence est celle des [capteurs clavier](https://dndkit.com/legacy/api-documentation/sensors/keyboard/) et [pointeur](https://dndkit.com/legacy/api-documentation/sensors/pointer/). Aucune montée de version des dépendances existantes.

## Recette et conservation

Les 111 tests, TypeScript et la compilation publique passent. Deux tests supplémentaires couvrent les destinations, les clôtures explicites, les cibles inconnues et le retour dans Envoyées sans mutation de l’historique. Le test SQLite de la vraie route PATCH exerce successivement applied, offer, rejected, withdrawn et interview en comparant note, rendez-vous, date d’origine et profil. Les propriétés optionnelles absentes de la réponse JSON sont normalisées pour la comparaison ; aucun champ d’entretien présent dans la réponse n’est retiré de la comparaison.

Une nouvelle candidature fictive dédiée contient une note en gras/listes, un bilan, un entretien futur et un rendez-vous annulé. Cinq changements réels sont exercés à la souris et au clavier : Entretiens, Envoyées, arrêt volontaire, Propositions, puis Entretiens. Les lectures API après chaque changement confirment l’identité de la note, des trois rendez-vous avec leur bilan, de la date d’origine et des faits de l’annonce. Une clôture est aussi annulée. L’ouverture d’une proposition mène toujours à Ma candidature avec focus dans les notes.

La comparaison avant/après confirme que les offres fictives préexistantes, leurs notes/entretiens, le profil existant, les sources, les expériences et les documents sont identiques. Seuls la nouvelle candidature de recette et son entrée de note ont été ajoutées. Les empreintes du code et les 35 travaux Git préexistants du projet privé sont inchangés. Les dépendances de recette ont été copiées dans l’espace isolé avant installation ; les modules du projet privé n’ont pas été modifiés.

Les scénarios locaux sans API vérifient le refus de sauvegarde, la clôture toujours ouverte avec sa sélection conservée, le dépôt hors cible, le dépôt identique et l’absence de requête dans ces deux derniers cas. Une attente simulée garde la carte dans l’ancienne colonne et désactive sa poignée ; une seconde validation ne produit qu’une requête.

Dix-huit états sont relevés : repos, cible de déplacement, choix de clôture et carte déplacée à 1440, 900, 390 et 320 px, plus l’erreur de clôture à 1440 et 320 px. Aucun débordement horizontal de page ou de dialogue. Le déplacement clavier à travers les colonnes défilantes est contrôlé aux quatre largeurs ; les poignées mobiles mesurent nominalement 44 px. La radio choisie reste cochée après échec et l’erreur utilise le rouge Signal.

Les captures, rapports et supports temporaires de recette restent hors du dépôt public. Les composants et la projection passent le lint ciblé ; une erreur hooks héritée demeure dans l’écran partagé, inchangée. Aucun contrôle distant configuré : les résultats sont locaux.

## Limites

Chromium, souris et clavier vérifiés. La configuration du capteur et les dimensions tactiles sont en place ; le geste sur appareil tactile physique, Safari/Firefox et un lecteur d’écran réel restent à vérifier séparément. Pas de certification d’accessibilité. Aucun changement de route API, schéma, migration ou permission. Le choix d’affichage revient toujours au tableau au rechargement, comme avant ce lot. Aucun déploiement privé.
