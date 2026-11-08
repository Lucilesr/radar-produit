# Recette P6 — accueil en trois blocs

Staging privé, version 68, données entièrement fictives : 1 000 offres et 50 candidatures. Captures avant/après à 1 360 × 900 et 390 × 844. La date du récit mensuel est explicitement simulée dans le bandeau démo.

- Exactement trois sections : Votre séance, Votre semaine, Le radar. Une étape principale et deux pistes facultatives issues de P4.
- Plan fictif enregistré : compteur 2 engagements sur 3, puis 3 sur 3 ; célébration et repli « ✓ Semaine tenue ». Une semaine tenue réelle dans ce compte de test, conservée après rechargement. Aucun joker inventé.
- Radar : 889 offres à examiner après rechargement, tendance calculée de 0,7 entretien par mois ; le récit d’octobre s’ouvre à la demande et Échap rend le focus au lien.
- Aides au toucher et au clavier, ouverture du plan par Entrée, mouvement réduit, aucun débordement horizontal et aucune erreur console en usage nominal.
- `local-erreur-mobile.jpg` documente une perte de connexion provoquée uniquement sur la prévisualisation locale de démonstration : erreur lisible et derniers nombres conservés. Aucune panne n’a été provoquée sur le staging.
- Aide visible : 18 mots au plus sur l’accueil sans clic, moins de 120 ; les précisions restent derrière les boutons d’information.

Composants réutilisés : WorkspacePanelHeader, WorkspaceButton, HelpTooltip, SignalRadar, SignalProgress et SignalMoment. Les captures de progression intermédiaire viennent de la version 67 ; la version 68 corrige uniquement l’accord du compteur au singulier.

Vérifications : 400 tests réussis, TypeScript sans erreur, aucune nouvelle erreur ESLint par rapport aux 35 erreurs préexistantes. Aucune migration. Production inchangée.
