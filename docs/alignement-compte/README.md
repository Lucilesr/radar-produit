# Mon compte — grille avant code

Existant : staging 109, main après #267. Pas de maquette dédiée au compte : les références ci-dessous servent uniquement pour les composants, les espacements et les règles Signal. Le contenu et les comportements du compte restent conservés.

| Format | Avant | Référence commune |
| --- | --- | --- |
| 1360 px | ![Avant](avant-ordinateur.jpg) | ![Référence](reference-ordinateur.jpg) |
| 390 px | ![Avant](avant-mobile.jpg) | ![Référence](reference-mobile.jpg) |

1. [ ] Même colonne pour titre et contenu, titre 40 px au plus / 28 px mobile ; en-tête mobile blanc avec compte, sans marque et recherche redondantes. Quatre entrées basses de 52 px, libellés cohérents.
2. [ ] Cartes de confort, journal et connexion en surface blanche, rayon 16 et espacements communs ; titres de section en h2, sans saut de hiérarchie. Aucun fond sombre ajouté.
3. [ ] Boutons et champs 10, informations et cases de 44 px, filtres en pastilles 999, focus visible ; mêmes couleurs et désactivations Signal. Avertissement irréversible maintenu visible.
4. [ ] Journal replié, lecture, vide / filtre vide, données et pagination, texte long, erreur et reprise : mêmes contrôles, surfaces et densité. Ne modifier ni calcul, ni filtres, ni historique.
5. [ ] Préférences : conserver leur enregistrement explicite à chaque case, le dernier état confirmé en cas d’erreur, la reprise et le mouvement réduit. Tester les choix sur un compte fictif dédié puis les restaurer.
6. [ ] Connexion, export et suppression : garder les parcours existants, vérifier les contrôles accessibles et le dialogue sans soumettre de suppression ni restauration. La démo cache volontairement les actions de données du compte connecté. Aucune identité ou donnée personnelle dans les preuves publiques.
7. [ ] Captures avant / après et références sur ordinateur / mobile, clavier et focus, 44 px, console vide, aides ≤ 120 mots, données fictives intactes, tests / types verts et aucune nouvelle erreur ESLint ; guide, changelog, plan, staging privé et fusion.

## Choix avant code

- Les avertissements de suppression restent visibles même s’ils occupent plusieurs lignes : le caractère irréversible ne doit pas être dissimulé dans une information.
- Les réglages de confort gardent leur comportement immédiat, distinct du niveau visé validé avec Terminé.
- La démo garde ses protections et son identité fictive ; le dialogue de suppression ne sera jamais soumis pendant cette recette.
