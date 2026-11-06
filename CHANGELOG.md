## 6 novembre 2026 — Page de connexion et déconnexion

Un visiteur non connecté arrive sur une page Radar (`/connexion`) au lieu d’être envoyé directement chez ChatGPT : présentation du service, « Se connecter avec ChatGPT », « Voir la démo » et rappel de confidentialité. La page d’origine est retrouvée après la connexion. « Se déconnecter » apparaît dans la barre latérale et dans la nouvelle section « Mon compte » de Mon profil, accessible aussi sur mobile ; dans la démo, le même bouton devient « Quitter la démo ». La déconnexion ramène sur la page de connexion. Aucune migration SQL ni dépendance ajoutée.

## 6 novembre 2026 — Un nouveau compte choisit son poste

Un nouveau compte ne reçoit plus les critères PO/PM d’origine : aucun poste, tous les contrats, toute présence et aucun minimum de rémunération. Tant qu’aucun poste n’est choisi, « Opportunités » invite à l’indiquer dans Ma recherche, le guide de prise en main attend un poste pour passer à l’étape suivante, et une offre reçoit « Aucun poste choisi » au lieu d’une pénalité d’intitulé. Sans minimum, une rémunération absente n’est plus signalée. Les critères affichent « Aucun poste choisi » et « Aucun minimum ». Les deux offres d’exemple n’évoquent plus de métier. La démo fictive de Camille garde explicitement sa recherche PO/PM. Un compte qui a déjà enregistré ses critères les conserve. Aucune migration SQL ni dépendance ajoutée.

## 6 novembre 2026 — Classement sans préférence cachée pour le produit

Un intitulé contenant « product », « produit », « PO » ou « PM » ne gagne plus de points quand le compte cherche un autre métier : seule la correspondance avec les postes visés compte. Le bonus fixe de 7 points pour la fintech, le paiement, le SaaS, l’IA ou le secteur public disparaît aussi ; chaque compte valorise ses secteurs avec ses « mots-clés à mettre en avant ». Les anciennes requêtes PO/PM constantes de `web-discovery.ts`, inutilisées, sont supprimées. Aucune migration SQL ni dépendance ajoutée.

## 6 novembre 2026 — Postes suggérés depuis vos offres (lot 16b)

Sous « Postes visés », le tableau et le popover proposent jusqu’à trois intitulés vus dans au moins trois offres non supprimées des trente derniers jours. Les suggestions excluent les postes déjà visés et les termes des pistes du compte. Un clic ajoute explicitement le poste avec la confirmation d’impact existante ; « Ne plus proposer » conserve le refus dans le compte, y compris après rechargement. Sans suggestion, la ligne disparaît. Aucune dépendance ni migration SQL ajoutée.

## 6 novembre 2026 — Finitions de Ma recherche (lot 16a)

La section « Critères » indique l’enregistrement automatique et signale les critères modifiés pendant la visite. Les confirmations d’impact proposent « Annuler » et « Voir les offres », vers « À examiner ». Le titre « Sources » rassemble les statuts suivis ; jusqu’à quatre sources non suivies sont suggérées selon les critères et s’ajoutent directement. La vue dépliée rappelle que les offres sans salaire affiché sont gardées, à vérifier. Aucune règle de classement ni suggestion de poste modifiée.

## 6 novembre 2026 — Tout modifier en tableau éditable (lot 15)

« Tout modifier » ouvre les groupes du tableau de critères avec leurs contrôles directement accessibles : postes et pistes, contrats, présence par contrat, minimums et tolérance, zones et mots-clés. Les boutons segmentés remplacent les menus de présence. L’en-tête rassemble l’état de sauvegarde, la reprise en cas d’erreur et le nombre d’offres à examiner. « Ajouter un critère » ouvre une ligne optionnelle ; le premier usage garde l’édition ouverte sans bouton « Terminé ». Les sauvegardes de champs distincts préservent les dernières valeurs des autres contrôles.

## 6 novembre 2026 — Ma recherche sur une seule page (lot 14)

Critères, sources et autres pistes se lisent à la suite, sans les trois onglets de section. L’actualisation des flux et son réglage rejoignent l’en-tête ; les alertes Collective se consultent et s’ajoutent dans le détail de la source. Les anciens liens de section sont conservés et ouvrent « Autres pistes » si nécessaire. Les recherches web redondantes et « Recherches couvertes » quittent la page. Aucune règle de classement ni dépendance modifiée.

## 6 novembre 2026 — Guide : trois lots pour rejoindre les maquettes

Le guide de « Ma recherche » décrit trois lots de plus : une seule page sans onglets (lot 14), « Tout modifier » en tableau éditable (lot 15), puis les finitions et les postes suggérés (lot 16). Les offres sans salaire affiché restent gardées, à vérifier à la main.

## 6 novembre 2026 — Configuration des sources

Suppression du bouton redondant « Modifier mon suivi ». Le chevron Signal reste disponible dans les cartes héritées ; la liste actuelle utilise le panneau de détail.

## 6 novembre 2026 — « Aujourd'hui » rappelle les sources à consulter

- Quand une source à consulter arrive à échéance, elle apparaît dans « Aujourd'hui » : « Welcome to the Jungle à visiter · vue il y a 3 jours ». Un clic ouvre son panneau dans « Ma recherche ».
- Le rappel suit le rythme choisi pour chaque source et disparaît si vous l'avez coupé.
- Dans le panneau d'une source, « Collez l'URL d'une offre vue sur ce site » ouvre le formulaire d'ajout avec le lien déjà rempli.

## 5 novembre 2026 — « + Critère »

- À la suite de vos étiquettes, « + Critère » propose ce que vous n'avez pas encore réglé : mots-clés à mettre en avant, mots-clés à écarter, tolérance sous le minimum, pistes de recherche.
- Choisir un critère ouvre directement son contrôle, sans passer par le formulaire complet. Une fois réglé, il quitte la liste et rejoint vos étiquettes.

## 5 novembre 2026 — Radar s'actualise tout seul à l'ouverture

- Si la dernière collecte date de plus de 12 heures, Radar actualise vos flux en arrière-plan quand vous ouvrez « Ma recherche », sans bloquer l'affichage et sans contourner les caches des sources.
- L'en-tête de la collecte indique « Actualisé il y a 2 h », et le bouton devient « Actualiser maintenant ».
- Un réglage « Actualisation » laisse choisir entre « Actualiser automatiquement à l'ouverture » et « Seulement quand je le demande ».

## 5 novembre 2026 — Choisir où Radar cherche

- « Ajouter une source » ouvre un panneau : une recherche, trois filtres, et le catalogue trié selon vos critères — les sources proches de vos contrats, de votre présence et de vos pays d'abord.
- Chaque entrée affiche son logo, son nom et deux ou trois étiquettes ; celles déjà suivies sont marquées « Ajoutée ».
- « Votre site n'est pas dans la liste ? » : collez l'URL de votre recherche, elle devient une source à consulter, avec son rythme de visite.
- Quand aucune source n'est suivie, la page demande « Où Radar doit-il chercher ? » et propose les deux familles, automatiques ou à consulter.

## 5 novembre 2026 — Le détail d'une source, et le rythme auquel la revisiter

- Cliquer sur le nom d'une source ouvre un panneau latéral : ce qu'il faut ouvrir, les recherches préparées depuis vos critères, ce que la source a rapporté, ses réglages et ses notes.
- « Rythme de visite » : chaque jour, tous les 2 jours ou chaque semaine, avec un rappel dans « Aujourd'hui » que vous pouvez couper. L'état « À visiter » suit le rythme choisi.
- Les écarts d'une recherche (« X n'est pas dans vos critères ») s'affichent désormais dans ce panneau, à côté des recherches concernées.
- La liste des sources garde ses lignes compactes : les réglages ne s'ouvrent plus dessous, mais dans le panneau.

## 5 novembre 2026 — Pistes de recherche propres à chaque compte, et alertes d'écart

- Les trois pistes de recherche (« Cœur de cible », « Filet large », « Alternatives pertinentes ») ne sont plus les mêmes pour tout le monde : chaque compte a les siennes, modifiables sous « Postes visés ».
- Un compte sans piste enregistrée cherche ses propres postes. Un compte qui cherchait les anciens postes par défaut garde les trois pistes d'avant.
- « Recherches couvertes » affiche les pistes du compte, et non plus un texte figé.
- Quand une recherche enregistrée sur une source cherche encore un intitulé absent de vos critères, la source l'indique : « X n'est pas dans vos critères », avec « L'ajouter à mes pistes » ou « Retirer de cette recherche ». Ces sources rejoignent le filtre « Action requise ».
- Les conseils propres à un profil disparaissent des notes de sources.

## 5 novembre 2026 — Ma recherche : une seule liste de sources, avec leur état

- Les sous-onglets « Jobboards » et « Alertes & flux » laissent place à une liste unique, groupée en « Automatiques » et « À consulter ».
- Chaque source affiche son état : OK, Erreur, À configurer, En pause, Nouvelle, À visiter ou À jour, avec l'action correspondante et sa dernière activité.
- Des filtres montrent toutes les sources, un seul type, ou celles qui demandent une action.
- « J'ai fait le tour » marque une source à consulter comme visitée ; son état repasse à « À jour » puis à « À visiter » après le délai.
- Les réglages d'une source s'ouvrent sous sa ligne, sans quitter la liste.

## 5 novembre 2026 — Ma recherche : mots-clés de l'annonce

- Une section « L'annonce » permet de mettre en avant les offres qui parlent de certains sujets (fintech, paiement…) et d'écarter celles qui contiennent d'autres mots (stage, alternance…).
- Les mots écartés masquent l'offre dans « À examiner » avec un point à vérifier ; les mots mis en avant la font remonter.
- La casse et les accents sont ignorés ; 12 mots-clés au plus par liste, de 2 à 40 caractères.

## 5 novembre 2026 — Ma recherche : présence acceptable par contrat

- Avec plusieurs contrats recherchés, la présence se règle contrat par contrat : full remote en CDI et hybride en freelance, par exemple.
- Les offres sont classées avec le niveau du contrat annoncé ; une offre au contrat non précisé suit le niveau le plus ouvert parmi les contrats recherchés.
- La barre de critères garde une seule étiquette « Présence », qui résume les niveaux ; le tableau déplié détaille une ligne par contrat.

## 5 novembre 2026 — Deux contrats de plus : portage salarial et temps partagé

- « Contrats » propose désormais le portage salarial et le temps partagé, en plus du CDI, du CDD et du freelance.
- Le portage se compare au TJM minimum, comme le freelance.
- Une rémunération de temps partagé n'est jamais comparée telle quelle à un minimum temps plein : l'offre reste visible avec le point à vérifier « Rémunération à temps partiel », à ramener à un temps plein avant de décider.
- Les annonces mentionnant « portage salarial », « temps partagé », « mi-temps » ou un rythme de 2 à 4 jours par semaine sont reconnues à l'ajout d'une offre.

## 5 novembre 2026 — Ma recherche : finitions du champ de lieux

- Le champ de recherche de lieu n'affiche plus qu'un seul contour net quand il est sélectionné, au lieu de deux cadres arrondis superposés.
- Les boutons « Inclure » et « Exclure » restent dans le panneau et passent à la ligne quand la place manque, au lieu de dépasser sur le côté.

## 5 novembre 2026 — Ma recherche : un seul champ pour les pays et régions

- Les deux champs « Inclure » et « Exclure » sont remplacés par une recherche unique : tapez un lieu, puis Inclure (Entrée) ou Exclure (Maj+Entrée).
- Les lieux choisis apparaissent dans une liste où chaque ligne bascule entre « Inclus » et « Exclu » sans la retaper, et se retire d'un clic.
- Des raccourcis proposent les régions déjà connues (Union européenne, Amérique du Nord…).

## 5 novembre 2026 — Ma recherche : tolérance sous le minimum

- Un curseur de 0 à 20 % règle la tolérance sous les minimums de salaire et de TJM. À 0 %, valeur par défaut, le comportement strict est inchangé.
- Une offre dont la rémunération connue se situe dans la tolérance reste dans « À examiner », comme exception, avec le point à vérifier « Sous votre minimum… » et un badge sur sa carte. En dessous de la tolérance, elle reste masquée.
- Le texte d'aide donne les seuils calculés (« dès 52 250 € brut/an ou 475 € HT/jour ») ; l'étiquette « Tolérance » n'apparaît dans la barre de critères que si elle est réglée.

## 5 novembre 2026 — Ma recherche : édition en place

- Une étiquette de critère ouvre un panneau avec ce seul réglage (postes, contrats et présence, rémunération, lieux) ; sur téléphone, le réglage s'ouvre dans la page, sous les étiquettes. Échap ou « Terminé » ferme et rend le focus à l'étiquette.
- Dans « Tout voir », « Modifier » ouvre le réglage sous la ligne concernée, sans quitter le tableau.
- « Tout modifier » ouvre toujours le formulaire complet. Les listes de pays et menus ouverts depuis un panneau ne le referment plus.

## 5 novembre 2026 — Ma recherche : enregistrement automatique et annulation

- Contrats, présence, salaire et TJM s'enregistrent seuls 600 ms après la dernière modification ; le bouton « Enregistrer » disparaît. Un état indique « en attente », « enregistrement » ou « enregistré », avec « Réessayer » en cas d'échec. Quitter le formulaire enregistre la dernière modification.
- Chaque enregistrement affiche ce qui a changé et le nombre d'offres à examiner qui en résulte (« TJM 500 € → 450 €/jour. 22 offres à examiner (+8). »), avec « Annuler » pour revenir aux critères précédents.
- Un champ de rémunération vidé reste vide au lieu d'afficher 0 devant la saisie suivante.

## 5 novembre 2026 — Ma recherche : critères lisibles d'un coup d'œil

- « Ce que je recherche » s'affiche d'abord comme une ligne d'étiquettes : postes, contrats, présence, minimums de rémunération, score Jobgether et lieux ; les lieux exclus sont signalés à part.
- « Tout voir » déplie un tableau rangé par thème (le poste, la présence, la rémunération, la géographie). Le choix replié ou déplié est mémorisé sur l'appareil.
- Une étiquette ou le bouton « Modifier » d'une ligne ouvre le formulaire sur le bon champ ; « Terminé » revient à la vue précédente. Le score Jobgether s'ouvre sur sa carte dans « Alertes & flux ».
- Un compte sans critères enregistrés voit toujours le formulaire ouvert, pour la première configuration.

## 5 novembre 2026 — Ma recherche : icône et logos des sources

- L’onglet Ma recherche utilise une icône de réglages au lieu d’une enveloppe.
- Les logos des sources gardent une largeur de texte fixe et restent entiers dans leur cadre, quelle que soit la police disponible ; le logo Remote OK n’est plus coupé.
- La mention « Radar ne collecte pas le contenu de ces sites et n’utilise aucun de vos comptes » apparaît une seule fois dans le suivi des jobboards au lieu d’être répétée sur chaque carte.

## 5 novembre 2026 — Explication des minimums stricts

Ma recherche décrit le masquage des rémunérations connues sous les minimums, y compris avec un contrat inconnu.

## 5 novembre 2026 — Minimums de rémunération stricts

Les salaires et TJM connus inférieurs aux minimums du compte sont exclus sans tolérance, y compris lorsque le contrat est inconnu. Ces offres sont masquées dans « À examiner ». Les montants absents restent à vérifier ; les sélections et candidatures existantes sont conservées.

## 5 novembre 2026 — Profil accessible après une mise à jour

- L'interface de Mon profil est chargée avec l'application pour qu'un onglet déjà ouvert puisse accéder aux expériences et documents même après le retrait des anciens fichiers du site.
- Aucun rechargement automatique n'interrompt les saisies.

## 5 novembre 2026 — Libellé du score Jobgether

- Le réglage précise que le score minimal mesure le matching entre le CV et les offres ; la phrase d’aide redondante est retirée.

## 5 novembre 2026 — Bornes du score Jobgether

- La saisie du score reste entre 0 et 100, y compris lors d’une frappe ou d’un collage hors plage.

## 5 novembre 2026 — Présentation de la carte Jobgether

- La carte Jobgether aligne son titre, son état et ses actions sur mobile et ordinateur. Le réglage du score utilise un champ compact avec un seul contour de focus visible.

## 5 novembre 2026 — Score Jobgether dans sa carte

- Le score minimal des nouvelles offres se règle directement sur la carte Jobgether dans « Jobboards & alertes → Alertes & flux ».
- Le champ compact accepte un entier de 0 à 100 et enregistre la valeur indépendamment des autres critères.

## 5 novembre 2026 — Seuil Jobgether dans Ma recherche

- Le seuil de score Jobgether est visible en haut de « Mes critères » et accessible directement depuis « Alertes & flux ».
- La valeur enregistrée est affichée dans le raccourci vers le réglage.

## 5 novembre 2026 — Titres des cartes Candidatures

- Dans le Kanban, le titre ouvre toujours le dossier. La flèche superflue est retirée et les titres occupent au plus deux lignes, avec des points de suspension si nécessaire.
- Les cartes se déplacent par glissement ou avec la poignée au clavier ; le bouton « Déplacer » et son choix de colonne redondants sont retirés.

## 5 novembre 2026 — Tags des candidatures

- Un dossier de candidature permet de créer des tags sans nom prérempli, de choisir une couleur, de les appliquer ou retirer de la carte, puis de les renommer ou supprimer après confirmation.
- Les tags sont visibles sur les cartes du Kanban. Cliquer sur un tag filtre les candidatures ; un contrôle Signal permet aussi de choisir le filtre.
- Fermer la fenêtre des tags avec Échap ou le bouton de fermeture rend le focus au bouton « Tag » du dossier.
- Saisir un nom dans la recherche des tags puis appuyer sur Entrée ouvre la création avec ce nom repris. Le bouton Tag est dans l’en-tête du dossier ; les tags appliqués apparaissent sous ses onglets, sans section vide.

## 5 novembre 2026 — Lisibilité des infobulles

- Les infobulles des opportunités et des autres écrans répartissent mieux le texte sur plusieurs lignes. Dans l’aide de la corbeille, « 10 jours » reste sur une même ligne.

## 5 novembre 2026 — Purge de la corbeille sur D1

- Le nettoyage des offres expirées traite des lots de 20 pour rester sous la limite de 100 paramètres par requête de Cloudflare D1. Une corbeille volumineuse est vidée en plusieurs lots sans bloquer le chargement du radar.

## 5 novembre 2026 — Chargement du radar

- Une erreur lors du nettoyage automatique de la corbeille n’empêche plus l’ouverture du radar ni la lecture des offres. Le nettoyage est retenté à la prochaine ouverture et l’erreur est conservée dans les journaux techniques.

## 4 novembre 2026 — Sélection des pays et régions

- Les champs Inclure et Exclure utilisent le Combobox du design system Signal. La recherche de pays et régions est intégrée au champ, et un lieu libre reste possible avec Ajouter.

## 4 novembre 2026 — Seuil Jobgether réglable dans Ma recherche

- Chaque compte peut choisir son score minimal Jobgether de 0 à 100 dans « Ma recherche » ; 55 reste la valeur initiale. Le seuil s’applique aux prochaines collectes et aux offres non suivies déjà présentes.
- Changer ce score déclenche une nouvelle collecte Jobgether lors de la prochaine actualisation. Les offres sélectionnées, les candidatures et la corbeille restent accessibles.

## 4 novembre 2026 — Choix guidé des pays et régions

- Les lieux à inclure et à exclure se choisissent avec des suggestions recherchables et s’enregistrent dès l’ajout ou le retrait. Les variantes comme US, USA et États-Unis sont ramenées au même pays.
- « Europe » couvre les pays européens, dont la Roumanie. Une exclusion de Roumanie l’emporte sur l’inclusion d’Europe ; une annonce indiquant seulement « Europe » reste à vérifier.

## 4 novembre 2026 — Conservation de la corbeille

- Les offres mises à la corbeille depuis plus de 10 jours sont supprimées définitivement à la prochaine ouverture du radar, avec leurs données de suivi liées. Le tooltip de la corbeille précise le délai de restauration.

## 4 novembre 2026 — Seuil de pertinence Jobgether

- Pour tous les comptes, seules les nouvelles offres Jobgether atteignant au moins 55 points de match sont importées. Les anciennes offres sous ce seuil sont masquées de la liste si elles n'ont pas été suivies ; les choix, candidatures et offres en corbeille restent accessibles.
- Le score est calculé avec les critères du compte. Le compteur de la source indique les offres qui ont passé ce filtre.

## 4 novembre 2026 — Pays et régions dans les critères de recherche

- Chaque compte peut inclure ou exclure des pays et régions depuis « Ma recherche », en saisissant par exemple « Europe ». Les lieux annoncés sont conservés séparément des pays autorisés pour le télétravail.
- Les offres existantes et futures sont reclassées avec ces critères. Une offre ouverte dans plusieurs lieux reste visible si au moins un convient ; un lieu absent ou trop large est signalé à vérifier.
- Les offres écartées pour leur lieu annoncé ne figurent plus dans « À examiner » ni dans les actions du jour. Une offre déjà sélectionnée ou suivie comme candidature reste accessible.

## 4 novembre 2026 — Veille Jobgether par compte

- Chaque utilisateur peut activer Jobgether sans compte ni clé depuis « Alertes & flux ». Radar réutilise ses postes et contrats enregistrés, interroge l’API officielle de façon bornée et conserve des fiches sommaires liées à la source.
- L’actualisation des flux suit la dernière réussite, respecte les délais indiqués après une limite atteinte et signale les réponses incompatibles ou les échecs répétés sans effacer les offres existantes. La planification automatique dépend d’une tâche de veille reliée au compte.

## 3 novembre 2026 — Suppression des sources suivies

- Les cartes de jobboards, d’alertes et de flux peuvent être supprimées après confirmation dans une modale du design system. Annuler conserve la carte ; un échec affiche une erreur dans la modale et permet de réessayer.
- Le retrait est conservé après rechargement et les sources restent disponibles dans « Ajouter des sources ». Les offres, notes et liens enregistrés sont conservés. Les recherches web associées sont masquées et un flux retiré n’est plus actualisé ; les emails externes se désactivent sur le site d’origine.

## 3 novembre 2026 — Sources en cartes

- Jobboards et Alertes & flux affichent deux cartes par ligne sur ordinateur et une sur mobile. Le bouton « Ajouter des sources » est placé en haut des deux onglets ; les sources supplémentaires restent cachées tant qu’elles ne sont pas choisies.

## 3 novembre 2026 — Sources d’alertes personnalisables

- Chaque source d’alerte ou de flux peut conserver une URL https à ouvrir, distincte de ses notes et de son état. Le lien personnalisé ne modifie pas la synchronisation du flux.
- Quatre sources sont proposées au départ ; les autres apparaissent quand elles sont suivies ou ajoutées via « Ajouter des sources ».

## 3 novembre 2026 — Liens de veille regroupés

- Les recherches LinkedIn et Welcome to the Jungle affichent chacune un seul accès par site et une recherche Google combinant les postes choisis. Les anciens liens personnalisés restent consultables.
- Les commandes pour modifier les liens et le suivi des alertes sont plus visibles. La démo explique quelles actions externes sont désactivées.

## 2 novembre 2026 — Profil et recherche à 80 % de la page

- Sur ordinateur, les en-têtes, sous-onglets et contenus de Mon profil et Ma recherche partagent une largeur de 80 % de la zone disponible. Sur tablette et mobile, ils reprennent toute la largeur pour garder des champs lisibles.

## 2 novembre 2026 — Largeur harmonisée de Mon profil et Ma recherche

- Les deux pages utilisent une largeur fluide commune pour l’en-tête, les sous-onglets et les panneaux. La largeur suit la fenêtre avec une limite en `rem` pour préserver la lisibilité sur grand écran.

## 2 novembre 2026 — Introduction des critères alignée

- Le texte d’introduction de « Mes critères » s’étend jusqu’au bord droit des champs de la deuxième colonne. La grille et les champs partagent les mêmes dimensions CSS ; sur mobile, le texte occupe toute la largeur disponible.

## 2 novembre 2026 — Recherches web plus directes

- Le sous-titre qui répétait les noms des plateformes et « tous pays » est retiré. La consigne d’ouverture des recherches reste visible au-dessus des liens.

## 2 novembre 2026 — Champs de critères affinés

- Les champs de poste, présence, salaire et TJM sont légèrement resserrés sur ordinateur. « Hybride avec présence exceptionnelle » devient « Présence exceptionnelle » dans le choix de recherche, comme sur les fiches d’offres. Le bouton du formulaire est nommé « Enregistrer ».

## 2 novembre 2026 — Alignement des critères en colonnes

- Les conditions de travail et la rémunération utilisent la même grille à deux colonnes : « Présence acceptable » s’aligne avec « TJM minimum ». Les champs gardent une largeur compacte ; sur mobile, les colonnes se superposent.

## 2 novembre 2026 — Ouverture directe de Mes expériences

- Lorsqu’on arrive directement sur Mes expériences, le carnet est lu en parallèle du profil et des offres, puis affiché dès le premier rendu. Le guide réutilise cette lecture, sans requête supplémentaire. La liste des documents continue de se charger en arrière-plan.

## 2 novembre 2026 — Critères de recherche plus compacts

- Le champ d’ajout d’un poste et le choix de présence prennent moins de largeur sur ordinateur. Les cinq libellés du formulaire partagent la même typographie et le même espacement ; les champs restent fluides sur mobile.

## 1er novembre 2026 — Ma recherche plus lisible

- Le formulaire « Ce que je recherche » regroupe les postes, conditions de travail et rémunérations dans des sections ouvertes. Un bouton permet d’ajouter un poste sans clavier. Les panneaux de Ma recherche et les listes de jobboards utilisent des séparateurs discrets au lieu de cartes blanches empilées.

## 1er novembre 2026 — Ouverture plus rapide de Mon profil

- Mes expériences réutilise l’extraction enregistrée du document courant. Le chargement du carnet s’affiche dès sa réponse, sans attendre l’historique des fichiers ; l’indicateur d’analyse apparaît seulement pour un nouveau document. Les deux sous-onglets du profil chargent leurs données à la première ouverture, puis conservent leur état.

## 1er novembre 2026 — Critères explicites repris automatiquement

- À l’ajout ou à l’enrichissement d’une opportunité, les conditions explicites du descriptif complètent les champs encore inconnus : contrat, rémunération, télétravail et niveau d’anglais. Les valeurs déjà renseignées sont conservées ; les fourchettes et montants ambigus restent à confirmer.

## 1er novembre 2026 — Alignement des sous-onglets de Ma recherche

- Les sous-onglets de Ma recherche utilisent la même largeur et la même disposition que ceux de Mon profil. Le contenu des panneaux reste centré sur 960 px.

## 1er novembre 2026 — Ma recherche en sous-onglets

- « Ma recherche » distingue Mes critères, Jobboards & alertes et Autres pistes. Les jobboards ouvrent des recherches à consulter ; les alertes et flux apportent des notifications ou des résultats synchronisés. Chaque type a ses réglages et explications dans son propre panneau.

## 1er novembre 2026 — Continuer sur l’offre suivante

- Après l’écartement d’une opportunité, la fiche juste en dessous s’ouvre. Si la dernière est écartée, la fiche précédente reste ouverte.

## 1er novembre 2026 — Mes documents alignés sur Mes expériences

- Le panneau Mes documents est centré sur la même largeur maximale de 960 px que Mes expériences, tout en restant fluide sur écran étroit.

## 1er novembre 2026 — Écartement sans chargement visible

- Écarter retire immédiatement l’offre de la liste sans bandeau de chargement. Un toast apparaît après confirmation ; en cas d’échec, l’offre revient dans la liste avec un message d’erreur.

## 1er novembre 2026 — Annuler une candidature déclarée

- Une candidature marquée « J’ai postulé » peut être annulée depuis le toast ou son dossier avant l’ajout d’un entretien. L’offre revient dans sa liste précédente et la date de candidature est effacée.

## 1er novembre 2026 — Menu de tri intégré

- Toute la commande de tri ouvre directement le choix chronologique. Le menu et ses options utilisent le style de Radar sur ordinateur et mobile.

## 1er novembre 2026 — Largeur de Ma recherche

- Tous les blocs de Ma recherche sont alignés sur les 960 px de la section principale de Mon profil, avec une largeur fluide sur écran étroit.

## 1er novembre 2026 — Tri compact des opportunités

- Le compteur redondant quitte la barre des opportunités. Un filtre discret « Trier : » prend sa place avec les deux ordres chronologiques ; les compteurs restent dans les onglets.

## 1er novembre 2026 — Déplacement immédiat entre les listes

- Sélectionner une offre la retire aussitôt de « À examiner » et l’affiche dans « Ma sélection ». Retirer une offre de la sélection effectue le déplacement inverse. En cas d’échec de l’enregistrement, elle revient dans sa liste initiale.

## 1er novembre 2026 — Écartement direct et tri des offres

- Écarter une offre, seule ou avec une sélection, la place directement dans la corbeille sans motif ni confirmation. Elle reste restaurable.
- Les opportunités se trient par date de mapping et la corbeille par date d’écartement, dans les deux sens.

## 30 octobre 2026 — Centrage des blocs de recherche et d’expériences

- Les blocs de Ma recherche sont centrés dans la page. Dans Mon profil, la section commençant par « Mes expériences » est centrée, titre compris ; la navigation du profil reste à sa place.

## 30 octobre 2026 — Boutons d’enregistrement de Ma recherche

- Les boutons d’enregistrement des critères, des liens de recherche et de l’alerte Collective sont alignés en bas à droite de leurs blocs, y compris sur mobile.

## 30 octobre 2026 — Largeur des critères de recherche

- Les champs des postes recherchés, de la présence acceptable, du salaire minimum et du TJM minimum sont réduits de 25 %.

## 30 octobre 2026 — Unités dans les champs de rémunération

- Les champs de salaire et de TJM occupent toute la largeur disponible : leurs unités restent à l’intérieur de la bordure. Les libellés s’alignent sur le bord gauche des champs.

## 30 octobre 2026 — Champs de rémunération

- Le salaire minimum et le TJM minimum s’affichent côte à côte lorsque la largeur le permet. Leurs libellés reposent sur la bordure et les unités restent visibles pendant la saisie.

## 30 octobre 2026 — Lecture de Mon profil et Ma recherche

- Le carnet d’expériences et les documents sont limités respectivement à 960 et 800 px sur grand écran ; les passages détaillés gardent une longueur de ligne lisible.
- Les critères et alertes de Ma recherche sont limités à 760 px, tandis que les collections de sources peuvent utiliser jusqu’à 1 120 px. Tous les blocs restent alignés à gauche, comme les titres des autres pages.
- Les textes d’aide et les champs de rémunération gagnent en lisibilité.

## 30 octobre 2026 — Accès direct aux recherches

- Bing disparaît des liens proposés. Chaque poste ouvre en priorité LinkedIn Jobs ou Welcome to the Jungle ; l’URL de recherche filtrée peut être enregistrée dans Radar.
- Google reste disponible en complément pour repérer des annonces publiques ; il n’est plus présenté comme l’accès principal.

## 30 octobre 2026 — Liens de recherche modifiables

- Chaque recherche LinkedIn ou Welcome to the Jungle permet d’enregistrer ses propres URL Google et Bing ; Welcome to the Jungle propose aussi un lien direct modifiable vers sa page d’offres.
- Les liens enregistrés restent disponibles sur les autres appareils via le compte Radar. Vider un champ rétablit le lien proposé par Radar.

## 30 octobre 2026 — Statut et hauteur des sources

- Les cartes de « Mes sources » affichent leur état de configuration dès la vue fermée, avec un repère plus visible pour les sources à configurer ou nécessitant une action.
- Les cartes fermées gardent une hauteur cohérente ; ouvrir une configuration ne force plus la carte voisine à s’étirer.

## 30 octobre 2026 — Présence acceptable et CDD

- Le choix de présence propose Présentiel, Hybride, Hybride avec présence exceptionnelle et Full Remote dans le sélecteur commun de l’application. Le classement des offres suit le niveau choisi.
- CDD peut être sélectionné dans la recherche et renseigné sur une offre ; il est reconnu dans les annonces et évalué avec le seuil de salaire annuel.
- Les champs salaire annuel et TJM affichent leur intitulé et leur montant sur la même ligne, avec des libellés raccourcis ; le bouton de sauvegarde indique « Enregistrer ».

## 30 octobre 2026 — Ma recherche

- Un poste saisi avec Entrée est enregistré immédiatement et apparaît dans la liste des postes recherchés. La suppression d’un poste s’enregistre aussi immédiatement ; le bouton du bas ne concerne plus que les autres critères.
- Les postes recherchés se saisissent librement. Un intitulé saisi devient prioritaire dans les matchs ; les autres rôles produit restent des pistes secondaires.
- L’onglet Sources devient Ma recherche : les postes saisis, contrats, présence acceptable et seuils de rémunération sont utilisés pour classer les offres existantes et nouvelles. Les liens de recherche web suivent aussi les intitulés saisis.
- Ma présentation quitte le profil et le guide de prise en main commence par les critères de recherche. Le CV et le carnet d’expériences restent dans Mon profil.
- Les annonces sans rémunération ou sans politique de télétravail précise restent à vérifier ; les alertes configurées sur les plateformes externes ne sont pas modifiées par ces critères.

## Guide de découverte : hiérarchie des modales

- La description de l’écran devient le contenu principal de la carte ; la consigne vers l’onglet suivant est plus discrète et plus courte.

## Guide de découverte : consignes plus lisibles

- Instruction vers le prochain onglet séparée de « Plus tard », sur toute la largeur.
- Vocabulaire aligné sur les actions et rubriques de l’application.
- Intensité maximale du halo réduite de 18 %.

# Évolutions de Radar Produit

## 29 octobre 2026

- Sources : chaque panneau « Configurer cette source » explique les étapes sur la plateforme, les actions possibles dans Radar et le sens du statut enregistré.
- Visite : carte de lancement, description de la page affichée et halo sur le prochain onglet à cliquer ; fin explicite.

- Sources : logo de chaque plateforme affiché à côté de son nom et fiches alignées sur une hauteur uniforme.
- Navigation : le logo Radar ramène à Aujourd’hui, au clic comme au clavier.
- Démo recruteur intégrée à Radar : un lien permanent crée un espace fictif isolé par visiteur, avec parcours d’onboarding accessible et connecteurs externes désactivés.
- Visite : explication synchronisée avec la page affichée, commandes Précédent/Suivant et fin explicite ; halo à pulsation plus contrastée.

- Guidage : remplacement des contours par un halo diffus pulsant, fixe lorsque les animations sont réduites.

- Onboarding : étape CV facultative, carnet alimenté par le CV en l’absence de document détaillé, champs nécessaires identifiés et consignes intégrées aux formulaires mobiles.

## 29 octobre 2026

- Mobile : retour aux offres visible dès l’ouverture, actions tactiles agrandies et aide du guide dans l’en-tête pour libérer les cartes.

- Guide mobile : consignes de saisie compactes, champs dégagés pendant l’édition et espace de défilement jusqu’à l’enregistrement, au-dessus de la navigation du téléphone.

- Guide de prise en main : panneau ancré en bas à droite du viewport sur les grands écrans, avec marge de sécurité en bas.
- Navigation mobile : retrait du liseré citron latéral de l’onglet sélectionné.
- Kanban : action « Déplacer » avec choix de colonne, statut automatique et motif de clôture conservé, en complément du glisser-déposer.
- Mobile : champs du profil et des sources à 16 px, cibles tactiles et bouton de présentation adaptés.
- Profil : exemples dans les cinq champs de Ma présentation, sur mobile et ordinateur.
- Interface : espacement de fin de page réduit, réserve mobile ajustée à la navigation fixe.
- Candidatures sur tablette : identité, date et prochaine action regroupées, commandes alignées et lignes compactes.
- Performance : la lecture d’une offre après modification ou enregistrement d’un entretien cible désormais cette offre, ses entretiens et sa dernière note. Le chargement de la liste regroupe les entretiens en un seul passage.

## 28 octobre 2026

- Kanban des candidatures : suppression des colonnes personnelles avec retour des cartes dans leur étape, déplacement direct des cartes avec statut mis à jour automatiquement, retrait du sélecteur de statut redondant sur les cartes.
- Retouches visuelles discrètes de la navigation, des opportunités et des candidatures : contours, typographie et animations courtes, avec prise en compte de la réduction des animations. Les parcours et actions existants sont conservés.
- Opportunités : suppression du filtre « Toutes » pour éviter de mélanger les offres à examiner et les candidatures. Les correspondances Radar excluent aussi les offres déjà passées en candidature ; les anciens liens « Toutes » ouvrent « À examiner ».

- Identité : le favicon reprend le logo Orbite de l’interface Signal et son URL est versionnée pour renouveler le cache du navigateur.
- Comptes pilotes : un nouveau compte démarre avec un profil professionnel vide ; un profil déjà enregistré reste conservé. Le rechargement remet aussi l’interface à vide lorsqu’aucun profil n’existe.

- Onboarding : mise en lumière des onglets Profil, présentation et carnet ; progression après enregistrement du profil et validation d’une expérience, puis mini-visite contextuelle des écrans. Guide quittable et relançable.

- Opportunités : le relais de défilement page → liste et détail s'applique désormais aux tablettes dès 761 px, avec des colonnes et critères adaptés à leur largeur.

- Sauvegarde privee : export v3 complet incluant les colonnes Kanban, les colonnes personnalisees et le journal des notes automatiques. Restaurations v1 et v2 conservees pour les archives precedentes.

- Opportunités : la page défile jusqu’à la liste, puis la liste et le détail utilisent toute la hauteur disponible avec un défilement indépendant. Remonter au début d’une colonne permet de retrouver les filtres ; la lecture mobile et les données restent inchangées.

- Candidatures : choix Tableau / Kanban déplacé à côté du titre, retrait du rappel Privé et du bouton Actualiser de cet en-tête ; filtres En cours / Closes / Toutes réservés au tableau.


- Kanban : prise de la carte entière, ajout et renommage de colonnes rattachées aux étapes existantes, avec protection des déplacements concurrents.
- Notes de candidature enregistrées automatiquement et historisées ; brouillons du bilan, de l’annonce, de la planification et des réponses conservés entre deux ouvertures, sans confirmer les décisions métier à la place de l’utilisateur.
- Liste et Kanban plus compacts sur tablette et téléphone ; statuts courts, actions rapprochées et maintien des cibles tactiles.


- Kanban : déplacer une carte par sa poignée vers une autre étape, à la souris ou au clavier, avec confirmation d’enregistrement et conservation des notes, bilans, rendez-vous et date de candidature. Closes demande de distinguer refus et arrêt volontaire ; un retour dans Envoyées conserve l’historique d’entretiens. Le sélecteur de statut reste disponible.

## 27 octobre 2026

- Candidatures : vue Kanban alternative au tableau, colonnes Envoyées / Entretiens / Propositions / Closes. Rang d’entretien et prochain rendez-vous sur la carte ; annulations exclues du rang, données et statuts existants conservés.

- Préparer / brief Signal : prompt copiable en tête, aperçu replié, questions sans panneaux imbriqués et limite directement éditable dans le compteur. Notifications communes ; section de variantes retirée de la vue selon le prototype, sans suppression des données ni des outils du connecteur.

- Aujourd’hui Signal : actions suivantes, compteurs et agenda harmonisés avec les panneaux communs. Statut d’entretien en tête à droite, dates et fuseaux conservés, états vides lisibles ; mêmes actions et limites de trois éléments affichés.

- Aujourd’hui Signal : carte prioritaire pétrole compacte, titre direct sans « À faire maintenant » et filigrane Orbite blanc/citron recadré en bas à droite. Les priorités et destinations des actions restent inchangées.

- Recherche web Signal : cartes PO/PM et liens Google/Bing harmonisés, noms accessibles distinguant rôle et plateforme. Les huit destinations restent inchangées ; aucun compte ni contenu de plateforme n’est lu.

- Sources Signal : alerte Collective, recherches couvertes et actualisation du flux reprennent les en-têtes et retours communs. Une seule notification confirme l’actualisation ; un lien refusé reste saisi pour correction, sans création d’offre ni modification des autres paramètres.

- Sources Signal : cartes et formulaires de configuration alignés sur les composants communs. Notes conservées pendant les changements de vue et les actualisations ; confirmation par la notification partagée, sans changer les règles de configuration ou le stockage.

- Documents et présentation Signal : une ligne par fichier, import/remplacement et téléchargement explicites, choix d’une ancienne version replié ; présentation alignée sur les composants communs. Le brouillon reste disponible entre les sous-onglets et les notifications utilisent le même style. Les anciennes versions des fichiers, champs et autorisations restent conservés.

- Carnet Signal : crayon dans les en-têtes, statut auprès du titre, création et modification avec une seule action Enregistrer. Droits d’usage regroupés avec sélection par expérience, exceptions par réalisation et explication de « Présentation pro ». Les contenus restent privés sans autorisation explicite ; historique, versions et restauration sont conservés.

- Profil Signal : composants partagés pour les en-têtes, le dépliage et les réalisations. Description, objectif, résultat et actions restent une projection des champs texte existants, testée pour conserver les autres faits et leur provenance.

- Entretiens Signal : planification, bilan et lecture partagent les sections, éditeurs et actions de Ma candidature. Statuts en tête des cartes, sauvegarde accessible sur mobile, brouillon conservé en cas de refus serveur et notification unique. Les libellés des sélecteurs sont visibles dès le rendu serveur ; les champs et transitions existants sont conservés.

- Ma candidature Signal : liste continue sans avatars, en-têtes alignés, dates anciennes en warning ; dossier de 870 px, annonce dans l’en-tête et notes privées mises en forme. Une proposition reçue ouvre les notes, même avec un entretien à venir ; sauvegarde et notifications partagées, sans modification des permissions ou API.

- Notes Signal : composants partagés de mise en forme (gras, italique, listes), sauvegarde et erreurs ; contenu conservé comme texte balisé dans les limites des champs existants, sans HTML stocké ni nouvelle dépendance.

- Opportunités Signal : lecture en deux colonnes ouvertes, défilements indépendants sur ordinateur et fiche dédiée sur mobile ; sélection citron, accès à l’annonce auprès de la sélection, suivi « J’ai postulé » en haut du détail et notifications avec raccourci. Critères compacts, pertinence et réserves près du début de la description ; source discrète et dates secondaires en bas. Le filtre automatique reste disponible dans « Correspondances Radar ». La corbeille conserve sa confirmation et son motif, avec une action rouge.

- Navigation Signal : logo Orbite, barre supérieure redondante retirée, actualisation dans l’en-tête de page et indication privée près du compte. Titres, onglets et marges partagent les mêmes repères dans toute la plateforme.

- Fondations Signal : palette pétrole, gris minéraux et accent citron ; contrôles et tags unifiés, sélecteurs compatibles avec les libellés longs, notifications compactes en haut à droite et arrière-plan flouté des dialogues. Les données et commandes applicatives restent inchangées.

## 20 octobre 2026 — Blocs repliables

- Le carnet d’expériences et les sources utilisent un bouton discret à double chevron, avec un statut visible et des détails encadrés.
- Espacements corrigés : retraits réguliers autour des cartes et statuts, contenus imbriqués alignés et historique des documents avec marges internes.
- Le repli conserve les saisies en cours ; les liens vers l’historique et le prochain bloc à relire ouvrent les sections concernées.
## 20 octobre 2026 — Recherche PO/PM sans collecte de plateformes

- Ajout de liens Google/Bing pour repérer des annonces PO/PM en français, tous pays. LinkedIn et Welcome to the Jungle restent consultés manuellement ; Radar ne récupère pas leurs contenus et n’utilise aucun compte LinkedIn.
- La version actuelle ne contient aucun collecteur direct ; les limites d’accès et de réutilisation sont documentées.

## 20 octobre 2026 — Aperçu des offres depuis les API employeur

- Ajoute une lecture publique et ponctuelle des fiches individuelles Greenhouse/Ashby, sans identifiant, clé ou abonnement.
- Présente les informations dans le formulaire d’offre ; un clic explicite copie la proposition dans le brouillon, où les champs restent modifiables et le descriptif peut être prérempli avec les propositions existantes.
- Les URLs de télétravail, conditions et langues absentes restent inconnues ; le lieu du poste ne devient pas un pays autorisé.

## 20 octobre 2026

- Alertes Collective : le lien de recherche reçu par email peut être conservé dans Sources et ouvert pour vérifier les annonces individuelles. Une alerte agrégée ne crée aucune fiche d’offre fictive.
- Candidatures : date d’envoi, prochaine étape et statut dans des colonnes alignées et centrées sur grand écran ; cartes rééquilibrées sur écrans étroits, statut plus discret et bouton « Ouvrir » compact. Sans date d’entretien, la prochaine étape indique « Entretien à suivre » ; le menu du statut reste dans la fenêtre, défile si nécessaire et indique le focus sans double contour.

- Candidatures : le premier clic sur « J’ai postulé » enregistre sa date. La liste « En cours » affiche cette date dans un tag coloré à partir de 14 puis 30 jours, sans mention relative supplémentaire. Les suivis historiques sans date restent signalés comme inconnus.

- Navigation du profil : une nouvelle visite depuis un autre onglet ouvre le carnet d’expériences, sans perdre les brouillons. Les liens directs et l’historique du navigateur conservent l’accès aux documents.

- Opportunités : préremplissage local depuis le descriptif avec propositions à cocher, mode de travail et langue modifiables, présence hebdomadaire/mensuelle distincte et select du pays autorisé pour le télétravail. Migration additive pour conserver ces faits sans modifier le suivi de candidature.

- Design system : calendriers français partagés, date/heure séparées, skeletons communs, textareas redimensionnables, sélecteurs cohérents et aides secondaires accessibles au clavier et au toucher.

- Navigation : retour en haut après le changement effectif d’onglet, y compris lors du retour vers une section déjà visitée.

## 19 octobre 2026

- Filtre du carnet intégré au sélecteur commun : menu stylé sur ordinateur, panneau sur mobile, chevron aligné et champs espacés.

- Autorisations du parcours : panneau aéré, titre et bilan mieux espacés, bouton sur sa propre ligne sur mobile.

- Carnet allégé : accès directs au remplacement et à l’historique des documents, rappels répétitifs retirés et champs de saisie en graisse normale.

- Premier affichage préparé côté serveur après authentification : vue demandée présente immédiatement, profil et offres indépendants en cas d’erreur, lectures initiales API supprimées. [Audit et mesures de production locale](audits/accessibility-performance-2026-10-19.md) avec données fictives, résultats et réserves détaillés.

- Audit d’accessibilité : noms accessibles alignés sur les libellés visibles, sélecteurs mobiles utilisables au clavier, bordures de champs contrastées, textes agrandis sans troncature dans la navigation et erreurs conservées jusqu’à leur fermeture. Profil et sources chargés à la demande avec un état de reprise.

- Recette de la refonte : focus restauré, arrière-plan inerte dans les dialogues, notifications accessibles au-dessus de la navigation mobile, erreurs de sauvegarde persistantes et brouillons conservés.

- Profil réparti entre carnet, documents et présentation, brouillons conservés pendant la navigation ; réglages des sources repliables et confirmation d’enregistrement.

- Opportunités : liste compacte et fiche adjacente sur ordinateur, fiche dédiée et retour à la liste sur mobile ; sélection groupée à la demande et décision confirmée avant mise à jour.

- Accueil centré sur la prochaine action et les entretiens réels ; candidatures lisibles avec prochaine étape, dates et reprise après erreur.

- Refonte des fondations : titre unique par page sans baseline, navigation restaurable par URL, contrôles accessibles et états de chargement/erreur distincts.

- Carnet d’expériences : exemples repliables, titre et statut visibles dans l’en-tête, ouverture automatique lors de la relecture.
- Ajout d’exemples sous une expérience ; amélioration des fiches d’offres, des sections de candidature et de la boîte de dialogue de corbeille.

Première version publique anonymisée : tri des offres, pipeline de candidatures, entretiens, bibliothèque de faits avec consentement, questions et variantes de réponses, corbeille et tests de non-régression. Les intégrations privées et les données personnelles ne sont pas distribuées.
