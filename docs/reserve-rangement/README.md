# Recette de la réserve — staging privé

Recette nominale38, source `e6779c399cddcdb3b503414ebe257ab8c69aa5e8`. Données fictives uniquement ; captures JPEG sans retouche.

- Ordinateur1360px :13offres,4groupes. Archiver demande confirmation. Trois anciennes offres passent aux archives, réserve13→10, compteur1/4et3enmoins, Archives3 ; Annuler restaure13offres et0/4. Captures `staging-groupes-ordinateur.jpg`, `staging-archives-annuler-ordinateur.jpg`.
- +Viser Growth PM ajoute le poste lu dans le groupe, après clic explicite et relecture du profil. L’action disparaît ; Annuler rétablit les anciens rôles et rend de nouveau la proposition disponible. Aucun autre critère touché.
- Mobile390px : Garder en réserve déplace les3annonces sans rémunération dans Plus tard. Le compteur indique1/4et0enmoins, car elles restent dans la réserve. Annuler les replace dans leur groupe. Capture `staging-garder-mobile.jpg`.
- Mobile : Écarter demande confirmation ; deux boutons44px, confirmation par Espace, compteur1/4et3enmoins, puis Annuler0/4. Focus au titre quand l’action disparaît ; aucun débordement ni erreur/avertissement de console nominale. Capture `staging-confirmer-mobile.jpg`.

326tests et TypeScript réussis, aucune nouvelle erreur ESLint. Tests SQLite couvrant atomisation, isolation et annulations concurrentes. Aucun déploiement de production.

Reprise corrigée sur version39, source `377fa24022e45da2c642d91b7a3d6e235c596716` : une offre du groupe est restaurée depuis un second accès. Annuler répond409 et ne restaure pas partiellement les deux autres ; Actualiser relit les états et recommence les compteurs, sans bouton d’annulation périmé. Le409 du scénario volontaire est attendu ; le parcours nominal reste sans erreur de console.

Captures de l’erreur volontaire et de sa reprise : `staging-conflit-mobile.jpg`, `staging-reprise-mobile.jpg`. La réserve relue contient11offres (un membre restauré sur trois, deux toujours en Corbeille), puis les seules données de ce test sont restaurées pour les recettes suivantes.
