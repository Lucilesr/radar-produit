> Mise à jour P2 : la présentation actuelle remplace les points par six réglages en trois groupes, avec quatre paliers segmentés. Les huit thèmes se trouvent dans Mes histoires du carnet. Le calcul Q4 ci-dessous reste inchangé ; les captures historiques décrivent son ancienne présentation. Recette actuelle : [P2](p2-portee-reglages/README.md).

# Q4 — Portée du radar

La fonction pure `lib/radar-reach.ts` calcule dix crans depuis les données du compte : rôle choisi 2, niveau 1, trois sources suivies actives 2, source consultable visitée 1, deux expériences validées 2, quatre histoires validées 2. Les sources en pause, désactivées, inconnues ou répétées sont exclues. Les suggestions non enregistrées ne comptent pas. Les blocs sont filtrés sur le document courant et les éléments masqués ou sensibles ; un parent masqué ne donne aucun crédit à ses enfants.

Une histoire est un fait validé portant un contexte, une contribution personnelle et un résultat ou une limite documentée. Les récits anciens qui répondent à ces critères comptent aussi. Les nouveaux thèmes utilisent `data.claimKey = interview-story:<thème>` dans le carnet existant. L’absence de mesure peut être dite explicitement ; aucun chiffre n’est fabriqué.

## Écran et choix explicites

Portée compacte sur Aujourd’hui, détail dans Mon profil. Seuils : Repérage 0–2, Balayage 3–6, Longue portée 7–9, Précision 10. La maquette représente bien 7 crans au troisième palier. À zéro : « Votre radar s’allume » ; à dix : « Précision atteinte », sans prochaine action imposée. Les paliers décrivent des usages existants, pas des droits d’accès.

La prochaine action suit les éléments manquants : critères, niveau, sources, visite, expériences, histoires. Une seule proposition et une durée sont affichées. Ouvrir une action ne gagne aucun point ; son enregistrement ou sa validation réelle fait foi. Les seuils de deux expériences et quatre histoires accordent leurs deux crans une fois atteints, pas au simple clic.

Les huit thèmes reprennent la maquette : Prioriser, Un impact chiffré, Travailler avec la tech, Apprendre vite, Un désaccord, Un échec, Mener une découverte, Convaincre sans autorité. Un nouveau récit est proposé puis validé explicitement via l’API du carnet, avec identifiant stable et reçus idempotents. Il reste privé. Une édition compare la version connue à celle du serveur, garde les textes en conflit et propose une comparaison explicite. La provenance et l’historique du carnet sont conservés. Comme pour ses autres blocs, modifier les faits suspend leur réutilisation jusqu’au nouveau choix des droits.

Les brouillons `story:<thème>` utilisent la table de sauvegarde de texte existante : huit clés autorisées, toujours séparées par l’identité authentifiée. Ils sont inclus dans la sauvegarde intégrale via `workspace_writes`. Aucun nouveau schéma, aucune migration, aucun service tiers. Le stockage de confort de séance garde uniquement identifiants et états, même quand la portée lit les blocs complets.

Le signal de palier est citron, une seule fois par progression dans ce navigateur. Le premier affichage crédite l’existant sans animation. Seul l’écran visible peut consommer ce signal : accueil compact ou portée détaillée. La préférence réduite coupe le mouvement. Les lectures partielles sont nommées, les valeurs sont celles des éléments disponibles et la prochaine action attend une relecture complète.

La recette a montré que le titre pouvait être hors champ après une validation : le signal utilise aussi la notification Signal commune, sans CTA, avec fermeture de 44 px. Il n’est mémorisé qu’au moment où il est réellement affiché ; un écran quitté avant son affichage ne le consomme pas. Une seule annonce vive porte le message. Le passage à minuit a aussi révélé un écart de date serveur/navigateur sur l’accueil de Q3 : son libellé attend désormais l’horloge locale après hydratation.

## Écarts avec les maquettes

- « Ce que chaque palier débloque » devient « Ce que vous préparez » : le §4.6 impose qu’aucune fonction ne soit verrouillée par la jauge.
- « Premier cran en un clic » ouvre le premier choix ; les points attendent les données réellement enregistrées. Aucun critère ni fait n’est ajouté pour attribuer une récompense.
- Une histoire modifiée suit les protections déjà présentes du carnet ; elle n’obtient aucun droit d’usage automatiquement.

## Recette

La démo isolée `scan-reduced` donne huit crans depuis ses critères, son niveau, quatre sources, une visite passée et deux expériences. Aucun signal de palier au premier affichage. Écrire et valider quatre récits fictifs : quatre thèmes cochés, dix crans et un signal de Précision. Recharger : dix crans, aucun nouveau signal. Les droits de candidature et de profil public restent faux. `demo?onboarding=1` vérifie zéro cran et le chemin vers Ma recherche.

Vérifications locales : crédit de l’existant, quatre récits, seuil 8→10, absence de relance à dix, stabilité au rechargement et mouvement réduit à 0 s. Deux onglets partagent un brouillon ; la validation du premier protège son récit et le second conserve sa rédaction divergente, avec comparaison. Le brouillon en conflit est retrouvable après fermeture du dialogue. Focus au titre à l’ouverture, retour au déclencheur ou au titre de portée après enregistrement et Échap. Compte sans critères à zéro ; premier bouton ouvre Ma recherche. Aucun débordement de page ou de dialogue à 390 px.

308 tests réussis et TypeScript réussi ; les tests SQLite couvrent quatre histoires validées sans droits d’usage, idempotence, isolation A/B et brouillons privés. Les tests purs couvrent chaque seuil, les sources exclues, les parents masqués et les blocs complets absents du stockage de séance. Aucune nouvelle erreur ESLint. Recette staging terminée sur v32 (source `5283cfeb0196a10136ca6b85f36dcc6b48dd7f5b`, code public `dfe99cb`) ; captures dans [q4-portee/](q4-portee/README.md). Les coupures réseau et le mode hors ligne du navigateur ne sont pas simulés : leurs délais et reprises sont examinés dans le code.

Recette staging : 1360 × 900 et 390 × 844. Crédit de huit crans sans signal initial ; brouillon repris après Échap ; quatre validations privées donnent dix crans conservés au rechargement. Deux onglets produisent un vrai conflit de version : texte conservé, comparaison du récit enregistré, puis sauvegarde après comparaison sans créer une cinquième histoire. Texte long de plus de 5 000 caractères dans le contexte sans débordement. Mouvement réduit calculé à 0 s. Compte fictif neuf à zéro : le bouton ouvre Ma recherche ; rôle puis niveau Senior validé par Terminé donnent trois crans. Notification « Palier atteint : Balayage » visible au-dessus de la navigation mobile, fermeture 44 px, animation 0,26 s, une seule annonce du palier ; absente après rechargement. Date locale « dimanche 8 novembre » après le passage à minuit, aucune erreur ni avertissement console dans le parcours nominal final.
