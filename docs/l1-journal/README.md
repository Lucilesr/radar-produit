# Recette L1 — staging40

Code applicatif public `22de4baf98eaeb845a168c2489bc0e427a73c752`, source Sites `8a9cc9b4264907f899ff5ef0aaeb14abd8df09fc`. Déploiement privé réussi le8novembre2026 (heure Maurice), configuration et visibilité conservées. Aucun déploiement de production. Captures : uniquement compte et données fictifs.

| Vérification | Résultat |
| --- | --- |
| Migration additive | Création de la table/index par le déploiement ; lecture et écritures réelles des événements réussies. Aucune donnée existante remplacée. L’inspecteur de tables Sites ne fournissait pas les liaisons ; contrôle effectué par les API applicatives authentifiées. |
| Compte sans historique | Journal vide explicite, aucune action ancienne inventée, capture ordinateur. |
| Événements attendus | Sélection, plus tard, écartement réalisés à l’écran ; candidature, entretien noté, histoire validée et engagement vérifiés sur fixtures API ; relance et fin de séance confirmées à l’écran. Les huit actions demandées sont présentes. |
| Données conservées | 1000 offres toujours présentes. Les51 candidatures incluent la nouvelle candidature fictive créée pour cette recette (50 actives, une close). |
| Reprise et relance | Après rechargement, bouton Reprendre la séance ; la relance faite ne réapparaît pas. Bilan final : une relance faite. Le point de reprise est vide après la fin confirmée (version6). |
| Conflit de reprise | Une fermeture de page a fait avancer le point de reprise pendant sa relecture. Écriture ancienne refusée ; Réessayer puis Reprendre ont abouti sans perdre la relance. Concurrence, non-résurrection et rollback couverts aussi dans les tests SQLite. |
| Pagination / clavier | 22 événements : pages20 puis2. Entrée active le bouton ; le focus revient sur le journal après lecture, sans perdre la page lors du changement de taille. |
| Ordinateur / mobile | 1360×900 et390×844 ; journal, vide, bilan et pagination vérifiés visuellement. À390px, dates sous le texte, boutons44px, aucun débordement horizontal. Journal sans animation ; les préférences de confort restent disponibles. |
| Console | Aucune erreur JavaScript relevée dans le parcours nominal et la reprise. Le conflit attendu est expliqué dans l’interface. |
| Confidentialité | Les événements ne contiennent ni notes, ni réponses, ni CV, ni texte d’histoire. Titres appartenant au compte seulement. Aucun tiers. |
| Contrôles | 337 tests réussis, TypeScript réussi, zéro nouvelle erreur ESLint (35 préexistantes). Sauvegarde et restauration A/B avec journal ; formatsv1–v3 conservés. |

Les erreurs réseau réelles et le mode hors ligne système n’ont pas été provoqués dans cette recette. Le code conserve la dernière lecture, propose une reprise et bloque une écriture sans confirmation ; ces règles serveur sont testées.

- `staging-vide-ordinateur.jpg` : journal neuf.
- `staging-relance-conservee-ordinateur.jpg` : relance déjà faite après rechargement.
- `staging-fin-seance-ordinateur.jpg` : bilan fidèle aux actions confirmées.
- `staging-pagination-clavier-ordinateur.jpg` : page ancienne et focus.
- `staging-pagination-mobile.jpg` : journal lisible et navigation à390px.
