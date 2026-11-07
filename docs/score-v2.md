# Score v2 — guide d'évolution

Ce guide remplace le score unique de `assessJob` par trois mesures : **conditions**, **adéquation** et **fiabilité de la fiche**. Il découpe le travail en lots livrables un par un, chacun dans sa propre branche `codex/<sujet>` et sa propre PR, selon `AGENTS.md`.

Pourquoi : le score actuel vérifie que les conditions sont remplies (intitulé, remote, salaire, langue), mais ne dit pas si le poste correspond. Il récompense un salaire très au-dessus du minimum, ignore le niveau demandé et pénalise les fiches courtes, alors que beaucoup de sources n'envoient qu'un résumé.

---

## 1. Point de départ dans le code

| Sujet | Où | État actuel |
| --- | --- | --- |
| Évaluation d'une offre | `lib/matching.ts` → `assessJob` (pure) | Somme de points plafonnée à 100 : intitulé +38 (sinon −12), full remote +25 (présence ponctuelle +21, hybride ou sur site compatible +12, inconnu +5), salaire ≥ minimum +20, TJM ≥ minimum +20, langue +10/+7/+4, mots-clés +6 chacun (12 au plus). Niveaux : `excluded`, `exception` (toute réserve, ou score < 60), `priority` (≥ 82), `match`. |
| Calcul à la lecture | `lib/job-store.ts` (`listOffers`, `getOffer`) | `assessJob` est rejoué à chaque lecture avec les critères du compte. Les colonnes `match_score` et `match_tier` ne servent que d'écriture initiale. |
| Classement du tri | `lib/triage.ts` → `offerRank`, `sortOffersForTriage` | `matchScore` + fraîcheur (+24 sous 7 jours, +12 sous 21, +3 sous 45) + détail de la fiche (+6 `full`, +3 `summary`) − 12 si un doute d'éligibilité est signalé. |
| Lecture du salaire | `lib/offer-parser.ts`, `lib/explicit-offer-facts.ts`, `lib/jobgether-offers.ts`, `lib/rss-offers.ts` | Une seule valeur, `annualSalary`. Une fourchette « 62–70 k€ » donne 70, 62 ou rien selon le parseur ; `explicit-offer-facts` ignore toute ligne qui contient une fourchette. |
| Couverture de la fiche | `JobRecord.contentCoverage` : `full`, `summary`, `partial`, `unknown` | Les flux RSS et Jobgether arrivent en `summary`. |
| Intitulés | `ownerRoles`, `managerRoles` dans `lib/matching.ts` | `\bpm\b` accepte « Project Manager (PM) » ; « chef de produit » n'est reconnu que suivi de « digital » ou « numérique ». |
| Critères | `SearchPreferences` (`lib/types.ts`), `searchPreferences()` | `roles`, `contracts`, `remote`, `minimumSalary`, `minimumDailyRate`, `payTolerancePercent`, `boostKeywords`, `excludeKeywords`, `minimumMatchScore` (Jobgether). Stockés dans `profiles.data`. |
| Consommateurs du score | `lib/opportunity-views.ts` (vue à `matchScore >= 75`), `components/radar-app.tsx` (compte des `exception`), `lib/jobgether-match.ts`, `lib/criteria-impact.ts`, démos | À revoir au lot S3. |
| Expériences | `lib/experience-domain.ts` → `ExperienceItem` | `validation: "approved"` et `applicationAllowed` disent ce qui peut servir aux candidatures. Champs texte : `title`, `role`, `context`, `contribution`, `result`. |
| Tests | `tests/matching.test.mjs` | Les modules `lib/*.ts` sont transpilés à la volée. |

---

## 2. Règles communes à tous les lots

- **Plusieurs comptes.** Aucun niveau, seuil ou terme de domaine codé en dur. Tout vit dans `SearchPreferences` (`profiles.data`) et se lit par `userId`. Un réglage absent est **ignoré**, jamais remplacé par une valeur personnelle.
- **Une information manquante ne coûte rien à l'adéquation.** Elle baisse la fiabilité de la fiche. C'est la règle centrale de ce guide.
- **`assessJob` reste pure et testée.** Les composants affichent, ils ne recalculent rien.
- **Compatibilité.** Jusqu'au lot S3, `score` et `tier` gardent leur sens actuel. Les nouveaux champs de `Assessment` sont ajoutés à côté.
- **Une intention par PR**, données fictives uniquement, vouvoiement, composants Signal, `CHANGELOG.md` à jour.
- **Vérifications de chaque PR** : `npm test`, `npx tsc --noEmit --incremental false`, et pour les lots visibles, rendu ordinateur et mobile, clavier et focus.

---

## 3. Les lots

Ordre conseillé : **S1 → S2 → S3**, puis le lot du jour (gamification), puis **S4**, et **S5** quand la bibliothèque d'expériences est bien remplie.

### Lot S1 — Fourchettes de rémunération et intitulés

**But.** Lire correctement les fourchettes et arrêter les faux positifs et faux négatifs d'intitulé.

**Fourchettes.**

- Nouveau module pur `lib/pay-range.ts` :

  ```ts
  export function parsePayRange(text: string): { kind: "annual" | "daily"; min: number | null; max: number | null } | null;
  ```

- Formats reconnus : « 62–70 k€ », « 60-70k », « 60 000 – 70 000 € », « €60,000–70,000 », « 62 k€ », « jusqu'à 70 k€ » (max seul), « à partir de 60 k€ » (min seul), « 500–600 €/jour », « TJM 550 € ». Les montants en USD ou GBP restent ignorés, comme aujourd'hui.
- Les quatre parseurs cités au §1 utilisent ce module au lieu de leur propre expression.
- Migration additive (`npm run db:generate`) : colonnes nullables `salary_min`, `salary_max`, `daily_rate_min`, `daily_rate_max` sur `jobs`. `JobInput`, `JobRecord` et le contrat d'import (`lib/import-contract.ts`) gagnent les champs optionnels correspondants.
- `annualSalary` et `dailyRate` restent remplis pour la compatibilité : valeur seule, ou milieu de la fourchette.
- **Condition de rémunération** : l'offre n'est exclue que si le **haut** de la fourchette est sous le plancher (minimum moins la tolérance). Si seul le bas est sous le minimum, l'offre passe avec le signal « Bas de fourchette sous votre minimum ».

**Intitulés.**

- « PM » n'est accepté que si « product » apparaît dans l'intitulé ou dans les 600 premiers caractères de la description.
- « Chef de produit » est reconnu sous toutes ses formes. « Chef de projet » ne l'est jamais comme Product Manager.

**Acceptation.** Le même poste a le même salaire quelle que soit la source. « Project Manager (PM) » sur un ERP n'est plus reconnu comme Product Manager. « Chef de produit paiements » est reconnu.

**Tests.** `parsePayRange` sur chaque format ci-dessus ; une ligne avec fourchette dans `explicit-offer-facts` ; condition de rémunération avec une fourchette à cheval sur le minimum ; intitulés PM, chef de produit et chef de projet.

### Lot S2 — Niveau visé et niveau détecté

**But.** Savoir si une offre est trop junior ou trop senior.

**Réglage.** `SearchPreferences.targetLevel?: "junior" | "confirmed" | "senior" | "lead" | "head"` et `acceptLevelAbove?: boolean` (faux par défaut). Ligne « Niveau visé » dans le groupe *Le poste* du tableau des critères (`criteriaGroups`), avec `ChoiceSelect` et un `Switch` « J'accepte un cran au-dessus ». Tant que le niveau visé est vide, rien ne change pour l'utilisateur.

**Détection.** Nouveau module pur `lib/seniority.ts` :

```ts
export function detectLevel(title: string, description?: string): { level: Level; evidence: string[] } | undefined;
```

| Niveau | Intitulé | Années demandées | Encadrement |
| --- | --- | --- | --- |
| `junior` | junior, stagiaire, alternant, graduate | 0 à 2 ans | — |
| `confirmed` | — | 3 à 4 ans | — |
| `senior` | senior, sr | 5 à 7 ans | — |
| `lead` | lead, staff, principal | 8 ans et plus | « référent », « encadrer une équipe » |
| `head` | head of, director, directeur, directrice, VP, chief | — | encadre des PM ou des PO (« manage a team of PMs ») |

- Années : « 5 ans », « 5+ ans », « 5 years », « 5+ years of experience », « au moins 5 ans ».
- L'intitulé l'emporte quand il donne un niveau. Sinon, on prend le plus élevé des signaux d'années et d'encadrement. `evidence` cite les mots trouvés.

**Signaux.** `Assessment` gagne `signals: string[]`, sans effet sur `score` dans ce lot :

- un cran au-dessus : « Niveau demandé : Lead (10 ans d'expérience), un cran au-dessus de votre cible. » ;
- deux crans ou plus au-dessus : « Poste probablement trop senior » ;
- en dessous : « Poste plus junior que votre cible ».

Les signaux s'affichent avec les raisons, dans le même style que `flags`.

**Acceptation.** Sans niveau visé : aucun signal, aucun changement. Avec niveau visé « senior » : un Lead donne le signal « un cran au-dessus », un Head of « trop senior », un Junior « plus junior ».

**Tests.** Chaque ligne du tableau, en français et en anglais ; priorité de l'intitulé ; niveau visé absent.

### Lot S3 — Trois mesures

**But.** Séparer conditions, adéquation et fiabilité, puis brancher le classement et l'affichage dessus.

**Nouveaux champs de `Assessment`.**

```ts
conditions: "pass" | "check" | "excluded";
fit: number | null;          // 0–100, null si aucun composant n'est connu
fitParts: { role?: number; level?: number; pay?: number; domain?: number };
confidence: "high" | "medium" | "low";
signals: string[];
```

**Conditions.** Mêmes règles qu'aujourd'hui pour l'exclusion (lieu, contrat, présence incompatible, rémunération sous le plancher, mots écartés). Toute réserve donne `check`. Plus aucun point.

**Adéquation.** Somme des composants **connus**, ramenée sur 100 (`somme / poids connus × 100`).

| Composant | Poids | Règle |
| --- | --- | --- |
| Poste (`role`) | 30 | Famille visée dans l'intitulé : 30. Intitulé ambigu non confirmé par la description : 15. Autre famille : 0. Toujours connu si `roles` n'est pas vide. |
| Niveau (`level`) | 25 | Dans la cible : 25. Un cran au-dessus : 15 (même si `acceptLevelAbove` est faux ; ce réglage retire seulement le signal). Un cran en dessous : 10. Deux crans ou plus : 0. Connu si `targetLevel` est défini et un niveau est détecté. |
| Rémunération comme signal de niveau (`pay`) | 15 | Ratio = milieu de la fourchette ÷ minimum du compte. Jusqu'à 1,35 : 15. De 1,35 à 1,6 : 8 et signal « Salaire au-dessus de votre cible ». Au-delà de 1,6 : 0 et signal « Probablement plus senior ». Si le niveau détecté est dans la cible : toujours 15, sans signal. Même règle pour le TJM. Connu si un montant et un minimum existent. |
| Domaine (`domain`) | 30 | Termes de `boostKeywords` trouvés dans la description (pas l'intitulé). Rendement décroissant : 12, 8, 5, puis 2 par terme, 30 au plus. Connu si `boostKeywords` n'est pas vide et `contentCoverage` vaut `full` ou `summary`. |

Les seuils 1,35 et 1,6 sont des constantes nommées dans `lib/matching.ts`, faciles à ajuster.

**Fiabilité de la fiche.** On compte cinq informations connues : description `full`, rémunération, présence (`mode` différent de `unknown`), niveau détecté, langue (différente de `unknown`). 4 ou 5 : `high` ; 3 : `medium` ; 2 ou moins : `low`.

**Compatibilité.** `score` devient `Math.round(fit ?? 0)`. `tier` devient :

- `excluded` si `conditions` vaut `excluded` ;
- `exception` si `conditions` vaut `check` ;
- `priority` si `fit` est au moins 80 ;
- `match` sinon.

Revoir chaque consommateur listé au §1 :

- la vue à `matchScore >= 75` utilise `fit >= 80` et une fiabilité différente de `low` ;
- le compte des `exception` dans `radar-app.tsx` lit `conditions === "check"`.

**Classement du tri.** `offerRank` = `fit` (ou 0) + fraîcheur réduite (+5 sous 7 jours, +2 sous 21) ; la fraîcheur ne fait plus que départager. Le −12 de doute d'éligibilité disparaît : il est porté par `conditions`.

**Affichage.** Sur les cartes d'offre, un libellé remplace le chiffre :

- « Très proche » si `fit` est au moins 80 ;
- « Proche » de 60 à 79 ;
- « À jauger » dès qu'il y a un signal de niveau ou de rémunération ;
- « Loin » sous 60.

Le chiffre reste lisible au survol (`title`) et pour les lecteurs d'écran. Une fiabilité `low` ajoute le tag « Fiche incomplète » (`.quiet-tag`).

**Acceptation.** Les sept cas du §4 donnent le résultat attendu. Une offre sans salaire ni remote détectable n'est plus classée sous une offre médiocre complète.

**Tests.** Les sept cas du §4 ; renormalisation (aucun composant connu → `fit` null) ; chaque seuil de rémunération ; exception « niveau dans la cible » ; fiabilité ; `offerRank`.

### Lot S4 — Fiches mystère

**But.** Transformer la recherche manuelle d'une annonce en geste simple et motivant, au lieu d'enterrer les fiches courtes.

**Règle.** Une offre est une **fiche mystère** si `conditions` ne vaut pas `excluded`, si le composant Poste vaut 30 et si la fiabilité est `low`. Dans « À examiner », les fiches mystère passent en tête, 5 au plus ; quand le lot du jour existera, elles y occuperont jusqu'à 5 places sur 20.

**Interface.**

- Carte « Fiche mystère » : l'intitulé et la source sont visibles, l'adéquation est masquée.
- Boutons « Ouvrir l'annonce » (`sourceUrl`) et « Coller le texte de l'annonce ».
- Le texte collé passe par l'analyse existante (`/api/parse-offer`), met à jour la fiche et passe `contentCoverage` à `full`.
- L'adéquation se révèle alors, avec une animation courte qui respecte `prefers-reduced-motion`. Si elle atteint 80, le message « Bonne pioche » s'affiche (`WorkspaceToast`).
- Le bouton « Annonce introuvable » met l'offre à la corbeille avec ce motif.

**Règle de conflit.** Les valeurs lues dans le texte collé remplacent celles de la source.

**Acceptation.** Une fiche mystère complétée devient une fiche ordinaire, classée par son adéquation. Rien ne s'affiche s'il n'y a aucune fiche mystère.

**Tests.** Sélection des fiches mystère (5 au plus) ; priorité du texte collé ; motif « Annonce introuvable ».

### Lot S5 — Domaine nourri par les expériences

**But.** Que le composant Domaine reflète ce que la personne sait faire, pas seulement ses mots-clés.

- Proposer des « Termes de votre domaine » tirés des expériences `approved` **et** autorisées pour les candidatures (`applicationAllowed`). La personne les confirme un à un.
- Les termes confirmés sont stockés dans `SearchPreferences.domainTerms?: string[]` (40 au plus) et comptent dans le composant Domaine comme `boostKeywords`.
- Aucun terme n'est tiré d'une expérience non validée ou non autorisée. Aucun terme n'est utilisé sans confirmation.

**Tests.** Exclusion des expériences non validées ou non autorisées ; dédoublonnage avec `boostKeywords` ; plafond de 40.

---

## 4. Cas de référence (données fictives)

Compte fictif : postes Product Owner et Product Manager, CDI, full remote, minimum 55 000 €, niveau visé `senior`, `acceptLevelAbove` faux, mots-clés « paiements » et « SEPA ».

| # | Offre | Aujourd'hui | Attendu après S3 |
| --- | --- | --- | --- |
| 1 | Product Owner Paiements, « 5 ans d'expérience », 62–70 k€, missions paiements et SEPA, fiche complète | priorité | `fit` 95 (30 + 25 + 15 + 25 sur 100), fiabilité `high`, « Très proche » |
| 2 | Lead Product Owner, « 10+ years », encadre 3 PO, 100 k€ | priorité | Niveau 15, rémunération 0 (ratio 1,8), signaux de niveau et de rémunération, « À jauger » |
| 3 | Senior Product Manager, « 8+ years », « manage a team of 3 PMs », 120 k€ | priorité | Niveau `head` : 0 ; rémunération 0 ; « Loin » |
| 4 | Product Owner, résumé RSS de deux lignes, sans salaire, remote non précisé | `exception`, score 47 | Seul le Poste est connu, fiabilité `low` : fiche mystère (S4) |
| 5 | Chef de produit Paiements, 65 k€, niveau non précisé, mission paiements | `exception` (intitulé non reconnu) | (30 + 15 + 12) ÷ 75 connus = 76, « Proche » |
| 6 | Project Manager (PM), déploiement d'ERP, 60 k€ | priorité | Poste 0, « Loin » |
| 7 | Junior Product Owner, sans salaire | `exception` | Niveau 0 (deux crans en dessous), « Loin » |

---

## 5. Points décidés et points à vérifier

| Sujet | Décision |
| --- | --- |
| Seuils de rémunération | 1,35 et 1,6 fois le minimum, constantes ajustables. |
| Niveau visé absent | Composant ignoré, aucun signal. Le niveau visé n'a pas de valeur par défaut. |
| Information manquante | Ne coûte rien à l'adéquation ; baisse la fiabilité. |
| Fourchettes | `salary_min`, `salary_max`, `daily_rate_min`, `daily_rate_max` en colonnes ; `annualSalary` garde le milieu. |
| Affichage | Libellé, chiffre au survol. |
| À vérifier, hors de ces lots | `showJobgetherOffer` compare le score de Radar au réglage « Score Jobgether minimum ». Le seuil devrait porter sur le score fourni par Jobgether. À traiter dans une PR à part. |

---

## 6. Consigne type pour lancer un lot dans Codex

```
Lis AGENTS.md, audits/signal-design-system.md et docs/score-v2.md.
Réalise uniquement le « Lot SN — <titre> » décrit dans le guide.
Pars de main à jour sur une branche codex/<sujet>. Garde assessJob pure et
teste-la dans tests/. N'ajoute aucune dépendance. Une information manquante ne
doit jamais baisser l'adéquation. Données fictives uniquement, vouvoiement.
Avant la PR : npm test, npx tsc --noEmit --incremental false, et pour un lot
visible, vérification ordinateur + mobile, clavier et focus. Mets à jour
CHANGELOG.md. Dans la PR, liste les tests ajoutés et les cas du §4 vérifiés.
```
