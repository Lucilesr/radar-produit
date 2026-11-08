# Recette C1 — staging44 à46

Version finale : staging46 privé, code public `2c17ced`, source Sites `bd2d2507d5518cc2ba5353c735aa0475b2f801c2`. Les contrôles de focus ont été corrigés dans45 ; la duplication du panneau au passage au brief a été corrigée et revérifiée dans46. Aucune migration supplémentaire, aucune production. Données et captures entièrement fictives.

| Vérification | Résultat |
| --- | --- |
| Sans repère | Zéro pour une candidature malgré le CV présent au profil. Autre dossier Orion resté à0 ; aucune coche automatique. |
| Trois sur quatre | CV, message et questions confirmés : Soignée à3sur4 : il manque le contact. Captures ordinateur/mobile. |
| Quatre / retrait | Contact confirmé :4/4. Retrait : retour à3/4, point manquant précis. Statut et note inchangés. |
| Persistance | Rechargement du dossier : mêmes trois choix. Tableau, Kanban et actions de l’accueil reprennent la même jauge ; autres candidatures à0. |
| Brief | Même jauge dans Préparer / brief. Défaut de duplication trouvé pendant la recette puis corrigé ; version46 vérifiée avant et après modification : un seul panneau, champs utilisables, console vide. |
| Conflit réel | Un autre accès du même compte fictif coche le contact. L’onglet ancien tente de retirer une autre case :409, quatre coches conservées, erreur explicite. Relire les repères reprend la version du compte sans écraser le contact. |
| Clavier / focus | Espace coche. Perte de focus initiale corrigée ; le focus revient sur la case après confirmation, sur Relire les repères lors d’un conflit, puis sur une case après relecture. Captures avec focus visible. |
| Ordinateur / mobile |1360×900 et390×844, dimensions de chaque fichier contrôlées. Quatre cibles44×44, texte multiligne, aucun débordement horizontal. |
| Mouvement réduit | Préférence du compte active, données et contrôles disponibles ; progression Signal, sans mouvement nécessaire. |
| Journal | Un événement application_cared observé au passage à trois ; le quatrième repère et ses réessais n’ajoutent pas un second événement. Seulement score et source, aucun texte privé. |
| Données / sauvegarde | Huit offres et trois candidatures fictives conservées. Métadonnées privées isolées par offre et compte, versions et restauration A/B couvertes ; aucune migration. |
| Console finale | Aucun avertissement ni erreur JavaScript dans le nouvel onglet de recette, y compris après modification du brief. Conflits409 attendus expliqués dans l’interface. |
| Contrôles |351 tests réussis, TypeScript réussi, zéro nouvelle erreur ESLint (35 préexistantes). |

Les captures du choix0/3/4, du conflit, des listes, du Kanban et de l’accueil sont dans ce dossier ; celles du brief sont prises sur46. Les règles inchangées ont été vérifiées sur44–45, puis le brief et son focus sur46. La panne réseau réelle et le mode hors ligne système n’ont pas été provoqués. L’interface conserve les choix confirmés et propose une relecture ; les échecs d’écriture, conflits et transactions annulées sont testés.

La longue en-tête des dossiers mobiles relevée en C0 reste à corriger dans C4. Aucun envoi réel, aucune nouvelle donnée transmise à un tiers.
