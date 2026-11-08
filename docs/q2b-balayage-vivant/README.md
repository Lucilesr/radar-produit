# Q2b — grille d’écarts avant code

Références : [ordinateur](../maquettes/iteration-2/Balayage-v2.html) et [mobile faisant foi à 390 px](../maquettes/iteration-2/Balayage-mobile.html), #257, #259 et #260 fusionnées. Les annotations ne sont pas affichées : les trois rendus se remplacent. Existant : staging privé version 80, données fictives. Grille arrêtée avant modification applicative.

| Format | Actuel | Maquette |
| --- | --- | --- |
| Ordinateur 1360 px | ![Avant](avant-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |
| Mobile 390 px | ![Avant mobile](avant-mobile.jpg) | ![Maquette mobile](maquette-mobile.jpg) |

1. [x] **Structure et colonne** : retour avant le titre sur ordinateur, retour/titre/Actualiser sur une ligne mobile, alignés sur le contenu ; bilan puis sources et visites, maximum 1120 px de contenu. Navigation latérale actuelle remplacée, sur Balayage seulement, par l’en-tête horizontal de la maquette ; mêmes quatre destinations et menu du compte. Sources et visites dans un cartouche commun sur ordinateur, deux cartouches sur mobile ; barre mobile Accueil/Offres/Suivi/Mon radar avec état actif discret.
2. [x] **Trois états** : moment pétrole pendant la lecture et avec nouvelles offres ; bilan calme clair sans nouveauté ; trois compteurs seulement dans le moment (parcourues / pour vous / nouvelles), doublons derrière ⓘ.
3. [x] **Radar** : balayage arrêté à la fin ; un écho persistant par offre unique correspondant aux critères, pulsation courte pour les nouvelles ; texte « Balayage terminé · N offres collent à vos critères » ; mouvement réduit statique.
4. [x] **Lecture progressive** : états attente / en cours / terminé / erreur par source, progression globale N sources sur M, résultats dès leur arrivée, reprise ciblée sans effacer les succès ; arrêt au plus à 60 s.
5. [x] **Barres** : tri décroissant par offres pour vous ; longueur relative aux offres parcourues ; segment citron pour les offres correspondant aux critères ; chiffres alignés, texte équivalent et lien « Voir ses offres » vers Offres filtrées exactement sur cette source.
6. [x] **Replis** : sources en pause ou non activées repliées ; trois visites au plus, ancienne visite d’abord, jamais visitées en premier ; « + N autres » ; bouton « Visiter » nommé dans son aria-label.
7. [x] **Jetons** : titres Bricolage ≤40/28 px, interlettrage ≥−0,01em ; rayons 20/16/10/999 ; espacements de la maquette ; un bouton principal par zone ; citron sans texte sur clair, corail absent hors célébration.
8. [x] **États de la bande** : toutes les sources en erreur avec Réessayer et conservation des données ; mouvement réduit ; mobile 390 px (radar 120 px au-dessus, trois compteurs, source nom/barre/chiffres) ; actualisation à l’ouverture silencieuse.
9. [x] **Accessibilité et preuves** : statuts de chaque source en aria-live polite, chiffres hors annonces ; clavier, focus, cibles mobiles 44 px ; aide ≤120 mots ; captures des états ; tests tri/repli/états, tests et types verts, aucune nouvelle erreur ESLint ni erreur console ; données fictives d’origine intactes.

## Choix explicites, comportement et accessibilité

- La maquette présente sept sources automatiques fictives ; le produit n’en prend en charge que deux. Le bilan montre uniquement les sources réellement lues, sans inventer de collecteur ni de compteurs.
- La maquette mobile dédiée fait foi à 390 px : titre 24 px, radar 120 px centré, compteurs en trois colonnes, sources et visites en blocs distincts. Les contrôles restent à 44 px pour l’accessibilité demandée.
- La maquette place six échos pour douze offres « pour vous ». La demande explicite impose un point par offre unique : le radar suit les identifiants réellement reçus.
- « N nouvelles » décrit les nouvelles fiches enregistrées ; le titre du moment précise les nouvelles correspondant aux critères. Pas de célébration si aucune nouvelle ne correspond.
- Le lien de retour revient à Mon radar ; le filtrage de source garde le lot quotidien intact et offre un effacement du filtre.
- Une visite ouvre le site sans la marquer automatiquement comme effectuée ; la confirmation existante « J’ai fait le tour » reste inchangée.
- Les lectures en cache n’inventent pas de parcours : mention « Lecture récente conservée », chiffres du parcours courant uniquement.

## Recette — staging privé version 84

Scénarios reproductibles : `/demo?scenario=scan` (nouveautés), `scan-empty` (sans nouveauté), `scan-partial` (reprise ciblée), `scan-error` (échec total), `scan-reduced` (mouvement réduit), `scan-auto` et `scan-auto-error` (ouverture silencieuse). Chaque lien crée un compte fictif indépendant. Les autres démonstrations gardent leur ouverture sans balayage automatique.

Les données principales du staging sont conservées. Les scénarios alternatifs sont lus depuis le même serveur de staging à travers un relais limité à la boucle locale, avec une session fictive distincte ; il ne modifie ni le site ni sa visibilité. Les captures n’incluent aucune donnée réelle. Les annotations restent uniquement dans la colonne Maquette.

| État | Ordinateur 1360 px | Mobile 390 px |
| --- | --- | --- |
| En cours | [Capture](apres-en-cours-ordinateur.jpg) | [Capture](apres-en-cours-mobile.jpg) |
| Nouvelles offres | [Capture](apres-nouvelles-ordinateur.jpg) | [Capture](apres-nouvelles-mobile.jpg) |
| Rien de nouveau | [Capture](apres-sans-nouveaute-ordinateur.jpg) | [Capture](apres-sans-nouveaute-mobile.jpg) |
| Une source en erreur | [Capture](apres-partiel-ordinateur.jpg) | [Capture](apres-partiel-mobile.jpg) |
| Toutes les sources en erreur | [Capture](apres-erreur-ordinateur.jpg) | [Capture](apres-erreur-mobile.jpg) |
| Mouvement réduit | [Capture](apres-mouvement-reduit-ordinateur.jpg) | [Capture](apres-mouvement-reduit-mobile.jpg) |
| Ouverture automatique silencieuse | [Capture](apres-ouverture-ordinateur.jpg) | [Capture](apres-ouverture-mobile.jpg) |
| Échec automatique silencieux | [Capture](apres-ouverture-erreur-ordinateur.jpg) | [Capture](apres-ouverture-erreur-mobile.jpg) |

### Validation finale

- Version 84 du staging privé, code `954e576979e132b8298a8e3a647637b4e0cdbbef` (la suite de la PR ajoute uniquement les preuves documentaires). Aucun changement de base, de fichiers ou de visibilité.
- `npm test` : 421 tests réussis ; `npx tsc --noEmit --incremental false` : réussi. ESLint complet : 33 erreurs déjà présentes, aucune nouvelle erreur par comparaison avec le relevé du lot précédent ; nouveaux modules sans erreur. Console vide sur les parcours finaux.
- Clavier : replis ouverts et fermés par Entrée, liens accessibles, focus ramené au titre après reprise ; cibles mobiles de 44 px, aucun débordement à 390 px. Mouvement réduit : échos sans animation. Au plus 45 mots dans les paragraphes visibles des états contrôlés.
- Deux sources parcourues séquentiellement : résultats affichés au fil de leur arrivée. Reprise de Jobgether seule après panne : le succès de We Work Remotely reste affiché. Un second balayage sans nouveauté garde les trois échos et passe au bilan clair.
- Les liens de source filtrent exactement les offres, persistent après rechargement et ne modifient pas le lot quotidien. Sept sources en pause repliées, trois visites visibles puis cinq autres ; jamais visitées avant les visites anciennes.
- L’actualisation automatique reste sur Aujourd’hui, sans ouvrir le bilan ni afficher d’erreur ; l’échec automatique ne prétend pas avoir trouvé zéro nouvelle offre.
- Les 1 000 offres fictives initiales, le profil, les deux fichiers, les 50 candidatures, les engagements et le lot verrouillé ont été comparés avant/après : inchangés. Seules les trois offres fictives du balayage ont été ajoutées. Les preuves brutes restent hors dépôt public.

[Comparaisons avant / après / maquette, pour chaque état et chaque format](comparaison.html). [Contrôle sur l’URL privée du staging](apres-staging-prive-ordinateur.jpg). Les bandeaux de démonstration identifient les comptes fictifs ; ils ne font pas partie des maquettes. Aucun bloc d’annotation n’est rendu dans l’application.
