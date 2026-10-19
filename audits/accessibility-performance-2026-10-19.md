# Audit de la refonte — accessibilité et performance

19 octobre 2026. Résultats sur une compilation de production locale, avec des données entièrement fictives. Les corrections d’accessibilité sont dans la PR #10 ; l’amélioration du premier affichage et ce rapport complètent cette PR.

## Périmètre et méthode

Cinq onglets : Aujourd’hui, Opportunités, Candidatures, Mon profil et Sources. Trois vues du profil : carnet, documents, présentation. Recette avec 50 offres, 8 candidatures, une expérience et 12 exemples. Contrôles automatiques sur les sept vues à 1440 × 1000 et 390 × 844 ; contrôles de reflow à 320 px, navigation clavier et états ouverts. Les critères applicables sont issus de [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Les instantanés des états ouverts servent à contrôler la structure et les styles ; leurs scripts sont retirés. Les interactions sont vérifiées séparément dans l’application réelle. Le contrôle des textes à 200 % double les tailles calculées dans un instantané ; il ne remplace pas une recette complète du zoom avec chaque navigateur. Les espacements sont appliqués ensemble : interligne 1,5, espace après les paragraphes 2 em, lettres 0,12 em, mots 0,16 em, selon le [critère 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html).

L’authentification hébergée, le connecteur, la page de sauvegarde et le contenu des documents importés ne font pas partie de cette refonte. Les corpus français et fictifs testés ne permettent pas de conclure sur la langue de toutes les futures annonces importées.

Les contrôles axe utilisent le moteur 4.14.0 et l’API officielle de son outillage avec une [émulation de dimensions explicites](https://developer.chrome.com/docs/chromedriver/mobile-emulation). Chaque résultat est rejeté si ses dimensions mesurées diffèrent des dimensions attendues. Les menus sont capturés séparément pour éviter toute troncature ; leurs interactions sont contrôlées dans l’application réelle.

## Résultat et réserves

Les 14 vues actives et les 10 états complémentaires ne présentent plus de violation automatique. Huit signalements de contraste nécessitaient une vérification manuelle : six textes du tiroir, dont le fond était indéterminable par axe en raison d’un pseudo-élément, et deux notifications superposées au contenu. Les couleurs calculées dans le navigateur sont opaques et donnent des rapports de 5,53:1 à 12,63:1 dans le tiroir, et 15,17:1 dans les notifications. Le nom et les références ARIA du menu desktop ont été corrigés puis rescannés.

Les problèmes constatés dans les parcours testés ont été corrigés. Ce rapport distingue les observations, les cas sans objet et les réserves ; aucun taux global de conformité ni attestation WCAG n’est revendiqué.

Le test vocal VoiceOver a été autorisé puis tenté. Le pilotage des applications macOS n’a pas répondu ; VoiceOver est resté arrêté selon l’inventaire des applications. La lecture vocale et une recette NVDA ne sont donc pas validées. Les noms, rôles, valeurs et états ont été contrôlés dans le DOM et l’arbre d’accessibilité disponible. Les [tests automatiques seuls](https://www.deque.com/axe/axe-core/) ne suffisent pas à établir la conformité.

## Corrections

- Navigation : le nom accessible reprend le libellé affiché sur chaque taille d’écran ; le compteur possède un libellé lisible.
- Sélecteurs : nom du champ et valeur exposés, focus sur les options du tiroir mobile, Échap et retour au déclencheur vérifiés.
- Fenêtres : seuls les éléments réellement visibles et actifs participent à la boucle de focus.
- Formulaires : champ d’analyse associé à son libellé, intitulé obligatoire explicite, lien de profil identifié comme URL.
- Contrastes : bordures des champs et de la recherche renforcées ; focus blanc sur les notifications sombres.
- Lecture : marque, navigation et nom du compte peuvent revenir à la ligne avec des textes agrandis. Les dates sont recalculées à l’ouverture et lors d’une actualisation demandée, sans modification périodique pendant la lecture.
- Reprise : focus sur la recherche après effacement, sur le titre si une candidature disparaît de la vue, et sur l’exemple suivant après fermeture du consentement. Erreurs persistantes et brouillons conservés.
- Chargement : profil et sources différés avec un état d’erreur récupérable ; données initiales et vue demandée préparées côté serveur après authentification, avec gestion indépendante des pannes du profil et des offres.

## Contrastes mesurés

| Élément | Couleurs | Rapport |
| --- | --- | ---: |
| Bordure de champ sur blanc | `#858593` / `#ffffff` | 3,64:1 |
| Bordure de recherche sur fond | `#858593` / `#f8f8f6` | 3,42:1 |
| Violet sur blanc | `#5751cf` / `#ffffff` | 6,03:1 |
| Texte secondaire sur blanc | `#60616e` / `#ffffff` | 6,12:1 |
| Statut validé | `#286044` / `#edf5ef` | 6,64:1 |
| Statut à relire | `#805416` / `#fff5e4` | 6,08:1 |

Ces rapports couvrent les couleurs citées ; les autres textes visibles des vues et états scannés sont contrôlés par axe.

## Grille WCAG 2.2 A et AA

« Observé » signifie qu’aucun défaut n’a été relevé sur le périmètre et les états vérifiés. « Réserve » indique une couverture incomplète. La grille ne certifie pas les contenus futurs ou les services externes.

| Critère | État | Observation |
| --- | --- | --- |
| 1.1.1 | Observé | Boutons nommés, icônes décoratives et textes adjacents contrôlés. |
| 1.2.1 à 1.2.5 | Sans objet | Pas de média audio ou vidéo dans les vues auditées. |
| 1.3.1 | Observé | Formulaires étiquetés, groupes nommés, un H1 et des H2. |
| 1.3.2 | Observé | Ordre de lecture et parcours liste / fiche conservés. |
| 1.3.3 | Observé | Instructions exprimées par du texte, sans dépendre d’une position ou couleur. |
| 1.3.4 | Observé | Aucun verrouillage de l’orientation ; reflow contrôlé. |
| 1.3.5 | Observé | URL du profil identifiée ; les autres champs décrivent la recherche et les offres. |
| 1.4.1 | Observé | Statuts, sélection et erreurs explicités par du texte et des états. |
| 1.4.2 | Sans objet | Aucun son automatique du produit. |
| 1.4.3 | Observé | Contrôles axe et rapports de contraste sur les couleurs principales. |
| 1.4.4 | Réserve | Tailles de texte doublées et lisibilité contrôlée sur instantanés ; zoom natif complet non validé. |
| 1.4.5 | Sans objet | Pas d’information transmise par une image de texte. |
| 1.4.10 | Observé | Aucun débordement horizontal relevé à 320 px sur les cinq onglets. |
| 1.4.11 | Observé | Bordures de saisie et états de focus renforcés. |
| 1.4.12 | Observé | Espacements renforcés contrôlés sur carnet et formulaire ouverts. |
| 1.4.13 | Sans objet | Pas de contenu applicatif déclenché uniquement au survol ; titres natifs du navigateur exclus. |
| 2.1.1 | Observé | Entrée, Espace, Tab, Maj+Tab, flèches et Échap dans les parcours contrôlés. |
| 2.1.2 | Observé | Fenêtres et sélecteurs quittables ; boucles de focus contrôlées. |
| 2.1.4 | Sans objet | Aucun raccourci global constitué d’un caractère seul. |
| 2.2.1 | Observé | Erreurs conservées jusqu’à fermeture ; confirmations conservées pendant leur consultation. |
| 2.2.2 | Observé | Retrait des mises à jour périodiques pendant la lecture ; animations réduites par préférence système. |
| 2.3.1 | Observé | Aucun clignotement rapide ; indicateurs de chargement lents. |
| 2.4.1 | Observé | Lien d’évitement vers le titre et navigation identifiée. |
| 2.4.2 | Observé | Document intitulé Radar Produit et titre de vue explicite. |
| 2.4.3 | Observé | Retours de focus corrigés après fermeture, consentement, recherche et clôture. |
| 2.4.4 | Observé | Actions et liens décrits par leur objet ou leur contexte. |
| 2.4.5 | Sans objet | Périmètre constitué des états internes d’une application sur une page. |
| 2.4.6 | Observé | Titres et libellés décrivent la section ou l’action. |
| 2.4.7 | Observé | Indicateurs de focus visibles et contrastés. |
| 2.4.11 | Observé | Focus contrôlé avec navigation fixe, sélection, fenêtre et tiroir. |
| 2.5.1 | Observé | Toutes les actions testées disposent d’un clic simple. |
| 2.5.2 | Observé | Actions déclenchées au clic ; corbeille confirmée et restaurable. |
| 2.5.3 | Observé | Libellés de navigation, sélecteurs et sélection des exemples inclus dans leurs noms accessibles. |
| 2.5.4 | Sans objet | Aucun geste de mouvement de l’appareil nécessaire. |
| 2.5.7 | Observé | Le tiroir peut être fermé et utilisé sans le faire glisser. |
| 2.5.8 | Observé | Cibles et étiquettes associées contrôlées ; aucun défaut de taille relevé. |
| 3.1.1 | Observé | Langue du document définie sur français. |
| 3.1.2 | Réserve | Interface et corpus de recette français ; langues des futurs contenus importés non auditées. |
| 3.2.1 | Observé | Aucun changement de vue provoqué par la seule prise de focus. |
| 3.2.2 | Observé | Sauvegardes explicites et changements de statut correspondant à l’action demandée. |
| 3.2.3 | Observé | Navigation stable sur les cinq onglets. |
| 3.2.4 | Observé | Actions communes identifiées de façon cohérente. |
| 3.2.6 | Sans objet | Pas de dispositif d’aide distinct répété sur plusieurs pages. |
| 3.3.1 | Observé | Erreurs annoncées et conservées dans les formulaires et notifications. |
| 3.3.2 | Observé | Champs libellés, obligation et contraintes d’import indiquées. |
| 3.3.3 | Observé | Erreurs accompagnées d’une reprise ou d’une correction possible. |
| 3.3.4 | Observé | Confirmation des usages, révisions des expériences et corbeille restaurable. |
| 3.3.7 | Observé | Données du profil, documents existants et notes réutilisés dans les parcours. |
| 3.3.8 | Hors périmètre | Authentification fournie par l’hébergeur ; pas de formulaire de connexion modifié. |
| 4.1.2 | Réserve | Structure, noms, rôles et valeurs vérifiés ; session avec lecteur vocal non réalisée. |
| 4.1.3 | Réserve | Régions de statut et d’alerte contrôlées ; annonce vocale effective non validée. |

## Performance

Mesures Lighthouse sur production locale, cache réinitialisé, Chrome sans interface, profil mobile avec ralentissement simulé par défaut. Trois passages mobiles par parcours ; un passage desktop par parcours. Les médianes sont calculées pour chaque métrique. Ces valeurs de laboratoire ne constituent pas une mesure terrain des Core Web Vitals ni de l’INP. La [méthode de simulation Lighthouse](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) dépend aussi de la machine de test.

| Parcours | Profil | Passages | Score | FCP | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Aujourd’hui | mobile | 3 | 98 | 1.83 s | 2.17 s | 40 ms | 0.000 |
| Aujourd’hui | desktop | 1 | 100 | 0.50 s | 0.56 s | 0 ms | 0.000 |
| Opportunités | mobile | 3 | 96 | 2.01 s | 2.38 s | 4 ms | 0.000 |
| Opportunités | desktop | 1 | 100 | 0.50 s | 0.60 s | 0 ms | 0.000 |
| Carnet d’expériences | mobile | 3 | 94 | 1.99 s | 2.35 s | 0 ms | 0.097 |
| Carnet d’expériences | desktop | 1 | 99 | 0.51 s | 0.69 s | 0 ms | 0.073 |

Les trois médianes mobiles respectent le budget local retenu : score ≥ 90, LCP ≤ 2,5 s, TBT ≤ 200 ms, CLS ≤ 0,1. La plage des scores et chaque passage sont conservés dans le JSON. Le TBT est un indicateur de laboratoire, pas une mesure de l’INP.

Le LCP médian de l’accueil passe de 2.98 s avant rendu serveur à 2.17 s après, sur le corpus fictif. Les décalages de mise en page mesurés sur l’accueil et les opportunités sont nuls dans ces passages. Les mesures du carnet restent sous le budget, avec un CLS médian de 0.097. Aucun appel initial redondant à `/api/jobs` ou `/api/profile` n’a été relevé après hydratation.

Les données sont préparées avec l’identité authentifiée et le même filtrage par propriétaire que l’API. Les tests vérifient les pannes partielles et la séparation de deux propriétaires ; un contrôle HTTP vérifie aussi le refus d’accès anonyme et l’absence des offres de recette pour une seconde identité fictive. Aucun chargement initial redondant des offres et du profil n’est nécessaire après hydratation.

## Reproduction et validation

`npm run build`, contrôle TypeScript et 76 tests réussis dans le projet source et sa copie publique. Les résultats synthétiques, versions et paramètres sont consignés dans [results-2026-10-19.json](results-2026-10-19.json). Les rapports bruts, bases et captures restent hors du dépôt.

Pour reproduire les mesures, utiliser les versions d’axe CLI, axe-core et Lighthouse indiquées dans le JSON avec un navigateur compatible. Sur un build de production authentifié localement avec une identité fictive :

```sh
axe "$AUDIT_URL" --axe-source "$AXE_SOURCE" --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa,best-practice --load-delay 1200 --exit
lighthouse "$AUDIT_URL" --chrome-flags=--headless --only-categories=accessibility,performance --output=json --output-path=rapport-mobile.json
lighthouse "$AUDIT_URL" --preset=desktop --chrome-flags=--headless --only-categories=accessibility,performance --output=json --output-path=rapport-desktop.json
```

Pour reproduire les deux dimensions avec axe, utiliser `testPages` de `@axe-core/cli` avec un pilote Chrome configuré par `setMobileEmulation` : `deviceMetrics: {width, height, pixelRatio: 1, touch: mobile, mobile}` et `clientHints: {platform: mobile ? "Android" : "macOS", mobile}`. Vérifier `testEnvironment.windowWidth` et `windowHeight` dans chaque résultat.

L’environnement local doit fournir ses propres données fictives et son authentification de test. Aucun contournement de connexion n’est ajouté au code déployable.
