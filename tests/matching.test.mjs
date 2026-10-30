import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(name, imports = {}) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of Object.entries(imports)) compiled = compiled.replaceAll(`"${from}"`, JSON.stringify(to));
  return "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
}
const arrangement = moduleUrl("work-arrangement");
const workflow = moduleUrl("application-workflow");
const marketScope = moduleUrl("market-scope");
const preferences = moduleUrl("search-preferences");
const { searchPreferences } = await import(preferences);
const { assessJob } = await import(moduleUrl("matching", { "./work-arrangement": arrangement, "./application-workflow": workflow, "./market-scope": marketScope, "./search-preferences": preferences }));
const { parseOfferText } = await import(moduleUrl("offer-parser", { "./work-arrangement": arrangement }));
const { createCandidateBrief, briefOffer } = await import(moduleUrl("candidate-brief"));
const opportunityViews = moduleUrl("opportunity-views");
const { selectTriageActions, sortOffersForTriage } = await import(moduleUrl("triage", { "./application-workflow": workflow, "./opportunity-views": opportunityViews }));
const baseline = { title: "Product Owner", company: "Fixture", contractType: "cdi", annualSalary: 55000, remoteMode: "full_remote", language: "fr", source: "Autre" };

test("les anciens choix PO/PM deviennent des intitulés éditables", () => {
  assert.deepEqual(searchPreferences({ roles: ["po", "pm"] }).roles, ["Product Owner", "Product Manager"]);
  assert.deepEqual(searchPreferences({ roles: ["product ops", "Product Ops", "!!!"] }).roles, ["Product Ops"]);
});

test("les intitulés libres donnent la priorité aux postes saisis", () => {
  const search = { roles: ["Product Ops", "Chef de projet digital"], contracts: ["cdi"], remote: "full_remote", minimumSalary: 65000, minimumDailyRate: 600 };
  assert.equal(assessJob({ ...baseline, annualSalary: 65000 }, search).tier, "exception");
  assert.match(assessJob({ ...baseline, annualSalary: 65000 }, search).flags.join(" "), /Rôle secondaire/);
  assert.equal(assessJob({ ...baseline, title: "Senior Product Ops", annualSalary: 65000 }, search).tier, "priority");
  assert.equal(assessJob({ ...baseline, title: "Chef de projet digital", annualSalary: 65000 }, search).tier, "priority");
  assert.equal(assessJob({ ...baseline, title: "Product Ops", annualSalary: null }, search).tier, "exception");
});

test("les autres critères de recherche restent appliqués", () => {
  const search = { roles: ["Product Manager"], contracts: ["cdi"], remote: "full_remote", minimumSalary: 65000, minimumDailyRate: 600 };
  assert.equal(assessJob({ ...baseline, title: "Product Manager", annualSalary: 65000 }, search).tier, "priority");
  assert.equal(assessJob({ ...baseline, title: "Product Manager", annualSalary: null }, search).tier, "exception");
  assert.equal(assessJob({ ...baseline, title: "Product Manager", annualSalary: 65000, remoteMode: "exceptional" }, search).tier, "excluded");
  assert.equal(assessJob({ ...baseline, title: "Product Manager", annualSalary: 65000, contractType: "freelance", dailyRate: 650 }, search).tier, "excluded");
});

test("full remote et présence exceptionnelle restent prioritaires", () => {
  assert.equal(assessJob(baseline).tier, "priority");
  assert.equal(assessJob({ ...baseline, remoteMode: "exceptional" }).tier, "priority");
});

for (const description of ["1 jour sur site par semaine", "1j sur site", "Présentiel : un jour par semaine", "One day per week onsite", "On-site: 1 day per week", "2 jours sur site par mois"]) {
  test(`présence négociable conservée : ${description}`, () => {
    const parsed = parseOfferText(`Product Owner\nCDI 55k€\nFrançais\n${description}`, "Autre");
    assert.equal(parsed.remoteMode, "hybrid");
    assert.equal(assessJob({ ...baseline, ...parsed }).tier, "exception");
  });
}

test("2 jours/semaine et sur site sont écartés par défaut", () => {
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "2 jours sur site par semaine" }).tier, "excluded");
  assert.equal(assessJob({ ...baseline, remoteMode: "onsite" }).tier, "excluded");
});

test("les annonces explicitement limitées au marché US sont écartées, les offres Europe restent", () => {
  const us = assessJob({ ...baseline, source: "We Work Remotely", description: "Remote - United States. Full-time." });
  assert.equal(us.tier, "excluded");
  assert.match(us.flags.join(" "), /États-Unis \/ Amérique du Nord/);
  assert.equal(assessJob({ ...baseline, source: "We Work Remotely", description: "Remote Europe. Core EU collaboration hours." }).tier, "priority");
  assert.equal(assessJob({ ...baseline, source: "We Work Remotely", description: "Headquarters: Australia. Remote | Permanent Contractor | Core EU Collaboration Hours." }).tier, "priority");
});

test("rythme hybride inconnu à vérifier, pas faux full remote", () => {
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid" }).tier, "exception");
  assert.equal(assessJob({ ...baseline, description: "Full remote, avec 1 jour sur site par semaine" }).tier, "exception");
});

test("complément remote uniquement avec une semaine complète explicite", () => {
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "Toute la semaine. Télétravail : 3 jours/semaine" }).tier, "excluded");
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "Toute la semaine. Télétravail : 4 jours/semaine" }).tier, "exception");
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "Télétravail : 3 jours/semaine" }).tier, "exception");
});

test("choix manuel d'entretien conservé, pas de dérogation présumée", () => {
  const offer = { ...baseline, remoteMode: "hybrid", description: "2 jours sur site par semaine" };
  const result = assessJob({ ...offer, status: "interview" });
  assert.equal(result.tier, "exception");
  assert.match(result.flags.join(" "), /non acquise/);
  assert.equal(assessJob({ ...offer, status: "closed" }).tier, "excluded");
  assert.equal(assessJob({ ...offer, status: "interview", annualSalary: 40000 }).tier, "excluded");
});

test("seuils et rémunérations absentes inchangés", () => {
  for (const [salary, tier] of [[55000, "priority"], [50000, "exception"], [49999, "excluded"], [null, "exception"]]) {
    assert.equal(assessJob({ ...baseline, annualSalary: salary }).tier, tier);
  }
  for (const [rate, tier] of [[500, "priority"], [450, "exception"], [449, "excluded"], [null, "exception"]]) {
    assert.equal(assessJob({ ...baseline, contractType: "freelance", dailyRate: rate }).tier, tier);
  }
});

test("notes de négociation distinctes de l'annonce et des preuves du CV", () => {
  const job = { ...baseline, id: "fixture", status: "interview", remoteMode: "hybrid", onsiteCadence: "2 jours sur site par semaine", reasons: [], flags: [], candidateNote: "J'ai proposé du distanciel avec des venues occasionnelles. Réponse à confirmer.", description: "L'annonce demande 2 jours sur site." };
  const profile = { evidence: [{ title: "Réalisation validée", context: "Fait réel." }], applicationNotes: { autre: "Note à ne pas divulguer" } };
  const input = {offer:briefOffer({...job,interviews:[{notes:"Bilan secret"}]}),facts:[]};
  const brief = createCandidateBrief(input);
  assert.doesNotMatch(JSON.stringify(input), /candidateNote|interviews|applicationNotes|Bilan secret/);
  assert.doesNotMatch(brief, /Suivi privé|J'ai proposé|Fait réel/);
  assert.match(brief, /L'annonce demande 2 jours sur site/);
  assert.doesNotMatch(brief, /Note à ne pas divulguer/);
  assert.match(createCandidateBrief(input,"en"), /anglais professionnel simple/);
});

test("contrat et pays inconnus ne deviennent pas un bon match confirmé", () => {
  const unknown = assessJob({ ...baseline, contractType: "other", annualSalary: null });
  assert.equal(unknown.tier, "exception");
  assert.match(unknown.flags.join(" "), /Contrat/);
  assert.equal(assessJob({ ...baseline, onsiteCadence: "Pays autorisés et fuseau de travail à vérifier dans la description" }).tier, "exception");
});

test("négation du full remote et intitulés abrégés sont correctement qualifiés", () => {
  const result = assessJob({ ...baseline, title: "PM mi-temps ASAP", remoteMode: "unknown", description: "Ne pas présumer le full remote ni le TJM à partir de l’alerte." });
  assert.equal(result.tier, "exception");
  assert.match(result.flags.join(" "), /remote à confirmer/);
  assert.doesNotMatch(result.reasons.join(" "), /Full remote explicite/);
  assert.match(result.reasons.join(" "), /votre recherche/);
});

test("mention de PO dans une annonce développeur et exigence bilingue ne passent pas inaperçues", () => {
  const developer = assessJob({ ...baseline, title: "Développeur React", description: "Travailler avec le Product Owner" });
  assert.doesNotMatch(developer.reasons.join(" "), /votre recherche/);
  const bilingual = assessJob({ ...baseline, language: "en", description: "Bilingual French and English required" });
  assert.equal(bilingual.tier, "exception");
  assert.match(bilingual.flags.join(" "), /bilingue/);
});

test("les actions mettent le bilan et la date d’entretien avant le flux d’offres", () => {
  const base = { ...baseline, matchTier: "exception", matchScore: 75, flags: [], contentCoverage: "summary" };
  const fresh = { ...base, id: "fresh", company: "Récent", status: "new", publishedAt: "2026-10-13T12:00:00Z" };
  const old = { ...base, id: "old", company: "Ancien", status: "new", publishedAt: "2026-09-01T12:00:00Z" };
  const interview = { ...base, id: "meeting", company: "Atlas", status: "interview", interviews: [{ state: "planned", endAt: "2026-10-13T12:00:00Z" }] };
  const rejected = { ...base, id: "rejected", company: "Refus", status: "rejected", publishedAt: "2026-10-14T12:00:00Z" };
  const watched = { ...base, id: "watched", company: "À qualifier", status: "watchlist", publishedAt: "2026-10-14T08:00:00Z" };
  const actions = selectTriageActions([old, rejected, fresh, interview], Date.parse("2026-10-14T12:00:00Z"));
  assert.deepEqual(actions.map(action => action.job.id), ["meeting", "fresh", "old"]);
  assert.equal(actions[0].kind, "interview_review");
  assert.ok(!actions.some(action => action.job.id === "rejected"));
  assert.deepEqual(sortOffersForTriage([old, rejected, watched, fresh], Date.parse("2026-10-14T12:00:00Z")).map(job => job.id), ["watched", "fresh", "old"]);
});

test("une offre sélectionnée n’est pas présentée comme une candidature déjà envoyée", () => {
  const selected = { ...baseline, id: "selected", title: "Product Owner Data", company: "Entreprise non précisée", status: "shortlist", reviewState: "selected", matchTier: "exception", flags: [] };
  const applied = { ...selected, id: "applied", company: "Atlas", status: "applied", reviewState: "selected" };
  const actions = selectTriageActions([selected, applied]);
  assert.equal(actions[0].title, "Préparer l’offre sélectionnée");
  assert.match(actions[0].detail, /Product Owner Data.*non envoyée/);
  assert.equal(actions[1].title, "Faire avancer la candidature");
  assert.match(actions[1].detail, /Atlas.*envoyée/);
});

test("fréquences explicites : semaine et mois restent indépendants dans la qualification",()=>{
 const assess=(onsiteDaysPerWeek,onsiteDaysPerMonth)=>assessJob({...baseline,remoteMode:"hybrid",onsiteDaysPerWeek,onsiteDaysPerMonth});
 assert.equal(assess(1,null).tier,"exception");assert.equal(assess(2,null).tier,"excluded");assert.equal(assess(null,2).tier,"exception");assert.equal(assess(null,8).tier,"excluded");assert.equal(assess(1,8).tier,"excluded");
});

test("brief : présence et pays de télétravail sont conservés parmi les faits d’annonce",()=>{
 const offer=briefOffer({...baseline,id:"demo",onsiteDaysPerWeek:1,onsiteDaysPerMonth:3,remoteCountry:"MU",candidateNote:"Note privée exclue"});
 assert.equal(offer.remoteCountry,"MU");assert.equal(offer.onsiteDaysPerMonth,3);assert.equal(offer.candidateNote,undefined);
});
