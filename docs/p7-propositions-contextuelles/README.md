# Recette P7 — propositions contextuelles

Staging privé, données entièrement fictives : 1 000 offres et 50 candidatures. Captures avant/après à 1 360 × 900 et 390 × 844. Les premiers contrôles viennent des versions 69 et 70 ; la version finale 71 conserve les contrôles Signal et remplace les erreurs de transport par le message français commun de Radar.

- Lot avec des offres Senior : question du niveau, quatre choix explicites. « Peu importe » enregistré après un clic, visible en jeton. Dans l’éditeur, sélectionner Senior ne modifie pas le compte avant « Terminé » : lecture du compte à l’appui, puis jeton Senior confirmé.
- Entretien fictif planifié : Entrée ouvre Prioriser dans le carnet. « Plus tard » confirmé reste appliqué après rechargement.
- Refus fictif : bilan privé validé, proposition d’histoire dans la candidature et Mes leçons. Le carnet s’ouvre avec trois champs vides ; aucun texte de bilan n’y est recopié. Report confirmé et conservé après rechargement.
- Expérience Atelier Horizon fictive : report des termes conservé pour cette expérience ; l’autre expérience peut garder ses propres propositions. Échéance relue dans le compte, sans masquer les termes déjà confirmés.
- Lot de vingt offres terminé : dix-neuf décisions fictives préparées par l’API gardée, dernière décision par l’interface mobile. Proposition Mon site, jamais visitée ; ouverture des réglages sans visite ni transmission externe, puis report confirmé après rechargement. Les vingt offres sont remises à examiner après la recette. Le cas « 9 jours sans visite » et la limite de sept jours sont vérifiés par les tests purs.
- Aide au clavier, retour du focus après repli, mouvement réduit, cibles 44 × 44 px au minimum, aucun débordement à 390 px et console nominale sans erreur sur le staging.
- `local-erreur-report-mobile.jpg` et `local-reprise-report-mobile.jpg` proviennent uniquement de la prévisualisation locale : connexion coupée, erreur française, proposition conservée, puis nouvel essai confirmé au retour de la connexion. Aucune panne n’a été provoquée sur le staging.

Aide visible sans clic : 0 mot supplémentaire pour les cartes de proposition. Les textes comptés en P8 restent identiques : Offres 8 mots, Candidatures 4, carnet replié 36, Ma recherche 35 (64 en édition complète) et dossier avec préparation/relance 44. La fiche avec bilan validé remplace l’invitation au bilan par son contenu privé, sans ajouter d’explication. Le message de transport ajoute 11 mots dans l’état d’erreur local. Les titres, choix et faits du compte restent du contenu métier ; les précisions de report sont derrière ⓘ. Chaque écran reste sous 120 mots.

Composants réutilisés : WorkspaceButton, WorkspaceFormError, HelpTooltip et boutons de choix Signal. Vérifications : 407 tests réussis, TypeScript sans erreur ; ESLint 33 erreurs préexistantes restantes contre 35 avant ce lot, aucune nouvelle. Aucune migration, aucun déploiement de production.
