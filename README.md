# Radar Produit

Radar Produit aide à trier des offres de Product Owner et Product Manager, suivre les candidatures et préparer des réponses à partir de faits approuvés. Ce dépôt présente une version de démonstration avec des données fictives, issue d’un outil développé pour répondre à un besoin réel de recherche d’emploi.

## Le problème produit

Les alertes dispersées créent du volume sans toujours donner assez d’informations pour décider. Radar rassemble les opportunités, rend les informations manquantes visibles et distingue une offre sélectionnée d’une candidature effectivement envoyée.

## Parcours disponibles

- Trier les nouvelles offres, les sélectionner, les mettre en veille ou les archiver.
- Qualifier une opportunité avec des règles explicables et des points à confirmer.
- Suivre les candidatures, entretiens et prochaines actions.
- Structurer une bibliothèque d’expériences et autoriser explicitement les faits réutilisables.
- Préparer un brief pour ChatGPT, conserver des questions et des variantes de réponses sans écraser les corrections.
- Supprimer et restaurer les offres avec une corbeille.

Les seuils de qualification sont des paramètres d’exemple codés dans cette démonstration. Les entreprises Atlas et Boréal, le profil et les documents de recette sont fictifs. Aucune candidature, boîte mail, pièce jointe ou base de données personnelle n’est distribuée.

## Démarche et contribution

Projet personnel de conception produit et de développement assisté par IA avec ChatGPT et Codex : formulation des besoins, priorisation, choix UX et validation humaine des parcours. Le code s’appuie sur un starter Sites/Vinext et des composants tiers dont les mentions de licence sont conservées.

Le projet illustre notamment trois décisions : conserver les opportunités négociables plutôt que les rejeter sur une information absente ; demander un consentement avant de réutiliser un fait personnel ; séparer les propositions générées des réponses corrigées et validées. Aucun résultat chiffré d’efficacité n’est revendiqué.

## Démarrer en local

Prérequis : Node.js 22.13 minimum et npm. Depuis un clone du dépôt :

```sh
npm ci
npm run build
```

Initialiser ensuite la base locale en appliquant les migrations SQL dans l’ordre :

```sh
node scripts/migrate-demo.mjs
npm run dev
```

Ouvrir `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/` pour utiliser l’identité locale de démonstration. Dans un autre terminal, `node scripts/seed-experience-ux-local.mjs` ajoute un parcours fictif. Les offres peuvent être ajoutées manuellement. L’identité simulée est limitée au développement local ; cette copie ne configure aucun service de production.

## Vérifications

```sh
npm test
npx tsc --noEmit --incremental false
```

Les tests couvrent notamment la qualification, les statuts, le consentement, l’isolation des comptes, les variantes de réponses, les sauvegardes et la corbeille. Les tests locaux ne prouvent pas le fonctionnement d’une intégration externe.

## Architecture et limites

React et TypeScript, Vinext/Vite, Drizzle avec Cloudflare D1, stockage documentaire R2 et serveur MCP. Les migrations SQL sont versionnées ; les bases locales, documents et secrets sont exclus du dépôt.

Les connexions Gmail, le connecteur ChatGPT, les automatisations et l’hébergement privé nécessitent leur propre configuration. Le clonage ne les active pas. La rédaction avec ChatGPT passe par une action manuelle et un connecteur configuré, ou par un brief copiable. Le serveur n’intègre pas de moteur d’inférence payant et n’envoie aucune candidature automatiquement.

## Évolution du projet

L’historique public commence avec une copie anonymisée du 19 octobre 2026. L’historique privé antérieur n’est pas publié. Les itérations suivantes seront regroupées en commits décrivant le problème traité, le changement et les vérifications ; le [journal des évolutions](CHANGELOG.md) en donnera une lecture produit.
