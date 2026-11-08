# Carnet détaillé — grille avant code

Existant : staging 111, main après #268. Pas de maquette dédiée à ces sous-vues : les références communes servent pour la colonne, les surfaces, les titres et les contrôles. Le carnet, les droits et les fichiers restent inchangés.

| Format | Avant | Référence Signal |
| --- | --- | --- |
| 1360 px | ![Avant](avant-ordinateur.jpg) | ![Référence](reference-ordinateur.jpg) |
| 390 px | ![Avant](avant-mobile.jpg) | ![Référence](reference-mobile.jpg) |

1. [ ] Retour « ← Mon radar », titre de la sous-vue et contenu sur la même colonne. Une seule navigation de sous-vues : Carnet, Mes histoires, Documents, Mes mois. Retirer les doublons et le raccourci de balayage hors contexte ; l’actualisation des offres reste disponible dans Mon radar. En-tête mobile 28 px, compte, quatre entrées basses 52 px.
2. [ ] Carnet : titres 24 / 20 pour les sections, surfaces 16, cartes et contrôles 10 / 999, grands panneaux / dialogues 20. Aide visible courte, détail dans ⓘ. États du carnet : lecture, vide, filtré, validé / à relire, ouvert, texte long, ajout / modification, erreur et reprise.
3. [ ] Droits, consentement et confirmation de masquage : mêmes décisions et limites, contrôles tactiles, focus et retour. Remplacer le sélecteur natif de doublon par ChoiceSelect existant. Ne modifier aucun droit du compte principal.
4. [ ] Histoires : lecture et état de thèmes, éditeur Signal, mouvement réduit et clavier. Ne modifier ni les huit thèmes ni leur validation.
5. [ ] Documents : mêmes fichiers / choix d’import, cartes et boutons alignés ; vide, liés et erreur. Mes mois : archive lisible et état vide ; récit plein écran conservé. Aucun transfert, suppression ni écrasement des fichiers pour cette recette.
6. [ ] Captures avant / après et références à 1360 / 390 px ; clavier, focus, cibles de 44 px, aucune nouvelle erreur ESLint, tests / types verts, console vide et données fictives identiques. Guide, changelog, plan et staging privé vérifiés, puis fusion.

Les avertissements de consentement et masquage restent visibles. Les éditeurs, sauvegardes, documents de référence et adresses existantes sont réutilisés. Les annotations des maquettes restent documentaires.
