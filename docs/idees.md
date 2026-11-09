# Idées hors grille

Toute nouvelle proposition est consignée ici avant une éventuelle décision ; elle ne déclenche pas de code.

## Retours de recette du 9 novembre 2026

- **Enregistrements qui bloquent l’interface.** Quand un choix s’enregistre (par exemple une case de la check-list dans « Préparer / brief »), le reste du formulaire est désactivé jusqu’à la réponse, ce qui gêne les modifications rapprochées. Piste : enregistrer en arrière-plan, garder les autres contrôles actifs et n’afficher l’attente que sur l’élément concerné.
- **Résumé du prompt ChatGPT.** Le contenu du prompt est affiché tel quel et se lit mal. Piste : un résumé en tête — ce que le prompt va produire et sur quelles expériences, histoires et documents il s’appuie — avec le texte complet repliable en dessous.
- **Couleur du score dans Offres.** Le style est apprécié mais manque de couleur. Piste : teinter le score selon l’adéquation, du rouge (loin) au vert (très proche), avec un libellé ou une forme en plus de la couleur.
- **Vert positif dans « Pourquoi elle remonte ».** Piste : passer en vert succès les ✓ qui servent de puces, pour signaler le positif.

## Dette CSS signalée après #271

- Réintégrer `signal-coherence.css` dans les fichiers d’origine ; relier aux variables les rayons encore écrits en dur (10, 16, 999 px) et les couleurs de survol ; ajouter un test qui refuse les rayons en dur dans `app/*.css` ; retirer les styles `.application-funnel-summary` devenus inutiles après la bascule Kanban / Entonnoir.
