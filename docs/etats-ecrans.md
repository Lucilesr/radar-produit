# Inventaire des états de Radar

Relevé du 7 novembre 2026, après fusion documentaire de #207. Référence applicative de départ : staging version 13, code de `main` validé avant cet audit. L’inventaire ne change pas le code applicatif. Les corrections sont suivies séparément en fin de document, une PR par écran.

## Lecture et périmètre

- **oui** : l’état possède un rendu ou un comportement dans le code actuel ; **partiel** : il existe, avec une lacune décrite ; **non** : aucun traitement dédié. L’existence dans le code et la reproduction visuelle sont distinguées.
- Les captures viennent uniquement du staging, avec le personnage fictif Camille et des sociétés fictives. Aucun profil, CV, offre ou écran de production n’est publié.
- Formats de recette : **1360 × 900** et **390 × 844**, sans débordement horizontal de page dans les captures répertoriées. Le Kanban garde son défilement horizontal interne.
- Jeu de volume : **1 000 offres et 50 candidatures**, dont des descriptions et intitulés longs, des fourchettes, des aperçus incomplets et des annonces publiées depuis plus de 21 jours. Création par les API existantes, dans un compte `demo:` isolé ; aucun code applicatif ni schéma modifié.
- Un exemple chargé n’est pas un compte réellement vide. Un filtre sans résultat n’est pas une suppression des données. Les intitulés des captures précisent le scénario.
- Un écran à jour n’est pas une preuve de mode hors ligne. Les tentatives d’accès aux outils de simulation réseau de Chrome ont échoué (navigation puis application native). **Hors ligne réel, réseau lent et émulation du mouvement réduit restent à reproduire** ; aucune capture n’est présentée comme telle. La règle CSS de mouvement réduit et les chemins d’erreur sont examinés dans le code. Un conflit API 409 a en revanche été effectivement déclenché et capturé.
- Le manifeste [captures.json](etats-ecrans/captures.json) précise route, dimensions et version de staging de chaque image. Il ne contient aucun jeton ni cookie. Une capture prouve le rendu affiché, pas l’ensemble des variantes d’un écran.

## Inventaire par écran et sous-vue

Sources communes : [cadre](../components/radar-app.tsx), [états et erreurs](../components/workspace-ui.tsx), [squelettes](../components/loading-skeleton.tsx), [notifications](../components/workspace-feedback.tsx), [brouillons](../components/autosave.tsx). Les lignes ci-dessous couvrent les douze familles demandées pour **chaque** sous-vue ; les états spécifiques suivent le tableau.

### 1. Cadre, navigation et connexion

Implémentation : [components/radar-app.tsx](../components/radar-app.tsx). Menu principal, lien d’évitement et titre focalisable.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun poste défini ; les offres demandent de choisir un poste. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Chargement global : squelette nommé. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de jobs ou profil : WorkspaceState et Réessayer ; l’autre lecture reste disponible. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Menu principal, lien d’évitement et titre focalisable. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/tour-introduction-ordinateur.jpg), [mobile](etats-ecrans/tour-introduction-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 2. Aujourd’hui

Implémentation : [components/today-workspace.tsx](../components/today-workspace.tsx). Action prioritaire, trois actions suivantes au plus et trois entretiens au plus.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Ni offre ni sélection : file à jour, Ajouter une offre ; agenda vide explicite. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Squelette global ; pas de balayage fictif. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur globale avec Réessayer ; absence d’état propre à une source en erreur. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Action prioritaire, trois actions suivantes au plus et trois entretiens au plus. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/aujourdhui-volume-ordinateur.jpg), [mobile](etats-ecrans/aujourdhui-volume-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 3. Opportunités — liste et recherche

Implémentation : [components/opportunities-workspace.tsx](../components/opportunities-workspace.tsx). Liste en région nommée, cartes boutons et focus visible.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun résultat : message spécifique et Effacer la recherche. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Squelette global ; données déjà lues ensuite. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur de lecture globale ; échec de décision annoncé, offre réaffichée. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Liste en région nommée, cartes boutons et focus visible. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | partiel |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/tour-opportunites-ordinateur.jpg), [mobile](etats-ecrans/tour-opportunites-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 4. Opportunités — fiche et adéquation

Implémentation : [components/offer-workspace.tsx](../components/offer-workspace.tsx). Conditions, adéquation, informations absentes, description et dates.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Données manquantes : À confirmer, Fiche incomplète ou Fiche mystère ; aucune valeur inventée. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Fiche en mémoire ; aucun squelette distinct. | Attendre ; les commandes dépendantes sont désactivées. | partiel |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur d’une action : message et conservation des faits ; pas de délai sur toutes les requêtes. | Lire l’erreur et réessayer ; conserver le brouillon. | partiel |
| Succès | Lecture aboutie ou écriture confirmée. | Conditions, adéquation, informations absentes, description et dates. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/opportunites-fiche-ordinateur.jpg), [mobile](etats-ecrans/opportunites-fiche-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 5. Opportunités — éditeur / ajout / collage

Implémentation : [components/offer-form.tsx](../components/offer-form.tsx). Annuler, enregistrer ; préremplissage contrôlé ; limites de longueur.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Formulaire vide, intitulé requis ; brouillon et champs à confirmer. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Lecture du brouillon puis champs désactivés ; indicateur pendant l’enregistrement. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur d’enregistrement : saisie conservée ; erreur de lecture carrière distincte. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Annuler, enregistrer ; préremplissage contrôlé ; limites de longueur. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/opportunites-editeur-ordinateur.jpg), [mobile](etats-ecrans/opportunites-editeur-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 6. Opportunités — lot du jour

Implémentation : [lib/daily-lot.ts](../lib/daily-lot.ts). Vingt offres au plus ; progression et compteur ; cinq mystères sauf complément documenté.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Lot de taille zéro ou bouclé ; la réserve doit rester accessible. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Lot absent jusqu’à hydratation et lecture du stockage local. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec d’une décision : retour de l’offre ; compteur optimiste pendant la requête puis retour. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Vingt offres au plus ; progression et compteur ; cinq mystères sauf complément documenté. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/opportunites-lot-volume-ordinateur.jpg), [mobile](etats-ecrans/opportunites-lot-volume-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 7. Opportunités — réserve / groupes

Implémentation : [lib/reserve.ts](../lib/reserve.ts). Voir le groupe, confirmation avant corbeille ; cinquante offres au plus par action.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun groupe : il n’y a pas de carte de groupe vide ; accès aux archives nécessaire. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Pas de chargement de groupes distinct : projection des offres déjà lues. | Attendre ; les commandes dépendantes sont désactivées. | partiel |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de suppression groupée : offres réaffichées et message global. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Voir le groupe, confirmation avant corbeille ; cinquante offres au plus par action. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | partiel |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/opportunites-reserve-ordinateur.jpg), [mobile](etats-ecrans/opportunites-reserve-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 8. Opportunités — archives

Implémentation : [lib/opportunity-views.ts](../lib/opportunity-views.ts). Après 21 jours depuis publication, sinon ajout ; rouvrir redonne 21 jours.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucune offre archivée : état vide et retour à À examiner. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Pas de lecture distincte ; état calculé sur les offres. | Attendre ; les commandes dépendantes sont désactivées. | partiel |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Remise à examiner en erreur : offre conservée ; absence de délai dédié à cette écriture. | Lire l’erreur et réessayer ; conserver le brouillon. | partiel |
| Succès | Lecture aboutie ou écriture confirmée. | Après 21 jours depuis publication, sinon ajout ; rouvrir redonne 21 jours. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/opportunites-archives-ordinateur.jpg), [mobile](etats-ecrans/opportunites-archives-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 9. Opportunités — corbeille

Implémentation : [components/opportunities-workspace.tsx](../components/opportunities-workspace.tsx). Restauration conserve notes et entretiens ; purge après dix jours à l’ouverture.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Corbeille vide : explication ; recherche sans résultat distincte. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | État global puis commandes désactivées pendant la restauration. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de restauration : message conservé et actualisation proposée. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Restauration conserve notes et entretiens ; purge après dix jours à l’ouverture. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/opportunites-corbeille-ordinateur.jpg), [mobile](etats-ecrans/opportunites-corbeille-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 10. Candidatures — tableau / liste

Implémentation : [components/today-workspace.tsx](../components/today-workspace.tsx). Date, prochaine suite, statut et ouverture ; liste mobile.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | En cours, Closes ou Toutes sans résultat : Aucune candidature dans cette vue. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Squelette global. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de statut : message et retour au statut conservé. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Date, prochaine suite, statut et ouverture ; liste mobile. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/candidatures-liste-ordinateur.jpg), [mobile](etats-ecrans/candidatures-liste-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 11. Candidatures — Kanban / filtres / déplacement

Implémentation : [components/application-kanban.tsx](../components/application-kanban.tsx). Défilement horizontal contenu ; poignée clavier ; choix du motif pour Closes.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Colonnes vides explicites ; filtre par tag vide avec Effacer le filtre. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Chargement des colonnes, des tags et commande bloquée pendant déplacement. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur de tableau : Réessayer ; conflit de version : saisie gardée et message de rechargement. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Défilement horizontal contenu ; poignée clavier ; choix du motif pour Closes. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/candidatures-kanban-ordinateur.jpg), [mobile](etats-ecrans/candidatures-kanban-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 12. Candidatures — dossier et notes

Implémentation : [components/offer-workspace.tsx](../components/offer-workspace.tsx). Notes privées et historique ; annuler un envoi seulement tant qu’aucun entretien n’est lié.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Notes vides avec aide ; statut et candidature restent consultables. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Chargement de note et statut de sauvegarde ; saisie protégée. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Autosave : erreur persistante, brouillon local, Réessayer ; comparaison en cas de conflit. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Notes privées et historique ; annuler un envoi seulement tant qu’aucun entretien n’est lié. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/candidatures-fiche-ordinateur.jpg), [mobile](etats-ecrans/candidatures-fiche-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 13. Candidatures — questions du recruteur

Implémentation : [components/application-questions.tsx](../components/application-questions.tsx). Question, limite de caractères, réponse, historique et archivage réversible ; défaut B-C1 après confirmation.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucune question : Ajouter ; aucune variante : indication explicite. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Squelettes de questions et actions occupées. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Message d’erreur API ; après confirmation la réponse revient à son ancienne valeur dans le formulaire alors que la nouvelle existe côté serveur (B-C1). | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Question, limite de caractères, réponse, historique et archivage réversible ; défaut B-C1 après confirmation. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/candidatures-questions-ordinateur.jpg), [mobile](etats-ecrans/candidatures-questions-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 14. Entretiens — parcours / liste

Implémentation : [components/offer-workspace.tsx](../components/offer-workspace.tsx). Prévu, bilan à faire, bilan enregistré et annulé.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun entretien : texte et Ajouter un entretien. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Lecture intégrée à la fiche ; écriture occupée. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Annulation ou mise à jour en erreur : message, aucun faux succès. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Prévu, bilan à faire, bilan enregistré et annulé. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/entretiens-planifie-ordinateur.jpg), [mobile](etats-ecrans/entretiens-planifie-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 15. Entretiens — planifier / modifier

Implémentation : [components/offer-workspace.tsx](../components/offer-workspace.tsx). Calendrier et heure Signal ; un brouillon est récupérable.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Date vide : Enregistrer désactivé ; fuseau et durée explicites. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Chargement du brouillon, puis enregistrement ; champs désactivés. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Validation et erreur API : formulaire gardé ; notification d’erreur. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Calendrier et heure Signal ; un brouillon est récupérable. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/entretiens-brouillon-ordinateur.jpg), [mobile](etats-ecrans/entretiens-brouillon-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 16. Entretiens — bilan et relance

Implémentation : [components/offer-workspace.tsx](../components/offer-workspace.tsx). Texte privé, résultat, prochaine action et date de relance dans le fuseau.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Bilan vide possible ; relance absente ne crée aucun rappel extérieur. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Chargement du brouillon et progression d’enregistrement. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de bilan : texte autosauvé et erreur ; confirmer la suite séparément. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Texte privé, résultat, prochaine action et date de relance dans le fuseau. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/entretiens-bilan-brouillon-ordinateur.jpg), [mobile](etats-ecrans/entretiens-bilan-brouillon-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 17. Préparer / brief et copie

Implémentation : [components/offer-workspace.tsx](../components/offer-workspace.tsx). Prompt à relire et copier, sélection des faits autorisés.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Faits insuffisants : points à confirmer ; aucune expérience inventée. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Texte construit depuis le dossier ; pas de chargement IA simulé. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de copie annoncé ; pas de génération IA automatique dans Radar. | Lire l’erreur et réessayer ; conserver le brouillon. | partiel |
| Succès | Lecture aboutie ou écriture confirmée. | Prompt à relire et copier, sélection des faits autorisés. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/brief-ordinateur.jpg), [mobile](etats-ecrans/brief-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 18. Mon profil — carnet / recherche / filtres

Implémentation : [components/experience-library.tsx](../components/experience-library.tsx). Approuvée, à relire, masquée ; historique et provenance.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucune expérience ou aucun résultat : message ; recherche vide sans action Effacer. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | partiel |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Squelette, progression d’extraction et contenu préchargé. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Lecture, extraction, validation ou conflit : message et contrôles de reprise. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Approuvée, à relire, masquée ; historique et provenance. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | partiel |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/profil-carnet-rempli-ordinateur.jpg), [mobile](etats-ecrans/profil-carnet-rempli-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 19. Mon profil — expérience / exemples / consentement

Implémentation : [components/experience-library.tsx](../components/experience-library.tsx). Expérience, exemples, faits, validation et dialogue des droits d’usage.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Entreprise et présentation obligatoires ; enregistrer désactivé. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Actions désactivées pendant les écritures. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Saisie gardée ; erreurs métier et conflits ; droits séparés de la validation. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Expérience, exemples, faits, validation et dialogue des droits d’usage. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | partiel |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/profil-ajout-experience-ordinateur.jpg), [mobile](etats-ecrans/profil-ajout-experience-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 20. Mon profil — documents

Implémentation : [components/profile-documents.tsx](../components/profile-documents.tsx). Fichier enregistré, téléchargement, remplacement et versions antérieures conservées.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun fichier : importer ; démo : aucun document d’exemple pour cette rubrique. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Lecture de vos fichiers ; un lien peut être annoncé indisponible avant la fin du chargement. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Lecture/import/rattachement en erreur : alerte et actualisation ; fichiers antérieurs gardés. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Fichier enregistré, téléchargement, remplacement et versions antérieures conservées. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/profil-documents-fictifs-ordinateur.jpg), [mobile](etats-ecrans/profil-documents-fictifs-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 21. Mon profil — compte / export / suppression

Implémentation : [components/account-settings.tsx](../components/account-settings.tsx). Déconnexion ; export complet ; suppression typée SUPPRIMER et confirmation définitive.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Compte fictif : identité de démo ; ni suppression réelle ni import de fichiers. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Téléchargement de sauvegarde, validation de suppression et indicateur occupé. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec d’export ou de suppression : message, sans faux succès ; pas de restauration dans l’interface. | Lire l’erreur et réessayer ; conserver le brouillon. | partiel |
| Succès | Lecture aboutie ou écriture confirmée. | Déconnexion ; export complet ; suppression typée SUPPRIMER et confirmation définitive. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/profil-compte-ordinateur.jpg), [mobile](etats-ecrans/profil-compte-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 22. Ma recherche — résumé et critères

Implémentation : [components/search-criteria-panel.tsx](../components/search-criteria-panel.tsx). Critère, jetons éditables, Tout voir, Tout modifier ; niveau enregistré seulement à la validation.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun poste : invitation à définir son poste ; critères non renseignés explicités. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Brouillon de niveau puis Terminé ; écriture avec état occupé. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Échec de sauvegarde : erreur, jetons inchangés ; pas de faux succès. | Lire l’erreur et réessayer ; conserver le brouillon. | partiel |
| Succès | Lecture aboutie ou écriture confirmée. | Critère, jetons éditables, Tout voir, Tout modifier ; niveau enregistré seulement à la validation. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/recherche-criteres-enregistres-ordinateur.jpg), [mobile](etats-ecrans/recherche-criteres-enregistres-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 23. Ma recherche — éditeur complet / prévisualisation

Implémentation : [components/search-preferences-form.tsx](../components/search-preferences-form.tsx). Poste, pistes, contrat, présence, rémunération, lieux, mots-clés, score Jobgether.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Champs libres ou minimum nul ; absence de niveau n’équivaut pas à junior. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Indication d’enregistrement et commandes bloquées selon la requête. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur conservant la saisie ; modifications des faits distinctes des critères. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Poste, pistes, contrat, présence, rémunération, lieux, mots-clés, score Jobgether. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/recherche-editeur-complet-ordinateur.jpg), [mobile](etats-ecrans/recherche-editeur-complet-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 24. Sources — liste, état et actualisation

Implémentation : [components/source-panel.tsx](../components/source-panel.tsx). Nouvelle, à configurer, configurée, pause, échec temporaire ou dégradation par source.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucune source suivie : choix Automatiques ou À consulter. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Squelette et Actualiser occupé ; actualisation externe désactivée en démo. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Configuration ou sync en erreur : message et reprise ; pas de borne sur toutes les requêtes. | Lire l’erreur et réessayer ; conserver le brouillon. | partiel |
| Succès | Lecture aboutie ou écriture confirmée. | Nouvelle, à configurer, configurée, pause, échec temporaire ou dégradation par source. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | oui |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/sources-liste-ordinateur.jpg), [mobile](etats-ecrans/sources-liste-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 25. Sources — fiche et liens de recherche

Implémentation : [components/source-detail.tsx](../components/source-detail.tsx). Liens préparés, actions manuelles, dernière visite et fréquence.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Lien absent : instruction de configuration ; visites jamais réalisées explicites. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Contrôles occupés pendant les modifications. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur de lien ou sauvegarde : message, saisie gardée. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Liens préparés, actions manuelles, dernière visite et fréquence. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/sources-fiche-ordinateur.jpg), [mobile](etats-ecrans/sources-fiche-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 26. Sources — ajout / suggestions / retrait

Implémentation : [components/source-add-sheet.tsx](../components/source-add-sheet.tsx). Catalogue, ajout volontaire et confirmation de retrait ; offres préservées.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucun résultat : aide ; site personnalisé possible. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Ajout en cours et boutons désactivés ; prévention des doubles clics. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | URL ou champs invalides : message ; échec API dans la feuille. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Catalogue, ajout volontaire et confirmation de retrait ; offres préservées. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/sources-ajout-ordinateur.jpg), [mobile](etats-ecrans/sources-ajout-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 27. Tour — introduction / visite / configuration / reprise

Implémentation : [components/onboarding-tour.tsx](../components/onboarding-tour.tsx). Cinq écrans de visite, sept étapes de préparation, Terminer ou Plus tard.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | partiel |
| Vide | La collection est vide ou un filtre ne donne rien. | Compte non réglé : étapes de configuration ; pause puis reprise possible. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Vérification du carnet occupée ; erreurs de lecture peu détaillées. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Stockage local indisponible : pas d’erreur bloquante ; reprise non garantie. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Cinq écrans de visite, sept étapes de préparation, Terminer ou Plus tard. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/tour-introduction-ordinateur.jpg), [mobile](etats-ecrans/tour-introduction-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 28. Dialogues — calendrier / choix / confirmations

Implémentation : [components/choice-select.tsx](../components/choice-select.tsx). Focus, Échap, annulation et retour au déclencheur ; calendriers Signal.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Choix vide, recherche sans option ou confirmation non complétée. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Actions occupées, fermeture parfois bloquée pendant l’écriture. | Attendre ; les commandes dépendantes sont désactivées. | oui |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur de formulaire dans le dialogue ; les champs restent accessibles. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Focus, Échap, annulation et retour au déclencheur ; calendriers Signal. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/dialogue-calendrier-ordinateur.jpg), [mobile](etats-ecrans/dialogue-calendrier-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

### 29. Notifications — succès / information / erreur

Implémentation : [components/workspace-feedback.tsx](../components/workspace-feedback.tsx). Succès/info sept secondes, pause au survol ou focus ; erreur persistante.

| état | ce qui le déclenche | ce que voit la personne | action proposée | existe aujourd’hui ? |
| --- | --- | --- | --- | --- |
| Compte neuf | Première ouverture, critères ou contenus absents. | Le contenu fictif éventuel est marqué comme exemple ; la configuration ou l’état vide s’applique. | Définir le poste, consulter le guide ou créer le premier contenu. | oui |
| Vide | La collection est vide ou un filtre ne donne rien. | Aucune notification : aucun emplacement réservé. | Ajouter, changer de vue ou effacer le filtre selon le contexte. | oui |
| Chargement | Entrée, lecture du brouillon ou requête en cours. | Aucun toast de succès avant confirmation ; état occupé dans le formulaire. | Attendre ; les commandes dépendantes sont désactivées. | partiel |
| Erreur réseau ou API | Réponse non confirmée, erreur HTTP ou conflit de version. | Erreur persistante ; fermer manuellement ; dernière notification remplace la précédente. | Lire l’erreur et réessayer ; conserver le brouillon. | oui |
| Succès | Lecture aboutie ou écriture confirmée. | Succès/info sept secondes, pause au survol ou focus ; erreur persistante. | Poursuivre ; fermer le retour de confirmation si présent. | oui |
| Partiel : une source en erreur | Un flux échoue mais les autres données sont lisibles. | Les offres connues restent ; l’état de santé est détaillé dans Sources. Les autres écrans ne détaillent pas tous la panne. | Consulter Sources ; réessayer sans effacer les données. | partiel |
| Beaucoup de données | Compte de recette à 1 000 offres et 50 candidatures. | Le lot reste borné à vingt ; les listes, groupes, tableaux et historiques gardent leur défilement. Aucune garantie de virtualisation globale. | Filtrer, rechercher ou utiliser le lot du jour. | oui |
| Textes très longs | Titre, société, description ou note à la limite acceptée. | Retour à la ligne ou zone de saisie bornée ; les limites doivent être annoncées avant enregistrement. | Lire, corriger ou raccourcir ; conserver le texte non enregistré. | oui |
| Hors ligne | Connexion perdue après ouverture, ou avant une nouvelle visite. | Les données déjà en mémoire peuvent rester ; erreur de requête et brouillon local selon l’écran. Pas de mode de consultation hors ligne garanti ni de bandeau global. | Réessayer une fois la connexion revenue ; ne pas annoncer un faux enregistrement. | partiel |
| Mouvement réduit | Préférence système prefers-reduced-motion: reduce. | Les animations CSS sont coupées. Les déplacements JavaScript explicitement smooth du carnet ne suivent pas encore tous cette préférence. | Conserver les états finaux et les informations textuelles. | oui |
| Clavier seul | Navigation Tab, Entrée, Espace et Échap, sans pointeur. | Contrôles nommés et focus visible ; dialogues et retours au déclencheur. Les raccourcis S/L/X sont encore prévus, non livrés. | Utiliser les contrôles existants ; poignée clavier pour le Kanban. | oui |
| Mobile à 390 px | Écran de recette 390 × 844. | Navigation basse ; contenu sur une colonne ou feuille ; défilement contenu pour le Kanban. | Lire et agir sans défilement horizontal de la page. | oui |

Preuve visuelle de référence : [ordinateur](etats-ecrans/notification-succes-ordinateur.jpg), [mobile](etats-ecrans/notification-succes-mobile.jpg). Les variantes effectivement capturées sont indexées plus bas.

## Couverture des preuves

Les photos indexées couvrent les vues principales, les formulaires prêts et désactivés, plusieurs chargements observés, les listes et filtres vides, le conflit API 409, le bilan passé, une relance prévue, les confirmations, le succès et les textes longs. Le lot est photographié avec un compte contenant 1 000 offres et 50 candidatures (puis 50 offres déplacées en corbeille, toujours restaurables). Les nombres affichés évoluent pendant cette recette.

**Restent sans preuve visuelle exhaustive** : panne réseau réelle, hors ligne, préférence système de mouvement réduit, panne partielle de flux externe (la démo désactive l’actualisation externe), premier compte sans exemples et parcours de suppression définitive. Ces conditions sont recensées par lecture du code ; elles ne doivent pas être assimilées à des captures réussies. Les captures de navigation au clavier documentent un parcours réel, pas un audit de chaque combinaison de touches de tous les contrôles.

## États spécifiques et limites métier

- **Fiche mystère** : le titre correspond, mais l’aperçu est insuffisant ; Coller l’annonce révèle ensuite l’adéquation. Les informations inconnues ne valent pas zéro.
- **Décision en cours** : sélection et Plus tard sont optimistes ; en échec l’offre est réaffichée. Le compteur peut donc baisser provisoirement. La corbeille garde une limite de cinquante offres par action.
- **Lot bouclé / autre appareil** : aucun remplissage pendant le tri ; stockage de confort local et recalcul ailleurs. Pas de synchronisation du lot entre appareils.
- **Archives** : publication depuis au moins 21 jours, sinon date d’ajout ; sélection et candidature exclues. Remettre à examiner et Plus tard donnent un nouveau délai de 21 jours. Corriger le salaire ne rajeunit pas une annonce.
- **Entretiens** : un rendez-vous futur ne peut pas recevoir un bilan. Un rendez-vous passé propose le bilan ; la suite et la date de relance sont confirmées à sa fermeture. Aucun email de relance n’est envoyé automatiquement.
- **Conflit** : les colonnes du Kanban possèdent une version ; un conflit 409 conserve le nom saisi et explique de recharger. Les notes ont une comparaison de versions, plutôt qu’un écrasement silencieux.
- **Documents** : types et taille maximale de 8 Mo ; en démo, lecture des fichiers fictifs seulement. Une absence de document anglais n’est pas une panne réseau.
- **Consentement** : approuver un fait et l’autoriser pour une candidature ou une présentation sont des décisions séparées. Les contenus non autorisés restent privés.
- **Suppression de compte** : confirmation typée et avertissement irréversible ; aucune suppression définitive exécutée pour l’audit. La restauration intégrale est un outil hors interface, pas une fonction à présenter comme livrée dans Mon compte.

## Confrontation à la feuille de route, §4

| Référence | Constat actuel | Contradiction / suite |
| --- | --- | --- |
| §4.1 Compte neuf | Guide existant ; l’accueil ne remplace pas encore son contenu par les trois étapes prévues. | Écart d’orientation gênant pour un poste non choisi ; corriger l’état de départ sans livrer Q3/Q4/Q5. |
| §4.1 Rien à faire | File à jour / Ajouter une offre et agenda vide ; lot bouclé existe. | Le texte « Revenez demain, le radar veille » serait trompeur si l’actualisation est manuelle ; préférer l’état réel. |
| §4.1 Entretien imminent | L’agenda existe ; l’action prioritaire retient surtout les bilans et entretiens à dater. | « Comme aujourd’hui » ne décrit pas exactement la priorité de tout entretien imminent ; distinguer échéance future et bilan en retard. |
| §4.2 Balayage | Actualisation et santé par source existent, mais pas SignalRadar ni carte d’écho. | Écran futur Q2, pas un écran existant à maquiller en capture réelle. Le plafond de 60 s doit aussi borner l’attente côté interface. |
| §4.3 Lot vide | Message et retour de vue ; archives dépendantes de l’accès à la réserve. | Le lien vers les archives doit rester présent quand le lot contient tout le reste. |
| §4.3 Décision en erreur | Message, retour de l’offre et compensation du choix optimiste. | Le compteur peut bouger avant le résultat ; le texte « ne bouge pas » doit viser l’état confirmé ou conduire à attendre la réponse. |
| §4.3 Raccourcis S/L/X | Boutons et navigation clavier présents ; ces trois raccourcis ne le sont pas. | Fonction future de tri, ne pas les annoncer comme existants. |
| §4.3 Fiches mystère | Les guides imposent cinq places mais autorisent un complément si les offres ordinaires manquent. | Le strict « cinq au plus » du score / résumé de maquette est incompatible avec ce complément ; garder la règle détaillée de docs/tri.md et l’expliciter. |
| §4.4 Séance | Aucune séance ni reprise de séance dans sessionStorage. | Q3 à livrer ; la pause du tour et le lot du jour ne constituent pas une séance. |
| §4.5 Fin de séance | Seulement le bandeau de lot bouclé ; aucun bilan, pépite ou compteur de séance. | Q3 futur ; aucune célébration inventée dans la recette. |
| §4.6 Portée | Aucun radar à dix crans ni écran de paliers. | Q4 futur ; la jauge ne doit pas bloquer des fonctions existantes. |
| §4.7 Semaine | Aucun plan weekPlan, engagement ou rythme dans l’interface. | Q5 futur ; série et jokers restent masqués avant L1/L2. |
| §4.8 Réserve | Groupes, filtre et confirmation existent ; ni compteur de rafale ni Annuler immédiat de groupe. | Enrichissement futur, distinct du défaut d’accès aux archives. |
| §4 + §3.3 Réduit | CSS réduite existante ; défilements smooth explicites dans le carnet. | Écart réel d’accessibilité ; Q6 et data-motion ne sont pas livrés. |
| §1 et §4.3 | #201 et #206 sont fusionnées, testées et publiées ; §1 les dit encore à rebaser. | État documentaire périmé ; l’inventaire fait foi pour le livré, sans changer rétroactivement les maquettes. |
| Maquettes / §3.2 | HTML statiques demandent Google Fonts et support.js absent. | Les maquettes sont des références visuelles, pas une preuve d’autonomie hors ligne ni des composants livrés ; les polices de l’app restent locales/système. |

## États manquants ou défaillants, par gravité

### Bloquant

| ID | Écran | Défaut confirmé | Correction attendue | Suivi |
| --- | --- | --- | --- | --- |
| B-C1 | Candidatures / questions | Après validation, la réponse de 90 caractères est conservée côté serveur mais revient à sa valeur initiale dans le formulaire (vide lors du premier essai, formulaire à nouveau sale). Une seconde validation pourrait écraser la réponse avec du vide. | Conserver dans le brouillon la question, la limite et la réponse effectivement confirmées ; vérifier sauvegarde puis réouverture. | Correctif Candidatures préparé ; recette après déploiement. |

Preuve : `questions-apres-validation-defaut`, après une confirmation réelle. La lecture de contrôle API retrouve la réponse fictive et sa version 2 ; aucun contenu privé n’est inclus dans cette vérification. Un export ou une suppression définitive de compte n’a pas été exécuté pour l’audit.

### Gênant — à corriger sans nouvelle validation de périmètre

| ID | Écran | Défaut et conséquence | Correction attendue | Suivi |
| --- | --- | --- | --- | --- |
| G-O1 | Opportunités | Lien Archives uniquement dans la réserve ; si aucune offre n’attend hors du lot, il peut être inaccessible. | Accès indépendant du nombre d’offres dans la réserve. | Correctif Opportunités préparé ; recette après déploiement. |
| G-O2 | Opportunités / éditeur | L’ajout et la lecture de fiche employeur pouvaient laisser le formulaire occupé sans délai. | Sortie après 15 s et saisie conservée. | Correctif éditeur préparé. |
| G-S1 | Sources | Lectures et écritures non bornées ; une requête qui ne répond pas peut laisser des commandes occupées indéfiniment. | Délai maximum, fin de chargement, erreur compréhensible et reprise ; 60 s maximum pour l’actualisation. | Correctif Sources préparé ; recette après déploiement. |
| G-C1 | Candidatures / entretiens | Colonnes, tags, statuts et écritures d’entretien ont des requêtes sans borne cohérente. | Délai, sortie de l’état occupé, reprise et saisie conservée. | Correctif Candidatures préparé ; recette après déploiement. |
| G-C2 | Candidatures / notes | Une lecture d’historique sans réponse laissait un faux état vide. | Chargement nommé, délai et Réessayer sans modifier les notes. | Correctif historique préparé. |
| G-P1 | Mon profil / documents | Un fichier lié est déclaré indisponible pendant sa lecture initiale. | Squelette ou lecture en cours avant de conclure à l’absence ; erreur de lecture distincte. | Correctif Mon profil préparé ; recette après déploiement. |
| G-P2 | Mon profil / carnet | Recherche sans résultat : conseil de changer de filtre mais pas de commande pour effacer la recherche. | Message adapté et Effacer la recherche, avec retour du focus. | Même PR Mon profil. |
| G-P3 | Mon profil / carnet | Défilements JavaScript smooth non soumis à la préférence système. | Positionnement instantané si le mouvement réduit est demandé. | Même PR Mon profil. |
| G-P4 | Mon compte | Une requête de suppression sans réponse pouvait verrouiller le dialogue indéfiniment. | Délai de 60 s, fin de l’attente et vérification du compte avant toute nouvelle tentative. | Correctif Mon compte préparé ; aucune suppression exécutée pour la recette. |
| G-P5 | Mon compte | Après Échap ou Annuler, le focus retombait sur le corps de page. | Revenir au bouton d’ouverture du dialogue. | Correctif Mon compte préparé. |
| G-A1 | Aujourd’hui | Nouveau profil sans poste : le chemin vers le réglage initial n’est pas explicite dans la carte prioritaire. | Orientation vers poste, sources et première actualisation ; tour existant conservé. | Correctif Aujourd’hui préparé ; recette après déploiement. |
| G-T1 | Tour de prise en main | Une navigation contextuelle ouvre Ma recherche sans faire avancer l’étape « Ouvrez Ma recherche ». | Suivre la page effectivement ouverte, quelle que soit l’action de navigation. | Correctif Tour préparé ; recette après déploiement. |

### Cosmétique ou amélioration planifiée

- La typographie et les animations Q0 ne sont pas un défaut bloquant des écrans Signal actuels ; ne pas appliquer la maquette comme un redesign global.
- Pas de raccourcis S/L/X, de séance, de portée ou de plan de semaine : fonctions planifiées, et non régressions à corriger dans cet inventaire.
- Hors ligne : aucun bandeau explicite ; les messages de requête et les brouillons couvrent seulement une partie du parcours. Émulation visuelle non disponible dans la session de recette, à compléter.
- Les textes « Tout est examiné » et « Rien de neuf » ne différencient pas toujours absence d’import, filtres trop stricts et lot bouclé.
- Plusieurs états de chargement sont très brefs ; le navigateur de recette ne permet pas une capture déterministe sous réseau lent. Les rendre artificiellement longs pour une photo changerait le comportement testé.

## Index des captures réellement produites

Les images suivantes sont des captures d’interface, jamais des maquettes. Une ligne vaut deux fichiers distincts. Les captures d’erreur utilisent un scénario identifié, sans modifier le code de l’application.

| Scénario | Ordinateur | Mobile |
| --- | --- | --- |
| aujourdhui-volume | [1360 px](etats-ecrans/aujourdhui-volume-ordinateur.jpg) | [390 px](etats-ecrans/aujourdhui-volume-mobile.jpg) |
| brief | [1360 px](etats-ecrans/brief-ordinateur.jpg) | [390 px](etats-ecrans/brief-mobile.jpg) |
| candidatures-colonne-brouillon | [1360 px](etats-ecrans/candidatures-colonne-brouillon-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-colonne-brouillon-mobile.jpg) |
| candidatures-conflit-api | [1360 px](etats-ecrans/candidatures-conflit-api-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-conflit-api-mobile.jpg) |
| candidatures-fiche | [1360 px](etats-ecrans/candidatures-fiche-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-fiche-mobile.jpg) |
| candidatures-kanban | [1360 px](etats-ecrans/candidatures-kanban-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-kanban-mobile.jpg) |
| candidatures-kanban-filtre-vide | [1360 px](etats-ecrans/candidatures-kanban-filtre-vide-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-kanban-filtre-vide-mobile.jpg) |
| candidatures-liste | [1360 px](etats-ecrans/candidatures-liste-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-liste-mobile.jpg) |
| candidatures-liste-vide | [1360 px](etats-ecrans/candidatures-liste-vide-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-liste-vide-mobile.jpg) |
| candidatures-questions | [1360 px](etats-ecrans/candidatures-questions-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-questions-mobile.jpg) |
| candidatures-volume-50-kanban | [1360 px](etats-ecrans/candidatures-volume-50-kanban-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-volume-50-kanban-mobile.jpg) |
| candidatures-volume-50-liste | [1360 px](etats-ecrans/candidatures-volume-50-liste-ordinateur.jpg) | [390 px](etats-ecrans/candidatures-volume-50-liste-mobile.jpg) |
| dialogue-calendrier | [1360 px](etats-ecrans/dialogue-calendrier-ordinateur.jpg) | [390 px](etats-ecrans/dialogue-calendrier-mobile.jpg) |
| dialogue-tag-nouveau | [1360 px](etats-ecrans/dialogue-tag-nouveau-ordinateur.jpg) | [390 px](etats-ecrans/dialogue-tag-nouveau-mobile.jpg) |
| dialogue-tags | [1360 px](etats-ecrans/dialogue-tags-ordinateur.jpg) | [390 px](etats-ecrans/dialogue-tags-mobile.jpg) |
| entretiens-bilan-a-faire | [1360 px](etats-ecrans/entretiens-bilan-a-faire-ordinateur.jpg) | [390 px](etats-ecrans/entretiens-bilan-a-faire-mobile.jpg) |
| entretiens-bilan-brouillon | [1360 px](etats-ecrans/entretiens-bilan-brouillon-ordinateur.jpg) | [390 px](etats-ecrans/entretiens-bilan-brouillon-mobile.jpg) |
| entretiens-bilan-confirme | [1360 px](etats-ecrans/entretiens-bilan-confirme-ordinateur.jpg) | [390 px](etats-ecrans/entretiens-bilan-confirme-mobile.jpg) |
| entretiens-brouillon | [1360 px](etats-ecrans/entretiens-brouillon-ordinateur.jpg) | [390 px](etats-ecrans/entretiens-brouillon-mobile.jpg) |
| entretiens-editeur | [1360 px](etats-ecrans/entretiens-editeur-ordinateur.jpg) | [390 px](etats-ecrans/entretiens-editeur-mobile.jpg) |
| entretiens-planifie | [1360 px](etats-ecrans/entretiens-planifie-ordinateur.jpg) | [390 px](etats-ecrans/entretiens-planifie-mobile.jpg) |
| notification-succes | [1360 px](etats-ecrans/notification-succes-ordinateur.jpg) | [390 px](etats-ecrans/notification-succes-mobile.jpg) |
| opportunites-ajout-vide | [1360 px](etats-ecrans/opportunites-ajout-vide-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-ajout-vide-mobile.jpg) |
| opportunites-archives | [1360 px](etats-ecrans/opportunites-archives-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-archives-mobile.jpg) |
| opportunites-corbeille | [1360 px](etats-ecrans/opportunites-corbeille-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-corbeille-mobile.jpg) |
| opportunites-editeur | [1360 px](etats-ecrans/opportunites-editeur-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-editeur-mobile.jpg) |
| opportunites-fiche | [1360 px](etats-ecrans/opportunites-fiche-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-fiche-mobile.jpg) |
| opportunites-lot-volume | [1360 px](etats-ecrans/opportunites-lot-volume-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-lot-volume-mobile.jpg) |
| opportunites-recherche-vide | [1360 px](etats-ecrans/opportunites-recherche-vide-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-recherche-vide-mobile.jpg) |
| opportunites-reserve | [1360 px](etats-ecrans/opportunites-reserve-ordinateur.jpg) | [390 px](etats-ecrans/opportunites-reserve-mobile.jpg) |
| profil-ajout-experience | [1360 px](etats-ecrans/profil-ajout-experience-ordinateur.jpg) | [390 px](etats-ecrans/profil-ajout-experience-mobile.jpg) |
| profil-carnet-rempli | [1360 px](etats-ecrans/profil-carnet-rempli-ordinateur.jpg) | [390 px](etats-ecrans/profil-carnet-rempli-mobile.jpg) |
| profil-clavier | [1360 px](etats-ecrans/profil-clavier-ordinateur.jpg) | [390 px](etats-ecrans/profil-clavier-mobile.jpg) |
| profil-compte | [1360 px](etats-ecrans/profil-compte-ordinateur.jpg) | [390 px](etats-ecrans/profil-compte-mobile.jpg) |
| profil-documents-fictifs | [1360 px](etats-ecrans/profil-documents-fictifs-ordinateur.jpg) | [390 px](etats-ecrans/profil-documents-fictifs-mobile.jpg) |
| profil-droits-dialogue | [1360 px](etats-ecrans/profil-droits-dialogue-ordinateur.jpg) | [390 px](etats-ecrans/profil-droits-dialogue-mobile.jpg) |
| profil-recherche-vide | [1360 px](etats-ecrans/profil-recherche-vide-ordinateur.jpg) | [390 px](etats-ecrans/profil-recherche-vide-mobile.jpg) |
| profil-textes-longs | [1360 px](etats-ecrans/profil-textes-longs-ordinateur.jpg) | [390 px](etats-ecrans/profil-textes-longs-mobile.jpg) |
| questions-apres-validation-defaut | [1360 px](etats-ecrans/questions-apres-validation-defaut-ordinateur.jpg) | [390 px](etats-ecrans/questions-apres-validation-defaut-mobile.jpg) |
| questions-limite-depassee | [1360 px](etats-ecrans/questions-limite-depassee-ordinateur.jpg) | [390 px](etats-ecrans/questions-limite-depassee-mobile.jpg) |
| questions-nouvelle-vide | [1360 px](etats-ecrans/questions-nouvelle-vide-ordinateur.jpg) | [390 px](etats-ecrans/questions-nouvelle-vide-mobile.jpg) |
| recherche-criteres-enregistres | [1360 px](etats-ecrans/recherche-criteres-enregistres-ordinateur.jpg) | [390 px](etats-ecrans/recherche-criteres-enregistres-mobile.jpg) |
| recherche-editeur-complet | [1360 px](etats-ecrans/recherche-editeur-complet-ordinateur.jpg) | [390 px](etats-ecrans/recherche-editeur-complet-mobile.jpg) |
| recherche-menu-critere | [1360 px](etats-ecrans/recherche-menu-critere-ordinateur.jpg) | [390 px](etats-ecrans/recherche-menu-critere-mobile.jpg) |
| recherche-niveau-brouillon | [1360 px](etats-ecrans/recherche-niveau-brouillon-ordinateur.jpg) | [390 px](etats-ecrans/recherche-niveau-brouillon-mobile.jpg) |
| relances-date-prevue | [1360 px](etats-ecrans/relances-date-prevue-ordinateur.jpg) | [390 px](etats-ecrans/relances-date-prevue-mobile.jpg) |
| reserve-confirmation | [1360 px](etats-ecrans/reserve-confirmation-ordinateur.jpg) | [390 px](etats-ecrans/reserve-confirmation-mobile.jpg) |
| sources-ajout | [1360 px](etats-ecrans/sources-ajout-ordinateur.jpg) | [390 px](etats-ecrans/sources-ajout-mobile.jpg) |
| sources-catalogue-vide | [1360 px](etats-ecrans/sources-catalogue-vide-ordinateur.jpg) | [390 px](etats-ecrans/sources-catalogue-vide-mobile.jpg) |
| sources-fiche | [1360 px](etats-ecrans/sources-fiche-ordinateur.jpg) | [390 px](etats-ecrans/sources-fiche-mobile.jpg) |
| sources-liste | [1360 px](etats-ecrans/sources-liste-ordinateur.jpg) | [390 px](etats-ecrans/sources-liste-mobile.jpg) |
| sources-retrait-confirmation | [1360 px](etats-ecrans/sources-retrait-confirmation-ordinateur.jpg) | [390 px](etats-ecrans/sources-retrait-confirmation-mobile.jpg) |
| tour-aujourdhui | [1360 px](etats-ecrans/tour-aujourdhui-ordinateur.jpg) | [390 px](etats-ecrans/tour-aujourdhui-mobile.jpg) |
| tour-candidatures | [1360 px](etats-ecrans/tour-candidatures-ordinateur.jpg) | [390 px](etats-ecrans/tour-candidatures-mobile.jpg) |
| tour-introduction | [1360 px](etats-ecrans/tour-introduction-ordinateur.jpg) | [390 px](etats-ecrans/tour-introduction-mobile.jpg) |
| tour-opportunites | [1360 px](etats-ecrans/tour-opportunites-ordinateur.jpg) | [390 px](etats-ecrans/tour-opportunites-mobile.jpg) |
| tour-profil | [1360 px](etats-ecrans/tour-profil-ordinateur.jpg) | [390 px](etats-ecrans/tour-profil-mobile.jpg) |
| tour-recherche | [1360 px](etats-ecrans/tour-recherche-ordinateur.jpg) | [390 px](etats-ecrans/tour-recherche-mobile.jpg) |

## Journal des corrections

À compléter après les PR par écran. La production reste sur la version explicitement validée auparavant ; cet audit et ses correctifs ne l’autorisent pas à évoluer.
