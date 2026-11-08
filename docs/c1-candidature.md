# C1 — Candidature soignée sur quatre

Quatre confirmations manuelles, propres à une offre : CV adapté, message, contact et questions. Aucun lien automatique avec le CV global, les réponses ou le statut. À partir de trois, le libellé Soignée décrit les repères choisis ; il ne certifie pas la qualité d’un texte. Le point manquant est explicite. Aucun parcours n’est bloqué.

Les cases sont stockées en versions ajoutées dans `workspace_writes`, sous une clé privée par offre. Le chemin générique des brouillons ne permet pas de modifier ces clés. Écriture vérifiée sur le propriétaire, comparaison de version, réessai idempotent et transaction avec l’événement L1 `application_cared` lors du passage à trois. Le quatrième point n’ajoute pas un deuxième événement. Les futurs bilans pourront dédupliquer les offres par identifiant ; retirer une case conserve l’historique de ce qui avait été confirmé. Aucun contenu de CV ni de message dans l’événement.

La liste lit les derniers repères en une requête indexée, sans requête par carte. Le dossier, le tableau, le Kanban et les actions de l’accueil affichent la même valeur. Les réponses anciennes de statut conservent la version de préparation la plus récente déjà reçue. Les choix et l’historique sont dans la sauvegarde intégrale existante : aucune migration supplémentaire ni service tiers.

Signal réutilisé : Checkbox, WorkspaceFormSection, WorkspaceFormError, WorkspaceButton et SignalProgress. Cases44px, confirmation attendue avant changement d’état et focus conservé. Guide, tour et inventaire d’états mis à jour. La longue en-tête de dossier mobile relevée en C0 reste ciblée par C4 ; ce lot n’en modifie pas la disposition.

Règles vérifiées : repères explicites, seuil, retrait, indépendance entre offres/comptes, réessai, écriture concurrente, rollback sans reçu, dossier disparu et sauvegarde A/B. La recette staging est consignée dans `c1-candidature/README.md` avant fusion.
