# L1 — Journal privé et continuité du compte

Le journal commence à l’activation. Aucun événement ancien n’est inventé. La table `activity_events` appartient au compte (`user_id` obligatoire), avec identifiant, action, type et identifiant d’objet, date ISO et données JSON de repérage. Index compte/date/id et pagination de vingt événements. Les notes, CV, réponses et textes des histoires n’y sont pas copiés ; aucun service tiers.

## Écritures et reprise

Les transitions métier écrivent leur événement dans la même transaction que leur résultat. Les non-changements n’en créent pas. Les relances déclarées faites utilisent un reçu déterministe et un marqueur persistant dans l’entretien ; corriger son texte ne recrée pas le rappel, changer sa date oui. Les candidatures closes n’offrent plus ce rappel. Les histoires restent privées tant que leurs droits ne sont pas accordés séparément.

Le lot du jour et le point de reprise sont conservés dans le profil, dans un champ protégé des anciens formulaires. Le lot verrouillé ne se remplit pas à nouveau. Les versions de lot et de séance sont distinctes ; une séance obsolète reçoit un conflit. Terminer la séance et écrire son événement est atomique ; un ancien onglet ne peut pas la ressusciter. Une reprise reste volontaire, sans réouverture automatique de parcours. Le stockage du navigateur sert uniquement à récupérer une ancienne séance et à conserver une lecture de secours ; fermer une page hors ligne ne garantit pas sa transmission.

## Migration et sauvegarde

`drizzle/0015_activity_events.sql` ajoute uniquement la table et son index. Aucune suppression ni modification des données existantes. Application sur le staging uniquement dans cette livraison. La sauvegarde intégrale passe en v4 et inclut le journal ; la vérification conserve les formats v1, v2 et v3. Les migrations 13/14 annoncées par ces formats sont aussi vérifiées. Suppression du compte et restauration suivent la même liste de tables.

## Vérifications

337 tests réussis, dont transactions annulées sans reçu orphelin, vraies transitions, réessais, isolation A/B, pagination, reprise versionnée, concurrence et anciennes pages de profil. Vérification TypeScript réussie ; aucune nouvelle erreur ESLint par rapport à la base (35 erreurs préexistantes). Parcours local de démarrage, rechargement, reprise et fin de séance : confirmé, sans erreur console.

La recette sur le staging et ses captures sont consignées dans `l1-journal/README.md` avant fusion.
