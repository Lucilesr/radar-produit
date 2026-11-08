# Recette P2 — réglages du radar

Staging privé **61**, code public `8d5fd66`, source Sites `1f2a48d6c74383698c9ba195727b36a19d57eabc`. Avant : staging 60. Données et captures entièrement fictives, mille offres et cinquante candidatures. Aucune migration ni production.

| Vérification | Résultat |
| --- | --- |
| Avant / après | Portée détaillée et bloc d’accueil :1 360 × 900 et390 × 844, dimensions contrôlées. |
| Calcul conservé | Même compte à 4 sur 10 avant et après, deux réglages faits. lib/radar-reach.ts inchangé ; tests Q4, score et seuils toujours réussis. |
| Quatre paliers | Repérage, Balayage, Longue portée, Précision. Quatre segments, valeur accessible 4 sur 10, palier Balayage. |
| Six réglages | Six lignes dans trois groupes, une seule action ouverte. Réglages faits et autres réglages fermés par défaut ; ouverture clavier conserve le focus. |
| Histoires dans le carnet | Continuer dans le carnet ouvre Mes histoires et focalise son titre. Aucun des huit thèmes ne reste comme bouton dans la portée. |
| Choix de thème | Huit thèmes accessibles. Sur ordinateur, Un désaccord ouvre cet éditeur. Sur mobile, Un impact chiffré ouvre le bon éditeur ; options de 48 px, fermeture de 44 px. |
| Dialogue / clavier | Échap ferme l’éditeur et rend le focus à Écrire ou poursuivre. Aucun récit validé par l’ouverture ou la fermeture. |
| Mobile / mouvement réduit |390 px, mêmes choix, boutons de 44 px, pas de débordement horizontal. Préférence de mouvement réduit du compte conservée. |
| États et valeurs | Les tests couvrent 0 et 10, lecture partielle du titre, six réglages faits, groupes, libellés et lien direct des histoires. Le rendu de lecture partielle garde les valeurs connues et suspend l’action ; nouvelle panne réseau non provoquée dans cette recette. |
| Contrôles |390 tests réussis, TypeScript réussi, aucune nouvelle erreur ESLint (35 préexistantes). Console nominale finale sans erreur. |

Aide visible sans clic, mesurée sur la page déroulante : **accueil : 91 mots**, **portée : 6 mots au repos**, **29 mots tous réglages ouverts**, **carnet : 39 mots avec Mes histoires ouvert**. Les dates, sociétés, chiffres métier, titres et commandes sont exclus ; la mention du calendrier fictif est comptée par prudence dans l’accueil. Les infobulles fermées sont exclues. Même contenu sur ordinateur et mobile.

Le compteur sur 8 correspond aux thèmes couverts. Les autres récits personnels validés continuent de compter dans le calcul existant. P4 fournira le moteur central ; P6 retirera le bloc de portée de l’accueil. Les captures de choix mobile montrent la feuille Signal ; les thèmes ont aussi été vérifiés au clavier sur ordinateur.
