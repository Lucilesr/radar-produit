# Recette L4 — staging 53

Staging privé 53, code public `c504c1b`, source Sites `4a622548bc25fea9b3280482923b46331b3d1f4f`. Données et captures entièrement fictives. Aucune migration ni production.

| Vérification | Résultat |
| --- | --- |
| Avant le seuil | Compte de recette existant : trois anciennes candidatures, mais aucun événement d’envoi L1. Encore 5 candidatures ; aucun taux ni reconstruction depuis les statuts. Captures ordinateur et mobile. |
| Chargement | Relecture explicite : état de lecture et commande désactivée, derniers chiffres conservés. Captures des deux formats. |
| Cohorte fictive | Démo neuve : 10 envois, 4 candidatures avec entretien, 1 offre reçue. Interface et réponse privée concordent : 40 % puis 25 %. |
| Sources | Collectif fictif : 3 entretiens / 4 envois, 75 % ; Réseau fictif : 1 / 3, 33 % ; Veille fictive : 0 / 3, 0 %. Attribution au moment de l’envoi. |
| Rythme | À ce rythme, environ 1,3 entretiens par mois, avec limite de lecture explicite. Même tendance sur Aujourd’hui. |
| Historique disponible | Les trois candidatures génériques de la démo n’ont pas d’envoi L1 : elles restent hors taux. Treize dossiers dans Tableau et Kanban, dix envois dans la cohorte. La date des premiers événements est affichée. |
| Réessai / clavier | Entrée sur Actualiser les chiffres relit les données, puis le focus revient au titre de l’entonnoir. Aucun changement de dossier. |
| Mobile | 390 × 844, trois commandes de vue à 44 px ; compteurs, taux et sources sans débordement. Captures au repos et avec focus. |
| Ordinateur | 1 360 × 900, chiffres et sources lisibles, aucun débordement. |
| Mouvement réduit | Préférence du compte fictif activée ; mêmes 10 / 4 / 1, même accès aux vues, aucun mouvement requis. Captures ordinateur et mobile. |
| Suivi conservé | Tableau et Kanban affichent chacun les mêmes 13 dossiers. Retour vers Entonnoir sans perte ; aucune erreur console. |
| Erreurs / isolement | Tests SQLite : compte A/B, 401, 503, événement illisible, pas de texte privé dans les agrégats. Un événement illisible provoque une erreur plutôt qu’un taux sous-estimé. |
| Règles | Tests de seuil 4/5, limite exacte de 90 jours, futur et dates invalides, annulation et nouvel envoi, reçus / rendez-vous répétés, entretien annulé, offre directe et ordre réel des faits. |
| Contrôles | 377 tests réussis, TypeScript réussi, zéro nouvelle erreur ESLint (35 préexistantes). Console finale sans avertissement ni erreur. |

Les dimensions de tous les fichiers ont été contrôlées. Les captures de chargement montrent une relecture réelle ; les derniers chiffres confirmés restent présents pendant la lecture. La démo dédiée initialise uniquement un nouveau compte fictif et ne réinjecte pas d’événements dans un compte existant, règle également testée.

La panne réseau système n’a pas été provoquée sur le staging. Les chemins d’erreur et d’isolement sont testés ; l’interface conserve le dernier résultat confirmé et propose une relecture. Aucun historique n’est exporté vers un service tiers, aucun e-mail ou partage automatique.
