# Recette P5 — quatre espaces

Staging privé version 72, données entièrement fictives : 1 000 offres et 50 candidatures. Captures avant des six anciennes vues et après des quatre espaces, à 1 360 × 900 et 390 × 844. Aucune migration.

## Vérifications

- Quatre entrées : Aujourd’hui, Offres, Candidatures, Mon radar. Toutes les candidatures : cinquante lignes confirmées sur ordinateur et mobile. Lot de vingt offres et trois blocs d’accueil conservés.
- Mon radar : portée en en-tête, quatre paliers et six réglages accessibles ; critères, sources et carnet séparés. Histoires, documents et mois restent accessibles dans Ce que je sais faire.
- Le compte s’ouvre par le menu de l’avatar. Menu Signal, clavier, Échap et retour du focus confirmés ; cibles de 44 px, menu décalé du bord. Journal fermé par défaut. Aucun clic de déconnexion ni de suppression pendant la recette.
- Mes leçons se trouve dans Candidatures, avec le bilan fictif validé en P7. Le rappel d’entretien et ses reports restent conservés.
- Anciens liens testés sur le staging : profile=documents, stories, portee, lessons et account ; sources=channels et outreach ; section=documents seule ; lien d’entretien sans tab. Ils ouvrent la bonne section canonique. Paramètre utm conservé et Retour testé de Candidatures vers Documents.
- Sur mobile, choisir Lead dans l’éditeur puis changer d’espace sans Terminé laisse Senior enregistré. Le critère ne s’enregistre pas à l’affichage ou à la navigation.
- Tour en quatre étapes parcouru jusqu’à 4/4 et terminé sur le staging mobile. Les deux captures local-onboarding-carnet proviennent uniquement de la prévisualisation locale : compte de démarrage, poste enregistré, chemin sans CV, étape 7/7 et ajout manuel d’expérience disponible.
- Après déploiement : 1 000 offres, 50 candidatures, Senior, trois engagements cochés, quatre reports P7 et le même CV fictif. Les deux fichiers fictifs gardent leurs identifiants ; le troisième emplacement reste vide comme avant. Les notes, dates d’entretien et configuration de sources ne sont pas réinitialisées.
- Aucun débordement horizontal à 390 px ou 1 360 px ; mouvement réduit conservé, focus visible et aucune erreur console nominale. Les panneaux de Mon radar font partie du chargement initial pour éviter un morceau de page devenu indisponible après une mise à jour.

## Aide visible

Même méthode que P8 : les titres, commandes, valeurs et faits du compte ne sont pas de l’aide ; les infobulles fermées ne comptent pas. Les textes des panneaux réutilisés restent les mêmes, avec les nouvelles destinations dans les phrases de navigation.

| Vue | Mots d’aide ou majoration conservatrice |
| --- | ---: |
| Aujourd’hui | ≤ 18 |
| Offres, liste | 8 |
| Candidatures, liste | 4 |
| Mon radar, critères en jetons | ≤ 35, borne P8 de la recherche entière |
| Mon radar, édition avec tous les critères | ≤ 109, borne P8 avec les sources désormais cachées |
| Mon radar, sources | ≤ 35, borne P8 de la recherche entière |
| Carnet replié | 36 |
| Documents | ≤ 65 |
| Réglages tous dépliés | ≤ 33 |
| Mes leçons vides | ≤ 34 |
| Mois de recherche | ≤ 26 |
| Compte, avec avertissement réel et mention commune | ≤ 35 |

Le tour ajoute au plus 40 mots sur les trois premiers espaces, et onze au plus sur Mon radar. Le cas le plus large reste ainsi à 120 au plus ; l’édition des critères bénéficie aussi du retrait des explications de sources. Les avertissements irréversibles restent visibles.

## Contrôles

408 tests réussis ; npx tsc --noEmit --incremental false réussi. ESLint : 33 erreurs préexistantes, aucune nouvelle. Composants réutilisés : ReachCompact, ReachWorkspace, WorkspaceButton, onglets Signal, ProfileWorkspace, SourcePanel, AccountSettings et DropdownMenu. Production inchangée.

C4 est le lot suivant : liste mobile groupée par étape et en-tête de dossier très long. Les captures P5 conservent la liste mobile existante avant cette évolution. L6 suivra C4 sur la navigation en quatre espaces.
