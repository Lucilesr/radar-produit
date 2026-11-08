# L4 — Entonnoir réaliste

Cohorte des envois confirmés dans activity_events sur90jours glissants. Aucun statut actuel, texte de candidature ou ancien dossier ne sert à reconstruire un envoi manquant. Le seuil de cinq envois masque les taux ; le message indique le nombre manquant. Les chiffres et sources sont des agrégats privés, sans service tiers ni nouvelle table.

Chaque envoi ouvre un cycle ; son annulation explicite le retire. Les reçus et rendez-vous répétés ne gonflent pas les taux. Un entretien déclaré, programmé ou noté est attribué au cycle antérieur ; une annulation sans échange noté retire le signal de rendez-vous. Les offres reçues sans entretien antérieurement enregistré restent dans le total, sans inventer une conversion. La date réelle connue d’un entretien noté peut précéder la date de saisie du bilan.

La source est photographiée à l’envoi. Les nombres et petits échantillons accompagnent les pourcentages. Le rythme mensuel est le nombre de candidatures avec entretien sur90jours divisé par trois, sans prédiction. La date des premiers événements explique l’historique disponible. Une ligne illisible provoque une erreur, pas un taux silencieusement sous-estimé.

Une requête privée utilise l’index compte/date du journal. L’accueil et les trois vues de Candidatures partagent la lecture, rafraîchie à l’entrée et après un changement métier confirmé ; aucun polling ni requête par carte. Les chiffres confirmés restent pendant une panne, le focus revient après réessai. Signal gère compteurs, barres, boutons et mouvement réduit.

Le scénario de démonstration funnel initialise uniquement un nouveau compte fictif :10envois,4candidatures avec entretien,1offre, trois sources fictives. Il ne réinjecte jamais cet historique dans un compte existant. Les trois candidatures génériques de la démo, sans événements d’envoi, restent exclues des taux. Captures de staging et limites dans l4-entonnoir/README.md.
