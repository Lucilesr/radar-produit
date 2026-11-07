# Q2 — Le radar travaille

Le même balayage est accessible depuis Aujourd’hui, Opportunités et Ma recherche. Les réglages d’actualisation à l’ouverture restent respectés. Les vues précédentes restent montées : revenir pendant une lecture ne perd pas la saisie. Les raccourcis de tri sont suspendus pendant le bilan.

Le serveur compte les éléments réellement parcourus, les créations et les doublons. L’adéquation retient les offres à 60 ou plus, ou dont les conditions sont remplies, hors exclusions ; les identifiants sont dédoublonnés entre sources. Le nombre du bouton vers À examiner correspond aux offres réellement disponibles, distinct des correspondances déjà sélectionnées. Pause et cache sont distingués d’une panne. Les échecs partiels conservent aussi les écritures déjà réussies. Reprendre une source remplace uniquement sa ligne et recalcule le total.

Les flux partagent un délai de 40 secondes, chaque appel est borné et le client s’arrête au plus tard après 60 secondes, relecture comprise. Aucune suppression d’offre. Aucune mesure tierce. Pas de migration.

## Recette fictive

`/demo?scenario=scan` crée un compte isolé avec deux flux fictifs et deux visites anciennes. Le premier balayage donne **4 parcourues, 3 selon les critères, 3 nouvelles, 1 doublon**. Le suivant donne **0 nouvelle et 4 doublons**, sans recréer de fiche. `scan-empty` prépare ce second état dès le premier clic. `scan-partial` échoue sur Jobgether, puis Réessayer Jobgether le rétablit sans perdre We Work Remotely. `scan-error` échoue sur les deux sources : arrêt, message et accès aux offres conservées. `scan-reduced` active le réglage de mouvement réduit et affiche immédiatement les chiffres. Ces scénarios sont explicitement signalés et ne contactent aucun flux externe.

Composants réutilisés : SignalRadar, SignalCounter, WorkspaceButton, WorkspaceFormError, composants de source existants, palette et police Signal. Clavier : focus au titre du bilan, Échap et retour au déclencheur ; aucune touche de tri n’agit sur la fiche masquée. Les visites email sont également consultables et marquables comme faites, sans changer l’import des alertes.

Tests : 294 tests réussis, TypeScript réussi ; aucune nouvelle erreur ESLint (35 erreurs préexistantes). Les tests SQLite vérifient les vrais enregistrements et doublons, la reprise partielle, les pauses et l’absence de requête externe des scénarios. Les tests purs couvrent le calcul, les réponses malformées, la fusion de reprise et la conservation des réglages les plus récents.

Recette locale sur 1360 et 390 px : nouveaux résultats, doublons, panne partielle et reprise, panne complète, visite Malt confirmée, focus au titre, absence de débordement. Mouvement réduit contrôlé par le réglage réel : toutes les animations du radar ont une durée nulle. La coupure du réseau du navigateur n’a pas été simulée ; les délais et messages sont vérifiés dans le code.

Staging privé **v28**, déploiement réussi : [panne partielle sur ordinateur](q2-balayage/staging-partiel-ordinateur.jpg), [reprise sur mobile](q2-balayage/staging-reprise-mobile.jpg), [panne complète](q2-balayage/staging-erreur-mobile.jpg), [mouvement réduit](q2-balayage/staging-reduit-mobile.jpg). Panne partielle 2/1/1/1 puis reprise 4/3/3/1, mêmes chiffres que les enregistrements fictifs ; second balayage 4/3/0/4. Les offres restent conservées en panne complète. À 390 px, aucun débordement ; focus au titre puis retour à Actualiser par Échap ; animations du radar à 0 s dans le réglage réduit. Parcours nominal sans erreur ni avertissement de console ; le 503 du scénario de panne est volontaire. Configuration, stockage et audience privée conservés. Aucune production.
