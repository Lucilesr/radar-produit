# C4 — Candidatures mobile : grille préalable

Avant : staging 101, captures de la recette #265, donc même code que main au début de ce lot. À 390 px, Candidatures-mobile.html fait foi. Les décisions C1–C5 restent prioritaires.

| Format | Avant | Maquette |
| --- | --- | --- |
| 390 px | ![Avant](avant-mobile.jpg) | ![Maquette](maquette-mobile.jpg) |
| 1360 px | ![Avant](avant-ordinateur.jpg) | ![Maquette](maquette-ordinateur.jpg) |

1. [ ] En-tête blanc compact, titre 28 px et ajout en bouton + de 44 px ; retirer marque et recherche redondantes au-dessus. Garder les quatre entrées du bas, 52 px, libellés de la maquette.
2. [ ] Liste compacte : À envoyer, relances dues, entretiens et attente ; préserver les vraies propositions et les colonnes personnelles. Deux cartes par groupe puis « + N autres ». Aucun statut ni ordre stocké réécrit par cette projection.
3. [ ] Cartes 16 px, titre / entreprise lisibles, quatre repères réels pour la préparation ; une carte ouvre le dossier. Relancer / Reporter utilisent le dossier et son choix de date, sans envoi ni report automatique.
4. [ ] Outils dans « … » : tags et ajout de colonne. Changer d’étape reste disponible, avec motif pour clore. Échec : dernier état conservé, bouton de reprise et focus explicite après confirmation.
5. [ ] Fiche plein écran avec « ← Candidatures » ; prochaine action, quatre repères, dates et notes, composants existants. Reporter ouvre le réglage de date existant. Les autres rubriques du dossier restent accessibles.
6. [ ] C1 : pas de nouveaux filtres Toutes / Terminées ; terminées repliées en bas, Mes leçons en lien et entonnoir compact avec ⓘ. Adapter le rythme et les aides, cibles 44 px et pas de débordement.
7. [ ] États de la bande et régression : vide, seuil, refus facultatif, bilan enregistré, déplacement échoué / reprise, cinquante candidatures, textes longs, clavier et mouvement réduit. Captures avant / après / maquette dans les deux formats ; aucune annotation affichée.
8. [ ] Tests et types verts, aucune nouvelle erreur ESLint, console vide, données conservées, guide / changelog / plan et staging privé à jour.

## Choix avant code

- Les puces « À faire / Toutes / Terminées » de la maquette ne réintroduisent pas les filtres expressément retirés par C1. Tous les groupes sont accessibles dans une seule liste, et les terminées restent repliées.
- Les groupes urgents sont une présentation des faits ; les colonnes personnelles et les propositions reçues gardent leur sens. Le modèle n’est pas transformé pour reprendre les exemples chiffrés de la maquette.
- Ajouter mène aux offres, comme sur ordinateur. Reporter ne choisit aucune date à la place de la personne : il ouvre le réglage existant. Les rubriques du dossier restent accessibles, tout en donnant priorité à l’action et aux quatre repères.
