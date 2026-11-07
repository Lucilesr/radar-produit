# Q0 — Fondations Signal

Q0 ajoute les jetons de la feuille de route et une police d’affichage Bricolage Grotesque variable locale (204 636 octets, `font-display: swap`, licence OFL jointe). La police de lecture système reste conservée. Aucun titre existant n’est recomposé avant les lots qui l’utilisent.

La source de la police et sa licence sont le [dépôt officiel Atelier Triay](https://github.com/ateliertriay/bricolage). Aucune requête de police n’est adressée à Google Fonts ou à un autre service depuis l’application.

- `SignalCounter` : chiffres tabulaires, animation 600 ms et valeur finale accessible. Les images intermédiaires ne sont pas annoncées.
- `SignalProgress` : progression bornée, variantes neutre, énergie et terminée. La barre existante du lot l’utilise sans changement de disposition.
- `SignalRadar` : SVG décoratif de 48 à 160 px ; le balayage ne tourne que si `scanning` est demandé par une actualisation. Un texte adjacent doit expliquer l’état réel.
- `SignalMoment` : dialogue Radix plein écran, titre focalisé, Échap, fermeture, piège de focus et retour au déclencheur. Pétrole, texte blanc, bouton citron ; feuille pleine hauteur sur mobile.
- `SignalStepper` : étapes terminées, courante et futures, annoncées en texte.

`app/signal-motion.css` fournit radar-sweep (2,4 s), radar-blip (900 ms) et signal-pop (260 ms). `prefers-reduced-motion` et `html[data-motion="reduced"]` coupent animations, transitions et défilement animé ; les compteurs se terminent immédiatement. Q6 ajoutera la commande de préférence, sans changer ce contrat.

Le jeton `--signal-ash` sert aux bordures et décors sur blanc, jamais à un texte fonctionnel : son contraste ne satisfait pas 4,5:1. Le texte secondaire conserve `--signal-muted`. Citron et corail sont des fonds/décors accompagnés de texte pétrole contrasté ; aucune erreur n’utilise le corail.

## Vérifications

Tests Node des bornes et de la fin des compteurs ; suite applicative, TypeScript et comparaison ESLint avec la base. Contrôle de la barre du lot sur ordinateur et mobile, clavier et focus. Les composants sans consommateur sont contrôlés dans une page locale de recette retirée avant publication ; leurs parcours réels seront vérifiés lors de Q2/Q3/Q5. Cette page n’est pas un nouvel écran du produit.

Recette locale : [bilan ordinateur](q0-signal/bilan-ordinateur.jpg), [bilan mobile à 390 px](q0-signal/bilan-mobile.jpg), [composants avec mouvement réduit](q0-signal/composants-mobile.jpg). Le titre reçoit le focus ; Tab reste dans le bilan, Échap revient au bouton d’ouverture. Le radar réduit a une durée d’animation calculée de 0 s, le compteur affiche immédiatement 8 et la page ne déborde pas à 390 px. Console sans erreur ni avertissement. 276 tests réussis, TypeScript réussi, aucune nouvelle erreur ESLint (35 erreurs préexistantes dans la base).

La recette du staging porte sur le consommateur livré : barre du lot vide, en cours et terminé, ordinateur/mobile, navigation clavier. Les autres composants auront leur recette de staging dans les lots qui les emploient, sans exposer la page de test locale.

Pas de migration, de donnée utilisateur modifiée, de personnage ni de déploiement en production.
