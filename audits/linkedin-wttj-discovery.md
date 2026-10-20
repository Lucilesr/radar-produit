# Collecte LinkedIn / Welcome to the Jungle — pilote

## État et périmètre

La refonte de l’interface et le préremplissage d’un descriptif collé ne constituent pas une collecte d’offres. Le flux RSS disponible dans Radar ne couvre que We Work Remotely. LinkedIn et WTTJ sont référencés dans le catalogue mais leur présence ne signifie pas qu’ils sont connectés.

Ce premier lot vérifie une recherche **PO/PM, annonces contenant du français, tous pays** sur les pages publiques LinkedIn. Il ne nécessite ni Gmail, ni IA, ni API payante, ni compte LinkedIn. La langue de l’annonce, la langue de travail, le lieu du poste et les pays de télétravail autorisés restent des informations distinctes.

## Exécution locale

```sh
python3 scripts/linkedin-public-pilot.py --max-details 3 > /private/tmp/radar-linkedin-proposals.json
python3 tests/linkedin-public-pilot.test.py
```

Le JSON contient des propositions et les motifs de rejet, pas une confirmation d’import. Un seul résultat de recherche est lu, puis au plus cinq fiches, sans pagination ni nouvelle tentative automatique. Les fiches supplémentaires sont comptées comme différées. Le budget compte les lectures logiques ; les redirections HTTP ordinaires peuvent ajouter des requêtes réseau.

Le pilote sélectionne les intitulés PO/PM et leurs variantes françaises. La requête recherche les termes français/French, puis une règle locale vérifie la présence de plusieurs marqueurs français dans le descriptif. Cette règle accepte les annonces bilingues, peut manquer des annonces courtes et ne garantit pas une couverture exhaustive. Les résultats ne sont donc pas un décompte du marché.

Les liens sont limités aux fiches publiques `https://*.linkedin.com/jobs/view/…`. Les paramètres de tracking sont retirés ; l’ID LinkedIn produit un lien source stable. Le texte du descriptif conserve ses paragraphes et listes, dans la limite Radar de 12 000 caractères ; une troncature est signalée par `contentCoverage: partial`.

Les champs contrat, rémunération, remote et langue restent à vérifier avant import : ce pilote ne transforme pas un indice en fait. Le lieu de l’annonce ne renseigne jamais le pays autorisé pour le télétravail. La date collectée est celle fournie par la carte, jamais une date relative calculée à partir de « hier ». L’heure du contrôle est séparée.

## Accès et limites

Le programme n’utilise ni session, ni cookie, ni identifiant, ni proxy de rotation ou navigateur déguisé. Il s’arrête sur une limitation HTTP, une vérification anti-robot ou une structure non reconnue. Une absence de descriptif ou une erreur réseau ne prouve jamais qu’une offre est fermée. Les signaux explicites de clôture sont séparés des erreurs d’accès.

Un accès public qui répond techniquement ne vaut pas autorisation d’automatisation. [LinkedIn interdit les outils de scraping et d’automatisation non autorisés](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?intendedLocale=en&lang=en-us). Les [CGU WTTJ](https://www.welcometothejungle.com/fr/pages/terms) interdisent également l’extraction automatisée. Aucun fonctionnement continu ni absence de restriction ne peut être garanti. Ne pas activer ce pilote dans une tâche récurrente sans résoudre ce point d’accès avec la plateforme.

Les essais WTTJ ont montré deux limites : un résultat indexé comme récent peut correspondre à une offre fermée, et une fiche peut demander une vérification anti-robot. Aucun contournement WTTJ ni collecteur WTTJ automatique n’est inclus dans ce lot.

## Passage vers Radar

1. Examiner les propositions et vérifier les conditions dans la fiche source, avec leur provenance.
2. Qualifier seulement les faits explicites et conserver les inconnues. Le préremplissage local existant peut aider à proposer les champs à vérifier.
3. Importer les propositions retenues via `radar_import_offers`, au plus vingt par lot ; relire ensuite leur persistance avec `radar_list_offers`.
4. Réutiliser l’ID et le lien stable pour les relances ; enrichir une fiche existante via `radar_update_offer`, sans remplacer son suivi, ses notes ou ses entretiens.

Le pilote n’écrit jamais dans la base, ne publie rien et ne crée aucune tâche planifiée. Les captures, pages et résultats réels restent hors Git ; seuls du code, ce protocole générique et des tests entièrement fictifs sont publiables.
