# Mon radar — grille préalable

Avant : staging 104, main après #266. Références MonRadar.html et MonRadar-mobile.html ; à 390 px la version mobile fait foi. Les décisions D1–D4 priment sur les exemples de la maquette.

| Format | Avant | Maquette |
| --- | --- | --- |
| 1360 px | ![Avant](avant-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |
| 390 px | ![Avant](avant-mobile.jpg) | ![Maquette](maquette-mobile.jpg) |

1. [ ] D1 : portée sombre, titre « Votre radar est réglé à N sur 10 », quatre paliers, prochain réglage et bouton principal ; détail des réglages faits replié. 0 : champ du poste dans l’en-tête ; 10 : précision atteinte sans prochain réglage. Lecture partielle : faits sûrs, aucun réglage proposé et reprise.
2. [ ] D1 : radar fixe, sans balayage ni pulsation, avec les échos du dernier résultat confirmé ; clic vers le bilan. Conserver ce résultat dans la session du compte pour le retour et le rechargement. Sans résultat confirmé : radar vide et bilan indisponible expliqué, jamais d’échos inventés.
3. [ ] D2 : actualisation secondaire. Un seul bouton principal dans la zone de portée : prochain réglage. Conserver l’actualisation silencieuse à l’ouverture.
4. [ ] Structure : trois sections visibles sur ordinateur, pastilles vers leurs titres ; accordéon unique sur mobile, conservé au retour. En-tête blanc, compte, titre 28 px et navigation basse 52 px à 390 px. Les écrans détaillés restent accessibles par des liens explicites et les anciennes adresses.
5. [ ] Critères résumés par lignes poste / niveau / présence / contrats et rémunération, puis termes en puces ; éditeurs existants accessibles. D3 : Pistes et Score Jobgether retirés des jetons, conservés dans Tout modifier. D4 : domaine vide aligné à gauche, « Aucun terme confirmé · Ouvrir mon carnet », vrai lien.
6. [ ] Où chercher : trois sources puis dépliage, barres et chiffres alignés, pauses repliées, visites limitées et source nommée ; accès aux détails / ajout. Les barres décrivent les offres présentes si aucun historique fiable sur sept jours n’existe ; pas de statistique inventée.
7. [ ] Ce que je sais faire : cartes Carnet / Histoires / Documents, chiffres réels, liens vers les détails ; Mes mois reste accessible. Préserver carnet, validations, thèmes, documents et critères.
8. [ ] États de la bande : compte neuf, portée 10, termes ignorés et restauration, propositions après expérience, lecture partielle ; états ouverts / repliés, clavier, focus, mouvement réduit et textes longs. Aucune annotation rendue. Captures avant / après / maquettes dans les deux formats.
9. [ ] Tests / types verts, aucune nouvelle erreur ESLint, console vide, cibles 44 px, aide ≤ 120 mots, données fictives intactes, guide / changelog / plan à jour, staging privé vérifié et fusion.

## Choix avant code

- Le fond sombre de Portée est explicitement demandé (D1). Le radar n’est pas animé et ne simule aucun résultat.
- La page devient un aperçu à trois sections ; les réglages complets, les sources détaillées et le carnet restent des sous-vues. Les liens existants continuent à ouvrir leur destination.
- Le compte neuf mobile garde les trois accordéons fermés, conformément à sa maquette ; le champ du poste reste immédiatement disponible dans l’en-tête.
- Les statistiques de sources indiquent leur période réellement disponible. Les résultats de balayage restent locaux à la session et isolés par compte ; aucun changement de format des données enregistrées.
