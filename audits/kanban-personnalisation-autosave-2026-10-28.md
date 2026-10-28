# Kanban personnel et conservation des saisies — 28 octobre 2026

## Choix validés

- La carte entière peut être saisie. Le titre garde son clic d’ouverture ; les champs et sélecteurs gardent leurs interactions. La poignée reste une entrée clavier.
- Chaque nouvelle colonne correspond à Envoyées, Entretiens, Propositions ou Closes. Exemple : Échange RH dans Entretiens. Son nom est libre, son identifiant reste stable après renommage.
- Les statuts métier et les rendez-vous restent distincts du classement visuel. Un changement de statut incompatible effectué ailleurs réaffiche le dossier dans la colonne de référence : aucune carte ne disparaît.
- Ajout et renommage sont disponibles, sans suppression de colonne dans cette livraison. Closes conserve le choix explicite Refus reçu / J’arrête le processus.

## Stockage et concurrence

Les migrations 0011 et 0012 sont additives : une colonne nullable de classement sur jobs, une table de configuration personnelle et une table de révisions de texte. Aucun DROP, DELETE, TRUNCATE, réimport ou réinitialisation n’est nécessaire. Les valeurs de notes déjà présentes dans profiles restent physiquement conservées.

Le classement écrit le statut et la colonne dans la même ligne. La vue transmet le statut et la colonne qu’elle a lus ; une modification concurrente est refusée plutôt qu’écrasée. Le renommage utilise également une version conditionnelle.

Les notes et brouillons sont enregistrés dans workspace_writes, avec une clé propriétaire/document/version unique. Chaque sauvegarde ajoute une révision. La première sauvegarde d’une note conserve aussi sa valeur précédente, y compris lorsqu’elle vient de l’ancien profil. Les lectures de dossiers superposent la dernière note au stockage historique, sans réécrire le profil, les documents ou les entretiens.

La sauvegarde attend 750 ms de pause, sérialise les requêtes et conserve une copie locale à chaque changement. Une réponse ancienne ne remplace pas une saisie plus récente. La file continue quand une fiche se ferme ; elle est relancée au retour du réseau. Une saisie non confirmée déclenche la protection de fermeture du navigateur. Les brouillons locaux sont séparés par propriétaire, document et instance de page ; les révisions serveur sont contrôlées par l’authentification et la propriété du dossier.

En cas de conflit, aucun remplacement automatique : le texte local reste dans le champ et la version distante est consultable avant une confirmation explicite. Le serveur conserve les versions antérieures. L’historique des notes affiche les 50 dernières révisions ; les autres ne sont pas supprimées. Un quota local indisponible et une sauvegarde refusée sont signalés.

## Texte sauvegardé et décisions métier

- Notes privées : sauvegarde directe, sans bouton Enregistrer ni toast à chaque pause.
- Bilan : texte et choix en cours sauvegardés en brouillon ; Terminer le bilan confirme la suite de candidature. Rédiger ne clôt pas un entretien et ne change pas prématurément le statut.
- Modification d’annonce et planification : brouillon automatique ; l’enregistrement explicite confirme les faits ou crée le rendez-vous.
- Questions du brief : question, réponse et limite gardées en brouillon ; la mise à jour explicite conserve le contrôle de version existant et met à jour le prompt.
- Retour ferme un éditeur en conservant son brouillon. Les anciennes versions restent dans le journal même après validation.

Les nouvelles écritures utilisent /api/workspace-drafts/[key]. L’ancien PATCH de note accepte une écriture séparée et exige la version courante après création des révisions ; une note ne peut pas être écrasée par un ancien formulaire sans version. Aucun consommateur interne ne combine l’écriture d’une note et celle d’un statut.

## Présentation responsive

Les titres du tableau deviennent Poste, Envoyée le, Suite, Statut. Les contrôles du suivi utilisent des libellés compacts ; leurs menus gardent les intitulés complets. À largeur intermédiaire : identité/date à gauche, prochaine étape au centre, sélecteur et action à droite. Sur téléphone : identité, date et suite, puis statut et action côte à côte. Les cibles tactiles principales restent de 44 px. Le défilement horizontal appartient au Kanban, pas à la page.

MouseSensor avec seuil de mouvement, TouchSensor avec maintien de 250 ms et tolérance de 6 px, KeyboardSensor avec flèches : la prise de carte ne désactive pas le défilement tactile sur toute sa surface. Références : [capteur Pointer et alternatives Mouse/Touch](https://dndkit.com/legacy/api-documentation/sensors/pointer/), [activateurs de carte](https://dndkit.com/legacy/api-documentation/draggable/).

## Recette et limites

119 tests passent, dont sérialisation des sauvegardes, fermeture/reprise, panne réseau, conflit, limite de longueur, stockage local indisponible, versions SQLite, isolement propriétaire A/B, origine étrangère, colonnes et déplacements concurrents. TypeScript et compilation publique passent. Les nouveaux composants et modules sont contrôlés au lint ; des erreurs hooks héritées subsistent dans les grands écrans existants, sans annoncer le lint global résolu. Aucune CI distante n’est configurée.

Recette réelle Chromium dans une copie fictive isolée : ajout puis renommage d’une seule colonne dédiée, glisser-déposer depuis le nom de l’entreprise, aller-retour clavier entre deux colonnes de la même étape, note saisie puis fermeture immédiate, rechargement et historique des notes, reprise du bilan après rechargement. Le bilan reste un brouillon et l’entretien existant reste identique.

16 états responsive ont été examinés : liste/Kanban à 1440, 1100, 900, 768, 390, 320 px ; dialogue de colonne à 390/320 px ; notes et bilan à 320 px. Aucune largeur de page ou de dialogue ne déborde. À 900 px, les lignes fictives mesurent environ 130 px, selon leur contenu. Les captures et les supports de recette restent locaux.

La comparaison API avant/après vérifie l’identité des candidatures et notes préexistantes, du profil, des expériences, documents et sources. Seuls une nouvelle candidature fictive et une nouvelle colonne de recette ont été ajoutées. Le dossier déplacé conserve son entretien et sa date d’origine. Code et 35 travaux Git privés préexistants inchangés ; base privée non accédée et aucun déploiement privé.

Le tactile sur appareil physique, Safari/Firefox et un lecteur d’écran réel restent à vérifier. Une copie locale ne remplace pas une sauvegarde serveur : l’indication Enregistré confirme l’accusé du serveur. Une panne de stockage locale est visible ; on ne revendique pas une garantie absolue contre toute panne du navigateur ou de l’appareil. Les champs de création d’une toute nouvelle opportunité, avant existence de son dossier, ne font pas partie de l’autosave des cartes existantes.
