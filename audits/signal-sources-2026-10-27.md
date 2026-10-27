# Signal — Sources

Base : main après la MEP Profil #36 (`853d7ac`). Reprise du prototype validé : titres 18 px, surfaces minérales, cartes et contrôles communs ; mêmes recherches, filtres, liens, données et actions. La recette utilise une copie et une base fictives isolées. Aucune donnée privée, document, capture ou historique privé n’est exporté.

## Cartes et conservation des notes

Les cartes gardent une identité stable et restent montées entre les filtres. Les notes et le choix de configuration non enregistrés sont conservés pendant un changement de vue ou une actualisation. Les champs restent désactivés pendant leur écriture. Les quatre valeurs de configuration et la limite de 1 500 caractères restent inchangées.

La recette saisit une note fictive Malt, passe à Flux autorisés, enregistre We Work Remotely en pause par double clic, actualise le flux puis revient à Malt : le brouillon est intact et peut être enregistré. Chaque sauvegarde utilise la notification partagée.

## Alerte et actualisation

Les erreurs apparaissent auprès de l’action concernée. Un lien Collective refusé par le serveur reste dans le champ ; sa correction puis son enregistrement donnent accès au lien accepté. Les notes et l’état précédemment enregistrés pour Collective sont conservés. Cette alerte agrégée ne crée aucune offre.

L’actualisation des fiches est silencieuse lorsqu’elle accompagne l’action Sources : une seule notification annonce le résultat du flux après relecture des données. La commande manuelle d’actualisation des autres onglets garde son retour habituel. Un résultat de lecture incomplet n’est pas présenté comme une actualisation réussie.

Les contrôles API comparent avant/après les offres, le profil, les expériences et les documents fictifs : ils restent identiques. Les configurations des autres sources sont conservées. Le flux utilisé pour la recette est en pause : aucune collecte externe n’est nécessaire.

## Périmètre et limites

La revue couvre les six filtres (toutes, web, email, flux, qualification, ajouts volontaires), la configuration ouverte et les recherches couvertes à 1440, 900, 390 et 320 px : 32 états, aucun débordement horizontal relevé. Les nombres de cartes correspondent au catalogue pour chaque filtre, et les huit liens Google/Bing sont conservés dans Toutes / Recherche web. Leurs noms accessibles distinguent le rôle et la plateforme.

Les nouvelles cartes et les composants Sources / recherche web passent leur lint ciblé ; aucune erreur ajoutée. Les 104 tests, TypeScript et la compilation de la copie publique finale passent. Aucun test ajouté qui dupliquerait le CSS. L’actualisation manuelle garde une notification unique, distincte du retour du flux. Les contrôles visuels Chromium ne constituent pas une certification d’accessibilité.

Aucun changement d’API, schéma, migration, permission serveur, catalogue ou requête de recherche. Les captures et empreintes de contrôle de la copie privée restent hors du dépôt public. La conservation des données ne repose pas sur une migration : aucune n’est introduite. Aucun déploiement privé.

Le flux actif distant et les résultats des moteurs ne sont pas exercés en conditions réelles dans cette recette : le flux est en pause et les destinations des recherches sont vérifiées sans ouvrir de compte ni collecter de résultat. Les tests existants couvrent les règles de parsing du flux. Aucune CI distante n’est configurée ; les vérifications rapportées sont locales.
