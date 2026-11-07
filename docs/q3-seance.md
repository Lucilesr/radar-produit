# Q3 — Séance du jour et bilan

L’accueil affiche la date, le nombre réel de Très proche dans le lot s’il y en a, la promesse de séance, le radar, puis les actions et compteurs existants. Un entretien dans les 24 heures ou un bilan urgent garde sa priorité au-dessus. Sans recherche, les trois étapes de configuration remplacent ces blocs. Une actualisation manuelle n’est jamais présentée comme une veille en arrière-plan.

La séance fige au plus quatre étapes non vides : lot, relances datées échues, source consultable active non visitée depuis plus de cinq jours, expérience ou histoire proposée dont le parent n’est pas masqué. Le pas-à-pas est un parcours, pas un score : Suivant permet de passer. Quitter reste accessible pendant le défilement, dans la fiche candidature et dans la feuille source. Le tour de prise en main s’efface pendant la séance.

Le bilan compare un instantané de décisions, visites et validations aux données confirmées. Une note modifiée, une restauration, une étape passée ou un simple changement d’onglet n’ajoutent rien. Une offre arrivée pendant la séance ne compte qu’après une décision. Les validations du carnet sont communiquées seulement après la réponse d’écriture. Une pépite proche sélectionnée peut être ouverte depuis le bilan ; sinon, aucun emplacement vide. Les prochaines relances datées du lendemain sont réelles. Pas de bloc semaine avant Q5.

Les commandes de passage et de clôture attendent les écritures en cours (offre, visite ou carnet), puis le bilan utilise leur réponse confirmée. Les erreurs déverrouillent le parcours sans ajouter d’action. Cette attente évite de quitter entre le clic de tri et sa réponse.

## Stockage et limites

Aucune écriture de séance en base, aucune migration, aucun service tiers. Les actions ordinaires gardent leurs écritures existantes. La séance est en mémoire et sessionStorage, avec une copie locale limitée au jour pour le cas demandé d’un onglet fermé : uniquement identifiants, états et durées, aucun texte du CV ni note. À la réouverture, le parcours est en pause ; Reprendre est volontaire. Pagehide et la pause arrêtent la durée ; l’indisponibilité du stockage laisse le parcours courant en mémoire. Autre appareil : pas de reprise. Les données du bilan restent celles du navigateur jusqu’à L1.

Avant C2, seules les relances explicitement datées dans les bilans d’entretien existent. « J’ai fait cette relance » atteste l’action pour cette séance, sans envoi de message et sans historique durable ; C2 branchera le suivi à J+7 et sa confirmation persistante. Une pause conserve l’instantané du jour : les actions confirmées entre l’ouverture et la clôture peuvent entrer dans ce bilan ; les minutes de pause sont exclues. Ce choix suit le calcul par différence demandé, sans chronométrer les gestes.

Un échec de lecture des sources ou du carnet est signalé, avec reprise et conservation des offres lisibles ; il ne laisse pas la préparation en attente infinie. Les lectures sont bornées à quinze secondes. Rien à faire désactive le départ ; la sortie sans action revient à l’accueil sans écran de bilan.

## Vérifications

Logique pure testée : ordre et saut des étapes, seuil strict de cinq jours, échéances, vrais changements et absence de faux compteurs, pépite, stockage invalide ou périmé, minutes hors pause. L’intégration SQLite vérifie les scénarios fictifs, la relance datée et l’expérience proposée. Composants réutilisés : SignalStepper, SignalMoment, SignalCounter, WorkspaceButton et états Signal ; sources, fiches et carnet existants.

`/demo?scenario=session` ouvre un compte isolé signalé : trois offres à trier, une relance datée, deux visites anciennes et un bloc proposé. Choisir Plus tard pour une offre, confirmer la relance, marquer Collective visitée, enregistrer l’expérience Ligne Claire, puis Terminer : **1/1/1/1**. `/demo?scenario=session-empty` vérifie le bouton Rien à faire aujourd’hui. Pour une pépite et le mouvement réduit, `scan-reduced`, Actualiser, puis commencer une séance et sélectionner une offre proche.

Recette locale sur 1360 et 390 px : parcours quatre étapes, bilan 1/1/1/1, fermeture Échap et focus à l’accueil, pas de débordement ; pause puis fermeture et réouverture de l’onglet proposent Reprendre sans lancer la séance. Quitter sans action revient directement à l’accueil. Recette staging et captures consignées après déploiement.

Staging privé **v30** déployé avec succès : le parcours complet reproduit **1 offre triée, 1 relance faite, 1 source visitée, 1 bloc validé**. Les commandes de séance attendent réellement le tri et la validation ; la sortie de la source attend sa visite. Pied de feuille mobile de 44 px, sans débordement. [Bilan ordinateur](q3-seance/staging-bilan-ordinateur.jpg), [bilan mobile](q3-seance/staging-bilan-mobile.jpg), [source mobile](q3-seance/staging-source-mobile.jpg). Échap revient à `workspace-title`. Le premier [pas-à-pas ordinateur](q3-seance/staging-etapes-ordinateur.jpg) a été capturé dans la version intermédiaire v29 ; la v30 ajoute l’attente des écritures.

Le scénario réduit affiche le vrai titre « 3 offres valent le détour aujourd’hui ». Une sélection donne le bilan au singulier, [sa pépite sur mobile](q3-seance/staging-pepite-reduite-mobile.jpg), puis ouvre exactement cette fiche dans Ma sélection. Toutes les durées d’animation du bilan sont à 0 s ; aucun débordement, aucune erreur ni avertissement dans la console du parcours nominal. 302 tests et TypeScript réussis, aucune nouvelle erreur ESLint. Production inchangée.

Pause puis rechargement sur le staging : Reprendre est proposé, aucune reprise automatique. Reprendre puis Quitter sans action n’affiche aucun bilan et focalise l’accueil. Le scénario [sans action sur mobile](q3-seance/staging-sans-action-mobile.jpg) affiche « Rien à faire aujourd’hui » désactivé. Les erreurs de lecture et leur délai restent vérifiés dans le code ; aucune coupure réseau artificielle n’a été capturée.
