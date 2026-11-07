# Feuille de route — gamification de Radar

Ce document reprend le travail préparé par Claude pour que Codex le poursuive seul. Les règles de `AGENTS.md` s'appliquent à chaque lot : une PR par intention, branche `codex/<sujet>` depuis `main` à jour, données fictives, design system Signal, `CHANGELOG.md`, vérification ordinateur et mobile, clavier et focus, staging avant production, production seulement après validation explicite de l'utilisatrice.

Guides détaillés déjà dans le dépôt :

- `docs/score-v2.md` : score (S1 à S4 livrés, S5 à faire) ;
- `docs/tri.md` : tri (Q1a et Q1b livrés, Q1c à faire) ;
- `docs/maquettes/*.html` : sept maquettes statiques de référence. Elles s'ouvrent dans un navigateur ; leurs données sont fictives.

---

## 0. Pourquoi

Radar doit donner envie d'y revenir. La recherche d'emploi est longue, solitaire et pleine de refus. L'application s'appuie honnêtement sur des biais connus, pour aider et jamais pour piéger :

- **Gradient d'objectif** : un lot fini, « Plus que 3 ».
- **Illusion du travail** : montrer ce que le radar a parcouru.
- **Pic et fin** : une fin de séance gratifiante.
- **Progression offerte et effet IKEA** : une jauge qui démarre avec des crans déjà gagnés.
- **Intention de mise en œuvre** : des engagements datés.
- **Récompense variable** : des célébrations rares.

Garde-fous :

- Pas de culpabilisation ni de fausse urgence.
- Pas de compteur qui remonte quand on trie.
- Tout est désactivable.
- Le vouvoiement reste la règle.

## 1. État au 7 novembre 2026

| Lot | État | PR |
| --- | --- | --- |
| Score v2 S1 à S4 (fourchettes, niveau, adéquation, fiches mystère) | Dans `main` | #196 à #200, plus les correctifs Codex #202 à #205 |
| Tri Q1a, lot du jour | À rebaser sur `main` puis fusionner | #201 |
| Tri Q1b, « Plus tard », réserve et archives | À rebaser après #201 | #206 |

Attention au déploiement de #206 : les offres sans décision depuis plus de 21 jours passent d'un coup aux archives. Elles restent consultables et restaurables. À signaler à l'utilisatrice.

## 2. Ordre des lots suivants

Une PR par ligne, dans cet ordre. Chaque lot est déployé sur le staging, puis l'utilisatrice le valide avant la production.

| Ordre | Lot | Effort | Dépend de | Migration |
| --- | --- | --- | --- | --- |
| 1 | **Q0** — design system « radar vivant » (§3) | S | — | Non |
| 2 | **Q1c** — repêchage du vendredi (`docs/tri.md`) | S | #206 | Non |
| 3 | **Q1d** — tris qui affinent le radar (§5.1) | S | #206 | Non |
| 4 | **Q2** — le radar travaille (§4.2) | S | Q0 | Non |
| 5 | **Q3** — séance et fin de séance (§4.4 et §4.5) | M | Q0, Q1 | Non |
| 6 | **Q4** — portée du radar (§4.6) | M | Q0 | Non |
| 7 | **Q5** — plan de la semaine (§4.7) | M | Q0 | Non : `profiles.data` |
| 8 | **Q6** — célébrations surprises et réglage (§5.2) | S | Q0 | Non |
| 9 | **S5** — domaine nourri par les expériences (`docs/score-v2.md`) | M | — | Non |
| 10 | **C1 à C4** — onglet Candidatures (§6) | M | Audit C0 | À décider |
| 11 | **L1** — journal d'activité, puis L2 à L5 | L | Décision de migration | Oui |

Avant chaque lot d'interface : relire la maquette concernée et §7 (oublis), puis lister les états (§4).

---

## 3. Q0 — Design system « radar vivant »

But : donner du caractère sans toucher à la lisibilité des écrans de travail. L'énergie va aux moments de passage (compteurs, fins de séance, jalons), pas aux formulaires.

### 3.1 Jetons à ajouter dans `app/signal-tokens.css`

Ils sont relevés dans les maquettes. Les jetons existants (pétrole, ligne, papier) ne changent pas.

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `--signal-petrol-ink` | `#193F50` | Grands chiffres, titres d'affichage |
| `--signal-petrol-deep` | `#203743` | Fonds sombres (carte « Séance bouclée ») |
| `--signal-petrol-mid` | `#24566B` | Balayage du radar, barres |
| `--signal-energy` | `#E6EE53` | Citron, couleur d'énergie : progression, réussite, échos du radar. **Jamais en texte sur fond clair.** Toujours en fond, sous un texte pétrole foncé, ou en trait de 3 px ou plus |
| `--signal-celebration` | `#FF8A65` | Corail, réservé aux célébrations (Q6) et aux jalons. Jamais pour une erreur |
| `--signal-success-ink` | `#176947` | Texte « tenu », « validé » |
| `--signal-mist` | `#EAF0F3` | Fonds de cartes secondaires |
| `--signal-ash` | `#7B8E99` | Texte tertiaire. Taille minimale de 13 px, contraste à vérifier |

Vérifier un contraste d'au moins 4,5:1 pour le texte et d'au moins 3:1 pour les graphiques. Le citron sur blanc ne passe pas en texte.

### 3.2 Typographie

- Affichage : **Bricolage Grotesque**, graisses 500 à 800, axe `opsz`. Elle sert aux titres de page, aux grands chiffres (compteurs, jauges, bilans) et aux titres des moments forts. Jeton `--font-display`.
- Texte courant : **Inter** (400 à 700), ou garder la police système si la performance l'exige. Jeton `--font-sans`.
- Les polices sont hébergées par l'application (fichiers `woff2` dans `public/fonts`, `font-display: swap`), pas chargées depuis Google : vie privée et indépendance.
- Chiffres : `font-variant-numeric: tabular-nums` sur les compteurs.

### 3.3 Mouvement

Quatre animations de base, dans `app/signal-motion.css` :

| Nom | Effet | Usage |
| --- | --- | --- |
| `radar-sweep` | Rotation de 360° en 2,4 s, linéaire, en boucle | Pendant l'actualisation seulement |
| `radar-blip` | Point qui apparaît, grandit puis s'estompe, 900 ms | Une nouvelle offre repérée |
| `pop` | Échelle 0,9 puis 1,05 puis 1, 260 ms | Coche, palier atteint |
| `count-up` | Compteur qui défile, 600 ms, en JavaScript | Grands chiffres des bilans |

- `@media (prefers-reduced-motion: reduce)` coupe tout (état final direct, aucun défilement). Le réglage Q6 « Réduire les animations et célébrations » produit le même effet, via un attribut `data-motion="reduced"` sur `<html>`.
- Pas d'animation sur un contenu qu'on lit ou édite.

### 3.4 Composants Signal à créer

Chacun a ses états : défaut, survol, focus visible, désactivé, réduit (mouvement coupé).

- `SignalCounter` : grand chiffre et libellé, avec `aria-live="polite"` en option.
- `SignalProgress` : barre avec `role="progressbar"`. Variantes neutre, énergie et terminée. Le bandeau du lot du jour (#201) migre dessus.
- `SignalRadar` : radar SVG avec balayage et échos. Taille de 48 à 160 px. Image décorative, `aria-hidden`, le texte voisin porte l'information.
- `SignalMoment` : carte plein cadre pour les moments forts (fin de séance, nouvelle semaine, palier). Fond pétrole profond, chiffres en Bricolage, bouton principal citron. Le focus va sur le titre à l'ouverture et `Échap` ferme.
- `SignalStepper` : étapes de séance (Trier, Relancer, Visiter, Valider), avec étape courante, faite et à venir.

### 3.5 Décision ouverte

Faut-il un personnage (comme le hibou de Duolingo), ou le radar seul comme figure ? Par défaut, **le radar seul**. Ne pas créer de mascotte sans validation de l'utilisatrice.

### 3.6 Acceptation

- Aucun écran existant ne change de mise en page.
- Les tests visuels et d'accessibilité existants restent au vert.
- Une page interne `/?tab=dashboard` montre les nouveaux composants si l'application a déjà un endroit pour cela. Sinon, rien de visible avant Q2.

---

## 4. Maquettes finalisées : écrans, états, comportement, évolution

Pour chaque écran : la maquette de référence, ce qu'il faut construire, puis ses états. « Mobile » signifie 390 px de large. La navigation basse existante reste ; un moment plein cadre devient une feuille pleine hauteur.

### 4.1 Accueil « Aujourd'hui » — `docs/maquettes/Main.html`

**Blocs**, de haut en bas :

1. Badge de série. Il apparaît à partir de L2 ; avant L2, il est masqué.
2. Date du jour.
3. Titre dynamique, par exemple « 3 offres valent le détour aujourd'hui » : nombre d'offres « Très proche » dans le lot du jour.
4. Promesse de séance : « environ N minutes », à raison de 1 min par offre du lot restante et 3 min par relance ou visite. Bouton « Commencer ma séance » (Q3).
5. Ligne radar : « Actualisé il y a 2 h · 214 offres parcourues sur 9 sources » (Q2).
6. Plan de la semaine, compact (Q5).
7. Portée du radar, compacte (Q4).
8. « À faire ensuite » : trois actions au plus, déjà calculées par `lib/triage.ts`.
9. Trois compteurs : à examiner, sélection, candidatures.

**États.**

| État | Rendu |
| --- | --- |
| Compte neuf (ni critère ni source) | Remplace les blocs 3 à 9 par « Réglez votre radar en 3 étapes » : critères, sources, première actualisation. Le tour de prise en main existant reste |
| Rien à trier | « Lot du jour bouclé » ou « Rien de neuf » ; la promesse de séance ne parle que des relances ou visites. Sans rien à faire : « Rien d'urgent. Revenez demain, le radar veille. » |
| Entretien imminent | La carte entretien existante passe en premier, comme aujourd'hui |
| Chargement | Squelettes aux dimensions finales, sans balayage |
| Erreur de chargement | Message existant `WorkspaceState`, bouton « Réessayer » |
| Q4 ou Q5 non livrés | Le bloc est absent, pas un emplacement vide |

**Évolution.** L2 (série) et L4 (« À ce rythme, environ 2 entretiens par mois ») s'ajoutent sous le titre.

### 4.2 Balayage — `docs/maquettes/Scan.html` (Q2)

**Comportement.** « Actualiser » lance le balayage (`SignalRadar` en mouvement). `POST /api/sources/sync` renvoie déjà `total`, `imported` et `deduplicated`. À la fin, une carte d'écho remplace l'animation :

- les chiffres « offres parcourues », « collent à vos critères » (adéquation d'au moins 60 ou conditions remplies), « nouvelles » et « doublons écartés » ;
- le bouton « Voir les N offres » ouvre « À examiner » ;
- le détail par source. Les sources manuelles (Collective, Malt) affichent « à visiter, dernière visite il y a N jours ».

**États.**

| État | Rendu |
| --- | --- |
| En cours | Radar animé, « Balayage de 9 sources… ». Le bouton est désactivé avec `aria-busy` |
| Terminé avec des nouvelles | Carte d'écho, compteurs `count-up` |
| Terminé sans nouvelle | « Rien de neuf depuis 2 h. 214 offres déjà connues. » Pas de célébration |
| Une source en erreur | Ligne de la source en avertissement, « Réessayer » ; les autres chiffres restent |
| Toutes les sources en erreur ou hors ligne | Message d'erreur, aucune animation infinie. Le balayage s'arrête au bout de 60 s au plus |
| Mouvement réduit | Radar fixe, chiffres affichés directement |

**Évolution.** Les doublons fusionnés pourront être consultés : « Voir d'où vient chaque offre ».

### 4.3 Tri — `docs/maquettes/Tri.html` (Q1, livré en partie)

**Déjà livré** (#201, #206) :

- bandeau « Plus que N », barre et lot de 20 ;
- « Plus tard » ;
- réserve rangée et archives.

**Reste à faire, à l'aide de la maquette :**

- **Raccourcis clavier** `S` (Sélectionner), `L` (Plus tard) et `X` (Écarter) sur l'offre ouverte. Ils sont actifs seulement quand le focus n'est pas dans un champ de saisie. Une aide visible donne les touches. Ils sont désactivables avec Q6. Après chaque décision, l'offre suivante du lot s'ouvre et le focus va sur son titre.
- **« Pourquoi elle remonte »** : quatre raisons au plus, prises dans `assessment.reasons` et `signals`.
- **Q1d « Vos tris affinent le radar »** : voir §5.1.

**États.**

| État | Rendu |
| --- | --- |
| Lot vide (aucune offre) | « Aucune offre à trier aujourd'hui », avec un lien vers les sources |
| Lot bouclé | Bandeau citron, « Continuer avec la réserve ». En séance (Q3), ouvre la fin de séance |
| Erreur d'enregistrement d'une décision | L'offre reste et le message existant s'affiche. Le compteur ne bouge pas |
| Autre appareil | Lot recalculé (limite connue, documentée dans `docs/tri.md`) |

### 4.4 Séance du jour (Q3) — en-tête de `Tri.html`

**Comportement.** « Commencer ma séance » (accueil) ouvre une séance de quatre étapes au plus, en sautant celles qui sont vides :

1. Trier le lot.
2. Relancer : les relances arrivées à échéance.
3. Visiter une source manuelle (plus de 5 jours sans visite).
4. Valider un bloc (une expérience ou une histoire du profil).

`SignalStepper` en haut, « Quitter la séance » toujours visible. La séance vit en mémoire, avec `sessionStorage` en confort : instantané à l'ouverture, différence à la fermeture. Rien n'est écrit en base.

**États.**

| État | Rendu |
| --- | --- |
| Séance interrompue (onglet fermé) | Pas de reprise forcée. Au retour, l'accueil propose « Reprendre la séance » le même jour |
| Toutes les étapes vides | Le bouton devient « Rien à faire aujourd'hui » et ne lance rien |
| « Quitter » avant la fin | Fin de séance si au moins une action a été faite ; sinon, retour à l'accueil sans écran |

### 4.5 Fin de séance — `docs/maquettes/FinDeSeance.html` (Q3)

**Contenu.**

- `SignalMoment` : « Séance bouclée · N minutes qui comptent ».
- Quatre compteurs : offres triées, relances envoyées, sources visitées, histoires validées.
- La **pépite** : l'offre de meilleure adéquation sélectionnée ou repérée pendant la séance, gardée pour la fin, avec « Ouvrir la pépite ».
- L'état du plan de la semaine (Q5).
- Ce qui arrive demain, par exemple « Demain : 2 relances arrivent à échéance ».
- Bouton « Terminer pour aujourd'hui ».

**États.**

| État | Rendu |
| --- | --- |
| Pas de pépite | Le bloc disparaît, sans texte de remplacement |
| Une seule action | Libellés au singulier, pas de superlatif |
| Q5 absent | Pas de bloc semaine |
| Mouvement réduit | Pas de `count-up` |
| Clavier | `Échap` ou « Terminer » ferme et le focus revient sur l'accueil |

### 4.6 Portée du radar — `docs/maquettes/Portee.html` (Q4)

**Paliers** : Repérage, Balayage, Longue portée, Précision. Dix crans, calculés à partir des données existantes :

| Crans | Condition |
| --- | --- |
| 2 | Critères renseignés |
| 1 | Niveau visé |
| 2 | Au moins 3 sources actives |
| 1 | Une source manuelle visitée |
| 2 | Au moins 2 expériences validées |
| 2 | Au moins 4 histoires d'entretien |

Le compte démarre avec les crans déjà gagnés (progression offerte). Chaque palier affiche ce qu'il débloque. Ce sont des fonctions qui existent déjà ; rien n'est bloqué par la jauge.

**Prochain cran** : une seule action, avec sa durée estimée et le bouton « Écrire maintenant » ou « Ajouter une source ».

**Histoires d'entretien** : huit thèmes, à rapprocher du skill de préparation d'entretien. Les thèmes faits sont cochés, ceux qui restent apparaissent avec « + ».

**États.**

| État | Rendu |
| --- | --- |
| 0 cran | « Votre radar s'allume », premier cran en un clic |
| Palier atteint | `pop` et citron, une fois. Pas de corail (réservé à Q6) |
| 10 crans | « Précision atteinte ». La jauge reste, sans relance |
| Mobile | Paliers en liste verticale |

Fonction pure `lib/radar-reach.ts`, testée.

### 4.7 Plan de la semaine — `docs/maquettes/Semaine.html` (Q5)

**Comportement.**

- Le lundi, à la première visite (ou à la première visite de la semaine), l'accueil ouvre « Nouvelle semaine, page blanche ».
- Choix du rythme : Tranquille, Régulier ou Intense, ce qui donne 2, 3 ou 4 engagements.
- Pour chaque engagement : « Quand » (jour et heure), « je » (action, liste fermée : relance, soigne, visite, écris, prépare, fais le bilan), « Pour » (une offre, une candidature, une source ou une histoire).
- Le radar propose trois suggestions tirées de l'état réel.
- Stockage dans `profiles.data.weekPlan = { week: "2026-W46", rhythm, commitments: [{ id, when, action, targetId?, label, doneAt? }] }`, sans migration.

**États.**

| État | Rendu |
| --- | --- |
| Plan non posé | Rappel discret sur l'accueil, jamais bloquant |
| Engagement en retard | Neutre (« à replanifier »), pas de rouge, avec « Déplacer » |
| Semaine tenue (tout coché) | Petit moment, puis citron |
| Semaine précédente non tenue | Rien de punitif : « Nouvelle semaine, page blanche » |
| Série et jokers | **Masqués tant que L1 et L2 ne sont pas livrés.** La maquette les montre en avance |

**Évolution.** L2 ajoute la série, les deux jokers et la pause sans perte.

### 4.8 Ranger la réserve — `docs/maquettes/Rafale.html` (Q1b livré, à enrichir)

Déjà livré : groupes, « Voir le groupe » et « Écarter le groupe ».

À reprendre de la maquette :

- l'en-tête « 1 groupe rangé sur 5 · 38 offres en moins » ;
- un bouton « Annuler » juste après une décision de groupe (restauration via la corbeille) ;
- une action propre à chaque groupe : « Archiver les 24 » pour les anciennes, « Garder en réserve » pour « sans salaire », « + Viser Growth PM » pour un poste voisin (ajoute le rôle aux critères).

Le repêchage du vendredi est le lot Q1c.

---

## 5. Lots sans écran dédié

### 5.1 Q1d — Vos tris affinent le radar

Quand la personne écarte au moins 4 offres en 7 jours pour la même raison détectable, une carte discrète le lui signale. Raisons détectables : présence hybride au-delà de N jours, contrat, intitulé, source.

La carte dit par exemple : « Vous avez écarté 4 offres en hybride 3 jours cette semaine. Ne plus me les proposer ? ». Elle propose deux boutons :

- **Ajuster mes critères** : ouvre le critère concerné, prérempli ;
- **Non merci** : la même suggestion ne revient pas pendant 30 jours. Le refus est gardé dans `profiles.data`.

Le critère n'est jamais modifié sans clic. Toute la logique est pure et testée.

### 5.2 Q6 — Célébrations surprises et réglage

- **Déclencheurs** : de vraies actions seulement (candidature envoyée, relance faite, bilan d'entretien rempli, semaine tenue).
- **Fréquence** : probabilité d'environ 1 sur 3, jamais deux fois dans la même heure.
- **Forme** : petite animation corail et une phrase variée. Pas de son.
- **Réglage dans « Mon profil »** : « Réduire les animations et célébrations ». Il coupe aussi le mouvement (§3.3) et les raccourcis de tri si la personne le souhaite. Il est stocké dans `profiles.data.preferences`.
- **Jamais** après un refus ou une offre écartée.

---

## 6. Onglet Candidatures

Point demandé par l'utilisatrice, à traiter « dans un second temps ». Il n'a pas encore été étudié : **commencer par un audit (C0), sans code.**

### C0 — Audit, à livrer en document dans `docs/candidatures.md`

1. Inventorier l'existant :
   - `ApplicationsWorkspace` dans `components/today-workspace.tsx` ;
   - `application-kanban.tsx` (colonnes personnelles via `use-personal-board`) ;
   - `application-questions.tsx` ;
   - `application-tags.tsx` ;
   - entretiens (table `interviews`), relances et brief ;
   - statuts `JobStatus` : `applied`, `interview`, `awaiting_response`, `next_step`, `offer`, `rejected`, `withdrawn`, `closed`.
2. Parcourir l'onglet sur le staging, avec des données fictives, sur ordinateur et sur mobile. Noter les frictions.
3. Répondre aux questions du guide de challenge métier :
   - **États et cycle de vie** : que se passe-t-il après un refus ? Après 30 jours sans réponse ?
   - **Temps** : relances à J+7 et J+14, entretiens passés.
   - **Erreurs** : glisser-déposer qui échoue.
   - **Mobile** : le kanban en colonnes est-il utilisable à 390 px ?
   - **Volume** : 50 candidatures.
4. Proposer des lots C1 à C4 à l'utilisatrice avant de coder.

### Pistes déjà identifiées, à valider en C0

- **C1 — Candidature soignée** : une jauge sur 4 (CV adapté, lettre ou message, contact identifié, questions préparées). « Soignée à 3 sur 4 : il manque le contact » (maquette Main). C'est l'effet IKEA appliqué à la qualité plutôt qu'au volume.
- **C2 — Relances qui tombent à pic** : date de relance proposée à J+7, rappel dans « À faire ensuite » et dans la séance (Q3). Une fois la relance faite, il suffit d'un clic pour la noter.
- **C3 — Après un refus (L3 allégé)** : deux questions, « ce que je garde » et « ce que je change ». C'est privé, et c'est compté comme un progrès, pas comme un échec. Ce lot demande L1 pour l'historique ; une version sans migration peut écrire dans la note de la candidature.
- **C4 — Vue mobile** : une liste groupée par étape plutôt que des colonnes, et une action principale par carte.
- Plus tard, avec L4 : entonnoir réaliste, sources qui mènent vraiment à des entretiens.

---

## 7. Points d'attention

- **Mesure.** Il n'existe pas d'outil de mesure d'usage, et chaque lot du document de cadrage a une mesure. Ne pas ajouter d'outil tiers : la mesure viendra de L1 (journal d'activité interne, propre à chaque compte). Décider de la migration L1 avec l'utilisatrice.
- **Sauvegarde et restauration.** Vérifier que la sauvegarde intégrale (`account-backup`) conserve `review_state = later`, `weekPlan` et les nouveaux champs de `profiles.data`.
- **Test en échec** sur `main` (« sauvegarde intégrale A/B », `sqlite.serialize`) : le corriger dans une PR à part, pour retrouver une suite verte.
- **Plusieurs appareils.** Le lot du jour et la séance vivent dans le navigateur. Le documenter dans le guide de prise en main ; L1 réglera ce point.
- **Plusieurs comptes.** Aucune valeur personnelle codée en dur. Seuils et rythmes par défaut dans les guides, réglables par compte.
- **Notifications.** Il n'y a ni e-mail ni push aujourd'hui. Ne pas en ajouter sans décision : le plan de la semaine et les relances restent dans l'application.
- **Volume.** Vérifier les performances avec 1 000 offres (lot, réserve, archives) : calculs mémoïsés, pas de tri à chaque rendu inutile.
- **Accessibilité.**
  - Compteurs en `aria-live="polite"`, sans annoncer chaque `count-up`.
  - Moments plein cadre gérés comme des dialogues (piège de focus, `Échap`).
  - Cibles de 44 px sur mobile.
  - Citron jamais en texte.
- **Ton.** Vouvoiement, chaleureux et sobre. Pas de « Bravo !!! », pas de culpabilisation, pas de fausse urgence.
- **Guide de prise en main.** Le mettre à jour à chaque lot visible (lot du jour, réserve, séance, portée, semaine).
- **Production.** L'archivage à 21 jours (#206) et les nouveaux écrans changent l'expérience des vrais comptes. Le prévenir dans la note de version et attendre la validation explicite.

## 8. Définition de « terminé » pour chaque lot

- [ ] Logique pure dans `lib/`, avec des tests `node --test` pour les règles et les cas limites.
- [ ] États listés au §4 tous rendus : vide, chargement, erreur, partiel, terminé, mouvement réduit, mobile.
- [ ] `npm test` (hors test connu) et `npx tsc --noEmit --incremental false` au vert ; ESLint sans nouvelle erreur.
- [ ] Captures ordinateur (1360 px) et mobile (iPhone 13), clavier et focus visibles, console sans erreur.
- [ ] `CHANGELOG.md` et guide du lot mis à jour, écarts assumés écrits.
- [ ] Déployé sur le staging privé et vérifié. Production seulement après validation explicite de l'utilisatrice.
