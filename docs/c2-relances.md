# C2 — Relances proposées à J+7

Une candidature envoyée ou en attente, avec une date d’envoi connue et sans entretien non annulé, reçoit une proposition sept jours après l’instant d’envoi. Aucune écriture à la lecture et aucun message automatique. Un entretien garde ses propres relances explicites ; les dossiers clos et les propositions reçues sont exclus. Le suivi d’une candidature en Corbeille reste disponible.

Les choix sont des versions ajoutées sous `application:followup:<id>` dans la table existante `workspace_writes`, avec l’instant d’envoi d’origine, la date choisie ou le retrait, et la confirmation faite. Un nouvel envoi pour la même offre ne réutilise pas l’ancienne confirmation. Revenir à une date déjà faite pour le même envoi réutilise son reçu, sans fausse nouvelle action. La déclaration est autorisée avant l’échéance si la personne a déjà fait la relance. Une seconde relance n’est jamais automatique ; le calendrier facultatif propose au plus tôt une semaine à partir du jour courant, en conservant J+14 si celui-ci est plus loin.

La confirmation et l’événement L1 sont atomiques, privés et idempotents. Propriétaire, état de candidature, date d’envoi, date du rappel et absence d’entretien sont revérifiés lors de la transaction. Un entretien ajouté pendant l’écriture bloque le vieux rappel. La lecture groupée des métadonnées reste sans requête par carte. La sauvegarde intégrale inclut ces versions ; aucun schéma, fichier ou configuration existant n’est remplacé, aucune nouvelle migration ni aucun tiers.

L’accueil, les cartes et la séance utilisent une règle pure commune. La séance compte aussi une déclaration faite depuis le dossier ou l’accueil pendant son déroulement, sans doublon. Q6 exige un événement réel du compte et une candidature encore ouverte ; ses préférences et son quota restent inchangés. Les dates d’envoi utilisent le fuseau de l’appareil avec une première lecture SSR stable en UTC, les rendez-vous gardant leur fuseau explicite.

Signal réutilisé : WorkspaceFormSection, WorkspaceButton, WorkspaceFormError, Dialog et DateTimePicker. Le calendrier partagé a ses cibles mobiles à44px ; une date attend Terminé. Le brouillon est conservé en cas d’erreur ou de conflit et la comparaison est explicite. Guide, tour, audit C0 et inventaire d’états mis à jour.

360 tests réussis : J6/J7, retrait, confirmation, nouveau cycle, isolement A/B, réessais, rollback, entretien concurrent, preuve Q6 et sauvegarde. TypeScript réussi ; aucune nouvelle erreur ESLint. Recette staging et captures consignées dans `c2-relances/README.md` avant fusion.
