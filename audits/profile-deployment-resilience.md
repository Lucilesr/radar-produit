# Profil — résistance aux mises à jour (5 novembre 2026)

## Cause et correction

Un onglet ouvert avant un déploiement pouvait demander au premier accès au profil
un ancien fichier JavaScript versionné, devenu introuvable. React.lazy mémorise
aussi le rejet de cet import ; changer d'onglet ne permettait pas de récupérer.

ProfileWorkspace est désormais un import statique de RadarApp. L'interface du
profil, des expériences et des documents fait partie du graphe initial téléchargé
avec l'application. Les composants restent montés seulement à la première visite ;
les requêtes de données restent déclenchées à ce moment-là. Aucun rechargement
automatique, changement de données ou migration n'est ajouté.

## Recette sur compilation de production

Recette locale avec base fictive isolée, sur la version corrigée :

1. Compiler, appliquer les migrations locales, démarrer le serveur de production.
2. Ouvrir deux onglets sur Aujourd'hui, sans avoir visité le profil.
3. Déplacer temporairement le répertoire des chunks JavaScript hors de son chemin
   de service. Une requête HTTP directe vers un fichier de l'application confirme
   une réponse 404. Cela reproduit la disparition des anciens fichiers lors d'une
   mise à jour, sans remplacer les API.
4. Dans le premier onglet, ouvrir Mon profil puis Mes documents : expériences et
   fichiers fictifs s'affichent, sans rechargement et sans écran de section bloquée.
5. Dans le second onglet, en 390 × 844, ouvrir Profil pour la première fois :
   les expériences s'affichent également après la disparition des fichiers.
6. Tab permet d'atteindre les sections ; Entrée ouvre Mes documents et conserve un
   focus visible. Le titre reçoit le focus à l'ouverture du profil.
7. Restaurer les fichiers avant toute compilation ou publication.

Résultat : ouverture du profil réussie sur ordinateur et mobile alors que les
anciens fichiers JavaScript sont indisponibles. Ce test simule le retrait des
fichiers d'un déploiement ; ce n'est pas un test de deux déploiements de production
successifs ni une garantie de disponibilité du réseau ou des API.

## Vérifications

- Compilation de production Vinext réussie.
- TypeScript sans émission réussi.
- 27 tests existants réussis : navigation, profil initial, référence documentaire,
  expériences et validation des documents.
- UI Signal conservée : ProfileWorkspace, ExperienceLibrary, ProfileDocuments,
  workspace-tabs, boutons et styles de focus existants. Aucun nouveau contrôle
  ou style ajouté. Rendu ordinateur et mobile, chargement/désactivation observés,
  sélection des sous-onglets et navigation clavier vérifiés.

## Limites

Le code du profil est désormais chargé au démarrage : son coût réseau est avancé,
sans nouvelle dépendance. L'extraction PDF/DOCX déclenchée à la demande conserve son
propre chargement. Les onglets déjà ouverts sur la version défectueuse doivent être
actualisés une fois pour recevoir la correction. Cette modification ne rétablit
pas les anciens fichiers supprimés par la plateforme d'hébergement.

