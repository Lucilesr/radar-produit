# Recette L3 / C3 — staging 50 à 52

Version finale : staging privé 52, code public `06d6927`, source Sites `e86f61ad130474a87b25e8bca173421aa800b89a`. Les données et toutes les captures sont fictives. Aucune migration supplémentaire, aucune production.

| Vérification | Résultat |
| --- | --- |
| Compte sans bilan | Mes leçons affiche un état vide explicatif, sur ordinateur et mobile. |
| Proposition facultative | Un refus confirmé propose Écrire ou Pas maintenant. Aucun formulaire obligatoire ni encouragement du refus. Le refus reste enregistré après avoir décliné. |
| Reprise au clavier | Pas maintenant remet le focus sur le titre de la page. Le dossier et la section Entretiens permettent de retrouver le bilan. |
| Champs et brouillon | Deux questions et un espace libre, tous facultatifs. Validation désactivée à vide. Trois réponses fictives conservées après Échap et réouverture ; aucun bilan validé ni événement L1 à ce stade. |
| Conflit réel | Un second accès du même compte valide un autre bilan. L’ancien formulaire reçoit un 409, conserve ses trois textes et place le focus sur l’erreur. Dernière version lisible ; validation après comparaison explicite. |
| Validation et persistance | Bilan daté dans le dossier, puis même contenu dans Mes leçons après rechargement. Accès réciproque entre profil et candidature. |
| Journal | Un seul lesson_validated pour l’envoi, malgré comparaison et réessai. Aucun texte privé dans ses données. La candidature reste refusée ; neuf offres fictives et trois candidatures conservées, jauge C1 inchangée. |
| Longs textes | 2 000 caractères dans une question et 4 000 dans l’espace libre : champs défilables et retours à la ligne, aucun débordement à 390 px ou 1 360 px. Retour au bilan court sans nouveau progrès. |
| Mobile / mouvement | Cibles de 44 px ; titre du formulaire visible au-dessus du bandeau de démo après correction. Mouvement réduit du compte : durée calculée 0 s. |
| Focus / erreurs | Focus sur titre à l’ouverture, sur erreur après conflit, sur le bouton ou la région du bilan à la fermeture et à la validation. Le texte reste disponible en cas d’échec. |
| Mes leçons | Lecture paginée ; titre mobile corrigé et vérifié sur une ligne. Doublons de rendez-vous sans effet sur ce parcours. Pagination de 22 bilans et dossier devenu indisponible couverts par tests SQLite. |
| Sauvegarde / isolement | Textes validés, brouillons et versions conservés par sauvegarde intégrale A/B ; aucun accès au bilan d’un autre compte. Dix tests de sauvegarde réussis sur Node 22.13.0. |
| Console finale | Aucun avertissement ni erreur dans le nouvel onglet nominal sur 52. Le 409 volontaire a été vérifié séparément. |
| Contrôles | 368 tests réussis, TypeScript réussi, zéro nouvelle erreur ESLint (35 préexistantes). |

Les captures marquées `final` montrent la version 52. Les premières captures documentent aussi les états vérifiés sur 50 et les détails de superposition corrigés sur 51 ; leurs règles de sauvegarde sont inchangées sur 52. Toutes les dimensions ont été contrôlées : 1 360 × 900 ou 390 × 844.

La coupure réseau système n’a pas été provoquée. Les erreurs, conflits, transactions annulées, réessais et changements concurrents sont couverts par tests ; le brouillon et les bilans déjà affichés restent conservés dans l’interface. La sauvegarde inclut les textes privés, mais le journal et les prompts ne les reçoivent pas. Le quota et les préférences Q6 restent actifs ; la démo de recette utilise le mouvement réduit.

La règle Q6 « jamais au seul refus » est précisée dans le guide et la feuille de route pour éviter toute contradiction avec le progrès L3/C3 explicitement demandé.
