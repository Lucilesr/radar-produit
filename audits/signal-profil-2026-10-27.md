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

## Documents et présentation

Une ligne par document, avec import/remplacement, téléchargement et choix d’une version existante replié. La présentation reprend l’en-tête, le bouton de sauvegarde et les erreurs partagés, sans message de succès doublonnant la notification. Le brouillon reste monté entre sous-onglets. Un verrou protège les écritures des doubles clics.

Les imports par API locale de deux fichiers fictifs conservent les deux versions et leur téléchargement ; la dernière est liée au profil. Le choix d’une ancienne version a ensuite été effectué depuis l’interface. Les expériences restent identiques après remplacement du CV. Une sauvegarde de titre de présentation conserve exactement tous les autres champs et liens de documents. La saisie est conservée entre sous-onglets.

Le sélecteur système de fichier a bloqué l’outil de recette : son import de bout en bout n’est pas annoncé validé. Le remplacement et la conservation sont vérifiés par les API réelles, puis le rattachement d’une ancienne version et les états sont vérifiés dans l’interface.

## Revue finale et limites

Six vues (carnet, édition d’expérience, réalisation, droits, documents, présentation), à 1440, 900, 390 et 320 px : 24 contrôles, aucun débordement horizontal relevé. Les droits restent dans la modale, avec les actions dans son pied ; une seule sauvegarde dans chaque formulaire. Les titres suivent la hiérarchie page / sous-section / expérience / réalisation / champ.

Cinq tests d’adaptation couvrent la conservation des champs, dont le cas importé où le rôle avait été recopié dans les actions : modifier l’objectif ne remplace plus ces actions. Total : 104 tests. TypeScript et compilation réussis sur la recette. Le lint ciblé des nouveaux composants passe ; quatre erreurs héritées subsistent dans les trois composants d’écran, contre cinq avant ce lot. Aucune CI distante configurée : les résultats sont locaux.

Les contrôles visuels sont réalisés sous Chromium et ne constituent pas une certification d’accessibilité. Pas de nouvelle dépendance, API, migration ou modification de permission serveur. Une création puis validation repose sur deux commandes existantes : si la validation échoue après création confirmée, l’élément reste dans le carnet et la correction utilise sa version enregistrée. Les autorisations restent explicites et séparées.
