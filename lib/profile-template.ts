import type { CandidateProfile } from "./types";

// Profil entièrement fictif destiné à la démonstration publique.
export const profileTemplate: CandidateProfile = {
  headline: "Product Owner / Product Manager — profil fictif",
  summary: "Camille accompagne une équipe fictive dans le cadrage, la priorisation et la recette d’un produit SaaS. Ce profil ne représente aucune personne réelle.",
  location: "France — localisation fictive",
  languages: ["Français", "Anglais"],
  roleKeywords: ["Product Owner", "Product Manager"],
  skills: ["Backlog prioritization", "User journeys", "Acceptance testing", "Stakeholder management"],
  industries: ["SaaS", "B2B"],
  achievements: [
    { label: "Exemple fictif", detail: "Préparation d’une recette fonctionnelle pour le produit Atlas." },
  ],
  evidence: [
    { title: "Projet Atlas — exemple fictif", context: "Cadrage d’un parcours et rédaction de scénarios de recette pour une entreprise imaginaire.", strengths: ["Cadrage", "Recette", "Priorisation"] },
  ],
  linkedinUrl: "",
};
