# Retours de recette du 9 novembre — plan détaillé

Lots validés par Lucile à partir de `docs/idees.md`. Suivre `AGENTS.md` : une branche `codex/<sujet>` et une PR par lot, dans l’ordre ci-dessous. Le lot suivant commence après fusion **et** recette du précédent sur le staging.

Pour chaque lot :

- grille numérotée publiée dans la PR avant le code ;
- composants et variables Signal ;
- captures avant / après à 1360 et 390 px, avec les états utiles ;
- clavier et focus vérifiés, cibles de 44 px sur mobile ;
- tests et types verts, aucune nouvelle erreur ESLint, console vide ;
- données fictives conservées, `CHANGELOG.md` à jour ;
- déploiement sur le staging privé, puis attente de la validation de Lucile avant la production.

Une fois le lot livré, retirer son idée de `docs/idees.md`.

| Lot | Sujet | Taille |
| --- | --- | --- |
| R1 | Enregistrer sans bloquer : check-list d’envoi | M |
| R1bis | Fluidité : Kanban, séance, plan de la semaine | L |
| R2 | Résumé du prompt ChatGPT | M |
| R3 | Score chiffré et coloré dans Offres | S |
| R4 | ✓ verts dans « Pourquoi elle remonte » | XS |
| R5 | Dette CSS | Fait dans #288 |

---

## R1 — Enregistrer sans bloquer : check-list d’envoi

**Problème.** Dans la fiche candidature (« Préparer / brief » ou « Ma candidature »), cocher une case de la **check-list d’envoi** désactive les quatre cases jusqu’à la réponse du serveur. Plusieurs cases cochées à la suite se bloquent les unes les autres, ce qui rend la saisie pénible.

**Cause dans le code.**

- `components/application-care.tsx`, fonction `save()` :
  - `lock.current` refuse tout nouveau clic tant qu’une requête est en cours ;
  - `setBusy(true)` désactive le `<fieldset disabled={!ready||busy}>` entier.
- Chaque requête `PUT /api/application-care/:jobId` envoie `{field, checked, version}`. Deux requêtes parallèles avec la même version provoqueraient un conflit (409). C’est pour éviter ce conflit que tout est verrouillé.

**Comportement attendu.**

1. Un clic coche ou décoche la case **immédiatement** (mise à jour optimiste). Le compteur « N sur 4 » et la barre suivent tout de suite.
2. Les autres cases restent utilisables pendant l’enregistrement. Seule la case en cours d’envoi affiche un état discret (`aria-busy` sur la ligne, opacité légère), sans être désactivée.
3. Les envois partent **dans l’ordre**, un à la fois (file d’attente côté client). Chaque envoi utilise la `version` renvoyée par le précédent, donc aucun 409 n’est provoqué par Radar lui-même.
4. Si l’utilisatrice reclique la même case avant l’envoi, la file ne garde que le dernier état voulu pour cette case.
5. En cas d’échec :
   - la case concernée revient à son dernier état confirmé, et elle seule ;
   - un message court s’affiche sous la liste (« La case « Contact identifié » n’a pas été enregistrée. ») avec « Réessayer » ;
   - les autres cases confirmées ne bougent pas.
6. En cas de 409 venu d’un autre onglet : appliquer l’état renvoyé par le serveur, puis rejouer les changements encore en attente sur cette nouvelle version.
7. Le message de statut pour les lecteurs d’écran reste dans la zone `role="status"` existante. Pendant l’envoi : « Enregistrement… » ; ensuite : vide.
8. Le focus ne bouge pas : il reste sur la case cochée.

**Où.** `components/application-care.tsx`. Si utile, un petit utilitaire de file d’attente dans `lib/` avec ses tests. L’API reste inchangée.

**Critères d’acceptation.**

- [ ] Cocher les 4 cases en moins de 2 secondes : les 4 restent cochées, 4 requêtes partent l’une après l’autre, aucun 409.
- [ ] Réseau coupé (DevTools hors ligne) puis 1 case cochée : la case revient, le message et « Réessayer » apparaissent, les autres cases restent utilisables.
- [ ] Rechargement après enregistrement : l’état affiché est celui du serveur.
- [ ] Test unitaire de la file : ordre conservé, fusion des clics répétés sur une même case, version chaînée, repli en cas d’échec.

**Hors périmètre de R1.** Les autres formulaires qui bloquent pendant l’enregistrement suivent le même schéma (`disabled={!ready||busy}`) :

- `components/radar-preferences.tsx` (cases de « Votre confort ») ;
- `components/application-followup.tsx` (relance) ;
- `components/domain-terms.tsx` (confirmer ou ignorer un terme).

Les lister dans la PR comme suites possibles, sans les modifier.

---

## R1bis — Fluidité : Kanban, séance, plan de la semaine

**Problème constaté par Lucile (11 novembre).** L’application rame à l’usage :

1. déplacer une carte dans Candidatures : la carte ne bouge qu’après un délai, et le tableau est bloqué pendant ce temps ;
2. « Lancer ma séance » ou « Reprendre ma séance » : très long avant que quoi que ce soit ne s’ouvre ;
3. cocher une action du bloc « Ma semaine » : lent à s’enregistrer ;
4. « Étape suivante » dans la séance : lent, et parfois le clic ne fait rien.

**Cause commune.** Chaque geste attend la réponse du serveur avant de changer l’écran, et désactive tout le bloc pendant ce temps. Le même schéma que R1, appliqué à quatre endroits.

| Geste | Où | Ce qui bloque |
| --- | --- | --- |
| Déplacer une carte | `components/radar-app.tsx`, `updateJob()` / `changeStatus()` ; `components/application-drag.tsx` | `setJobs` n’est appelé qu’après le `PATCH /api/jobs/:id`. Pendant l’attente, `busy` désactive toutes les commandes du tableau (`disabled={!!busy}`). |
| Lancer / reprendre la séance | `components/use-session-journey.ts`, `start()` puis `checkpoint()` | `start()` refuse tant que le carnet (`/api/experiences`) et le point de reprise (`/api/radar-continuity`) ne sont pas relus. Puis `checkpoint()` attend l’écriture du point de reprise **avant** d’ouvrir l’étape (`after()` n’est appelé qu’après `save()`). |
| Étape suivante | `use-session-journey.ts`, `next()` | Même attente via `checkpoint()`. En plus, `next()` **ignore le clic sans rien dire** si une autre écriture est en cours ailleurs (`pending.current.size`, alimenté par `sessionWrite`). C’est le « clic qui ne fait rien ». |
| Cocher une action de la semaine | `components/week-plan.tsx`, bouton `week-check` | La case ne change qu’après le `PUT /api/week-plan`. `planBusy` désactive toutes les cases pendant l’envoi. |

Côté serveur, le point de reprise est écrit dans le JSON complet de `profiles.data` (`lib/radar-continuity-store.ts`) : lecture du profil entier, puis `UPDATE … WHERE data=?` qui compare tout le JSON. Plus le profil grossit, plus chaque étape coûte.

**Étape 0 — Mesurer avant de corriger.** Sur le staging, avec un compte de démo bien rempli, mesurer pour chacun des quatre gestes :

- le délai entre le clic et le premier changement visible ;
- la durée de chaque requête réseau, et la taille de `profiles.data` pour ce compte.

Reporter les chiffres dans la PR (tableau avant / après). Ajouter un en-tête `Server-Timing` sur les routes concernées si c’est utile au diagnostic.

**Comportement attendu.** Règle générale : **l’écran réagit tout de suite, le serveur confirme ensuite.** Moins de 100 ms entre le clic et le changement visible.

1. **Kanban.**
   - La carte part dans sa nouvelle colonne dès le dépôt (ou dès « Déplacer vers »). Mise à jour optimiste de `jobs`.
   - Seule la carte en cours d’envoi porte un état discret (`aria-busy`, opacité légère). Les autres cartes restent déplaçables.
   - Les envois sur une **même** carte partent dans l’ordre ; les envois sur des cartes différentes peuvent partir en parallèle.
   - En cas d’échec, la carte revient à sa colonne d’origine, avec le message existant et « Réessayer ». Les autres cartes ne bougent pas.
   - Le toast « Statut enregistré » reste, mais n’apparaît qu’après confirmation.
   - Cas particulier inchangé : le passage à « Envoyées » d’une offre qui n’était pas encore une candidature garde son verrouillage du lot du jour (`lockDailyLot`) avant l’envoi.
2. **Lancer / reprendre la séance.**
   - Le carnet et le point de reprise sont relus **à l’arrivée sur Aujourd’hui**, pas au clic. Le bouton est donc prêt au moment où l’on clique.
   - Au clic, l’étape s’ouvre tout de suite. Le point de reprise s’enregistre en arrière-plan.
   - Si l’enregistrement échoue, on reste sur l’étape et un bandeau discret propose « Réessayer ». Pas de retour en arrière.
   - Conflit 409 (autre onglet ou appareil) : garder le comportement actuel, c’est-à-dire relire l’état du compte et prévenir.
3. **Étape suivante.**
   - Même principe : l’étape suivante s’ouvre tout de suite, le point de reprise suit.
   - Ne plus ignorer le clic quand une autre écriture est en cours. Mettre le changement d’étape en file derrière elle, et l’afficher immédiatement.
   - Si l’on clique plusieurs fois vite, chaque clic avance d’une étape ; les écritures partent dans l’ordre avec la version renvoyée par la précédente.
4. **Cocher une action de la semaine.**
   - La case se coche dès le clic, l’action passe dans « réalisées » tout de suite.
   - Les autres cases restent utilisables. Mêmes règles que R1 : file ordonnée, version chaînée, dernier état voulu gardé si l’on reclique, repli de la seule case en échec.
   - La célébration « semaine tenue » ne se déclenche qu’après confirmation du serveur.

**Mise en œuvre.**

- R1 crée une file d’enregistrement côté client (dans `lib/`, avec tests). R1bis la **réutilise** pour les quatre gestes au lieu d’en écrire une par composant. Si R1 n’est pas encore fusionné, faire R1 d’abord.
- Ne pas changer les API ni le schéma de la base dans ce lot. Si la mesure montre que le serveur reste lent (par exemple `profiles.data` très lourd), le noter dans la PR comme suite possible, sans le traiter ici.
- Garder les garde-fous existants : versions, détection de conflit, `sessionWrite` pour la fin de séance et les relances.

**Critères d’acceptation.**

- [ ] Tableau avant / après des quatre délais dans la PR, mesurés sur le staging.
- [ ] Déplacer 3 cartes à la suite en moins de 3 secondes : les 3 sont à leur place immédiatement, 3 requêtes confirmées, aucun 409.
- [ ] « Lancer ma séance » ouvre la première étape en moins de 100 ms une fois Aujourd’hui affiché.
- [ ] « Étape suivante » cliqué 2 fois vite : on avance de 2 étapes, le point de reprise final est le bon après rechargement.
- [ ] Cocher 3 actions de la semaine à la suite : les 3 restent cochées, état identique après rechargement.
- [ ] Réseau coupé : chaque geste revient proprement en arrière (ou reste sur l’étape pour la séance), avec un message et « Réessayer ».
- [ ] Clavier et lecteurs d’écran : le focus ne saute pas, la zone `role="status"` annonce l’enregistrement.
- [ ] Tests unitaires de la file sur ces nouveaux usages ; tests et types verts, console vide.

**Hors périmètre.** « Votre confort », la relance et les termes du domaine (listés sous R1) restent pour un lot suivant, avec la même file.

---

## R2 — Résumé du prompt ChatGPT

**Problème.** Dans « Préparer / brief », le bloc « Prompt ChatGPT » ne montre qu’un bouton « Copier le prompt » et un dépliant « Voir le contenu du prompt » qui contient tout le texte brut (`<pre>`). Rien n’indique en un coup d’œil ce que le prompt va faire, ni sur quelles expériences il s’appuie.

**Données disponibles.** `POST /api/brief` (`app/api/brief/route.ts`) construit le prompt avec `createCandidateBrief` (`lib/candidate-brief.ts`) à partir de :

- l’offre (`briefOffer`) ;
- les faits approuvés et autorisés pour candidature (`approvedFacts(userId,"application")`) : titre, expérience, période, contribution, résultat ;
- les questions du recruteur (`listApplicationQuestions`).

La route ne renvoie aujourd’hui que `{brief, factCount}`.

**Comportement attendu.** Entre le titre « Prompt ChatGPT » et le bouton de copie, un résumé lisible remplace la phrase actuelle « Annonce, parcours validé et questions… » :

1. **« Ce que ChatGPT va préparer »** : liste fixe à 4 points, tirée de la section « Demande » du prompt :
   - les ajustements du CV, fondés sur vos expériences ;
   - un message court ;
   - les réponses aux questions du recruteur, dans leur limite de caractères ;
   - une checklist de validation avant envoi.
2. **« Sur quoi il s’appuie »** :
   - **Offre** : « [Intitulé] chez [Entreprise] » ;
   - **Expériences** : la liste des expériences utilisées, une par ligne (« Product Owner · CAPSENS · 2022–2024 »), regroupées par expérience si plusieurs faits viennent de la même. Au-delà de 4 : « + N autres » ;
   - **Questions** : « N questions du recruteur » ou « Aucune question enregistrée ».
3. **Si aucun fait n’est autorisé**, afficher à la place une alerte claire : « Aucune expérience autorisée pour les candidatures : le prompt ne pourra pas s’appuyer sur votre parcours. », avec un lien « Ouvrir mon carnet ». Le bouton de copie reste disponible.
4. Le texte complet reste accessible dans le dépliant, renommé « Voir le texte complet ».
5. Le résumé suit la langue choisie (« Langue des réponses ») uniquement pour le prompt. L’interface reste en français.

**Où.**

- `app/api/brief/route.ts` : renvoyer en plus un objet `summary` :
  - `offer` : `{title, company}` ;
  - `experiences` : `[{title, company, period}]`, dédoublonnées ;
  - `questionCount`.

  Aucun nouveau champ privé : uniquement ce qui figure déjà dans le prompt.
- `components/offer-workspace.tsx`, composant du bloc `signal-prompt-section` : afficher le résumé.
- `lib/candidate-brief.ts` : exporter une fonction `briefSummary(context)` testée, pour que le résumé et le prompt viennent de la même source.

**Critères d’acceptation.**

- [ ] Avec 3 expériences autorisées et 2 questions, le résumé liste les 3 expériences et « 2 questions du recruteur ».
- [ ] Avec 0 fait autorisé, l’alerte et le lien vers le carnet apparaissent.
- [ ] Le texte copié est identique à celui d’avant (aucune régression du prompt).
- [ ] Test de `briefSummary` : dédoublonnage par expérience, coupure à 4 avec « + N », cas sans fait.
- [ ] À 390 px : résumé lisible sans débordement, bouton de copie en pleine largeur.

---

## R3 — Score chiffré et coloré dans Offres

**Problème.** Dans Offres, l’adéquation n’apparaît que comme un libellé neutre (« Très proche », « Proche », « À jauger », « Loin »). Le chiffre sur 100 n’est visible qu’au survol. L’écran manque de couleur et de repères rapides.

**Existant.**

- `components/offer-workspace.tsx`, composant `FitBadge`, utilisé dans la liste (`opportunities-workspace.tsx`) et la fiche (`OfferFitCard`) :
  - le libellé seul s’affiche ;
  - `fitTones` ne colore que `very_close` (`is-success`) et `to_weigh` (`is-warning`).
- `lib/fit.ts` : `fitLabel()` donne Loin sous 50. À partir de 50, une offre à arbitrer est À jauger ; sinon Très proche à partir de 80, Proche de 60 à 79, Loin de 50 à 59.

**Comportement attendu.**

1. Dans la liste des offres et dans la fiche, le badge affiche **le chiffre puis le libellé** : « **82** · Très proche ».
2. La couleur suit le **libellé**, pas un nouveau seuil, pour rester cohérente avec le tri :

   | Libellé | Fond | Texte |
   | --- | --- | --- |
   | Très proche | `--signal-success-bg` (#edf5f0) | `--signal-success` (#176947) |
   | Proche | `--signal-mist` (#eaf0f3) | `--signal-petrol` (#24566b) |
   | À jauger | `--signal-warning-bg` (#fff4df) | `--signal-warning` (#80551a) |
   | Loin | `--signal-danger-bg` (#fff0f2) | `--signal-danger` (#be263d) |

3. « Fiche mystère » et « Fiche incomplète » gardent leur style neutre actuel, sans chiffre.
4. Dans la fiche (`OfferFitCard`), le grand chiffre « 82 / 100 » prend la couleur du texte de son libellé.
5. La couleur n’est jamais le seul repère : le libellé reste écrit. Contraste d’au moins 4,5:1 à vérifier pour chaque paire.
6. Lecteur d’écran : « Adéquation 82 sur 100, très proche ». Retirer le doublon `sr-only` si le chiffre devient visible.

**Où.**

- `components/offer-workspace.tsx` (`FitBadge`, `fitTones`, `OfferFitCard`) ;
- styles dans `app/signal-opportunities.css` ou `app/signal-offers-aligned.css`, avec les variables Signal uniquement.

**Critères d’acceptation.**

- [ ] Les quatre libellés ont chacun leur couleur dans la liste et la fiche, à 1360 et 390 px.
- [ ] Les fiches mystère et incomplètes sont inchangées.
- [ ] Les contrastes sont relevés dans la PR.
- [ ] Le badge ne passe pas à la ligne dans la carte de liste à 390 px.

---

## R4 — ✓ verts dans « Pourquoi elle remonte »

**Problème.** Dans la fiche d’une offre, « Pourquoi elle remonte » liste jusqu’à 4 raisons, chacune précédée d’une icône ✓ (`CheckCircle2`) de la couleur du texte. Rien ne signale visuellement que ce sont des points positifs.

**Comportement attendu.**

1. Les icônes ✓ des raisons passent en vert succès (`--signal-success`, #176947). Le texte des raisons reste couleur encre.
2. Les « Points à vérifier » (`aligned-offer-warnings`, icône `CircleHelp`) restent neutres, ou passent en ambre `--signal-warning` pour bien les distinguer. À montrer dans la PR, avec une capture de chaque option.
3. Aucune autre modification de contenu.

**Où.** `components/offer-workspace.tsx` (section `aligned-offer-reasons`, ligne « Pourquoi elle remonte ») et une règle CSS dans `app/signal-offers-aligned.css`.

**Critères d’acceptation.**

- [ ] Les ✓ sont verts dans la fiche à 1360 et 390 px.
- [ ] Les icônes restent `aria-hidden`.
- [ ] Contraste de l’icône d’au moins 3:1 sur le fond.

---

## R5 — Dette CSS (réalisé par Claude dans #288)

Gardé pour mémoire : le lot est livré, avec ses garde-fous dans `tests/css-signal.test.mjs`. Codex n’a rien à faire ici.

**Problème.** Le lot #271 (cohérence Signal) a ajouté `app/signal-coherence.css`, chargé en dernier, qui **réécrase** des règles d’autres fichiers. Ça marche, mais :

- une même valeur est déclarée à deux endroits (par exemple le rayon des bulles d’aide : 10 px dans `signal-controls.css`, 16 px dans la surcharge) ;
- des rayons (10, 16, 999 px) et des couleurs de survol (`#dce6eb`, `#a21e33`) sont encore écrits en dur au lieu des variables ;
- aucun test n’empêche qu’ils reviennent ;
- les styles `.application-funnel-summary` ne servent plus depuis la bascule Kanban / Entonnoir.

L’utilisatrice ne voit rien, mais chaque modification de style devient plus lente et plus risquée.

**Comportement attendu.** Aucun changement visible.

1. Reporter chaque règle de `signal-coherence.css` dans le fichier d’origine du composant, puis supprimer la surcharge.
2. Remplacer les rayons en dur par `--signal-radius-control`, `--signal-radius-card`, `--signal-radius-panel` et `--signal-radius-pill`, et les couleurs de survol par des variables Signal.
3. Supprimer les styles morts (`.application-funnel-summary` et les autres que l’inventaire révélera).
4. Ajouter un test `node --test` qui lit `app/*.css` et refuse un `border-radius` en px hors variables, avec une liste d’exceptions justifiées (coins composés, dessins).

**Critères d’acceptation.**

- [ ] Captures avant / après identiques sur les 8 écrans de `docs/coherence-signal/README.md`, à 1360 et 390 px.
- [ ] `signal-coherence.css` est supprimé.
- [ ] Le nouveau test passe.
- [ ] Le nombre de règles CSS est relevé avant et après.
