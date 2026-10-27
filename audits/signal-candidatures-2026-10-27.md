# Signal — Ma candidature et les entretiens

Le lot repart de `main` après fusion de la MEP #28. Copie de travail et base D1 locales isolées, données fictives uniquement ; aucune modification de l’instance privée ni de ses changements en cours. La nouvelle MEP regroupe des PR ciblées, puis peut être fusionnée sur `main` après vérification selon l’autorisation donnée par l’utilisateur.

## Ma candidature

- Liste continue, séparateurs et fond partagés avec Opportunités ; initiales décoratives supprimées. Les colonnes gardent leurs données et les cartes mobiles leurs libellés.
- Dates et tags utilisent la même police et le même centrage ; ancienneté existante conservée (14 puis 30 jours), affichée en warning.
- Dossier de 870 px, lien d’annonce dans l’en-tête, fermeture par la croix ; suppression du pied de fiche redondant. Une offre en corbeille reste restaurable depuis l’en-tête et son suivi reste accessible.
- Statut enregistré au choix, huit statuts courants regroupés en Candidature / Échanges / Clôture. Les statuts historiques restent affichables quand ils sont présents.
- Notes : gras, italique et listes, même action Enregistrer la note, sans texte d’aide répétitif ni état vide de sauvegarde. Les marqueurs comptent dans la limite de 2 000 caractères.
- La proposition reçue ouvre Ma candidature et place le focus dans les notes, y compris si un ancien entretien à venir est encore présent.
- Fournisseur unique de notifications, même composant pour les actions du dossier ; la boucle de focus de la modale inclut leurs boutons.

### Vérifications effectuées

Le gras et une liste ont été saisis par les commandes de l’éditeur puis enregistrés par l’API réelle. Après changement d’onglet et fermeture/réouverture du dossier, les éléments forts et la liste sont conservés. Une note de 2 001 caractères reste intégralement visible, indique l’erreur et désactive Enregistrer. Une sauvegarde suivante produit une seule notification, en haut à droite. Le dossier mesure 870 px sur le bureau de recette.

Une candidature fictive avec un entretien futur a été passée à Proposition reçue. Son bouton Ouvrir mène à Ma candidature, avec le focus sur Notes privées de candidature. Aucun CTA Corbeille ni deuxième fermeture ne subsiste en bas du dossier.

## Limites

API, champs texte, longueurs maximales, autorisations et transitions serveur conservés. Le format des notes est limité aux emphases et listes, sans HTML stocké ni nouvelle dépendance. Les commandes natives d’édition sont vérifiées dans Chromium ; Safari et Firefox nécessitent une recette dédiée. Les erreurs de lint héritées sont relevées séparément ; les nouveaux composants de notes, sauvegarde et notifications passent leur lint ciblé. Les essais locaux ne constituent pas une certification d’accessibilité.
