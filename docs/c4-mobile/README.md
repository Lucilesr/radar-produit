# C4 — Candidatures par étape sur mobile

Livré après P5, sur la navigation à quatre espaces. La liste mobile reprend les colonnes personnelles du Kanban, leurs noms, leur ordre et leurs compteurs. Les groupes se replient ; les déplacements attendent la réponse du serveur et Closes exige un motif explicite. Sur ordinateur, tableau et Kanban restent disponibles. Les notes, entretiens, repères de préparation et bilans restent dans le même dossier.

Recette sur le staging privé, versions 73 à 77. Captures avant en version 72, puis après à 1 360 × 900 et 390 × 844. Compte entièrement fictif avec 1 000 offres et 50 candidatures ; aucune migration ni production.

| Parcours réellement vérifié | Résultat |
| --- | --- |
| Volume et filtres | Toutes : 50 dossiers ; En cours : 49 ; Closes : 1. Le tableau ordinateur rend 50 lignes. Aucun débordement de page à 390 px. Le Kanban ordinateur reste horizontal ; il devient la liste sur téléphone. |
| Colonnes personnelles | Création de « Échange fictif », déplacement d’Orion dans cette colonne, rechargement : colonne et dossier conservés. Répartition finale : 45 Envoyées, 2 Entretiens, 1 Échange fictif, 1 Proposition, 1 Close. |
| Repli et clavier | Espace replie les groupes, Entrée ouvre le dossier, Échap ferme et rend le focus au bouton. Après déplacement vers un groupe replié, focus à son titre ; une cible momentanément désactivée est remplacée par le titre disponible de son groupe. |
| Clôture | Le choix Closes ouvre le motif Refus reçu / J’arrête le processus. Sans motif, validation désactivée. Annuler ou Échap ne clôt rien. Retrait fictif confirmé, dossier retrouvé dans Closes puis remis dans Envoyées. |
| Conservation | Note fictive de 2 000 caractères et date d’envoi conservées après clôture/réouverture ; entretien Orion strictement identique avant et après. Deux fichiers et niveau Senior conservés. Les identifiants des 1 000 offres restent identiques. |
| Conflit réel | Un autre accès passe le dossier en attente de retour ; l’ancienne liste tente Entretiens : réponse 409, carte et dernier état lu conservés, un seul message d’erreur dans la liste. Après relecture, le changement distant est bien présent. Dossier fictif rétabli ensuite. |
| Texte long | Le titre de 180 caractères passe de 106 × 543 px à 348 × 143 px dans la fiche mobile. Actions et fermeture restent accessibles ; aucun débordement du dialogue. |
| Proposition et autres vues | Mira affiche Proposition reçue. Entonnoir inchangé : 47 candidatures, 2 avec entretien, aucun faux événement d’entretien créé par le conflit. Bilan privé P7 présent dans Mes leçons. |
| Mes leçons → dossier → fermeture | La sous-vue Mes leçons reste dans l’URL ; retour au bilan et au bouton d’origine sur ordinateur et sur mobile. |
| Confort | Cibles de 44 × 44 px au minimum dans la liste, focus Signal visible. Réglage Radar `data-motion="reduced"` actif ; aucune préférence du système changée. Console nominale sans avertissement ni erreur ; le 409 provoqué est isolé de ce contrôle. |

`local-hors-ligne-mobile.jpg` et `local-reconnexion-mobile.jpg` viennent uniquement de la prévisualisation locale : arrêt de sa connexion, déplacement refusé en français et carte conservée ; retour de la connexion, nouvel essai confirmé. Aucune panne n’a été provoquée sur le staging.

Les tests de projection couvrent les 50 dossiers, les colonnes supprimées ou devenues incompatibles, les doublons, la corbeille, les anciens statuts et les dossiers partiels, sans mutation. Une date d’envoi valide ou une clôture historique garde le dossier dans Candidatures ; une offre seulement préparée reste dans Offres. Ces cas historiques sont des vérifications unitaires, pas des données inventées par la recette visuelle.

Aide ajoutée : aucune sur les cartes. Liste : 4 mots de confidentialité ; Mes leçons : 15 avec cette ligne ; tiroir de choix : 6 ; clôture : 15 ; erreur et notification temporaire : 28 au total. Les explications des fiches et de l’entonnoir restent celles vérifiées en P8 ; aucun écran ne dépasse 120 mots d’aide.

Composants réutilisés : ChoiceSelect, WorkspaceButton, WorkspaceFormError, Collapsible, badges de préparation, dialogues et jetons Signal. Vérification : 412 tests réussis, TypeScript sans erreur, aucune nouvelle erreur ESLint (33 préexistantes). Les captures constituent une recette Chromium, sans annoncer une certification d’accessibilité ou une vérification Safari/Firefox.
