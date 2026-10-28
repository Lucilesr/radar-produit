# Signal — fondations visuelles

Palette : pétrole #24566B, pétrole foncé #193F50, texte #203743, secondaire #5B6B76, fond #F3F5F6, surface #FFFFFF, surface secondaire #EAF0F3, bordure #D4DFE5, champ #7B8E99, sélection citron #E6EE53. Succès #176947, attention #80551A, suppression #BE263D.

Police système Avenir Next / Segoe UI / Arial, sans téléchargement externe. H1 28/1.2, dossier 24/1.3, section 14/1.5, onglet de dossier 15/1.45. Les rôles HTML décrivent la structure du contenu.

Boutons : rayon 5 px, minimum 42 px (44 sur mobile), contour de focus pétrole 3 px décalé de 3 px. Principal pétrole et texte blanc. Sélection citron réservée à une offre sélectionnée ; suppression rouge et annulation neutre. Désactivation à 50 %, dimensions de chargement stables.

Tags et dates : police de l’interface, 12/16 px, padding 4×8 px, minimum 26 px, rayon 4 px, texte centré. Libellés longs multilignes sans hauteur fixe.

Menus : Radix et Vaul conservés. Valeurs longues multilignes, groupes en gras, contours contrastés. Comportements clavier existants conservés.

Notifications : WorkspaceToast, blanc et texte pétrole, pictogramme citron pour succès et rouge pour erreur. En haut à droite, largeur maximale 340 px, action facultative et fermeture. Succès/info 7 secondes, pause au survol ou au focus ; erreur persistante. Tous les onglets intégrés et le brief utilisent ce composant commun.

Modales : surface blanche, bordure discrète, fond neutre avec flou. Focus, inertie, Escape et restauration de focus conservés.

Validation initiale : TypeScript, compilation Vinext et 95 tests applicatifs réussis. Les tests métier ne constituent pas une certification d’accessibilité. Aucun endpoint, migration ni schéma modifié dans ce lot.

## Private note editing

The shared NoteEditor provides bold, italic, bullet and numbered lists plus native undo/redo. API values remain strings using explicit emphasis/list markers. Existing plain text remains supported. The formatter escapes HTML before generating its own allowlisted tags; pasted and dropped content is inserted as plain text. Markup counts against the existing field limits. Overlong input stays visible and must be shortened before saving; it is never silently truncated.

Native browser editing commands preserve selection and undo history. This uses the existing browser editing API, without a new dependency. Chromium is checked locally; Safari/Firefox still require a dedicated compatibility pass. No HTML storage, schema change or change in use permissions.

## Concordance finale (27–28 octobre 2026)

Les cinq onglets, les sous-onglets du profil et les quatre sections du dossier reprennent les fondations Signal. La revue globale corrige le brief resté dans l’ancienne composition : aperçu du prompt replié, questions à plat, limite éditable dans le compteur, mêmes contrôles et notifications. Les variantes stockées restent conservées, leur panneau est retiré de cet écran selon l’arbitrage validé.

La vue Kanban complémentaire de Candidatures utilise les mêmes cartes, tags, dates, sélecteurs, dossiers et erreurs. Les colonnes projettent les statuts existants ; rang et rendez-vous sont calculés sans migration. Les limites d’accessibilité, de compatibilité navigateur et de lint sont documentées dans `signal-revue-globale-2026-10-27.md` ; aucune certification ni CI distante n’est annoncée.

## Déplacement des candidatures (28 octobre 2026)

La poignée du Kanban mesure 32 px sur bureau et 44 px sur mobile. Le titre reste un accès au dossier ; la poignée est la seule zone de prise tactile. Aperçu flottant et surlignage utilisent les surfaces, bordures et couleurs Signal. Le déplacement au clavier utilise Entrée/Espace, gauche/droite, Échap et Tab, avec annonces françaises et restauration de focus. Le statut n’est confirmé visuellement qu’après sauvegarde. Le choix de clôture réutilise boutons, erreur et fond flouté, dans un dialogue compact. Le sélecteur reste disponible. Conservation et limites : `signal-kanban-drag-2026-10-28.md`.
