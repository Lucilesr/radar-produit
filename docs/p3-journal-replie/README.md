# P3 — recette du journal replié

Staging privé, version 62, le 8 novembre 2026. Toutes les données et identités visibles sont fictives. Même compte de démonstration, 1 000 offres et 50 candidatures ; 66 événements, dont 44 cette semaine, fuseau Indian/Mauritius.

- Ordinateur 1 360 × 900 et mobile 390 × 844 : journal fermé au chargement, résumé intégral de 44 actions ; ouverture au clavier, journées indépendantes.
- Pagination 20 → 40 → 60 → 66 sans doublon. La journée reste ouverte ; le focus arrive sur la première nouvelle ligne ou le résumé de la nouvelle journée. Le total hebdomadaire reste 44.
- Filtres avant pagination : Tri 12, Profil vide ; conservation des autres jours jusqu’au changement de filtre confirmé. Un filtre vide explique son état sans annoncer une erreur.
- Mobile : textes longs à la ligne, aucun débordement horizontal, filtres de 46 px. Focus visible ; transition des jours à 0 s avec le confort réduit du compte.
- Console nominale : aucune erreur ni alerte.
- 393 tests réussis, vérification TypeScript réussie. Tests dédiés : droits du compte, lecture seule, pagination filtrée, semaine complète au-delà de 20, lundi et changements d’heure, future date exclue, erreur API 503 et requête invalide 400. La panne réseau réelle n’a pas été provoquée sur le staging ; l’interface conserve les dernières données et propose de relire.

L’aide visible est de 74 mots dans cette démo, 115 dans le compte hors démo (textes métier et commandes exclus). Le journal ajoute son aide derrière le bouton d’information.

Captures avant/après dans ce dossier : compte et journal sur les deux formats, pagination, jours, filtre vide et ligne mobile. Les dimensions sont contrôlées. Les données privées réelles ne sont jamais utilisées.
