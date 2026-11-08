# P4 — recette de la prochaine étape commune

Staging privé version 66, le 8 novembre 2026, source 88538fd8b4d4ccc8db535f8fcc710f00b39f28d4. Uniquement le compte fictif déjà utilisé : 1 000 offres et 50 candidatures, contrôlés par l’API avant et après. Aucune migration ni production.

## Résultats vérifiés sur le staging

- Ordinateur 1 360 × 900 et mobile 390 × 844 : une étape principale et deux pistes au plus. Au départ, les deux relances précèdent le lot de vingt offres et le plan.
- Ancienne séance : les trois étapes déjà enregistrées restent dans leur ordre (lot, relances, validation). La reprise fonctionne, puis sa fin sans nouvelle action revient à l’accueil sans faux bilan.
- Fin confirmée : « C’est tout pour aujourd’hui. Le radar veille. » reste après rechargement. Revoir les étapes est volontaire. Une nouvelle séance reprend ensuite la file commune.
- Nouvelle séance : relances → lot → plan → candidature soignée → réglage, conformément aux données disponibles. Les deux relances fictives confirmées disparaissent de leur étape. Radar n’envoie aucun message.
- Plan : ouverture depuis l’étape, suggestion compatible issue de la file, bouton Enregistrer désactivé avec des engagements vides. Aucun plan n’est enregistré pendant cette recette.
- Candidature sélectionnée : focus sur le premier repère à préparer. Trois confirmations font passer à 3 sur 4. Le bilan affiche exactement deux relances et une candidature soignée ; les étapes seulement parcourues n’y ajoutent rien. Les compteurs à zéro sont repliés.
- Entretien prioritaire : déplacement temporaire d’un entretien fictif à moins de 24 heures ; il passe avant le lot sur les deux formats. Commencer ouvre Prioriser dans le carnet, focus au titre, sans validation automatique. Sa date d’origine du 12 novembre, son fuseau et ses autres champs ont ensuite été rétablis et relus par API.
- Portée inchangée : 4 sur 10 avant/après ; le prochain réglage de niveau vient de la file, les autres restent repliés.
- Clavier : Entrée ouvre le plan, Échap le ferme et le focus revient au bouton de l’étape. Cibles tactiles de 44 px, textes longs à la ligne, aucun débordement horizontal. Date lisible et sans défilement interne de la carte.
- Préférence de mouvement réduit active ; transitions observées à 0 s. Console nominale vide sur le staging.

## Vérifications de code et limites

400 tests réussis et TypeScript réussi. ESLint : 35 erreurs préexistantes, aucune nouvelle. Neuf tests du moteur et de la compatibilité couvrent les sept priorités, le vide, les 48 heures, les sept jours pour les sources, les doublons, les entrées immuables, le calendrier du lundi, les anciennes séances et le seuil de préparation confirmé. Les étapes d’une nouvelle séance peuvent aller jusqu’à sept ; elles restent moins nombreuses lorsque les données ne les justifient pas.

Les sources manuelles n’étaient pas actives dans ce compte de recette : leur seuil de sept jours est vérifié par les tests dédiés, sans prétendre avoir visité un site externe. Une panne réseau réelle n’est pas provoquée pendant cette recette ; les erreurs et données conservées restent couvertes par les contrôles existants. La largeur du long titre dans la fiche mobile reste le point déjà identifié pour C4, demandé après P5.

Le point de confort de fin ne contient que le compte et le jour, dans le stockage de l’onglet ; il ne remplace pas la continuité du compte. Les instantanés de préparation ne contiennent que des nombres, sans textes privés. Une ancienne séance sans ces nombres ne reçoit aucun progrès reconstitué.

## Aide visible

Accueil au repos : 27 mots (durée 7, plan facultatif 7, source 9, confidentialité 4), hors date et commandes. En reprise : 25 ; après la fin : 20. Les informations sont repliées ; même leur ouverture et le tour restent sous 120 mots. Les autres sous-vues gardent les aides courtes de P8 ; le plan et le récit restent sous cette limite.

Les captures avant/après sont réelles et fictives, dans ce dossier. Dimensions contrôlées pour chaque fichier. Les confirmations de relance et de préparation restent dans les seules données de recette ; le rendez-vous temporairement déplacé est restauré.
