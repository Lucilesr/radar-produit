# Signal — intégration du premier lot

Base : `main` public 6720fac. Source de travail isolée, données fictives créées par les routes de la vraie application, base D1 locale. L’instance privée, ses changements en cours et ses documents n’ont pas été modifiés ni copiés. Aucun déploiement.

## Découpage

1. Fondations, #25 : palette, tokens, contrôles et notification partagés.
2. Navigation, #26 : logo Orbite, retrait du bandeau redondant et même niveau de titre.
3. Opportunités : composition, critères, actions et confirmation de corbeille.

Ces PR ciblent la branche `codex/mep-signal-opportunites`. Seule une PR de MEP présente leur résultat vers `main`. Les lots suivants concernent la composition des candidatures et entretiens, le carnet, les documents, le tableau de bord et les autres formulaires.

## Parcours exercés dans le navigateur

- Sélectionner une offre : état citron et coche, offre maintenue ouverte dans la vue d’examen ; compteur et sélection mis à jour par le serveur.
- Notification avec lien de navigation disponible ; lien « Voir ma candidature » effectivement utilisé.
- « J’ai postulé » : statut `applied` persisté par la route existante, aucune modale imposée ; notification puis ouverture volontaire de Ma candidature, avec date du jour et statut Candidature envoyée.
- Écarter : motif requis, action rouge #BE263D avec texte blanc, Annuler blanc, fond flouté 7 px et arrière-plan inerte. Suppression récupérable puis restauration dans la corbeille vérifiées.
- Sélection de deux offres et confirmation groupée : une raison commune ; Annuler conserve les offres. Limite existante de 50 et filtrage de la sélection conservés.
- Édition d’une annonce, enregistrement et retour en lecture : texte modifié présent, notification de réussite. Préremplissage et champs existants conservés.
- Prompt ChatGPT : contenu chargé, bouton Copier le prompt disponible ; aucune connexion ChatGPT nécessaire. Le contenu du prompt n’est pas modifié dans ce lot.
- Filtre automatique « Correspondances Radar » toujours disponible et état actif affiché ; calcul de matching inchangé.
- À 1440×1000 : titre à y=44 px, début de description vers y=779 px pour l’offre de recette. Défilement réel du détail à 734,5 px, liste et page à 0 px.
- Liste, détail et recherche vide contrôlés à 900, 390 et 320 px ; aucun débordement horizontal constaté. L’état vide conserve exactement la marge du contenu : 24 px sur tablette, 16 px sur mobile.
- Vérification complémentaire dans un iframe local à largeur fixe : à 320 px, largeur interne du détail égale à sa largeur défilante. Le menu de motif mobile s’ouvre, sélectionne une option et revient à la confirmation ; Annuler la ferme.

Les mesures et captures sont conservées localement pour la revue et le portfolio. Le cadre de capture temporaire n’est pas suivi ni exporté dans le dépôt.

## Contrôles automatisés et limites

- 95 tests applicatifs réussis ; TypeScript et compilation Vinext réussis.
- Le lint global n’est pas vert : cinq erreurs hooks déjà présentes dans la base subsistent dans les anciens composants de dossier et d’application. Une comparaison des règles signalées avec 6720fac n’ajoute aucune erreur ; les nouveaux composants de notification et la liste Opportunités passent leur lint ciblé. Le défaut de ref du composant de notification a été corrigé avant livraison.
- Pas de modification de schéma, migration, endpoint, calcul de matching, permission ou payload métier. Les changements de flux sont limités aux décisions validées : conserver l’offre en lecture, accès unique à l’annonce, confirmation non intrusive de candidature et raccourcis de notification.
- Les critères, réserves, descriptions, dates et liens restent disponibles. Les dates et mentions secondaires sont placées en fin de lecture.
- Revue visuelle et tests locaux sur données fictives ; pas de certification WCAG, pas de recette sur l’instance privée, pas de mesure d’adoption. La suite de la plateforme reste à intégrer par lots.
