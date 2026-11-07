# Recette S5 — staging privé

Captures JPEG sans retouche, avec données entièrement fictives. Version staging36, code source `b05b2373bfaf56f22aeeb909c73c99432ae22100`. Aucun déploiement de production.

- `staging-propositions-ordinateur.jpg` : propositions issues de blocs validés et autorisés, 1360px.
- `staging-deux-termes-mobile.jpg` : deux confirmations distinctes, jetons persistants après rechargement, 390px.
- `staging-notification-sans-cta-mobile.jpg` : accusé de confirmation, fermeture seule, aucun CTA Annuler ou Voir les offres.
- `staging-offre-liste-mobile.jpg` et `staging-offre-fiche-mobile.jpg` : offre fictive, fourchette62–70k€/an ; critères B2B et Backlog pris en compte. Lecture API avant/après : pas de Domaine puis20points, adéquation87/Très proche ; poids inchangés.
- `staging-droits-changes-mobile.jpg` : vraie révocation du droit de candidature depuis un second accès fictif. L’ancienne proposition SaaS répond409, conserve les deux critères et propose Relire. La relecture ne propose plus SaaS depuis ce bloc.

Retrait d’un terme par Espace vérifié, focus au titre et contrôles44px. Aucun débordement horizontal à390px. Console du parcours nominal sans erreur ; le409 volontaire du scénario périmé est attendu et expliqué.

Plafond préparé par38confirmations API individuelles de données fictives puis vérifié en interface :40/40, huit boutons désactivés ; retrait B2B par Espace39/40, confirmation40/40 ; pagination8→16, aucun débordement. Captures `staging-quarante-termes-mobile.jpg` et `staging-quarante-termes-ordinateur.jpg`. Titre180caractères dans les propositions. Console nominale sans erreur ni avertissement après ces actions.
