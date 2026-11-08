# B — Correctifs Balayage et Aujourd’hui

Grille publiée avant code, à partir des décisions B1–B4. Captures avant du staging 95, données fictives ; maquettes Balayage-v2 / Balayage-mobile et Aujourd’hui-v2 / Aujourd’hui-mobile.

| Format | Avant | Après | Maquette |
| --- | --- | --- | --- |
| 1360 px | ![Avant](avant-balayage-ordinateur.jpg) | ![Après](apres-bilan-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |
| 390 px | ![Avant](avant-balayage-mobile.jpg) | ![Après](apres-bilan-mobile.jpg) | ![Maquette](maquette-mobile.jpg) |

1. [x] B1 : retour, titre et contenu sur la même colonne ; actualiser à droite. Éviter que les styles d’Aujourd’hui s’appliquent au sous-écran Balayage.
2. [x] B2 : garder l’heure précédente avant la nouvelle lecture ; première lecture sans historique clairement nommée. Une reprise ciblée garde cette référence.
3. [x] B3 : démo seulement, sept sources actives dont une panne simulée, deux en pause ; vraies écritures fictives et résultats progressifs, aucun flux externe. Conserver les deux collecteurs réels en dehors de la démo et le format enregistré. Le résumé d’Aujourd’hui doit reprendre les totaux du bilan courant, puis toutes les lectures fictives après rechargement.
4. [x] B4 : prochaine étape nommant sa candidature / entreprise, sans changer sa priorité ni sa cible ; remplacer la formulation du bloc radar par « parcourues ».
5. [x] Capturer progression, bilan avec nouveautés / panne partielle, reprise, sans nouveauté et pauses dans les deux formats ; mouvement réduit, clavier, focus et cibles 44 px. Tests, types, ESLint, console et données conservées.

Les annotations restent exclusivement dans les maquettes. Les barres, états et contrôles Signal existants sont réutilisés. La simulation est signalée à l’écran ; elle ne prétend pas ajouter des collecteurs réels.

## Recette et choix

Code public `4647bde`, source de staging `6898daaa3b9f20bf770342702b62be514a9459d9`. [Galerie avant / après / maquette](galerie.html). Captures du staging via le relais privé, sans transformation de l’interface ; comptes et entreprises entièrement fictifs.

- B1 : retour, titre et contenu à la même abscisse, actualiser au bord droit. Sur mobile, le retour est sur sa propre ligne, conformément à la décision B1 qui précise la maquette.
- B2 : référence mémorisée avant le début du balayage ; une reprise ciblée ne la remplace pas. Une première lecture sans historique dit « Aucune nouvelle offre à ce premier balayage » plutôt que d’inventer une heure passée.
- B3 : les sept sources fictives utilisent le même chemin privé d’enregistrement ; les deux vraies intégrations restent inchangées. Une réponse de simulation peut décrire une panne sans erreur HTTP artificielle. Le délai de la démo est de trois minutes au maximum ; celui des deux collecteurs réels reste d’une minute. Les lignes identiques d’un même flux fictif sont dédupliquées sans répéter les écritures.
- B4 : l’entreprise de la relance, de la préparation et de l’entretien reste celle de la file existante. Les priorités et actions ne changent pas. Le résumé d’Aujourd’hui utilise le bilan courant, puis les dernières lectures enregistrées après rechargement.

431 tests et vérification des types au vert. Aucune nouvelle erreur ESLint par rapport au menu commun. Les contrôles SignalRadar, SignalProgress, WorkspaceButton, HelpTooltip et les styles Signal sont réutilisés. Aucun schéma ni migration. Production inchangée.

Staging privé **99** vérifié à 1360 et 390 px : progression réelle 0 puis 4 sources sur 7, 17 nouvelles offres / 32 parcourues, panne Jobgether et reprise ciblée donnant 20 nouvelles offres / 35 parcourues. Le second passage aboutit sans nouveauté, garde 17 échos et indique l’heure précédente « 00:53 », antérieure à sa fin. Aujourd’hui reprend « 32 offres parcourues sur 7 sources ». [Résumé ordinateur](apres-resume-ordinateur.jpg) · [mobile](apres-resume-mobile.jpg).

Les deux pauses sont ouvertes au clavier ; cibles de 44 px et plus, focus et absence de débordement vérifiés. Avec la préférence de mouvement réduit, les 17 échos ont une animation calculée à `none`. Console sans erreur ni avertissement. Les huit offres initiales et les deux fichiers sont conservés à l’identique ; les vingt ajouts viennent uniquement des lectures fictives demandées, sans doublons supplémentaires au second passage. L’actualisation silencieuse conserve son chemin distinct : ouvrir un balayage visible reste conditionné à l’action explicite, et les scénarios autorisés sont couverts par les tests.
