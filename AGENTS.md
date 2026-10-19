# Workflow Radar Produit

Ce dépôt est public et présente des données fictives. Le site personnel privé et ses données ne doivent jamais être copiés ici.

Pour chaque évolution, y compris les corrections, la documentation et les règles du projet :

1. Partir du `main` GitHub à jour et créer une branche `codex/<sujet>`.
2. Garder une seule intention cohérente par branche et par pull request. Séparer les ajustements indépendants au lieu de les regrouper dans une grosse PR.
3. Vérifier le diff et exclure CV réels, documents, offres privées, profils personnels, sauvegardes, secrets et journaux.
4. Exécuter les tests adaptés et indiquer leur résultat dans la PR.
5. Ouvrir la PR vers `main` avec le compte GitHub connecté de la propriétaire. Indiquer que Codex a préparé les changements si c’est le cas.
6. Ne pas pousser directement sur `main` et ne pas fusionner la PR à la place de la propriétaire sans demande explicite.

Un changement cohérent peut toucher plusieurs fichiers. Pour des PR dépendantes, indiquer la dépendance et adapter la branche de base afin que chaque diff reste ciblé. La description de chaque PR explique le problème traité, le résultat et les vérifications effectuées. Mettre à jour `CHANGELOG.md` pour les évolutions produit ; une modification documentaire seule ne nécessite pas de tests applicatifs.

Le dépôt GitHub et le dépôt interne de Sites sont distincts. Un déploiement du site privé ne crée pas de PR GitHub. Si la même modification concerne les deux, ouvrir sa petite PR GitHub et vérifier que le code public reste fictif, puis gérer séparément le déploiement privé sans changer sa visibilité.
