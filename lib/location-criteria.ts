import { countryCodes } from "./countries";
import { isNorthAmericaRestricted } from "./market-scope";

const fold = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[’']/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const europe = new Set("AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SJ SK SM UA VA".split(" "));
const northAmerica = new Set(["CA", "US", "MX"]);
const southAmerica = new Set("AR BO BR CL CO EC GF GY PE PY SR UY VE".split(" "));
const africa = new Set("AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW".split(" "));
const asia = new Set("AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE".split(" "));
const oceania = new Set("AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV VU WF WS".split(" "));
const regionNames: Record<string, Set<string>> = {
  europe, "union europeenne": new Set("AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK".split(" ")),
  "amerique du nord": northAmerica, "north america": northAmerica,
  "amerique du sud": southAmerica, "south america": southAmerica,
  afrique: africa, africa, asie: asia, asia, oceanie: oceania, oceania,
};
const aliases: Record<string, string> = { usa: "US", us: "US", "united states": "US", "united states of america": "US", "etats unis": "US", uk: "GB", "united kingdom": "GB", "royaume uni": "GB", uae: "AE" };
const displayFr = new Intl.DisplayNames(["fr"], { type: "region" });
const displayEn = new Intl.DisplayNames(["en"], { type: "region" });
const countryNames = countryCodes.flatMap(code => [displayFr.of(code), displayEn.of(code)].filter((name): name is string => !!name).map(name => ({ name: fold(name), code })));

function hasPhrase(text: string, phrase: string) { return (` ${text} `).includes(` ${phrase} `); }
function countriesIn(text: string) {
  const found = new Set<string>();
  for (const { name, code } of countryNames) if (name.length >= 4 && hasPhrase(text, name)) found.add(code);
  for (const [name, code] of Object.entries(aliases)) if (hasPhrase(text, name)) found.add(code);
  return found;
}
function optionParts(location: string) {
  return location.split(/\s*(?:[;/|]|\b(?:or|ou|and|et)\b)\s*/i).flatMap(part => {
    const commaParts = part.split(",").map(item => item.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every(item => {
      const name = fold(item); return !!regionNames[name] || countriesIn(name).size > 0;
    })) return commaParts.map(item => ({ text: fold(item), countries: countriesIn(fold(item)) }));
    const countries = countriesIn(fold(part));
    // "Paris, France" is one place; "France, Allemagne" is two alternatives.
    return countries.size > 1 ? [...countries].map(code => ({ text: fold(part), countries: new Set([code]) })) : [{ text: fold(part), countries }];
  }).filter(part => part.text);
}
function ruleMatches(rule: string, option: ReturnType<typeof optionParts>[number]) {
  const name = fold(rule);
  if (!name) return false;
  const region = regionNames[name];
  if (region) return hasPhrase(option.text, name) || [...option.countries].some(code => region.has(code));
  const ruleCountries = countriesIn(name);
  if (ruleCountries.size) return [...ruleCountries].some(code => option.countries.has(code));
  return hasPhrase(option.text, name);
}
export function normalizeLocationRules(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Map(value.filter((item): item is string => typeof item === "string")
    .map(item => item.trim().replace(/\s+/g, " ")).filter(item => item.length >= 2 && item.length <= 80)
    .map(item => [fold(item), item])).values()].slice(0, 20);
}
export function announcedLocationFor(job: { announcedLocation?: string; source?: string; description?: string }) {
  if (job.announcedLocation?.trim()) return job.announcedLocation.trim();
  if (job.source === "Jobgether") return job.description?.match(/^Lieu annoncé : (.*?)(?:\. Organisation annoncée :|$)/)?.[1]?.trim();
  if (isNorthAmericaRestricted({ title: "", description: job.description })) return /north america/i.test(job.description ?? "") ? "Amérique du Nord" : "États-Unis";
  return undefined;
}
export function assessLocation(location: string | undefined, included: string[], excluded: string[]) {
  if (!included.length && !excluded.length) return { excluded: false, uncertain: false };
  if (!location) return { excluded: false, uncertain: true };
  const options = optionParts(location);
  if (!options.length) return { excluded: false, uncertain: true };
  const permitted = options.filter(option => !excluded.some(rule => ruleMatches(rule, option)));
  if (!permitted.length) return { excluded: true, uncertain: false };
  if (!included.length) return { excluded: false, uncertain: false };
  if (permitted.some(option => included.some(rule => ruleMatches(rule, option)))) return { excluded: false, uncertain: false };
  // A broad announced zone may contain a requested country. Keep it for review.
  const broad = permitted.some(option => /\b(?:worldwide|global|anywhere|monde entier)\b/.test(option.text) || Object.entries(regionNames).some(([name, members]) => hasPhrase(option.text, name) && included.some(rule => [...countriesIn(fold(rule))].some(code => members.has(code)))));
  return { excluded: !broad, uncertain: broad };
}
