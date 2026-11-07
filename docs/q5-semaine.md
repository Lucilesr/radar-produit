# Q5 — Plan de semaine

`lib/week-plan.ts` porte les semaines ISO selon un fuseau IANA, les rythmes 2/3/4, les six actions fermées, la validation des horaires dans la semaine, le report et la conservation des coches. Aucune série ni joker avant L1/L2. La maquette Semaine est appliquée sur ces choix, sans son badge anticipé. Le plan est facultatif, avec engagements personnels possibles quand la cible ne figure pas dans le radar.

Stockage en ajout de clés JSON dans `profiles.data` : `weekPlan`, `weekPlanRevision` et `weekPlans`. Aucune migration. Le passage à un nouveau plan archive le précédent sans doublon ni effacement. La sauvegarde intégrale conserve le JSON entier ; son test A/B vérifie explicitement le plan, les coches et l’historique. Un endpoint authentifié, de même origine, écrit seulement ces clés avec comparaison de la version et du document lu. Une sauvegarde générale du profil conserve atomiquement les clés du plan courant. L’état coché n’est jamais accepté du formulaire ; le serveur date les confirmations. Déplacer conserve une coche ; changer action, cible ou libellé l’efface.

Le brouillon `week-plan:<semaine>` réutilise la sauvegarde de texte privée du compte. Un conflit ne remplace pas sa saisie : le plan enregistré peut être comparé, puis une sauvegarde explicitement confirmée utilise sa version. Le compteur ne devance pas l’API. Les écritures bloquent une fin de séance jusqu’à confirmation et le bilan Q3 indique l’état du plan. Les anciennes semaines restent disponibles pour L2.

Signal réutilisé : WorkspacePanelHeader/Button/FormError, ChoiceSelect (sélecteur bureau et tiroir mobile), DateTimePicker, AutosaveStatus, SignalProgress et SignalMoment Radix. Aucune notification externe, aucun tiers, aucune nouvelle police ni couleur. Les dates sont neutres « À replanifier ». Le premier moment de la semaine attend la fin du guide, d’un dialogue, d’une séance ou d’un balayage ; fermer le moment laisse un rappel compact. Aucun plan n’est proposé au-dessus de la configuration d’un compte neuf.

## Vérifications

Tests purs : semaines à cheval sur l’année, fuseaux proches du lundi, changement d’heure, dates invalides/hors semaine, rythmes incomplets, actions inconnues, aucune coche fabriquée, report et changement de cible, semaine tenue non vide, archivage sans doublon. SQLite : conservation des autres clés du profil, réessais idempotents, conflit de version, isolation A/B, ancien formulaire de profil inoffensif pour les coches, historique lors du changement de semaine, refus de cocher une semaine révolue. Contrôles et recette staging ajoutés après déploiement.

La recette mobile a révélé que Radix pouvait notifier une valeur vide lors du changement simultané de l’action et des options de cible. ChoiceSelect ignore désormais les notifications sans préfixe ni option valide : une suggestion conserve sa cible, son libellé et l’horaire. Vérification locale d’une suggestion passant d’une candidature à une histoire, puis sauvegarde réelle.
