# Q1d — Vos tris affinent le radar

Radar cherche des **faits communs**, sans prétendre connaître la raison intime d’un refus : quatre offres écartées depuis sept jours avec la même présence hybride chiffrée, le même contrat, le même intitulé exact ou la même source. Les annonces signalées comme pourvues ou fermées ne participent pas. Une seule proposition est affichée à la fois, en privilégiant présence, contrat, intitulé puis source ; aucun critère n’est modifié automatiquement.

**Ajuster mes critères** ouvre un dialogue Signal prérempli : présence exceptionnelle pour le contrat concerné, retrait du contrat si un autre reste recherché, mot d’intitulé à exclure ou source à écarter. Le brouillon est modifiable ; **Enregistrer le critère** est le seul enregistrement. Annuler ou Échap conserve les critères. Un échec conserve le brouillon et propose de réessayer. Les sources écartées apparaissent dans Ma recherche et peuvent y être décochées. Les sélections et candidatures restent accessibles.

**Non merci** garde le refus dans `profiles.data.triageDismissals` trente jours, y compris après rechargement. La liste est validée et bornée à soixante clés ; aucun événement n’est envoyé à un tiers. Les autres propositions, fondées sur d’autres faits, restent possibles. Un refus ne modifie jamais un critère.

## Tri et compteur

- Sur une fiche ouverte, **S** sélectionne, **L** garde pour plus tard, **X** écarte. Ces touches sont inactives dans les saisies, menus, dialogues, pendant une écriture et avec Ctrl/Alt/Commande. La préférence `preferences.triageShortcuts: false` les coupe ; la commande de réglage arrive en Q6.
- Le premier choix verrouille les identifiants affichés avant la requête. Compteur et offre restent stables pendant l’attente. Après confirmation, l’offre suivante s’ouvre et son titre reçoit le focus. En échec, l’offre et le compteur restent conservés.
- Le lot ne reçoit aucun complément après son démarrage, même s’il a moins de vingt offres. La nouvelle règle du §4.3 remplace le complément prévu dans l’ancienne version de docs/tri.md ; les offres nouvelles ou restaurées restent dans la réserve.
- Les identifiants sont séparés par compte dans le stockage de confort. Sans stockage, la visite courante garde le lot en mémoire ; il est recalculé après un rechargement ou sur un autre appareil.
- « Pourquoi elle remonte » donne au plus quatre raisons réelles. Les informations inconnues restent distinctes de l’adéquation.

L’ouverture d’un dialogue a aussi révélé une boucle du ResizeObserver des colonnes : lecture/écriture sont regroupées à l’image suivante et les valeurs inchangées ne sont plus réécrites.

## Recette

`/demo?scenario=triage` crée un compte fictif isolé : quatre offres écartées, hybrides trois jours/semaine, et une cinquième encore à examiner. Le bandeau annonce ces tris d’exemple. Ouvrir Opportunités : la proposition « hybride 3 jours » doit être préremplie, annulable et sans effet avant confirmation. Non merci doit être conservé au rechargement ; les autres faits communs peuvent donner la proposition suivante. Le scénario vendredi de Q1c reste disponible séparément.

La logique pure teste le seuil, les sept jours et les trente jours, les annonces fermées, les doublons, les limites de listes, les critères non modifiés par un aperçu et les touches protégées. Un test de matching couvre l’exclusion explicite d’une source ; les tests du lot couvrent le premier verrou, le compteur et l’absence de complément.

Composants réutilisés : Dialog/Radix, ChoiceSelect (menu sur ordinateur, feuille sur mobile), Input, WorkspaceButton et WorkspaceFormError ; couleurs et espacements Signal. La fermeture du dialogue commun est nommée en français et mesure 44 px. Contrôles clavier/focus, ordinateur 1360 et mobile 390, erreur/attente/désactivation, console et capture du brouillon avant publication. Pas de migration ; staging privé uniquement.

Recette locale : lot de 4 figé, puis L/S/X donnent 3, 2 et 1 offre restante, titre suivant focalisé et progression conservée après rechargement. Non merci reste conservé après rechargement ; les propositions contrat, intitulé et source se succèdent sans écriture des critères. Confirmation d’une source, jeton dans Ma recherche, puis réactivation par sa case vérifiés. Sur mobile : absence de débordement, fermeture de 44 px, enregistrement désactivé sans contrat, S sans effet dans le dialogue et Échap revient au déclencheur.

Échec API réel et réversible : une offre fictive est écartée dans un second onglet ; la vue restée ouverte tente S et reçoit un refus API. La fiche reste ouverte et le compteur reste à 0 sur 4, avec « Choix non enregistré ». Après actualisation, une fiche qui n’appartient plus à la vue est fermée. Les requêtes hors ligne et leur délai sont contrôlés dans le code ; aucune émulation de coupure réseau n’est annoncée.

Captures fictives : [brouillon ordinateur](q1d-tri/brouillon-ordinateur.jpg), [brouillon mobile](q1d-tri/brouillon-mobile.jpg), [tri confirmé](q1d-tri/tri-confirme-ordinateur.jpg), [échec API conservant le lot](q1d-tri/erreur-api-ordinateur.jpg). 287 tests réussis, TypeScript réussi, aucune nouvelle erreur ESLint ; les 35 erreurs préexistantes restent hors de ce lot. Les erreurs HTTP délibérément provoquées pour la recette sont distinguées des erreurs de console du parcours nominal.

La recette de staging a repéré que le message d’échec se trouvait dans les contrôles masqués sur une fiche mobile ouverte. Il est désormais placé dans la fiche, sous le titre et l’aide clavier, pour rester visible sur ordinateur comme sur mobile. La correction fait partie de Q1d avant sa fusion.

Staging privé **v26** : recette réussie sur 1360 et 390 px. L/S/X et rechargement conservent le lot à quatre identifiants ; Non merci est conservé ; la source proposée est confirmable et réactivable dans Ma recherche. Le conflit fictif entre deux onglets conserve la fiche et le compteur **0 sur 4** ; le message est maintenant visible dans la fiche sur [mobile](q1d-tri/staging-erreur-mobile.jpg) et sur [ordinateur](q1d-tri/staging-erreur-ordinateur.jpg). Après actualisation, l’offre obsolète se ferme et le focus revient au titre de page. Parcours nominal repris dans un nouvel onglet : console sans erreur ni avertissement, défilement et absence de débordement vérifiés. Les 404 provoqués pour le scénario d’échec ne sont pas des erreurs du parcours nominal.
