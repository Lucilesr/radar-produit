# Recherche d’offres LinkedIn et Welcome to the Jungle

Radar affiche des liens de recherche Google et Bing ciblant Product Owner / Product Manager, avec des termes français, sans filtre de pays. L’utilisateur ouvre l’index et vérifie chaque résultat lui-même. Radar n’interroge pas LinkedIn ou Welcome to the Jungle, ne récupère ni ne conserve les résultats, et n’utilise ni compte, cookies, extension ou Brave.

Cette limite est volontaire. Les conditions LinkedIn interdisent le scraping, y compris automatisé via des tiers, et la copie/distribution de contenus sans consentement. Les CGU publiques de Welcome to the Jungle interdisent également l’extraction et la copie automatisées, tout en prévoyant une permission limitée pour les moteurs publics qui indexent leurs pages. Une recherche disponible sur un moteur ne vaut pas autorisation pour Radar de constituer une copie d’offres.

Les fiches Radar peuvent être complétées depuis des sources employeur officielles ou des connecteurs ATS publics. L’aperçu ne lit que des offres individuelles Greenhouse/Ashby via leurs API publiques documentées ; aucun identifiant ni paiement. L’import reste une proposition à vérifier. Le pays du poste n’est jamais assimilé aux pays autorisés pour le télétravail. La langue française est un critère de découverte, pas une garantie que toute l’annonce ou le travail se déroule en français.

## Vérifications

- Les liens ne contiennent que des requêtes de recherche publiques ; aucune donnée utilisateur n’y est ajoutée.
- Aucun endpoint LinkedIn/WTTJ, profil, cookie ou identifiant de compte n’est appelé.
- Aucun abonnement ou clé de recherche payante n’est requis. Brave n’est pas proposé.
- Le test vérifie les hôtes des liens générés et le contenu des quatre requêtes.

## Références consultées le 20 octobre 2026

- LinkedIn, [User Agreement](https://www.linkedin.com/legal/user-agreement), sections 8.1 et 8.2.
- Welcome to the Jungle, [Conditions d’utilisation](https://www.welcometothejungle.com/fr/pages/terms), règles d’accès automatisé et d’indexation.
- Greenhouse, [Job Board API](https://docs.greenhouse.io/job-board) : GET public des fiches, sans authentification.
- Ashby, [Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api) : GET des annonces publiées du tableau employeur.
- Microsoft, [Retrait des API Bing Search le 11 août 2025](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement). Radar ouvre le moteur web Bing ; il ne dépend pas de l’ancienne API Bing Search.
