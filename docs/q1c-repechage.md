# Q1c — Le repêchage du vendredi

Le vendredi, au-dessus de **la réserve**, Radar propose au plus trois offres écartées depuis sept jours, encore classées **Proche** ou **Très proche**, avec une adéquation d’au moins 60 et sans condition exclue. Une candidature déjà engagée n’entre pas dans ce tirage.

Le tirage utilise le jour civil local et l’identifiant de l’offre. À ensemble éligible identique, il est stable sur la journée et indépendant de l’ordre des offres reçues. Aucun tirage, clic « Laisser » ou nouveau critère n’est stocké. La carte disparaît hors du vendredi ou sans offre éligible. La date est relue à la minute et au retour dans l’onglet.

**Restaurer** utilise la route de corbeille existante ; le résultat est confirmé avant de retirer l’offre du repêchage. Une erreur garde une reprise possible et un message explicite. **Laisser** conserve l’offre en corbeille et la retire seulement de la carte pendant cette visite. La restauration ne change aucun statut de candidature. La stabilisation du lot dès le premier choix, également observée dans la base, est suivie dans Q1d. La réserve reste accessible même si le repêchage est sa seule proposition.

## Recette reproductible, données fictives

`/demo?scenario=friday` crée un compte de démonstration isolé, avec un niveau Senior fictif et quatre offres proches écartées il y a deux à cinq jours. Le bandeau annonce explicitement un repêchage simulé un vendredi : l’horloge de l’appareil n’est pas modifiée, aucun compte réel n’est concerné. Ouvrir Opportunités puis Voir la réserve. Trois offres sont proposées ; recharger et revenir à la réserve conserve le tirage tant qu’aucune donnée ne change. Laisser puis Restaurer permet de vérifier les deux actions et le compteur Corbeille.

La démo ordinaire, hors du vendredi, vérifie l’absence de carte. Les tests Node couvrent la fenêtre de sept jours et ses bornes, les dates invalides/futures, les candidatures, les états incomplets, les conditions exclues, la stabilité et les autres jours. Contrôles complets : tests applicatifs, TypeScript et comparaison des erreurs ESLint avec la base.

Composants réutilisés : WorkspaceButton, WorkspaceFormError, FitBadge et les variables/cartes Signal. Focus restitué au titre après un choix ; actions nommées par entreprise, cibles de 44 px sur mobile, titres longs multilignes. Pas de migration, pas de production.

Recette locale : [ordinateur 1360 px](q1c-repechage/ordinateur.jpg), [mobile 390 px](q1c-repechage/mobile.jpg). Trois propositions, même tirage après rechargement ; Laisser conserve Corbeille à 4, Restaurer le passe à 3 ; focus au titre après chaque action, cibles de 44 px, aucun débordement. Console sans erreur ni avertissement. 279 tests réussis, TypeScript réussi, aucune nouvelle erreur ESLint.
