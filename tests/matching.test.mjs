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
const countries = moduleUrl("countries");
const locations = moduleUrl("location-criteria", { "./countries": countries, "./market-scope": marketScope });
const preferences = moduleUrl("search-preferences", { "./location-criteria": locations });
const searchPreferencesModule = await import(preferences);
const { searchPreferences } = searchPreferencesModule;
const { assessJob } = await import(moduleUrl("matching", { "./work-arrangement": arrangement, "./application-workflow": workflow, "./market-scope": marketScope, "./search-preferences": preferences, "./location-criteria": locations }));
const { assessLocation, normalizeLocationRules } = await import(locations);
const { parseOfferText } = await import(moduleUrl("offer-parser", { "./work-arrangement": arrangement }));
const { createCandidateBrief, briefOffer } = await import(moduleUrl("candidate-brief"));
const opportunityViews = moduleUrl("opportunity-views");
const { selectTriageActions, sortOffersForTriage } = await import(moduleUrl("triage", { "./application-workflow": workflow, "./opportunity-views": opportunityViews }));
const baseline = { title: "Product Owner", company: "Fixture", contractType: "cdi", annualSalary: 55000, remoteMode: "full_remote", language: "fr", source: "Autre" };

test("le seuil Jobgether est normalisé par compte", () => {
  assert.equal(searchPreferences(undefined).minimumMatchScore, 55);
  assert.equal(searchPreferences({ minimumMatchScore: 70 }).minimumMatchScore, 70);
  assert.equal(searchPreferences({ minimumMatchScore: 0 }).minimumMatchScore, 0);
  assert.equal(searchPreferences({ minimumMatchScore: 101 }).minimumMatchScore, 55);
  assert.equal(searchPreferences({ minimumMatchScore: 54.5 }).minimumMatchScore, 55);
});

test("Europe inclut les offres situées dans un pays européen", () => {
  assert.deepEqual(assessLocation("Paris, France", ["Europe"], []), { excluded: false, uncertain: false });
  assert.equal(assessJob({ ...baseline, announcedLocation: "Berlin, Germany" }, { ...searchPreferences(undefined), includedLocations: ["Europe"] }).tier, "priority");
});
test("Europe sauf Roumanie accepte les autres pays et garde une zone vague à vérifier", () => {
  assert.deepEqual(assessLocation("Bucharest, Romania", ["Europe"], ["Roumanie"]), { excluded: true, uncertain: false });
  assert.deepEqual(assessLocation("Paris, France", ["Europe"], ["Roumanie"]), { excluded: false, uncertain: false });
  assert.deepEqual(assessLocation("Europe", ["Europe"], ["Roumanie"]), { excluded: false, uncertain: true });
  assert.deepEqual(assessLocation("Romania / France", ["Europe"], ["Roumanie"]), { excluded: false, uncertain: false });
  assert.deepEqual(assessLocation("Moscow, Russia", ["Europe"], ["Roumanie"]), { excluded: false, uncertain: false });
  assert.deepEqual(assessLocation("EU", ["Europe"], ["Roumanie"]), { excluded: false, uncertain: true });
});
test("un seul choix États-Unis couvre US, USA et United States", () => {
  const [rule] = normalizeLocationRules(["USA"]);
  assert.equal(rule, "États-Unis");
  for (const location of ["US", "USA", "United States", "États-Unis"]) assert.equal(assessLocation(location, [], [rule]).excluded, true);
  assert.deepEqual(normalizeLocationRules(["Romania", "Roumanie"]), ["Roumanie"]);
});

test("une exclusion ne masque pas une offre ouverte dans un autre lieu", () => {
  assert.deepEqual(assessLocation("Europe, USA", [], ["États-Unis"]), { excluded: false, uncertain: false });
  assert.deepEqual(assessLocation("France / Germany", [], ["Europe"]), { excluded: true, uncertain: false });
  assert.deepEqual(assessLocation("Europe", ["France"], []), { excluded: false, uncertain: true });
  assert.deepEqual(assessLocation(undefined, ["Europe"], []), { excluded: false, uncertain: true });
});
test("une inclusion explicite peut ouvrir le marché américain auparavant écarté", () => {
  const preferences = { ...searchPreferences(undefined), includedLocations: ["États-Unis"] };
  assert.notEqual(assessJob({ ...baseline, description: "Remote - United States", announcedLocation: "États-Unis" }, preferences).tier, "excluded");
});
test("exclure un autre pays ne désactive pas la restriction américaine existante", () => {
  const preferences = { ...searchPreferences(undefined), excludedLocations: ["France"] };
  assert.equal(assessJob({ ...baseline, description: "Remote - United States" }, preferences).tier, "excluded");
});

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
    assert.equal(assessJob({ ...baseline, ...parsed }).tier, "match");
  });
}

test("le choix hybride accepte deux jours sur site, mais écarte le présentiel", () => {
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "2 jours sur site par semaine" }).tier, "match");
  assert.equal(assessJob({ ...baseline, remoteMode: "onsite" }).tier, "excluded");
});

test("les annonces explicitement limitées au marché US sont écartées, les offres Europe restent", () => {
  const us = assessJob({ ...baseline, source: "We Work Remotely", description: "Remote - United States. Full-time." });
  assert.equal(us.tier, "excluded");
  assert.match(us.flags.join(" "), /États-Unis \/ Amérique du Nord/);
  assert.equal(assessJob({ ...baseline, source: "We Work Remotely", description: "Remote Europe. Core EU collaboration hours." }).tier, "priority");
  assert.equal(assessJob({ ...baseline, source: "We Work Remotely", description: "Headquarters: Australia. Remote | Permanent Contractor | Core EU Collaboration Hours." }).tier, "priority");
});

test("un rythme hybride annoncé reste hybride", () => {
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid" }).tier, "match");
  assert.equal(assessJob({ ...baseline, description: "Full remote, avec 1 jour sur site par semaine" }).tier, "match");
});

test("les rythmes hybrides sont acceptés quand le choix est hybride", () => {
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "Toute la semaine. Télétravail : 3 jours/semaine" }).tier, "match");
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "Toute la semaine. Télétravail : 4 jours/semaine" }).tier, "match");
  assert.equal(assessJob({ ...baseline, remoteMode: "hybrid", description: "Télétravail : 3 jours/semaine" }).tier, "match");
});

test("choix manuel d'entretien conservé, pas de dérogation présumée", () => {
  const offer = { ...baseline, remoteMode: "hybrid", description: "2 jours sur site par semaine" };
  const result = assessJob({ ...offer, status: "interview" }, { ...searchPreferences(), remote: "exceptional" });
  assert.equal(result.tier, "exception");
  assert.match(result.flags.join(" "), /non acquise/);
  assert.equal(assessJob({ ...offer, status: "closed" }, { ...searchPreferences(), remote: "exceptional" }).tier, "excluded");
  assert.equal(assessJob({ ...offer, status: "interview", annualSalary: 40000 }, { ...searchPreferences(), remote: "exceptional" }).tier, "excluded");
});

test("minimums stricts et rémunérations absentes à confirmer", () => {
  for (const [salary, tier] of [[55000, "priority"], [54999, "excluded"], [50000, "excluded"], [49999, "excluded"], [null, "exception"]]) {
    assert.equal(assessJob({ ...baseline, annualSalary: salary }).tier, tier);
  }
  for (const [rate, tier] of [[500, "priority"], [499, "excluded"], [450, "excluded"], [449, "excluded"], [null, "exception"]]) {
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

test("les rythmes de présence explicites respectent le choix hybride",()=>{
 const assess=(onsiteDaysPerWeek,onsiteDaysPerMonth)=>assessJob({...baseline,remoteMode:"hybrid",onsiteDaysPerWeek,onsiteDaysPerMonth},{...searchPreferences(),remote:"hybrid"});
 assert.equal(assess(1,null).tier,"match");assert.equal(assess(2,null).tier,"match");assert.equal(assess(null,2).tier,"match");assert.equal(assess(null,8).tier,"match");assert.equal(assess(1,8).tier,"match");
});

test("brief : présence et pays de télétravail sont conservés parmi les faits d’annonce",()=>{
 const offer=briefOffer({...baseline,id:"demo",onsiteDaysPerWeek:1,onsiteDaysPerMonth:3,remoteCountry:"MU",candidateNote:"Note privée exclue"});
 assert.equal(offer.remoteCountry,"MU");assert.equal(offer.onsiteDaysPerMonth,3);assert.equal(offer.candidateNote,undefined);
});

test("les quatre niveaux de présence et les anciennes préférences sont reconnus", () => {
  assert.equal(searchPreferences({ remote: "occasional" }).remote, "exceptional");
  assert.equal(searchPreferences({ remote: "light_hybrid" }).remote, "hybrid");
  const offer = { ...baseline, remoteMode: "hybrid", annualSalary: 65000 };
  assert.equal(assessJob(offer, { ...searchPreferences(), remote: "full_remote" }).tier, "excluded");
  assert.equal(assessJob(offer, { ...searchPreferences(), remote: "exceptional" }).tier, "excluded");
  assert.equal(assessJob(offer, { ...searchPreferences(), remote: "hybrid" }).tier, "match");
  assert.equal(assessJob({ ...offer, remoteMode: "onsite" }, { ...searchPreferences(), remote: "onsite" }).tier, "match");
});

test("CDD est conservé et filtré comme contrat salarié", () => {
  const cdd = { ...baseline, contractType: "cdd", annualSalary: 65000 };
  assert.deepEqual(searchPreferences({ contracts: ["cdd"] }).contracts, ["cdd"]);
  assert.equal(assessJob(cdd, { ...searchPreferences(), contracts: ["cdi"] }).tier, "excluded");
  assert.equal(assessJob(cdd, { ...searchPreferences(), contracts: ["cdd"] }).tier, "priority");
  assert.equal(parseOfferText("Product Owner\nCDD\nSalaire 65k€", "Autre").contractType, "cdd");
});

for (const contractType of ["cdi", "cdd", "freelance", "other"]) {
  test(`tout montant connu respecte les minimums personnalisés : ${contractType}`, () => {
    const preferences = { ...searchPreferences(), minimumSalary: 58000, minimumDailyRate: 570, contracts: ["cdi", "cdd", "freelance"] };
    const offer = { ...baseline, contractType, annualSalary: null, dailyRate: null };
    for (const [field, threshold, flag] of [["annualSalary", 58000, "Salaire"], ["dailyRate", 570, "TJM"]]) {
      for (const value of [0, threshold - 1, threshold - 5000]) {
        const result = assessJob({ ...offer, [field]: value }, preferences);
        assert.equal(result.tier, "excluded");
        assert(result.flags.some(text => text.startsWith(`${flag} sous votre seuil`)));
      }
      assert.notEqual(assessJob({ ...offer, [field]: threshold }, preferences).tier, "excluded");
      assert.notEqual(assessJob({ ...offer, [field]: threshold + 1 }, preferences).tier, "excluded");
    }
    assert.notEqual(assessJob(offer, preferences).tier, "excluded");
    assert.equal(assessJob({ ...offer, annualSalary: 58000, dailyRate: 569 }, preferences).tier, "excluded");
  });
}

test("le recalcul des critères masque les offres sous les minimums dans À examiner", async () => {
  const { inOpportunityView } = await import(opportunityViews);
  const preferences = { ...searchPreferences(), minimumSalary: 58000, minimumDailyRate: 570 };
  for (const amounts of [{ annualSalary: 57999 }, { annualSalary: 25000 }, { annualSalary: null, dailyRate: 569 }]) {
    const offer = { ...baseline, ...amounts, contractType: "other", status: "new", reviewState: "to_review" };
    const assessment = assessJob(offer, preferences);
    assert(!inOpportunityView({ ...offer, matchTier: assessment.tier, flags: assessment.flags }, "to_review"));
    const lower = assessJob(offer, { ...preferences, minimumSalary: 0, minimumDailyRate: 0 });
    assert(inOpportunityView({ ...offer, matchTier: lower.tier, flags: lower.flags }, "to_review"));
  }
});

test("la tolérance sous le minimum garde les offres proches comme exceptions", () => {
  const { payFloor } = searchPreferencesModule;
  assert.equal(payFloor(55000, 5), 52250);
  assert.equal(payFloor(500, 5), 475);
  const strict = { minimumSalary: 55000, minimumDailyRate: 500 };
  const tolerant = { ...strict, payTolerancePercent: 5 };
  // Strict by default: PR #156 behaviour is unchanged.
  assert.equal(searchPreferences(strict).payTolerancePercent, 0);
  assert.equal(assessJob({ ...baseline, annualSalary: 54999 }, strict).tier, "excluded");
  // At the limit: kept, flagged.
  const atFloor = assessJob({ ...baseline, annualSalary: 52250 }, tolerant);
  assert.notEqual(atFloor.tier, "excluded");
  assert.equal(atFloor.tier, "exception");
  assert.ok(atFloor.flags.some(flag => flag.startsWith("Sous votre minimum")));
  // One euro below the limit: excluded as before.
  assert.equal(assessJob({ ...baseline, annualSalary: 52249 }, tolerant).tier, "excluded");
  // At the minimum: a normal match, no tolerance flag.
  assert.ok(!assessJob({ ...baseline, annualSalary: 55000 }, tolerant).flags.some(flag => flag.startsWith("Sous votre minimum")));
  // Same rule for the daily rate.
  const freelance = { ...baseline, contractType: "freelance", annualSalary: null };
  assert.equal(assessJob({ ...freelance, dailyRate: 475 }, tolerant).tier, "exception");
  assert.equal(assessJob({ ...freelance, dailyRate: 474 }, tolerant).tier, "excluded");
  // Out-of-range values fall back to strict.
  assert.equal(searchPreferences({ payTolerancePercent: 35 }).payTolerancePercent, 0);
  assert.equal(searchPreferences({ payTolerancePercent: 2.5 }).payTolerancePercent, 0);
});

test("le portage salarial se compare au TJM, le temps partagé reste à vérifier", () => {
  const search = { contracts: ["cdi", "freelance", "portage", "part_time"], minimumSalary: 55000, minimumDailyRate: 500 };
  assert.deepEqual(searchPreferences(search).contracts, ["cdi", "freelance", "portage", "part_time"]);
  // Portage: the daily rate decides, like freelance.
  const portage = { ...baseline, contractType: "portage", annualSalary: null };
  assert.equal(assessJob({ ...portage, dailyRate: 550 }, search).tier !== "excluded", true);
  assert.equal(assessJob({ ...portage, dailyRate: 400 }, search).tier, "excluded");
  assert.ok(assessJob({ ...portage, dailyRate: null }, search).flags.some(flag => flag.startsWith("TJM non communiqué")));
  // Shared time: a part-time salary is never compared to a full-time minimum.
  const shared = { ...baseline, contractType: "part_time" };
  const lowSalary = assessJob({ ...shared, annualSalary: 30000, dailyRate: null }, search);
  assert.notEqual(lowSalary.tier, "excluded");
  assert.ok(lowSalary.flags.some(flag => flag.startsWith("Rémunération à temps partiel")));
  assert.ok(assessJob({ ...shared, annualSalary: null, dailyRate: null }, search).flags.some(flag => flag.startsWith("Rémunération du temps partagé")));
  // An announced daily rate is compared as usual.
  assert.equal(assessJob({ ...shared, annualSalary: null, dailyRate: 300 }, search).tier, "excluded");
  // A contract that is not searched still excludes the offer.
  assert.equal(assessJob({ ...portage, dailyRate: 550 }, { ...search, contracts: ["cdi"] }).tier, "excluded");
});

test("le parseur reconnaît le portage et le temps partagé", () => {
  const read = text => parseOfferText(text, "Autre").contractType;
  assert.equal(read("Product Owner en portage salarial, TJM 600 €/jour"), "portage");
  assert.equal(read("Mission via une société de portage, 550 € / jour"), "portage");
  assert.equal(read("Product Manager à temps partagé, 3 jours par semaine"), "part_time");
  assert.equal(read("Poste de Product Owner à mi-temps"), "part_time");
  assert.equal(read("Mission freelance, TJM 600 €/jour"), "freelance");
  assert.equal(read("Product Owner en CDI, 60 k€"), "cdi");
});

test("la présence acceptée peut différer selon le contrat", () => {
  const { remoteForContract } = searchPreferencesModule;
  const search = searchPreferences({ contracts: ["cdi", "freelance"], remote: "full_remote", remoteByContract: { freelance: "hybrid" } });
  assert.equal(remoteForContract(search, "cdi"), "full_remote");
  assert.equal(remoteForContract(search, "freelance"), "hybrid");
  // An unknown contract follows the most permissive level searched.
  assert.equal(remoteForContract(search, "other"), "hybrid");
  assert.equal(remoteForContract(search, undefined), "hybrid");
  // A contract that is not searched falls back the same way.
  assert.equal(remoteForContract(search, "cdd"), "hybrid");
  // A hybrid offer is kept for freelance, excluded for a CDI that wants full remote.
  const hybrid = { ...baseline, remoteMode: "hybrid", onsiteDaysPerWeek: 2, description: "2 jours sur site par semaine" };
  assert.equal(assessJob({ ...hybrid, contractType: "freelance", annualSalary: null, dailyRate: 600 }, search).tier !== "excluded", true);
  assert.equal(assessJob({ ...hybrid, contractType: "cdi", annualSalary: 60000 }, search).tier, "excluded");
  // Levels outside the searched contracts are ignored when reading back.
  assert.equal(searchPreferences({ contracts: ["cdi"], remoteByContract: { freelance: "onsite" } }).remoteByContract.freelance, undefined);
});

test("les mots-clés mettent en avant ou écartent une offre", () => {
  const search = { boostKeywords: ["fintech", "paiement"], excludeKeywords: ["stage", "alternance"] };
  const offer = extra => ({ ...baseline, annualSalary: 60000, ...extra });
  // Accents and case are ignored, and the company name counts.
  const boosted = assessJob(offer({ description: "Plateforme de PAIEMENT et Fintech" }), search);
  assert.ok(boosted.reasons.some(reason => reason.startsWith("Mentionne")));
  assert.ok(boosted.score > assessJob(offer({ description: "Plateforme logistique" }), search).score);
  // An excluded word rules the offer out.
  const refused = assessJob(offer({ title: "Product Owner — stage" }), search);
  assert.equal(refused.tier, "excluded");
  assert.ok(refused.flags.some(flag => flag.startsWith("Contient stage")));
  // No keyword, no effect.
  assert.equal(assessJob(offer({ description: "Équipe produit" }), {}).flags.some(flag => flag.startsWith("Contient")), false);
  // Normalisation: 12 at most, no duplicates, 2 to 40 characters.
  const saved = searchPreferences({ boostKeywords: ["a", "fintech", "FINTECH", " paiement ", "x".repeat(41), ...Array.from({ length: 15 }, (_, i) => "mot" + i)] });
  assert.equal(saved.boostKeywords.includes("a"), false);
  assert.equal(saved.boostKeywords.filter(word => word.toLowerCase() === "fintech").length, 1);
  assert.ok(saved.boostKeywords.includes("paiement"));
  assert.equal(saved.boostKeywords.length, 12);
});
