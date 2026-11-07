# Workflow Radar Produit

Ces consignes s’appliquent à tous les agents, dont Codex et Claude. `CLAUDE.md` renvoie vers ce fichier pour conserver une référence commune.

## Déploiement : staging puis production

- Chaque tâche applicative terminée est déployée sur le staging privé pour les tests et la validation de l’utilisatrice. Fournir le lien et les vérifications effectuées.
- Passer en production uniquement après validation explicite par l’utilisatrice de la version testée sur staging. La fin d’une tâche, les tests ou la fusion d’une PR ne valent pas validation de production.
- Promouvoir le code validé sans écraser, remplacer, réinitialiser ni supprimer les données ou fichiers de production. Conserver sa configuration et sa visibilité.
- Le staging utilise sa propre base, son propre stockage et des données de test indépendantes. Ne jamais copier ses données vers la production.
- Une modification documentaire seule ne nécessite pas de déploiement applicatif.
- Chaque agent doit disposer de ses propres accès GitHub et Sites autorisés. Ces instructions ne donnent pas accès aux outils d’un autre agent ; signaler tout accès manquant sans annoncer une publication non effectuée.

## Règle de production : design system

Pour chaque changement visible, réutiliser les composants, styles et variables du design system Signal. Examiner les composants existants et `audits/signal-design-system.md` avant de créer un contrôle ; éviter les sélecteurs natifs ou les styles isolés lorsqu’un composant du système couvre le besoin.

Avant toute PR ou tout déploiement d’interface, vérifier visuellement le rendu sur ordinateur et mobile, les états utiles (repos, ouverture, sélection, erreur et désactivation selon le cas), le clavier et le focus. Corriger les écarts avec les autres écrans avant publication et indiquer dans la PR les composants réutilisés et les vérifications effectuées. Cette vérification s’applique à chaque itération, sans rappel de l’utilisateur.

Ce dépôt est public et présente des données fictives. Le site personnel privé et ses données ne doivent jamais être copiés ici.

Pour l’onglet Ma recherche, suivre `docs/ma-recherche-v2.md` lot par lot. Pour le score des offres, suivre `docs/score-v2.md` lot par lot.

Pour chaque évolution, y compris les corrections, la documentation et les règles du projet :

1. Partir du `main` GitHub à jour et créer une branche `codex/<sujet>`.
2. Garder une seule intention cohérente par branche et par pull request. Séparer les ajustements indépendants au lieu de les regrouper dans une grosse PR.
3. Vérifier le diff et exclure CV réels, documents, offres privées, profils personnels, sauvegardes, secrets et journaux.
4. Exécuter les tests adaptés et indiquer leur résultat dans la PR.
5. Ouvrir la PR vers `main` avec le compte GitHub connecté de la propriétaire. Indiquer que Codex a préparé les changements si c’est le cas.
6. Ne pas pousser directement sur `main`. Après les vérifications, fusionner automatiquement la PR si elle est fusionnable et si les contrôles requis réussissent, sans redemander confirmation. Si la fusion est bloquée, laisser la PR ouverte et expliquer le blocage.

Un changement cohérent peut toucher plusieurs fichiers. Pour des PR dépendantes, indiquer la dépendance et adapter la branche de base afin que chaque diff reste ciblé. La description de chaque PR explique le problème traité, le résultat et les vérifications effectuées. Mettre à jour `CHANGELOG.md` pour les évolutions produit ; une modification documentaire seule ne nécessite pas de tests applicatifs.

Le dépôt GitHub et le dépôt interne de Sites sont distincts. Un déploiement du site privé ne crée pas de PR GitHub. Si la même modification concerne les deux, ouvrir sa petite PR GitHub et vérifier que le code public reste fictif, puis gérer séparément le déploiement privé sans changer sa visibilité.
