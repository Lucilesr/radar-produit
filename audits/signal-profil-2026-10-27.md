# Signal — Mon profil

Base : `main` après la MEP Candidatures #32. Ce lot reprend les arbitrages validés du prototype pour le carnet, les documents et la présentation. Le travail utilise une copie isolée et une base locale fictive. Aucun déploiement, migration, réinitialisation ou accès à la base privée n’est inclus.

## Carnet

- En-tête commun et crayon dans les en-têtes d’expérience et de réalisation. Statut au même niveau que le titre, sans ligne « Statut ».
- Création et modification avec une seule action Enregistrer. La création orchestre les commandes existantes de création puis validation, avec identifiants de reprise stables ; les droits restent séparés et ne sont pas accordés par la sauvegarde.
- Réalisation : titre, description, objectif, résultat et actions. Les valeurs restent une projection des champs existants ; les autres données et la provenance sont conservées. Les métadonnées d’une réalisation existante restent dans les options avancées.
- Droits d’usage : sélectionner les contenus validés d’une expérience puis décocher certaines réalisations ; état partiel natif. « Présentation pro » explique le droit de réutilisation sans publication. Une notification partagée confirme l’ensemble de la sauvegarde.
- Historique, questions existantes et restauration restent disponibles ; aucune suppression définitive ajoutée.

## Vérifications du carnet

Recette avec API locales réelles et contenu fictif : création d’expérience, création de réalisation par double clic sans doublon, modification d’un objectif sans perte des autres champs, sélection d’une expérience avec exception puis réouverture des droits. Les quatre tests de l’adaptateur couvrent passages importés, résultats distincts, conservation de la provenance et saisie neuve. La base de tests complète contient 103 tests.

Les captures de recette et les empreintes de contrôle de la copie privée sont conservées hors du dépôt public. L’empreinte compare uniquement les fichiers de code et le statut Git ; aucun contenu de base privée n’est exporté.
