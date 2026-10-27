import type {ReactNode} from 'react';
import {Textarea} from '@/components/ui/textarea';
import type {ItemData} from '@/lib/experience-domain';
import {exampleParts,exampleValues,updateExampleField,exampleLabels,examplePlaceholders,type ExampleField} from '@/lib/experience-fields';
const order:ExampleField[]=['description','objective','result','actions'];
export function ExampleEditor({data,onChange,disabled=false,requiredDescription=false}:{data:ItemData;onChange:(data:ItemData)=>void;disabled?:boolean;requiredDescription?:boolean}){
 const values=exampleValues(data),parts=exampleParts(data);
 return <div className="library-example-fields sm:col-span-2">{order.map(field=>{
  const ranges=parts.filter(p=>p.field===field);
  const contextCost=updateExampleField(data,field,'x').context.length-1;
  const limit=field==='actions'?4000:field==='result'?parts.some(p=>p.field==='result')?Math.min(4000,6000-contextCost):4000:6000-contextCost;
  return <label className="library-example-field" key={field}><span>{exampleLabels[field]}</span><Textarea required={requiredDescription&&field==="description"} disabled={disabled} aria-label={exampleLabels[field]} data-field={field==='actions'?'contribution':field==='result'?'result':'context'} data-start={ranges[0]?.start??0} data-end={ranges.at(-1)?.end??0} data-context-ranges={JSON.stringify(ranges.map(p=>[p.start,p.end]))} rows={field==='description'?4:3} maxLength={Math.max(0,limit)} placeholder={examplePlaceholders[field]} value={values[field]} onChange={event=>onChange(updateExampleField(data,field,event.target.value))}/></label>;
 })}</div>;
}
export function ExampleSummary({data,renderText}:{data:ItemData;renderText:(text:string)=>ReactNode}){
 const values=exampleValues(data);
 return <div className="library-example-summary">{order.filter(field=>field==="description"||values[field]).map(field=><section key={field}><h4>{exampleLabels[field]}</h4>{values[field]?renderText(values[field]):<p className="library-example-empty">{field==='description'?'Description à compléter.':field==='objective'?'Objectif à préciser.':field==='result'?'Résultat à documenter.':'Actions personnelles à préciser.'}</p>}</section>)}</div>;
}
