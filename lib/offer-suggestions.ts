import type { JobInput } from "./types";
import { parseOfferText } from "./offer-parser";
import { countryCodes, countryLabel } from "./countries";
export type SuggestedField="title"|"company"|"contractType"|"annualSalary"|"dailyRate"|"remoteMode"|"language"|"onsiteDaysPerWeek"|"onsiteDaysPerMonth"|"remoteCountry";
export type OfferSuggestion={field:SuggestedField;value:string|number;quote:string};
const fold=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function suggestOfferFields(text:string):OfferSuggestion[] {
  const parsed=parseOfferText(text.slice(0,12000),"Ajout manuel"), result:OfferSuggestion[]=[];
  const lines=text.slice(0,12000).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  function add(field:SuggestedField,value:string|number|undefined|null,pattern:RegExp) {
    const quote=lines.find(line=>pattern.test(line));
    if((field==="annualSalary"||field==="dailyRate")&&quote&&!/€|\bEUR\b|euros?/i.test(quote))return;
    if(quote&&value!==undefined&&value!==null&&value!==""&&value!=="unknown"&&value!=="other")result.push({field,value,quote});
  }
  const titleLine=lines.find(line=>/^(?:intitulé|titre|poste|job title|title)\s*:/i.test(line));
  const header=titleLine?.replace(/^(?:intitulé|titre|poste|job title|title)\s*:\s*/i,"")??(/^(?:(?:senior|lead|junior|staff)\s+)?(?:product owner|product manager|product builder|product ops|product lead)\b/i.test(lines[0]??"")?lines[0]:undefined);
  if(header&&header.length<=180)result.push({field:"title",value:header,quote:titleLine??lines[0]});
  add("company",parsed.company,/^(?:chez|at|company|entreprise)\s*[:\-]/i);
  const permanent=/\bCDI\b|\bpermanent\b/i.test(text),freelance=/\bfreelance\b|\bcontractor\b/i.test(text);
  if(permanent!==freelance&&!/(?:pas de|sans|no|not)\s+(?:CDI|freelance|permanent|contractor)/i.test(text))add("contractType",permanent?"cdi":"freelance",/\bCDI\b|\bfreelance\b|\bcontractor\b|\bpermanent\b/i);
  const salaryLine=lines.find(line=>/(?:salaire|salary|rémunération|compensation)/i.test(line)&&/annuel|annual|par an|per year|\/an/i.test(line));
  const euroAmount=salaryLine?.match(/(?<!\d)(\d{4,6}|\d{2,3}(?:[ \u00a0]\d{3})+)\s*(?:€|EUR\b|euros?)/i)?.[1];
  add("annualSalary",parsed.annualSalary??(euroAmount?Number(euroAmount.replace(/\s/g,"")):null),/(?:salaire|salary|rémunération|compensation)|\d\s*k\s*(?:€|euros)/i);
  add("dailyRate",parsed.dailyRate,/tjm|daily rate|€\s*\/\s*jour|euros?\s*\/\s*jour|\d\s*(?:€|euros?)\s*\/\s*(?:jour|day)/i);
  add("remoteMode",parsed.remoteMode,/remote|télétravail|hybride?|sur site|présentiel|on.site|au bureau/i);
  // A requirement marked as absent must not become a language requirement.
  const englishLine=lines.find(line=>/anglais|english/i.test(line));
  const advanced=englishLine&&/(?:(?:anglais|english).{0,24}(?:C1|C2|courant|fluent|bilingue|native)|(?:C1|C2|fluent|native).{0,24}(?:anglais|english))/i.test(englishLine);
  const professional=englishLine&&/professionnel|professional|B2/i.test(englishLine);
  if(!/anglais\s+(?:non (?:requis|exigé)|facultatif)|(?:no|not)\s+english\s+(?:required|needed)/i.test(text))add("language",englishLine?(advanced?"advanced_en":professional?"professional_en":"en"):/français|french/i.test(text)?"fr":"unknown",/anglais|english|français|french/i);
  for(const [field,period,max] of [["onsiteDaysPerWeek","semaine|week",5],["onsiteDaysPerMonth","mois|month",31]] as const) {
    const number="(?<![\\d.,-])\\b([0-9]{1,2}|un|une|deux|trois|quatre|cinq|one|two|three|four|five)";
    const days="\\s*(?:jours?|days?|j)\\b";
    const site="(?:sur (?:le )?site|en presentiel|de presence|au bureau|on[ -]?site|in[ -]?office)";
    const per="\\s*(?:par|per|/|a)\\s*(?:"+period+")";
    const patterns=[new RegExp(number+days+"\\s*"+site+per),new RegExp(number+days+per+"\\s*"+site),new RegExp(site+"\\s*[:,-]?\\s*"+number+days+per)];
    const matches=lines.flatMap(quote=>patterns.flatMap(pattern=>{const match=fold(quote).match(pattern);if(!match)return [];const words:Record<string,number>={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,one:1,two:2,three:3,four:4,five:5};return [{quote,value:words[match[1]]??Number(match[1])}];}));
    const values=[...new Set(matches.map(match=>match.value))];
    // Conflicting or impossible frequencies remain to be checked manually.
    if(values.length===1&&values[0]>=0&&values[0]<=max)result.push({field,value:values[0],quote:matches[0].quote});
  }
  if(result.some(item=>item.field.startsWith("onsiteDays"))&&!result.some(item=>item.field==="remoteMode"))result.push({field:"remoteMode",value:"hybrid",quote:result.find(item=>item.field.startsWith("onsiteDays"))!.quote});
  if(/(?:100\s*%\s*(?:présentiel|sur site)|sur site uniquement|fully on[ -]?site|aucun télétravail)/i.test(text)){
    const index=result.findIndex(item=>item.field==="remoteMode");if(index>=0)result.splice(index,1);add("remoteMode","onsite",/100\s*%|sur site uniquement|fully on[ -]?site|aucun télétravail/i);
  }
  for(const [field,prefix] of [["remoteCountry",/^(?:télétravail autorisé depuis|remote (?:allowed )?from|pays de télétravail|pays autorisé pour le télétravail)\s*:\s*(.+)$/i]] as const){
    for(const quote of lines){const raw=quote.match(prefix)?.[1];if(!raw)continue;const code=countryCodes.find(code=>fold(countryLabel(code))===fold(raw)||code===raw.toUpperCase());if(code){result.push({field,value:code,quote});break;}}
  }
  return result;
}
export function selectedSuggestions(suggestions:OfferSuggestion[],fields:SuggestedField[]):Partial<JobInput> {
  return Object.fromEntries(suggestions.filter(item=>fields.includes(item.field)).map(item=>[item.field,item.value]));
}
