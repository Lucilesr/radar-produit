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
| R2 | Résumé du prompt ChatGPT | M |
| R3 | Score chiffré et coloré dans Offres | S |
| R4 | ✓ verts dans « Pourquoi elle remonte » | XS |
| R5 | Dette CSS (facultatif) | M |

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

## R5 — Dette CSS (facultatif, à valider avant de commencer)

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
