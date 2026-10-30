import { isCountryCode } from "./countries";
import { z } from "zod";
import { broadMailQuery, sourceNames } from "./source-catalog";

export const offerSchema = z.object({
  title: z.string().trim().min(1).max(180),
  company: z.string().max(160).optional(),
  contractType: z.enum(["cdi", "cdd", "freelance", "other"]),
  annualSalary: z.number().int().nonnegative().nullable().optional(),
  dailyRate: z.number().int().nonnegative().nullable().optional(),
  remoteMode: z.enum(["full_remote", "exceptional", "hybrid", "onsite", "unknown"]),
  onsiteCadence: z.string().max(180).optional(),
  onsiteDaysPerWeek: z.number().int().min(0).max(5).nullable().optional(),
  onsiteDaysPerMonth: z.number().int().min(0).max(31).nullable().optional(),
  remoteCountry: z.string().refine(value=>value===""||isCountryCode(value),"Pays invalide").optional(),
  language: z.enum(["fr", "en", "professional_en", "advanced_en", "unknown"]),
  source: z.enum(sourceNames),
  sourceUrl: z.string().url().refine(v => /^https?:\/\//.test(v)).optional(),
  contact: z.string().max(160).optional(),
  description: z.string().max(12000).optional(),
  publishedAt: z.union([z.string().datetime({ offset: true }), z.string().date(), z.literal("")]).optional(),
  applicationUrl: z.union([z.string().url().refine(v => /^https?:\/\//.test(v)), z.literal("")]).optional(),
  contentCoverage: z.enum(["full", "summary", "partial", "unknown"]).optional(),
  notificationAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export const offerPatchSchema = offerSchema.partial().refine(value => Object.keys(value).length > 0);

export const batchSchema = z.object({ offers: z.array(offerSchema).min(1).max(20) }).strict();
export const listSchema = z.object({ limit: z.number().int().min(1).max(100).default(50) }).strict();

export const importRules = {
  version: 6,
  query: 'newer_than:7d -in:spam -in:trash {from:collective.work from:malt.com}',
  selection: "Lire uniquement les alertes d'offres et propositions de mission. Ignorer statistiques, newsletters, discussions support et suivis de candidature dans cet import.",
  extraction: "Enregistrer seulement les faits présents dans la fiche. Ne jamais inventer salaire, TJM, contrat ou remote à partir des filtres de recherche. Null pour les montants absents ; unknown pour remote/langue non précisés.",
  linksOnly: "Une alerte Collective qui annonce un nombre d'offres et donne seulement un lien de recherche n'est pas une offre : ne pas créer de fiche fictive. Enregistrer le lien et la date via radar_record_collective_alert pour l'afficher dans Sources, sans récupération automatique du site. Les annonces individuelles vérifiées peuvent ensuite être importées séparément.",
  privacy: "Ne transmettre à Radar ni email MIME/HTML brut, ni pièce jointe, ni identifiants Google. Seulement une description factuelle normalisée et le lien d'origine. Aucun changement Gmail, aucune candidature ou réponse automatique.",
  thresholds: { cdiAnnualEur: 55000, freelanceDailyEur: 500 },
  additionalMailQuery: broadMailQuery,
  content: "Conserver toutes les missions, compétences, conditions et étapes de recrutement effectivement fournies, hors footer email et liens techniques. Préciser contentCoverage full/summary/partial ; ne pas appeler complète une simple notification. publishedAt est la date réelle de l'annonce, jamais la date de l'email ; notificationAt est la date de réception/source séparée. Garder le lien d'offre et, lorsqu'il existe, applicationUrl. Pour enrichir une fiche existante, utiliser radar_update_offer, sans changer ses notes, entretiens ou statuts.",
  remotePreferences: "Full remote et présence exceptionnelle prioritaires. NOUVELLE PRÉFÉRENCE : ne pas écarter les offres annonçant 1 jour sur site (jusqu'à 1 jour/semaine) ; les garder en exception remote à négocier. Hybride sans fréquence : à vérifier. Présence plus fréquente : écartée par défaut. Une candidature déjà poursuivie manuellement reste suivie avec une alerte de négociation ; ne jamais présumer l'accord du recruteur. Ces préférences à jour remplacent l'ancien rejet systématique de l'hybride dans les consignes de veille. Importer les faits même si la qualification est négative, laisser le Radar classer, et ne pas modifier les statuts existants.",
  workflow: "Lister les fiches existantes, importer par lots de 20 maximum, puis relire les résultats persistés. Réessayer un lot identique est sans doublon pour une même fiche et un même lien. Ne pas modifier les statuts de candidature existants.",
  closure: "Si une source autorisée donne une preuve explicite que CETTE annonce précise est pourvue ou n'accepte plus de candidatures, utiliser radar_mark_offer_closed avec son id, sa source et son URL exacte et une courte citation de ce signal. Ne jamais inférer une fermeture d'un 404, d'une connexion demandée ou d'une absence dans un flux. Ne pas classer un refus de candidature comme fermeture du poste. Les entretiens et rappels engagés restent suivis.",
};

const offerProperties = {
  title: { type: "string", minLength: 1, maxLength: 180 },
  company: { type: "string", maxLength: 160 },
  contractType: { type: "string", enum: ["cdi", "cdd", "freelance", "other"] },
  annualSalary: { type: ["integer", "null"], minimum: 0 },
  dailyRate: { type: ["integer", "null"], minimum: 0 },
  remoteMode: { type: "string", enum: ["full_remote", "exceptional", "hybrid", "onsite", "unknown"] },
  onsiteCadence: { type: "string", maxLength: 180 },
  onsiteDaysPerWeek: { type: ["integer","null"], minimum: 0, maximum: 5 },
  onsiteDaysPerMonth: { type: ["integer","null"], minimum: 0, maximum: 31 },
  remoteCountry: { type: "string", description: "Pays de télétravail explicitement autorisé, code ISO alpha-2 ou vide. Ne pas déduire du siège ou du pays du poste." },
  language: { type: "string", enum: ["fr", "en", "professional_en", "advanced_en", "unknown"] },
  source: { type: "string", enum: offerSchema.shape.source.options },
  sourceUrl: { type: "string", format: "uri" },
  contact: { type: "string", maxLength: 160 },
  description: { type: "string", maxLength: 12000 },
  publishedAt: { type: "string", description: "Date réelle de publication : ISO datetime, YYYY-MM-DD, ou vide si inconnue." },
  applicationUrl: { type: "string" },
  contentCoverage: { type: "string", enum: ["full", "summary", "partial", "unknown"] },
  notificationAt: { type: "string", format: "date-time" },
};

export const importTools = [
  { name: "radar_record_collective_alert", description: "Afficher dans Sources la dernière alerte email Collective contenant uniquement un lien de recherche. Ne crée aucune fiche d'offre et ne lit pas le site tiers.", inputSchema: { type: "object", properties: { url: { type: "string", format: "uri" }, notificationAt: { type: "string", format: "date-time" }, label: { type: "string", maxLength: 120 } }, required: ["url", "notificationAt", "label"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: "radar_mark_offer_closed", description: "Mettre une offre précise en corbeille si et seulement si sa source fournit une fermeture explicite attribuable à son URL exacte. Conserve candidature, notes et entretiens. N'infère rien d'un lien indisponible.", inputSchema: { type: "object", properties: { id: { type: "string" }, reason: { type: "string", enum: ["filled", "applications_closed"] }, source: { type: "string" }, sourceUrl: { type: "string", format: "uri" }, evidence: { type: "string", minLength: 12, maxLength: 500 } }, required: ["id", "reason", "source", "sourceUrl", "evidence"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } },
  { name: "radar_update_offer", description: "Enrichir les faits d'une offre existante : description, dates sources et lien de candidature. Ne modifie ni statut, ni notes privées, ni entretiens. Réservé au propriétaire connecté.", inputSchema: { type: "object", properties: { id: { type: "string" }, offer: { type: "object", properties: offerProperties, additionalProperties: false } }, required: ["id", "offer"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: "radar_due_interviews", description: "Lister les entretiens passés qui attendent un bilan et n'ont pas encore eu de rappel. Lecture privée, aucun email envoyé.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "radar_mark_interview_reminded", description: "Confirmer un rappel après avoir vérifié son envoi à l'utilisateur. Idempotent. Ne change pas le statut de candidature et n'envoie aucun message.", inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" }, maxItems: 50 } }, required: ["ids"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: "radar_sync_authorized_feed", description: "Importer les offres produit du flux RSS public autorisé We Work Remotely, avec attribution ; écarter les postes explicitement réservés aux États-Unis ou à l'Amérique du Nord. Les postes mondiaux restent à qualifier. Pas de scraping ni de flux payant. Conserve les candidatures existantes.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  {
    name: "radar_get_import_rules", description: "Lire les règles de veille et d'import d'alertes Gmail vers Radar. Ne modifie rien.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "radar_list_offers", description: "Relire les dernières offres de l'utilisateur connecté, pour vérifier un import et éviter les doublons. Ne donne aucun accès aux autres utilisateurs ni aux CV.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 50 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "radar_import_offers", description: "Enregistrer jusqu'à 20 offres normalisées à partir d'alertes ou posts fournis. Réservé à l'utilisateur connecté. Ne transmettez pas d'emails bruts, de pièces jointes ni de données inventées. Ne change aucun statut existant, n'envoie aucune candidature ni email. Une relance identique ne crée pas de doublon.",
    inputSchema: { type: "object", properties: { offers: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", properties: offerProperties, required: ["title", "contractType", "remoteMode", "language", "source"], additionalProperties: false } } }, required: ["offers"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];
