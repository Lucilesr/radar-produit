# Itération 2 — moins, mais mieux

Constat au 8 novembre 2026 : tous les lots de gamification sont livrés, mais chaque brique propose sa propre tâche, son propre compteur et son propre texte d'aide. Radar demande trop, au mauvais moment et dans le désordre.

Cette itération **n'ajoute aucune fonction**. Elle range, raccourcit et relie. Les règles de `AGENTS.md` s'appliquent : une PR par lot, staging avant production, vérification sur ordinateur et sur mobile.

## Règles (à respecter dans tous les lots)

1. **Une prochaine étape à la fois.** Un seul moteur (P4) décide laquelle ; aucun composant n'affiche sa propre invitation.
2. **Trois choses à faire au plus visibles par écran**, et un seul bouton principal par zone.
3. **Deux progressions seulement** :
   - la boucle de la semaine : lot du jour, séance, semaine tenue ;
   - le réglage du radar : la portée.

   Le reste est de l'information, rangée.
4. **Ce qui est fait se replie** en une ligne « ✓ … ». On célèbre, puis on s'efface.
5. **Une ligne d'aide au plus** par bloc, le reste derrière ⓘ « En savoir plus » (infobulle accessible au clavier et au toucher).
6. **Le droit d'arrêter.** Quand la séance est finie : « C'est tout pour aujourd'hui. Le radar veille. » Aucun compteur rouge.
7. **Demander au bon moment** (P7), plutôt que dans une liste générale.

Mesure : aucun écran ne dépasse **120 mots** d'aide visibles sans clic.

## Décisions prises par l'utilisatrice

- Navigation en **4 espaces** : Aujourd'hui, Offres, Candidatures, Mon radar (P5).
- **Histoires d'entretien** : dans le carnet. Un rappel apparaît dans Candidatures quand un entretien est planifié.
- **Leçons** (bilans après refus) : dans Candidatures, avec un lien « En faire une histoire » vers le carnet.
- **Terme ignoré** : il reste ignoré, sauf s'il est restauré depuis une ligne repliée « Termes ignorés (N) ».

## Lots, dans l'ordre

### P1 — Termes du domaine : compacts, ignorables, au bon endroit (S)

**Aujourd'hui** : le panneau `components/domain-terms.tsx` prend la moitié de Ma recherche et repousse les sources vers le bas. Il affiche 8 propositions avec extraits et ne permet pas de dire « pas moi ».

- **Ignorer.** Nouvelle action `ignore` sur `POST /api/domain-terms`. La liste des termes ignorés est gardée dans `profiles.data.ignoredDomainTerms`, sans migration ; un terme ignoré n'est plus proposé. La ligne repliée « Termes ignorés (N) ▸ » permet de restaurer chaque terme.
- **Puces.** Chaque proposition devient une puce : libellé, ✓ « Confirmer » et × « Ignorer ». L'extrait n'est visible que dans ⓘ « Où l'avez-vous écrit ? ». **Cinq propositions visibles au plus** ; quand on en traite une, la suivante prend sa place, et une mention indique « + N autres ».
- **Dans le carnet.** Après la validation d'une expérience (avec ses droits d'usage), une ligne apparaît sous l'expérience : « Radar a repéré N termes : A · B · C. » Elle propose « Tout ajouter », « Choisir » (ouvre les puces) et « Plus tard ».
- **Dans Mon radar / Ce que je cherche.** Les termes confirmés deviennent une ligne de puces dans le panneau Critères (« Domaine : Paiements · SEPA · SCA + 2 »). Les propositions en attente tiennent en une ligne repliée : « N termes repérés dans votre carnet · Voir ». Le grand panneau disparaît.
- **Textes.** Un seul ⓘ : « Rien n'est utilisé sans votre accord. Rien n'est envoyé à un service tiers. Retirer un terme ne modifie pas votre carnet. »
- **Tests** : ignorer puis restaurer ; un terme ignoré n'est jamais proposé ; 5 propositions au plus ; « Tout ajouter » respecte la limite de 40.

### P2 — Portée du radar : des réglages, pas des crans (S)

**Aujourd'hui** : la liste « Vos dix crans » donne des points abstraits.

- Le mot « cran » disparaît partout. Le titre devient « Votre radar est réglé à N sur 10 ». La barre `SignalProgress` est **segmentée en 4 paliers** : Repérage, Balayage, Longue portée, Précision.
- **Six réglages en trois groupes.** Chaque réglage dit ce qu'il change, sans valeur en points :

  | Groupe | Réglage | Ce que ça change |
  | --- | --- | --- |
  | Ce que vous cherchez | Critères | « Radar trie vos offres » |
  | Ce que vous cherchez | Niveau visé | « Radar repère les postes trop seniors » |
  | Où chercher | Trois sources | « Plus d'offres, sans doublons » |
  | Où chercher | Une source manuelle visitée | « Les offres que les agrégateurs ratent » |
  | Ce que vous savez faire | Deux expériences validées | « Le score lit vos domaines » |
  | Ce que vous savez faire | Quatre histoires | « Vos entretiens se préparent » |

- Les réglages faits se replient en « ✓ N réglages faits ▸ ». **Seul le prochain reste ouvert**, avec son bouton et sa durée. Ce prochain réglage vient de P4.
- Les 8 thèmes d'histoires **quittent la portée** pour le carnet (« Mes histoires »). La portée affiche seulement « N histoires sur 8 · Continuer ».
- Le calcul de `lib/radar-reach.ts` ne change pas, seulement la présentation. Les tests existants restent verts ; ajouter un test sur les libellés.

### P3 — Journal d'activité : replié, groupé par jour (S)

- Le journal passe dans **Mon compte**, lui-même déplacé dans le menu de l'avatar (P5). Avant P5, il reste où il est, mais **fermé par défaut** : « Journal d'activité · N actions cette semaine ▸ ».
- **Une ligne résumé par jour**, ouvrable : « Aujourd'hui · 9 offres triées · 1 relance · 1 histoire ▸ ».
- **Une action par ligne** quand on déplie : « 10:42 · Sélectionnée · PO Paiements, Néobanque ». Pas de description.
- **Filtres en puces** : Tout, Tri, Candidatures, Profil, Semaine.
- **« Afficher 20 de plus »** remplace la pagination « plus récentes » / « plus anciennes ».
- **Accessibilité** : chaque jour est un `<details>` ou un bouton avec `aria-expanded`, et le focus est conservé quand on déplie.

### P8 — Passe d'écriture (S)

- **Glossaire** dans `docs/glossaire.md`. Il est ensuite appliqué partout :
  - **offre** (pas « opportunité ») ;
  - **critères** ;
  - **carnet** ;
  - **réglage** (pas « cran ») ;
  - **palier** ;
  - **séance** ;
  - **lot du jour** ;
  - **réserve**.
- **Une ligne d'aide au plus** par bloc, le reste en ⓘ. Supprimer les explications répétées, par exemple « vos éléments déjà validés comptent » ou « sans modifier vos données ».
- **Vérification** : compter les mots d'aide visibles par écran, au plus 120, et lister le résultat dans la PR.

### P4 — Un seul moteur de « prochaine étape » (M)

- Une fonction pure `lib/next-steps.ts` renvoie une file triée d'étapes `{ id, kind, label, minutes, action }`. Ordre de priorité :
  1. Entretien dans les 48 h : préparer l'histoire qui va avec.
  2. Relances arrivées à échéance.
  3. Lot du jour à trier.
  4. Lundi, ou plan absent : poser le plan de la semaine.
  5. Candidature sélectionnée pas encore soignée.
  6. Prochain réglage du radar.
  7. Source manuelle non visitée depuis 7 jours.
- **Qui la lit** : l'accueil, la séance (`radar-session`), la portée, le plan de la semaine et la candidature soignée. Chaque module supprime son invitation propre.
- **Tests** : ordre, cas vides, entretien prioritaire, aucune étape en double.

### P6 — Accueil en trois blocs (S, après P4)

1. **Votre séance** : la première étape de P4 en grand, avec sa durée et « Commencer ». Les deux étapes suivantes apparaissent en petit dessous.
2. **Votre semaine** : plan et série dans une seule carte, par exemple « 2 engagements sur 3 · 4 semaines tenues ».
3. **Le radar** : dernière actualisation, nouvelles offres, et l'entonnoir en une ligne s'il est disponible.

La portée compacte, l'entonnoir détaillé et les trois compteurs quittent l'accueil. Quand tout est fait : « C'est tout pour aujourd'hui. Le radar veille. » L'entretien imminent reste en premier, comme avant.

### P7 — Demander au bon moment (M, après P4)

| Moment | Ce que Radar propose, en ligne ou en carte discrète |
| --- | --- |
| Validation d'une expérience | Termes repérés (P1) |
| Première offre Lead ou Senior dans le lot, niveau visé vide | « Quel niveau visez-vous ? » Choix : Confirmé, Senior, Lead, Peu importe. Le réglage est enregistré seulement après un clic |
| Entretien planifié | « Préparez l'histoire qui va avec · 5 min » (ouvre le carnet sur le thème) |
| Lot du jour bouclé | « Faites le tour de [source manuelle], N jours sans visite » |
| Bilan après refus enregistré | « En faire une histoire ? » (ouvre le carnet) |

Chaque proposition a un bouton « Plus tard ». Il la masque pendant 7 jours, ce qui est gardé dans `profiles.data`.

### P5 — Quatre espaces (M, en dernier)

| Aujourd'hui | Offres | Candidatures | Mon radar |
| --- | --- | --- | --- |
| Accueil en 3 blocs (P6) | Lot du jour, réserve, archives, corbeille | Kanban, relances, entonnoir, leçons, rappel d'histoire avant entretien | En-tête Portée (P2), puis **Ce que je cherche** (critères, termes, niveau), **Où chercher** (sources), **Ce que je sais faire** (carnet, histoires, documents) |

- **Mon compte** passe dans le menu de l'avatar : données, sauvegarde, journal (P3), suppression.
- **Anciennes URL** (`tab=profile`, `tab=sources`, `section=…`) : redirection vers la bonne section de Mon radar ou du compte, testée dans `lib/radar-navigation.ts`.
- **Mobile** : 4 entrées en barre du bas.
- **À mettre à jour** : le tour de prise en main et le guide.
- **Captures avant et après** de chaque espace.

## Définition de « terminé »

La même que dans `docs/feuille-de-route.md` §8, plus deux règles :

- les captures avant et après sont jointes à la PR ;
- le nombre de mots d'aide visibles par écran est vérifié.
