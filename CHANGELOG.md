# Évolutions de Radar Produit

## 20 octobre 2026 — Blocs repliables

- Le carnet d’expériences et les sources utilisent un bouton discret à double chevron, avec un statut visible et des détails encadrés.
- Espacements corrigés : retraits réguliers autour des cartes et statuts, contenus imbriqués alignés et historique des documents avec marges internes.
- Le repli conserve les saisies en cours ; les liens vers l’historique et le prochain bloc à relire ouvrent les sections concernées.
## 20 octobre 2026 — Recherche PO/PM sans collecte de plateformes

- Ajout de liens Google/Bing pour repérer des annonces PO/PM en français, tous pays. LinkedIn et Welcome to the Jungle restent consultés manuellement ; Radar ne récupère pas leurs contenus et n’utilise aucun compte LinkedIn.
- La version actuelle ne contient aucun collecteur direct ; les limites d’accès et de réutilisation sont documentées.

## 20 octobre 2026 — Aperçu des offres depuis les API employeur

- Ajoute une lecture publique et ponctuelle des fiches individuelles Greenhouse/Ashby, sans identifiant, clé ou abonnement.
- Présente les informations dans le formulaire d’offre ; un clic explicite copie la proposition dans le brouillon, où les champs restent modifiables et le descriptif peut être prérempli avec les propositions existantes.
- Les URLs de télétravail, conditions et langues absentes restent inconnues ; le lieu du poste ne devient pas un pays autorisé.

## 20 octobre 2026

- Navigation du profil : une nouvelle visite depuis un autre onglet ouvre le carnet d’expériences, sans perdre les brouillons. Les liens directs et l’historique du navigateur conservent l’accès aux documents.

- Opportunités : préremplissage local depuis le descriptif avec propositions à cocher, mode de travail et langue modifiables, présence hebdomadaire/mensuelle distincte et select du pays autorisé pour le télétravail. Migration additive pour conserver ces faits sans modifier le suivi de candidature.

- Design system : calendriers français partagés, date/heure séparées, skeletons communs, textareas redimensionnables, sélecteurs cohérents et aides secondaires accessibles au clavier et au toucher.

- Navigation : retour en haut après le changement effectif d’onglet, y compris lors du retour vers une section déjà visitée.

## 19 octobre 2026

- Filtre du carnet intégré au sélecteur commun : menu stylé sur ordinateur, panneau sur mobile, chevron aligné et champs espacés.

- Autorisations du parcours : panneau aéré, titre et bilan mieux espacés, bouton sur sa propre ligne sur mobile.

- Carnet allégé : accès directs au remplacement et à l’historique des documents, rappels répétitifs retirés et champs de saisie en graisse normale.

- Premier affichage préparé côté serveur après authentification : vue demandée présente immédiatement, profil et offres indépendants en cas d’erreur, lectures initiales API supprimées. [Audit et mesures de production locale](audits/accessibility-performance-2026-10-19.md) avec données fictives, résultats et réserves détaillés.

- Audit d’accessibilité : noms accessibles alignés sur les libellés visibles, sélecteurs mobiles utilisables au clavier, bordures de champs contrastées, textes agrandis sans troncature dans la navigation et erreurs conservées jusqu’à leur fermeture. Profil et sources chargés à la demande avec un état de reprise.

- Recette de la refonte : focus restauré, arrière-plan inerte dans les dialogues, notifications accessibles au-dessus de la navigation mobile, erreurs de sauvegarde persistantes et brouillons conservés.

- Profil réparti entre carnet, documents et présentation, brouillons conservés pendant la navigation ; réglages des sources repliables et confirmation d’enregistrement.

- Opportunités : liste compacte et fiche adjacente sur ordinateur, fiche dédiée et retour à la liste sur mobile ; sélection groupée à la demande et décision confirmée avant mise à jour.

- Accueil centré sur la prochaine action et les entretiens réels ; candidatures lisibles avec prochaine étape, dates et reprise après erreur.

- Refonte des fondations : titre unique par page sans baseline, navigation restaurable par URL, contrôles accessibles et états de chargement/erreur distincts.

- Carnet d’expériences : exemples repliables, titre et statut visibles dans l’en-tête, ouverture automatique lors de la relecture.
- Ajout d’exemples sous une expérience ; amélioration des fiches d’offres, des sections de candidature et de la boîte de dialogue de corbeille.

Première version publique anonymisée : tri des offres, pipeline de candidatures, entretiens, bibliothèque de faits avec consentement, questions et variantes de réponses, corbeille et tests de non-régression. Les intégrations privées et les données personnelles ne sont pas distribuées.
