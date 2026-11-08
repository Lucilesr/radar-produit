# L2 — Série de semaines

La logique pure `week-series` relit les plans Q5, sans fabriquer d’actions L1 anciennes. Une semaine entièrement cochée est tenue ; une semaine courante incomplète reste ouverte. Une semaine passée incomplète consomme automatiquement un joker si la série existe et qu’il en reste, sinon elle repart à zéro. Un joker est gagné toutes les quatre semaines tenues au total, avec un plafond de deux : les gains excédentaires ne sont pas mis en attente. Réserve initiale : zéro. Aucune pression pour créer un plan.

Les pauses couvrent une à quatre semaines ISO. Elles commencent cette semaine, ou la prochaine si celle-ci est tenue. Une semaine tenue pendant la pause compte ; une pause seule ne gagne pas de semaine. Reprendre conserve les pauses passées et retire la pause de cette semaine et des suivantes. Les semaines sont calculées dans le fuseau du plan ; le premier fuseau enregistré pour la série stabilise les changements d’appareil. La série commence au premier plan connu, ou à son activation si aucun plan n’existe. L’historique de calcul est borné aux vingt dernières années.

Les paramètres privés de série sont stockés dans `profiles.data.weekSeries`, protégés des anciens formulaires, avec une version et une comparaison atomique du profil. Les autres champs restent conservés. La sauvegarde intégrale couvre ce champ ; aucune migration supplémentaire ni transmission à un tiers. Le moment de nouvelle semaine est acquitté dans le compte. Il s’ouvre à la première visite de la semaine, y compris si cette visite suit le lundi.

Signal réutilisé : SignalMoment, WorkspaceButton, WorkspaceFormError, Dialog, ChoiceSelect et variables existantes. Les données restent disponibles lorsque les mouvements sont réduits. Guide et tour mis à jour.

Règles vérifiées : semaine ouverte, retrait de coche, gain et plafond, consommation automatique, remise à zéro, passage d’année ISO, pause et reprise anticipée, concurrence, compte distinct, formulaire ancien et sauvegarde. Résultat de la recette staging consigné dans `l2-semaines/README.md` avant fusion.
