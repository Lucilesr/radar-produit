# Préserver les dates de publication importées

Certaines sources utilisent un horodatage ISO avec six décimales et un décalage de fuseau. La limite de30caractères le tronquait avant sa conversion et faisait retomber l’archivage sur la date d’ajout. La limite passe à100, sans changer les règles d’âge, les décisions existantes ou les données déjà enregistrées. Aucun rattrapage par supposition ni migration.

Un test suit l’import jusqu’au calcul des archives après une correction de TJM : la publication ancienne prime, date simple et précision restent intactes. Guide mis à jour. L’interface Signal existante est réutilisée sans changement visuel ; recette fictive ordinateur et mobile dans le dossier associé.

## Recette staging49

Source `aa18250f62ba48200d05f4856c954c83236792b8`, privé. Offre fictive21days ajoutée le8novembre, publication `2026-10-01T12:00:00.123456+04:00` conservée entière et offre visible aux archives. TJM passé de620à700 : publication inchangée, offre toujours archivée après rechargement ; bouton Remettre à examiner disponible. Ordinateur1360×900, mobile390×844 : fiche, dates et focus lisibles, sans débordement ni erreur console. Captures dans `correction-date-publication/`.361 tests et TypeScript réussis, ESLint du fichier modifié réussi. Aucune donnée de production touchée.
