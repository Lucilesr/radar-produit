/** View adapter over existing experience fields; no additional persisted schema. */
import {contextPassages,replaceContextPassage,replaceDocumentedField,type ItemData} from './experience-domain';
export type ExampleField='description'|'objective'|'result'|'actions';
export function exampleParts(data:ItemData){
 let section:ExampleField="description";
 return contextPassages(data.context).flatMap(p=>{
  let start=p.start,text=p.text;
  if(start===0){const heading=/^###\s+[^\r\n]+(?:\r?\n)?/.exec(text);if(heading){start+=heading[0].length;text=text.slice(heading[0].length);}}
  if(!text.trim())return [];
  const label=/^\*\*(Son rôle|Objectif|Le résultat|Résultat)\.\*\*\s*/i.exec(text);
  if(label)section=/résultat/i.test(label[1])?'result':'objective';
  const field=section;
  return [{field,start,end:p.end,prefix:label?.[0]??'',text:text.slice(label?.[0].length??0).trim()}];
 });
}
export function exampleValues(data:ItemData){
 const parts=exampleParts(data),texts=(field:ExampleField)=>parts.filter(p=>p.field===field).map(p=>p.text).filter(Boolean);
 const results=[...new Set([texts('result').join('\n\n'),data.result.trim()].filter(Boolean))];
 return {description:texts('description').join('\n\n'),objective:texts('objective').join('\n\n'),result:results.join('\n\n'),actions:data.contribution};
}
export function updateExampleField(data:ItemData,field:ExampleField,value:string):ItemData{
 if(field==='actions')return replaceDocumentedField(data,'contribution',value);
 const parts=exampleParts(data).filter(p=>p.field===field);
 let next=data;
 if(parts.length){
  for(let n=parts.length-1;n>=0;n--){const p=parts[n];next=replaceContextPassage(next,p.start,p.end,n===0?p.prefix+value:'');}
 }else if(field!=='result'&&value){
  const prefix=field==='objective'?'**Objectif.** ':'';
  next={...data,context:data.context+(data.context?'\n\n':'')+prefix+value};
 }
 // The legacy passage helper synchronizes an exact copy of « Son rôle ».
 // In this view Objective and Actions are separate controls: editing one must
 // never replace the other without an explicit action from the user.
 next={...next,contribution:data.contribution};
 return field==='result'?replaceDocumentedField(next,'result',value):next;
}
export const exampleLabels={description:'Description',objective:'Objectif',result:'Résultat',actions:'Mon rôle et mes actions'};
export const examplePlaceholders={
 description:'Décrivez le projet, le problème rencontré et le contexte en quelques phrases.',
 objective:'Quel objectif cherchiez-vous à atteindre ? Ex. simplifier un parcours ou réduire les erreurs.',
 result:'Décrivez les effets observés, les retours reçus et les limites connues. Si le résultat reste à mesurer, précisez-le.',
 actions:'Précisez ce que vous avez fait personnellement : cadrage du besoin, ateliers, décisions, priorisation, coordination…'
};
