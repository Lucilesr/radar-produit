# L3 / C3 — Bilan privé après refus

Une proposition facultative suit un refus confirmé, sans ouvrir de formulaire obligatoire. Le dossier et Mon profil → Mes leçons restent accessibles ensuite. Ce que je garde, Ce que je change et un espace libre privé peuvent être remplis séparément ; au moins une réponse est nécessaire pour valider. Le brouillon se conserve indépendamment de la validation.

Les versions confirmées sont ajoutées dans workspace_writes sous application:lesson:<offre>, les brouillons sous lesson:<offre>. L’écriture et l’événement lesson_validated sont atomiques et propres au compte. La première validation par envoi crée le progrès ; les réessais et modifications du même bilan réutilisent son reçu. Aucun texte privé n’entre dans le journal ou les prompts. Une candidature qui change de statut pendant la transaction bloque la validation ancienne. Mes leçons utilise une requête paginée, conserve les bilans d’un dossier devenu indisponible, et ne demande aucune migration.

Conflits comparables, brouillons récupérables, versions et sauvegarde intégrale A/B. La preuve Q6 exige le reçu réel de validation, avec quota, préférences et mouvement réduit inchangés. Aucun encouragement au seul refus. Guide et tour mis à jour. Recette et limites dans l3-bilan-refus/README.md.
