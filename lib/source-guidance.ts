import { sourceCatalog } from "./source-catalog";

type SourceName = (typeof sourceCatalog)[number]["name"];

export const sourceGuidance: Record<SourceName, { steps: [string, ...string[]]; result: string }> = {
  Collective: {
    steps: ["Ouvrez Collective et créez ou vérifiez votre recherche PO/PM et ses notifications sur le site.", "Quand un email arrive, copiez son lien « See jobs » dans « Ajouter une alerte Collective », en haut de cette page."],
    result: "Radar conserve le lien vers les résultats. Il n'ajoute aucune annonce à partir de cette seule alerte.",
  },
  Malt: {
    steps: ["Ouvrez Malt et vérifiez les notifications de missions dans votre compte.", "Notez ici les critères suivis et la fréquence de vérification. Revenez sur les propositions reçues pour examiner chaque mission."],
    result: "Radar mémorise votre suivi. Il ne modifie pas votre profil Malt et ne récupère pas vos messages.",
  },
  "LinkedIn Jobs": {
    steps: ["Ouvrez la recherche sur LinkedIn et enregistrez son URL filtrée dans « Recherches web pour vos postes ».", "Google peut compléter la recherche ; vérifiez chaque annonce avant de l’ajouter volontairement à Radar."],
    result: "Radar n'active pas d'alerte LinkedIn et ne lit pas votre compte.",
  },
  Apec: {
    steps: ["Ouvrez Apec, lancez une recherche PO/PM et ajustez contrat et télétravail.", "Créez l'alerte sur Apec, puis notez ici la recherche et la fréquence choisies."],
    result: "Radar conserve seulement l'état et vos notes ; l'alerte reste gérée par Apec.",
  },
  "Welcome to the Jungle": {
    steps: ["Ouvrez la recherche sur Welcome to the Jungle et enregistrez son URL filtrée dans « Recherches web pour vos postes ».", "Google peut compléter la recherche ; vérifiez l'annonce, idéalement sur la page carrière de l'employeur, avant de l'ajouter à Radar."],
    result: "Radar n'active pas d'alerte Welcome to the Jungle et ne collecte pas ses résultats.",
  },
  "Free-Work": {
    steps: ["Ouvrez Free-Work et créez vos alertes PO/PM selon le contrat et le télétravail souhaités.", "Notez ici les recherches et la fréquence des emails, puis vérifiez les missions reçues avant de les ajouter."],
    result: "Radar ne crée pas ces alertes sur Free-Work ; il conserve votre suivi.",
  },
  Indeed: {
    steps: ["Ouvrez Indeed, recherchez PO/PM et créez l'alerte email sur leur site.", "Notez ici les mots clés et filtres réellement utilisés. Vérifiez chaque annonce avant de l'ajouter à Radar."],
    result: "Radar ne règle pas votre compte Indeed et ne lit pas ses alertes depuis cette page.",
  },
  HelloWork: {
    steps: ["Ouvrez HelloWork, recherchez PO/PM et créez l'alerte sur leur site.", "Notez ici les filtres retenus et la fréquence. Gardez une recherche sans salaire minimum si vous voulez voir les offres non chiffrées."],
    result: "Radar conserve votre suivi ; l'alerte reste gérée par HelloWork.",
  },
  "We Work Remotely": {
    steps: ["Cliquez sur « Actualiser le flux remote autorisé » en haut de cette page.", "Consultez les fiches ajoutées et vérifiez pour chacune les pays autorisés et les conditions de travail."],
    result: "Radar lit ce flux public. « En pause » empêche les prochaines actualisations manuelles du flux.",
  },
  Wellfound: { steps: ["Ouvrez Wellfound et vérifiez si les rôles produit et la zone géographique correspondent à votre recherche.", "Notez ici les critères utiles et les points encore à vérifier avant d'en faire une source suivie."], result: "Aucune connexion ni import automatique n'est activé dans Radar." },
  Himalayas: { steps: ["Ouvrez Himalayas et vérifiez les filtres de rôle et de pays autorisés.", "Notez ici les recherches utiles et les restrictions à vérifier sur chaque annonce."], result: "Aucune connexion ni import automatique n'est activé dans Radar." },
  "Remote OK": { steps: ["Ouvrez Remote OK et vérifiez les rôles produit qui vous intéressent.", "Notez ici les restrictions géographiques et les points à qualifier avant un suivi régulier."], result: "Aucune connexion ni import automatique n'est activé dans Radar." },
  Remotive: { steps: ["Ouvrez Remotive et vérifiez les rôles produit et les pays autorisés.", "Notez ici si cette source mérite un suivi manuel et les critères à contrôler."], result: "Aucune connexion ni import automatique n'est activé dans Radar." },
  FreelanceRepublik: { steps: ["Ouvrez FreelanceRepublik et examinez les conditions d'inscription et les missions produit.", "Notez ici le TJM, le télétravail et les actions que vous décidez de faire sur leur site."], result: "Radar n'inscrit pas votre profil et ne contacte aucun recruteur." },
  Mindquest: { steps: ["Ouvrez Mindquest et vérifiez les missions produit/IT disponibles.", "Notez ici les critères de durée, de TJM et de présence à confirmer."], result: "Radar ne crée pas de compte et ne contacte aucun recruteur." },
  "Post LinkedIn": { steps: ["Ouvrez le post LinkedIn que vous souhaitez conserver.", "Ajoutez volontairement l'offre dans Radar avec son lien et le texte disponible, puis vérifiez ses conditions."], result: "Ce statut sert de repère ; aucun post n'est importé depuis cette carte." },
};
