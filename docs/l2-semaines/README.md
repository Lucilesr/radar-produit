# Recette L2 — staging41 à43

Version finale : staging43 privé, code public `fa74de9`, source Sites `b1fe01c3de884fff1ffa0acd6de529e08958bd69`. Les premiers parcours de pause ont été effectués sur41, la protection des écritures rapprochées sur42, puis les moments et leur contraste sur43. Aucune migration supplémentaire, aucun déploiement de production. Captures et scénarios entièrement fictifs.

| Vérification | Résultat |
| --- | --- |
| Neuf / partiel | Zéro semaine et zéro joker pour le compte sans historique ; son plan partiel1/2 conserve la série. |
| Semaine tenue | Dernière coche confirmée : moment Semaine tenue et badge1. Sur le scénario historique4, la même action affiche5semaines et conserve1joker. |
| Joker | Quatre semaines réellement cochées dans les plans fictifs, puis une semaine non tenue : série4, joker0. Calcul ordinaire, sans faux événement L1 ancien. |
| Nouveau départ | Une deuxième semaine non tenue sans joker : série0, message Nouvelle semaine, page blanche. Aucun ton culpabilisant. |
| Pause | Durées1à4 dans ChoiceSelect Signal, dates avant confirmation. Semaine déjà tenue : début lundi suivant. Quatre semaines confirmées, conservées après rechargement. |
| Reprise | Pause active préservant4semaines et1joker ; Reprendre cette semaine conserve ces valeurs et retire seulement les pauses en cours et futures. |
| Changement de semaine | Moment à la première visite du compte dans la semaine. Acquittement conservé dans le compte ; calendrier stable dans le fuseau du plan. Le passage d’année ISO et le plafond de jokers sont testés. |
| Ordinateur / mobile | 1360×900 et390×844 ; choix ouverts, sélection, repos et moments contrôlés. Pas de débordement horizontal, contrôles44px. |
| Clavier / focus | Échap ferme le moment, focus sur week-plan-title ; fermer le dialogue ou reprendre rend le focus au bouton de pause. Sélecteur et actions accessibles au clavier. |
| Mouvement réduit | Scénario compte réduit : mêmes valeurs et actions, animation du moment none. Captures ordinateur/mobile. |
| Contraste | Défaut détecté pendant la recette sur le texte des jokers ; corrigé avec signal-paper sur fond pétrole. Couleurs finales : blanc sur rgb(25,63,80). Les captures des moments ont été reprises sur43. |
| Console | Aucune erreur JavaScript ni avertissement relevé dans le parcours nominal final. |
| Données / sauvegarde | Plans, pauses et série privés conservés, formulaire ancien protégé. Sauvegarde A/B vérifie le champ weekSeries ; autres données et visibilité conservées. |
| Contrôles | 344 tests réussis, TypeScript réussi, zéro nouvelle erreur ESLint (35 préexistantes). |

Les scénarios `/demo?scenario=weeks-held`, `weeks-joker`, `weeks-reset`, `weeks-pause` et `weeks-reduced` créent un compte fictif neuf. Ils n’altèrent jamais un compte existant. La panne réseau réelle et le mode hors ligne système n’ont pas été provoqués ; erreur, dernière lecture et relecture sont prévues, et les conflits de version sont testés en SQLite.

Les captures du dossier portent les états dans leur nom. Les moments finaux couvrent série4, semaine5, joker consommé, page blanche, pause active et mouvement réduit. Les captures du choix de pause et de sa persistance documentent le parcours41 ; leur comportement n’a pas changé dans43.
