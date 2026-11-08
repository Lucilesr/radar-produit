# L6 — Offres

Passe visuelle sur les vues existantes : hiérarchie Bricolage, surfaces Signal, cartes et réserve plus lisibles, petites commandes portées à 44 px. Les conteneurs de défilement, hauteurs de lecture, règles de lot, score, décisions et sauvegardes restent inchangés. Aucun texte d’aide ajouté.

Captures avant sur le staging privé 78, à 1 360 × 900 et 390 × 844, données fictives avec 1 000 offres et 50 candidatures. Référence de défilement : la page atteint les panneaux ; la fiche et la liste avancent séparément, sans faire défiler du blanc. Après : staging privé 79 puis 80, code final `4f79e98e565908e8fe7c5c6b7aca9c9eefaa6c80`. Aucune migration ni production.

La recette a révélé un ancien libellé de réserve devenu inexact : le groupe Loin suit le classement du radar, pas un seuil fixe de 50. Le texte est corrigé ; la règle de classement ne change pas.


Vérifié sur le staging : lot de 20 offres inchangé, fourchette 62–70 k€ / an dans la liste et deux bornes dans la fiche, labels Très proche / Proche / Loin, cinq groupes de réserve et filtre du groupe Loin à 6 offres. Écarter le groupe demande confirmation ; Annuler ne modifie rien. Archives (58) avec Remettre à examiner disponible, corbeille vide, sélecteur de date au clavier et options de 44 px. Fiche et éditeur mobiles ouverts puis fermés sans modification ; retour du focus à la liste. Aucune donnée de candidature ou décision de tri changée pendant ce lot.

Défilement sur ordinateur : avant, page de 407 px puis liste à 900 px et fiche à 337 px ; après, page de 417 px puis liste à 900 px et fiche à 346 px. Le conteneur extérieur reste à sa place pendant le défilement des deux panneaux. La différence de position vient des contrôles plus grands ; aucune hauteur ni règle de débordement n’a changé. Aucun débordement horizontal à 390 px. Les commandes visibles de liste et de réserve atteignent 44 px ; l’onglet L’offre est lui aussi élargi à 44 px. Mouvement réduit conservé et console nominale propre.

Contrastes calculés : texte secondaire sur surface secondaire 4,79:1, sur avertissement 5,06:1 ; titres pétrole sur papier 11,24:1. Les nombres et barres gardent un texte équivalent. Aucune animation ajoutée. Aide de réserve : 111 mots mesurés sur ordinateur (104 sur mobile), sous 120 ; aucune aide nouvelle, sauf le libellé inexact remplacé. 412 tests réussis, TypeScript sans erreur ; 33 erreurs ESLint préexistantes, aucune nouvelle. Les captures `local-*` sont un complément local explicite, les autres viennent du staging. Les composants d’erreur et de reprise restent ceux existants ; aucune panne n’a été provoquée sur le staging.

Lecture finale du compte : les 1 000 offres sont strictement identiques avant/après ; critères, deux fichiers, tableau personnel, plan et note de 2 000 caractères conservés. Le staging reste privé, un seul propriétaire et aucun visiteur externe.
