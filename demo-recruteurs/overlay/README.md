# Radar Produit — Démo recruteurs

Cette démo publique reprend les écrans et le design system Signal de Radar Produit, ainsi que son nouveau guide interactif. Elle utilise un Site, une base D1 et un bucket R2 distincts. Aucun historique Git, document ou enregistrement de l’instance privée n’est inclus.

Chaque visiteur reçoit un espace fictif séparé par un identifiant de session aléatoire en cookie HTTP-only. Huit offres, un profil, deux expériences, un entretien et deux documents Markdown fictifs illustrent les écrans réels. Les écritures effectuées dans la démo restent dans son stockage distinct ; le lien « Réinitialiser la démo » crée un nouvel espace fictif.

Les imports de documents, la synchronisation des flux et les alertes externes sont désactivés. Le connecteur MCP privé n’est pas distribué. Les entreprises, postes, dates et expériences montrés sont inventés.

Le lien « Tester l’onboarding » crée un espace fictif avec une présentation et un carnet vides. Le guide éclaire les onglets à cliquer, attend la présentation enregistrée puis une expérience validée. Une visite de cinq écrans explique ensuite le rôle de chaque onglet. Le guide peut être mis de côté et relancé.

Le dossier `demo-recruteurs` du dépôt public contient les modifications spécifiques à la démo. Exécuter `node demo-recruteurs/prepare.mjs /chemin/vers/nouveau-dossier` à la racine du dépôt pour reconstituer son code complet. Le script vérifie les empreintes des fichiers de base. Dans le dossier créé : `npm ci`, puis `npm test`, `npx tsc --noEmit` et `npm run build`. Pour l’exécuter avec Sites, renseigner le `project_id` du Site de test dans `.openai/hosting.json` et préparer une base D1 et un bucket R2 distincts.
