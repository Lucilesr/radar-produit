// Fictitious data only. This script deliberately cannot target a hosted Site.
import assert from "node:assert/strict";
const base="http://127.0.0.1:5173";
const headers={Cookie:"__sites_local_auth=1"};
const request=async(path,body)=>{
  const r=await fetch(base+path,{headers:{...headers,...(body?{"Content-Type":"application/json"}:{})},...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  const data=await r.json();assert(r.ok,JSON.stringify(data));return data;
};
const name="parcours-recette.md";
const text="# Parcours fictif de recette\n\n## Parcours en un coup d'œil\nUne synthèse, pas une expérience supplémentaire.\n\n## 1. Atlas — Product Owner (2024 → 2025, freelance)\nESN dont les clients sont des acteurs du secteur public.\n\n### Questionnaire de recette\n**Le contexte.** Refonte d’un outil fictif.\n\n**Son rôle.** J’ai rédigé les scénarios de recette.\n\n**Le résultat.** Livraison documentée, sans métrique d’impact inventée.\n\n## 2. Boréal — Product Owner / QA (2023 → 2024, à distance)\n**Le produit.** Une app mobile fictive.\n\n**L’équipe.** Deux fondateurs.\n\n**Ce qu’elle a produit.** Des scénarios et des prompts.\n\n**Non confirmé.** Le périmètre exact reste à préciser.\n\n## FORMATION ET LANGUES\nUne formation fictive, sans lien inventé avec une mission.";
let docs=(await request("/api/documents")).documents;
if(!docs.some(d=>d.originalName===name)){
  const form=new FormData();form.set("slot","detailedExperienceDocumentId");form.set("file",new Blob([text],{type:"text/markdown"}),name);
  const r=await fetch(base+"/api/documents",{method:"POST",headers,body:form});const data=await r.json();assert(r.ok,JSON.stringify(data));
}
let state=await request("/api/experiences");
if(!state.items.some(i=>i.data.title==="Atlas — copie de recette")){
  const data={title:"Atlas — copie de recette",organization:"Atlas copie",role:"Product Owner",period:"2024 → 2025",context:"Expérience fictive dupliquée pour tester le masquage et la restauration.",contribution:"",result:"",claimKey:""};
  state=await request("/api/experiences",{action:"create",id:crypto.randomUUID(),kind:"experience",parentId:null,data});
}
console.log(JSON.stringify({localOnly:true,fictionalOnly:true,reference:state.reference?.name,itemsBeforeBrowserExtraction:state.items.length}));
