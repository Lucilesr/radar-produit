# Ma recherche v2 — guide d'évolution

Ce guide découpe la refonte de l'onglet « Ma recherche » en lots livrables un par un, chacun dans sa propre branche `codex/<sujet>` et sa propre PR, selon `AGENTS.md`.

Les maquettes de référence sont privées et Codex ne peut pas les ouvrir : chaque état d'écran est donc décrit en texte dans la section concernée. **Les maquettes donnent la structure et le comportement. Les valeurs visuelles viennent de Signal** (`app/signal-tokens.css`, `audits/signal-design-system.md`). Quand une maquette et Signal divergent (police Inter, pastilles très arrondies, tutoiement), Signal l'emporte.

---

## 1. Point de départ dans le code

| Sujet | Où | État actuel |
| --- | --- | --- |
| Conteneur de la page | `components/source-panel.tsx` | 3 onglets (`criteria`, `channels`, `outreach`) pilotés par `?sources=` (`lib/radar-navigation.ts`). `channels` a 2 sous-onglets internes (`jobboards`, `alerts`). |
| Formulaire de critères | `components/search-preferences-form.tsx` | Formulaire toujours ouvert. Les postes et les lieux s'enregistrent tout de suite ; contrats, présence et rémunération attendent le bouton « Enregistrer ». |
| Modèle des critères | `lib/types.ts` → `SearchPreferences` ; `lib/search-preferences.ts` | Stocké dans `profiles.data` (JSON), sans colonne SQL dédiée. `remote` est une valeur unique ; `contracts` ⊂ `cdi \| cdd \| freelance` ; `minimumMatchScore` est le seuil Jobgether. |
| Évaluation d'une offre | `lib/matching.ts` → `assessJob` (pure) | Minimums **stricts depuis la PR #156** : un montant connu sous le seuil exclut l'offre, sans tolérance. Exclusion de lieu prioritaire. |
| Zones | `lib/location-criteria.ts`, `lib/countries.ts` | Régions déjà définies (Europe, Union européenne, Amérique du Nord…). |
| Sources | `lib/source-catalog.ts` (modes `email`, `rss`, `api`, `web`, `research`, `manual`) ; `lib/source-store.ts` ; table `source_settings.data` (JSON) | Champs existants : `state` (`not_configured`, `action_needed`, `configured`, `paused`), `selected`, `health` (`active`, `retrying`, `degraded`), `failureCount`, `lastSyncedAt`, `lastAttemptAt`, `error`, `searchLinks`, `notes`, `linkUrl`. |
| Carte source | `components/source-card.tsx`, `components/source-logo.tsx` | Une carte par source, notes libres, liens. |
| Recherches générées | `lib/web-discovery.ts`, `components/web-discovery-panel.tsx` ; `searchTracks` dans `source-catalog.ts` | Liens Google `site:` par poste. « Product Builder » vient volontairement de la piste « Alternatives pertinentes ». |
| Actualisation | `POST /api/sources/sync` | Manuelle (« Actualiser mes flux »), avec un cache de 15 min. **Aucune tâche planifiée.** |
| Notifications | `components/workspace-feedback.tsx` → `WorkspaceToast` | Accepte déjà une `action` (`{label, onClick}`), utilisable pour « Annuler ». |
| Navigation | `components/radar-app.tsx` | L'onglet « Ma recherche » utilise l'icône `Mail`. |
| Tests | `tests/*.test.mjs`, `node --test` | Les modules `lib/*.ts` sont transpilés à la volée (voir `tests/matching.test.mjs`). |

Le duplicata « Présence acceptable » vu sur le site privé n'existe pas dans ce dépôt : un seul `ChoiceSelect`. Si le bug se reproduit ailleurs, le traiter dans une PR à part.

---

## 2. Règles communes à tous les lots

- **Plusieurs comptes.** Radar sera ouvert à d'autres utilisateurs. Rien de ce qui décrit un profil (postes, pistes de recherche, seuils, notes de sources) ne doit être codé en dur. Tout vit dans le compte (`profiles.data`, `source_settings.data`) et se lit par `userId`. Les valeurs par défaut restent neutres. Voir le lot 12.
- **Une intention par PR.** Ne pas regrouper deux lots.
- **Compatibilité ascendante des données.** Tout nouveau champ de `SearchPreferences` ou de `source_settings.data` est optionnel, avec une valeur par défaut posée dans `searchPreferences()` ou dans une fonction de lecture. Aucune migration SQL n'est nécessaire tant qu'on reste dans les colonnes JSON.
- **Logique pure dans `lib/`, testée.** Les composants ne recalculent rien de métier.
- **Ton de l'interface : vouvoiement**, comme le reste de l'application. Les maquettes tutoient ; ne pas reprendre ce tutoiement.
- **Composants Signal** : `WorkspaceButton`, `ChoiceSelect`, `Combobox`, `WorkspaceToast`, `ExpandableSection`, `Switch`, `Sheet`/`Drawer`, `.quiet-tag`, `.signal-source-status`. Tags : 12/16 px, rayon 4 px. Boutons : rayon 5 px, 42 px minimum (44 sur mobile).
- **Vérifications de chaque PR** : `npm test`, `npx tsc --noEmit --incremental false`, rendu sur ordinateur et sur mobile, clavier et focus, mise à jour de `CHANGELOG.md`.
- **Données fictives uniquement** dans les tests et les exemples.

---

## 3. Lots

### Lot 1 — Corrections rapides

**But.** Retirer les irritants visibles sans toucher à la structure.

- `radar-app.tsx` : remplacer l'icône `Mail` de « Ma recherche » par `SlidersHorizontal` (lucide).
- `source-logo.tsx` et la CSS des cartes : les logos ne doivent plus être rognés. Le conteneur adapte sa largeur ou le logo passe en `object-fit: contain`.
- `source-catalog.ts` : la mention « Radar ne collecte pas le contenu… » s'affiche une seule fois par source (dans le détail), pas répétée sur chaque carte.

**Acceptation.** Plus aucun logo coupé à 320 px ni à 1440 px. L'icône du menu représente des réglages.

---

### Lot 2 — Barre de critères (lecture seule)

**But.** Les critères tiennent sur une ligne et le détail se consulte à la demande.

**Données.** Nouveau module pur `lib/search-criteria.ts` :

```ts
export type CriteriaToken = {
  id: "roles" | "contracts" | "remote" | "salary" | "dailyRate" | "matchScore"
    | "includedLocations" | "excludedLocations" | "boostKeywords" | "excludeKeywords";
  label: string;         // « Poste », « Contrat », « Sauf »…
  value: string;         // « Product Owner, Product Manager »
  tone: "include" | "exclude";
};
export function criteriaTokens(preferences: SearchPreferences): CriteriaToken[];
export function criteriaGroups(preferences: SearchPreferences): Array<{ title: string; rows: … }>;
```

- Une étiquette n'apparaît que si le critère a une valeur. Une liste vide n'en produit pas.
- Libellés : « Poste », « Contrat », « Présence », « Salaire CDI ≥ », « TJM ≥ », « Score Jobgether ≥ », « Zones », « Sauf », plus « Mots-clés » et « Sans » quand le lot 6 est livré.
- Les valeurs longues sont tronquées dans l'étiquette (3 éléments puis « +n ») ; la valeur complète va dans `title` et `aria-label`.

**Interface.** Dans `source-panel.tsx`, la section critères devient :

1. **Repliée (par défaut).** En-tête « Critères » avec, à droite, le bouton « Tout voir ». En dessous, une carte blanche qui contient les étiquettes (les exclusions en `--signal-danger-bg` et `--signal-danger`), puis un bouton en pointillés « + Critère », inactif jusqu'au lot 7.
2. **Dépliée (« Tout voir »).** Un tableau groupé par thème : *Le poste* (postes, contrats), *La présence*, *La rémunération* (minimums, score Jobgether), *La géographie* (zones ouvertes, sauf), *L'annonce* (lot 6). Chaque ligne affiche un libellé, les valeurs en tags et un bouton « Modifier » visible au survol et au focus.
3. Pour l'instant, « Modifier » ouvre le `SearchPreferencesForm` existant à cet endroit (en `Sheet` sur mobile). Le lot 3 le remplace.

L'état replié ou déplié est mémorisé dans `localStorage` (lecture et écriture protégées par `try/catch`).

**Tests.** `tests/search-criteria.test.mjs` : étiquettes avec des préférences par défaut, listes vides, exclusions, troncature.

**Acceptation.** Repliée, la section fait au plus 2 lignes d'étiquettes à 1280 px. Tous les champs de `SearchPreferences` sont visibles dans la vue dépliée.

---

### Lot 3 — Édition en place et enregistrement automatique

**But.** Supprimer le bouton « Enregistrer » et modifier chaque critère là où il s'affiche.

**Comportement.**

- Cliquer sur une étiquette de la barre ouvre un **popover ancré** (`Popover` ; `Drawer` sous 640 px) qui contient uniquement le contrôle de ce critère.
- « Modifier » sur une ligne du tableau déplié met cette ligne en édition, sur un fond `--signal-soft`. Un bouton « Modifier tout » met toutes les lignes en édition, avec « Terminé » en haut à droite.
- Chaque changement est enregistré seul, 600 ms après la dernière saisie, via le `onSave` existant. Reprendre le schéma actuel de `persistRoles` : mise à jour optimiste, retour en arrière si l'enregistrement échoue, message d'état.
- En haut de la section, un indicateur affiche « Enregistrement… », puis « Enregistré », puis « Non enregistré · Réessayer ».
- Après chaque enregistrement, afficher un `WorkspaceToast` avec l'**impact** et une action « Annuler » :
  « TJM 500 → 450 €/j · 22 offres à examiner (+8) ». « Annuler » restaure les préférences précédentes, gardées en mémoire (une seule étape d'annulation suffit).
- Pour calculer l'impact, ajouter `lib/criteria-impact.ts` → `countMatches(jobs, preferences)`, qui rejoue `assessJob` sur les offres déjà chargées (`jobs` est déjà passé à `SourcePanel`). Ne compter que les offres non supprimées, au statut `new` et dont le niveau n'est pas `excluded`. Aucun appel serveur.

**Acceptation.** Aucun bouton « Enregistrer » dans la section. Une erreur réseau ne perd pas la saisie. « Annuler » remet les étiquettes et le compteur à l'état précédent.

**Tests.** `countMatches` avant et après une baisse de TJM sur des données fictives.

---

### Lot 4 — Zones : un seul champ

**But.** Ne plus choisir « Inclure » ou « Exclure » avant de taper.

**Interface (popover « Zones » et ligne dépliée).**

- Un seul `Combobox` (« Chercher un pays ou une région »). Chaque résultat affiche son type (pays ou région) et deux boutons : **Ouvrir** et **Exclure**. Au clavier : Entrée ouvre la zone, Maj+Entrée l'exclut.
- Sous le champ, des raccourcis vers les régions déjà définies dans `location-criteria.ts` (« Union européenne », « Europe »…).
- La liste « Votre sélection » affiche chaque zone avec un sélecteur segmenté **Ouverte / Exclue** et un bouton « Retirer ».
- Garder le texte d'aide sur la priorité des exclusions et sur « remote monde ».

**Données.** Inchangées : `includedLocations` et `excludedLocations`. Passer une zone d'une liste à l'autre se fait en une seule sauvegarde. Les limites actuelles restent : 20 lieux par liste, pas de doublon.

**Acceptation.** Exclure « Roumanie » alors que « Europe » est ouverte produit l'étiquette « Sauf : Roumanie ». Les tests de `location-criteria` passent toujours.

---

### Lot 5 — Nouveaux types de contrat

**But.** Ajouter **Portage salarial** et **Temps partagé**.

**Données.**

- `ContractType` et `SearchPreferences["contracts"]` reçoivent `"portage"` et `"part_time"`. La colonne `jobs.contract_type` est déjà en texte, donc aucune migration.
- `searchPreferences()` accepte ces deux valeurs.
- `offer-parser.ts` reconnaît « portage salarial » → `portage`, et « temps partagé », « part-time », « 2 jours/semaine » ou « 3 jours par semaine » (pour un poste) → `part_time`. Ne pas écraser la détection `freelance` existante.
- `matching.ts` :
  - `portage` est comparé au **TJM** (`minimumDailyRate`) ;
  - `part_time` est comparé au TJM s'il est annoncé, sinon au salaire ramené à un temps plein : signaler « Rémunération à temps partiel à vérifier » au lieu d'exclure ;
  - un contrat non coché exclut l'offre, comme aujourd'hui.

**Interface.** Une case à cocher par contrat, avec une ligne d'aide sous les deux nouveaux (« comparé au TJM », « 2 à 3 jours par semaine »). Pas de badge « Nouveau ». Au moins un contrat reste coché, comme aujourd'hui.

**Tests.** Parser (deux exemples par type) et matching (portage sous et au-dessus du TJM ; temps partagé sans montant).

**À trancher avant de coder.** Le temps partagé a-t-il besoin d'un critère « jours par semaine » ? Par défaut, non.

---

### Lot 6 — Présence par contrat et mots-clés

Deux PR séparées.

**6a — Présence par contrat.**

- Ajouter `remoteByContract?: Partial<Record<Contract, Remote>>` à `SearchPreferences`. Quand un contrat n'y figure pas, `remote` sert de valeur de repli : les anciens profils restent valides sans migration.
- Les quatre niveaux existants sont repris : Full remote, Présence exceptionnelle, Hybride, Sur site (`onsite`).
- Interface : une ligne par contrat coché, avec un sélecteur segmenté de 4 options. Sous la ligne : « Présence exceptionnelle : quelques jours par an sur site, au plus. »
- `assessJob` lit le niveau du contrat de l'offre. Si le contrat est inconnu (`other`), on prend le niveau le plus permissif parmi les contrats cochés.

**6b — Mots-clés.**

- Ajouter `boostKeywords?: string[]` et `excludeKeywords?: string[]` (12 au plus chacun, de 2 à 40 caractères, normalisés comme les postes).
- `assessJob` cherche dans le titre et la description, sans tenir compte des accents ni de la casse. Un mot-clé à mettre en avant ajoute du score et une raison (« Mentionne : fintech ») ; un mot-clé à écarter met l'offre en `excluded` avec une alerte.
- Interface : ligne « Mettre en avant » (tags neutres) et ligne « Écarter si l'annonce contient » (tags en tons de danger), dans le groupe *L'annonce*.

---

### Lot 7 — « + Critère »

Un popover liste les critères pas encore affichés : mots-clés si vides, score Jobgether, puis les critères futurs (séniorité, langue de l'annonce, fraîcheur). Choisir un critère ouvre directement son contrôle.

**Hors périmètre** : la saisie en langage naturel des maquettes (« pas de startup en phase d'amorçage »). Le serveur n'a pas de moteur d'inférence (voir README). Cette fonction n'est possible qu'avec le connecteur ChatGPT ; c'est un chantier séparé, à décider plus tard.

---

### Lot 8 — Sources : liste unique et statuts

**But.** Une seule liste de sources, groupée par type, où chaque ligne dit ce qu'il faut faire.

**Données.** Ajouter le module pur `lib/source-status.ts` :

```ts
export type SourceStatus = "ok" | "error" | "to_configure" | "paused" | "new" | "to_visit" | "up_to_date";
export function sourceKind(mode): "automatic" | "manual" | "outreach";
// email, rss, api → automatic ; web, research → manual ; manual → outreach
export function sourceStatus(setting: SourceSetting | undefined, mode, now = new Date()): SourceStatus;
```

| Statut | Libellé | Règle | Action principale |
| --- | --- | --- | --- |
| `error` | Erreur | `health === "degraded"` | Réessayer (relance la synchro) |
| `paused` | En pause | `state === "paused"` | Reprendre |
| `to_configure` | À configurer | automatique et `state` ∈ `not_configured`, `action_needed` | Terminer |
| `ok` | OK | automatique, sinon | Réglages |
| `new` | Nouvelle | manuelle et `lastVisitedAt` absent | Ouvrir |
| `to_visit` | À visiter | manuelle et `now − lastVisitedAt > visitEveryDays` | Ouvrir |
| `up_to_date` | À jour | manuelle, sinon | Ouvrir |

Couleurs : `ok` et `up_to_date` → succès ; `to_configure` et `to_visit` → attention ; `error` → danger ; `paused` → atténué ; `new` → pétrole doux.

**Interface.** La section « Sources » remplace les onglets `channels` et `outreach` :

- En-tête « Sources », un résumé (« 5 actives · 3 demandent une action ») et le bouton « Ajouter une source ».
- Des filtres en onglets soulignés : Toutes · Automatiques · À consulter · Action requise.
- Un bloc par type, « Automatiques » puis « À consulter », chacun dans une carte. Une ligne par source affiche : logo, nom et sous-titre, pastille de statut, une information (« 9 offres cette semaine », « Vu il y a 3 jours »), l'action principale et un menu « … ».
- Sous la liste, une ligne « Suggérées pour vos critères : + Remote OK, + Remotive… » (sources du catalogue pas encore suivies).
- « Autres pistes » devient le dernier bloc de la liste (stratégies et ajouts volontaires), sans onglet.
- `?sources=channels` et `?sources=outreach` défilent jusqu'à la section correspondante, pour ne pas casser les liens existants.

**Acceptation.** Une source n'apparaît qu'une fois sur la page. Toutes les sources du catalogue suivies (`selected !== false`) sont listées. Le filtre « Action requise » montre `error`, `to_configure` et `to_visit`.

**Tests.** `tests/source-status.test.mjs`, avec un cas par ligne du tableau et une date `now` fixe.

---

### Lot 9 — Détail d'une source à consulter et rythme de visite

**Données** (`source_settings.data`, à valider dans `userSourceSetting`) : `visitEveryDays?: 1 | 2 | 7` (2 par défaut), `lastVisitedAt?: string`, `remindInToday?: boolean` (vrai par défaut). Nouvelle route ou nouvelle action `POST /api/sources` `{ source, visited: true }` qui enregistre `lastVisitedAt = now`.

**Interface : panneau latéral** (`Sheet` à droite ; plein écran sur mobile), ouvert en cliquant sur la ligne :

1. En-tête : logo, nom, « Source à consulter · ajoutée le … », pastille de statut, bouton « Fermer ».
2. Bloc d'action : « Ouvrir les n recherches ↗ » (bouton principal) et « J'ai fait le tour » (marque la visite). Phrase de conformité : « Radar ne collecte rien sur ce site et n'utilise aucun compte. »
3. « Recherches générées depuis vos critères » : une ligne par recherche (`discoveryQueriesForRoles` et `searchLinks`), avec son lien. Les alertes d'écart (« « X » n'est pas dans vos critères ») s'afficheront ici ; elles arrivent avec le lot 12, qui rend les pistes de recherche propres à chaque compte.
4. « Rythme de visite » : sélecteur segmenté Chaque jour / Tous les 2 jours / Chaque semaine, plus un interrupteur « Me le rappeler dans Aujourd'hui ».
5. « Offres trouvées ici » : nombre d'offres et de candidatures pour cette source, et un champ « Collez l'URL d'une offre vue sur ce site » qui rejoint le flux d'ajout existant (`offer-prefill`).
6. En bas : « Retirer cette source », via le `SourceRemovalDialog` existant.

Les notes libres de `source-card.tsx` passent dans ce panneau, sous un `ExpandableSection` « Notes ».

**Aujourd'hui.** Dans `today-workspace.tsx` / `lib/workspace-agenda.ts`, ajouter une entrée par source `to_visit` dont `remindInToday` est vrai : « LinkedIn Jobs à visiter · vu il y a 3 jours » → ouvre le panneau.

---

### Lot 10 — Ajouter une source et état vide

- « Ajouter une source » ouvre un panneau latéral avec une recherche, des onglets *Automatiques* / *À consulter*, et le catalogue trié par pertinence pour les critères (contrats, remote, international). Chaque entrée affiche logo, nom, mode et 2 ou 3 tags, plus « Ajouter » ou « Ajoutée ». Cela reprend la logique de `SourceAddPanel`.
- En bas du panneau : « Votre site n'est pas dans la liste ? » avec un champ URL. Pour l'instant, l'URL est enregistrée comme recherche manuelle (`linkUrl`, validée par `validSearchLink`) ; aucune analyse automatique.
- **État vide**, quand aucune source n'est suivie : une carte « Où Radar doit-il chercher ? » qui propose deux choix, « Automatiques » et « À consulter », avec des exemples.

---

### Lot 11 — Tolérance sous le minimum

**But.** Laisser chaque compte choisir de garder les offres un peu sous son minimum, au lieu de les masquer.

**Données.**

- Ajouter `payTolerancePercent?: number` à `SearchPreferences` : entier de 0 à 20. **0 par défaut**, ce qui conserve le comportement strict de la PR #156 pour les comptes existants.
- Dans `assessJob`, pour le salaire comme pour le TJM :
  - montant ≥ minimum → inchangé ;
  - minimum × (1 − tolérance) ≤ montant < minimum → l'offre n'est **pas** exclue : `exception = true` et l'alerte « Sous votre minimum de X € (dans votre tolérance de N %) » ;
  - montant sous la tolérance → exclu, comme aujourd'hui.
- Le contrat inconnu suit la même règle (cohérent avec la PR #156).
- Fonction pure `payFloor(minimum, tolerance)`, arrondie à l'euro, réutilisée par l'interface pour l'exemple chiffré.

**Interface.**

- Dans la ligne « Rémunération » (tableau et popover) : un `Slider` de 0 à 20 % par pas de 1, la valeur affichée à côté, et un exemple calculé : « Gardées avec la mention « sous votre minimum » à partir de 55 100 €/an ou 475 €/jour ». À 0 % : « Toute rémunération connue sous votre minimum est masquée. »
- Dans la barre de critères, l'étiquette « Tolérance −N % » n'apparaît que si N > 0.
- Dans Opportunités, les offres concernées portent un tag « Sous votre minimum » (tag d'attention Signal).
- Mettre à jour le texte d'aide actuel du formulaire, qui décrit le comportement strict.

**Tests.** Bornes exactes (au minimum ; à la limite de tolérance ; 1 € en dessous), tolérance 0, salaire et TJM, contrat inconnu. Les tests de la PR #156 doivent toujours passer avec la tolérance à 0.

---

### Lot 12 — Pistes de recherche par compte et alertes d'écart

**But.** Que les recherches générées et leurs alertes valent pour n'importe quel profil, pas seulement PO/PM.

**Ce qui est codé en dur aujourd'hui, à déplacer dans le compte :**

| Où | Quoi | Devient |
| --- | --- | --- |
| `source-catalog.ts` → `searchTracks` | 3 pistes PO/PM, avec « CDI ≥ 55 k€ » dans le texte | `SearchPreferences.searchTracks` |
| `web-discovery.ts` → `discoveryQueries` | Requêtes PO/PM constantes | Généré depuis les postes et les pistes du compte (`discoveryQueriesForRoles` existe déjà) |
| `source-catalog.ts` → `note` | Conseils PO/PM (« Quatre alertes PO/PM… ») | Note générique sur la source ; les conseils personnels vont dans `notes` du compte |
| `search-preferences.ts` → `defaultSearchPreferences.roles` | PO, PM | À choisir pendant l'onboarding ; plus de poste imposé à un nouveau compte |

**Données.**

```ts
type SearchTrack = { id: string; label: string; terms: string[]; kind: "core" | "broad" | "alternative" };
// SearchPreferences.searchTracks?: SearchTrack[]   (8 pistes et 12 termes par piste au plus)
```

- Sans `searchTracks`, une seule piste « core » est déduite des `roles`.
- Reprise des comptes existants : une seule fois, à la lecture, les 3 pistes actuelles sont copiées dans le compte si elles n'y sont pas. Les comptes existants ne perdent ainsi pas « Product Builder ».

**Alertes d'écart.** Nouveau module pur `lib/search-drift.ts` :

```ts
type Drift = { kind: "term" | "contract" | "location"; value: string; searchId: string };
export function searchDrift(search: { terms: string[]; contracts?: string[]; locations?: string[] }, preferences: SearchPreferences): Drift[];
```

- `term` : un terme de recherche absent des `roles` **et** de toutes les `searchTracks` du compte. Comparaison sans accents ni casse, avec les alias de `normalizeRoleTitles`.
- `contract` et `location` : à brancher quand une recherche enregistrée porte ces filtres (liens collés par l'utilisateur, alertes email). Commencer par `term`.
- Affichage dans le panneau de la source (lot 9) : bandeau ambre « « X » n'est pas dans vos critères », avec « L'ajouter à mes pistes » et « Retirer de cette recherche ».
- Le filtre « Action requise » de la liste des sources (lot 8) inclut les sources qui ont au moins un écart.

**Interface.** Ajouter une ligne « Pistes de recherche » au groupe *Le poste* : chaque piste a un nom, ses termes en tags et son type (Principale, Élargie, Alternative).

**Tests.** Isolation entre deux comptes fictifs (un compte « Data Analyst » ne reçoit aucun terme PO/PM). Reprise des pistes. Écart détecté, ou non, selon les pistes.

---

### Lot 13 — Actualisation automatique

En deux étapes, livrées dans deux PR.

**13a — Actualisation à l'ouverture (sans infrastructure).**

- À l'ouverture de Radar, si la dernière actualisation du compte date de plus de `refreshEveryHours` (12 par défaut), lancer `POST /api/sources/sync` en arrière-plan, sans bloquer l'affichage.
- Garder les caches existants (15 min pour We Work Remotely ; Jobgether demande de limiter les appels) : l'actualisation ne contourne aucun cache.
- Ajouter le réglage `refreshMode?: "on_open" | "manual"` dans le compte, et le choix « Actualiser automatiquement à l'ouverture » / « Seulement quand je le demande ».
- En-tête de la page : « Actualisé il y a 2 h » et le bouton « Actualiser maintenant ».

**13b — Actualisation planifiée (après vérification de l'hébergement).**

- Vérifier d'abord que l'hébergement Sites accepte un déclencheur planifié. Aujourd'hui, `build/sites-worker.ts` n'exporte que `fetch` ; il faudrait un handler `scheduled`.
- Si c'est possible : un passage par jour, avant 7 h (fuseau de chaque compte), qui traite les comptes par lots et respecte un intervalle minimal par source.
- Choix proposés au compte : « Chaque matin », « Matin et soir », « Seulement quand je le demande ». Pas de fréquence horaire.
- L'en-tête affiche alors « Prochaine actualisation demain vers 7 h ». N'afficher cette phrase que si la planification est réellement active.

---

## 4. Points à décider avant les lots concernés

| Lot | Question | Proposition par défaut |
| --- | --- | --- |
| 5 | Portage comparé au TJM ou au salaire brut ? | TJM. |
| 5 | Critère « jours par semaine » pour le temps partagé ? | Non, pour l'instant. |
| 7 | Critère en langage naturel ? | Reporté ; dépend du connecteur ChatGPT. |
| 11 | Tolérance maximale autorisée ? | 20 %. |
| 13b | L'hébergement accepte-t-il une tâche planifiée ? | À vérifier avant de coder ; sinon s'en tenir à 13a. |

**Ordre de livraison conseillé :** 1 → 2 → 3 → 11 → 4 → 5 → 6 → 8 → 12 → 9 → 10 → 13a → 7 → 13b.

---

## 5. Consigne type pour lancer un lot dans Codex

```
Lis AGENTS.md, audits/signal-design-system.md et docs/ma-recherche-v2.md.
Réalise uniquement le « Lot N — <titre> » décrit dans le guide.
Pars de main à jour sur une branche codex/<sujet>. Réutilise les composants Signal
cités ; n'ajoute aucune dépendance. Mets la logique métier dans lib/ et teste-la dans
tests/. Garde le vouvoiement de l'interface.
Avant la PR : npm test, npx tsc --noEmit --incremental false, vérification visuelle
ordinateur + mobile, clavier et focus, mise à jour de CHANGELOG.md. Dans la PR, liste
les composants réutilisés et les vérifications faites.
```
