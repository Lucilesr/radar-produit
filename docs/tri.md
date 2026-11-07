# Tri des offres — guide d'évolution (lots Q1)

Ce guide découpe le lot Q1 « Le tri qui avance » de la piste gamification en PR courtes, selon `AGENTS.md`. Il complète `docs/score-v2.md` : le tri s'appuie sur l'adéquation (S3) et sur les fiches mystère (S4).

Pourquoi : quand une source remonte 100 offres ou plus, une liste sans fin décourage. Une tâche courte et finie, avec un compteur qui ne fait que descendre, donne envie de la terminer (effet de gradient d'objectif). Le reste attend sans culpabiliser.

Valeurs retenues : **20 offres** au plus dans le lot du jour, dont **5 fiches mystère** au plus ; **21 jours depuis la publication** avant l'archivage automatique (date d’ajout si la publication est inconnue).

---

## Règles communes

- **Sans migration.** Le lot du jour vit dans le navigateur ; les autres états passent par la colonne texte `review_state`, qui accepte de nouvelles valeurs sans migration.
- **Aucune décision perdue.** Archiver ou écarter un groupe reste réversible depuis Radar.
- **Logique pure et testée** dans `lib/` ; les composants affichent seulement.
- **Plusieurs comptes.** Aucun seuil personnel codé en dur hors de ce guide ; les ids d'un autre compte stockés dans le navigateur sont ignorés.
- Vérifications de chaque PR : `npm test`, `npx tsc --noEmit --incremental false`, rendu ordinateur et mobile, clavier et focus, `CHANGELOG.md`.

---

## Lot Q1a — Lot du jour (livré)

**Ce que voit la personne.** « À examiner » s'ouvre sur un bandeau : « 20 offres dans votre lot du jour », puis « Plus que 18 offres » au fil du tri, avec une barre d'avancement. Quand tout est trié : « Lot du jour bouclé » et, s'il en reste, « Continuer avec les autres offres ». Le bouton « Voir toutes les offres (N) » donne la liste complète, triable par date comme avant. L'accueil reprend le compteur (« Trier mon lot du jour »).

**Règles** (`lib/daily-lot.ts`).

- Classement : `triageScore` (`lib/triage.ts`). C'est l'adéquation, plus 5 points sous 7 jours et 2 points sous 21 jours. Une offre sans libellé (« Fiche incomplète » ou « Fiche mystère ») est plafonnée à **55** : un intitulé seul ne passe plus devant une offre proche.
- Composition : les 20 mieux classées des offres à examiner, avec 5 fiches mystère au plus, placées à leur rang. Sans assez d'offres ordinaires, d'autres fiches mystère complètent le lot.
- Stabilité : tant que rien n'est trié, le lot est recalculé, ce qui fait entrer les offres de l'actualisation du matin. Dès qu'une offre du lot quitte « À examiner » (sélectionnée, écartée, candidature), le lot est figé : trier ne fait jamais entrer une offre, donc le compteur ne fait que descendre. Un lot de moins de 20 offres est complété par les nouvelles.
- Jour : jour civil local. Les ids sont conservés dans `localStorage` (`radar:lot-du-jour`), à titre de confort. Sans stockage, ou sur un autre appareil, le lot est simplement recalculé.
- Recherche texte active : pas de lot, la liste filtrée s'affiche comme avant.

**Limite connue.** Sur un autre appareil, le compteur repart des offres restantes. Un lot partagé entre appareils demandera le journal d'activité (L1).

**Tests.** `tests/daily-lot.test.mjs` : composition (20, dont 5 fiches mystère au plus), plafond 55, compteur qui ne remonte pas, entrée des offres du matin, complément d'un lot incomplet, jour ou compte différent, libellés.

---

## Lot Q1b — « Plus tard », réserve rangée et archivage à 21 jours (livré)

**But.** Vider la liste sans tout lire : une décision par groupe, et des offres qui s'archivent seules.

**« Plus tard ».** Troisième décision à côté de « Sélectionner » et « Écarter », sur une offre à examiner. Elle passe `review_state` à `later` : l'offre quitte le lot (elle compte comme triée) et rejoint la réserve. Étendre le type `reviewState` et `setOfferReviewState`, et accepter `later` dans `inOpportunityView`.

**Réserve.** « Voir toutes les offres » devient « La réserve ». On y trouve les offres à examiner hors du lot et les offres « Plus tard ». Elles sont rangées en groupes exclusifs, dans cet ordre, et chacune va dans le premier groupe qui lui correspond :

1. Gardées pour plus tard (`later`).
2. Hors de vos conditions (`conditions` = `excluded` : présence, contrat…). Plus large que « présence » seule, et déjà calculé par le score v2.
3. Loin de votre recherche (`fitLabel` = `far`).
4. Rémunération non communiquée.
5. Publiées il y a plus de 21 jours.
6. Les autres.

Chaque groupe affiche son nombre d'offres et deux actions. « Voir le groupe » filtre la liste. « Écarter le groupe » demande une confirmation, puis passe par la corbeille existante (50 offres au plus par action, limite de l'API), avec restauration possible. Un groupe vide ne s'affiche pas. Code : `lib/reserve.ts`.

**Archivage à 21 jours.** Une offre à examiner est archivée dès que sa publication (`publishedAt`) date d’au moins 21 jours, même si elle vient d’être ajoutée. Si cette date est inconnue ou invalide, `createdAt` sert de référence (`updatedAt` seulement pour un ancien enregistrement sans date d’ajout). Corriger les faits d’une annonce ne remet pas son âge à zéro. L'archive est un état **calculé à la lecture**, sans écriture. Elle sort de « À examiner », du lot et des compteurs, et apparaît dans « Archives (N) » en bas de la réserve. « Remettre à examiner » enregistre `reopened`, exposé dans l’interface comme une offre à examiner, et actualise `updatedAt` : la personne dispose d’un nouveau délai de 21 jours, conservé après rechargement. Le choix explicite « Plus tard » accorde lui aussi 21 jours à partir de `updatedAt`. Les deux états restent dans la colonne texte existante, sans migration. Les offres sélectionnées, en candidature ou dans la corbeille ne sont jamais archivées.

**Acceptation.**

- 138 offres à examiner donnent un lot de 20 et une réserve de 118 rangée en 6 groupes au plus.
- « Plus tard » fait baisser le compteur.
- Une annonce publiée il y a 22 jours, ajoutée aujourd’hui, n’est plus comptée mais reste consultable et restaurable. Une annonce sans publication connue, ajoutée il y a 22 jours, suit la même règle.

**Tests.** Groupes exclusifs et ordre ; « Plus tard » compté comme trié ; archivage depuis la publication, secours sur la date d’ajout et restauration persistante ; écarter un groupe.

---

## Lot Q1c — Repêchage du vendredi

**But.** Corriger les tris trop rapides sans relire la corbeille.

Le vendredi, une carte au-dessus de la réserve propose 3 offres écartées dans les 7 derniers jours, tirées au hasard parmi celles d'adéquation « Proche » ou mieux : « Repêchage : 3 offres écartées cette semaine méritent peut-être un second regard ». Chaque offre propose deux actions : « Restaurer » (route existante) ou « Laisser ». Le tirage est stable sur la journée : il utilise une graine dérivée du jour, sans stockage. La carte ne s'affiche pas si aucune offre ne remplit ces conditions.

**Tests.** Tirage stable sur la journée ; filtre « 7 jours » et « Proche ou mieux » ; aucun affichage hors du vendredi.
