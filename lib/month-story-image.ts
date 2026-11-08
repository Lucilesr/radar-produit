import {monthStoryCards,type MonthStory} from "./month-story";
/** Entirely local: no image service, upload or share destination. */
export async function monthStoryImage(story:MonthStory):Promise<Blob>{
 await document.fonts.ready;
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");if(!ctx)throw new Error("Le téléchargement en image n’est pas disponible dans ce navigateur.");
 const width=1080,pad=64,inner=width-2*pad,styles=getComputedStyle(document.documentElement),color=(name:string,fallback:string)=>styles.getPropertyValue(name).trim()||fallback,petrol=color("--signal-petrol-deep","#203743"),paper=color("--signal-paper","#ffffff"),energy=color("--signal-energy","#E6EE53"),mid=color("--signal-petrol-mid","#24566B");
 canvas.width=width;
 function lines(text:string,font:string,max=inner-80){ctx!.font=font;const result:string[]=[];let line="";for(const word of text.split(/\s+/)){const candidate=line?`${line} ${word}`:word;if(ctx!.measureText(candidate).width<=max){line=candidate;continue;}if(line)result.push(line);line="";for(const character of word){if(ctx!.measureText(line+character).width>max){result.push(line);line="";}line+=character;}}if(line)result.push(line);return result;}
 const cards=monthStoryCards(story),layouts=cards.map((card,index)=>{const detail=lines(card.detail,'400 30px "Avenir Next",sans-serif'),gemTitle=index===4&&story.gem?lines(story.gem.title,'650 46px "Bricolage Grotesque",sans-serif'):[],company=index===4&&story.gem?lines(story.gem.company,'400 32px "Avenir Next",sans-serif'):[];return {card,detail,gemTitle,company,height:index===4?Math.max(360,180+gemTitle.length*56+company.length*42+detail.length*40):310+detail.length*40};});
 const height=260+layouts.reduce((sum,item)=>sum+item.height+24,0)+140;canvas.height=height;ctx.fillStyle=petrol;ctx.fillRect(0,0,width,height);
 const draw=(text:string,x:number,y:number,font:string)=>{ctx.font=font;ctx.fillStyle=paper;ctx.fillText(text,x,y);};
 draw("Votre mois de recherche",pad,84,'700 54px "Bricolage Grotesque",sans-serif');draw(story.label,pad,146,'500 40px "Bricolage Grotesque",sans-serif');draw("Les faits enregistrés, à votre rythme.",pad,202,'400 28px "Avenir Next",sans-serif');let y=244;
 for(const [index,item] of layouts.entries()){ctx.fillStyle=mid;ctx.fillRect(pad,y,inner,item.height);ctx.fillStyle=energy;ctx.fillRect(pad,y,inner,4);draw(`${index+1} / 5  ·  ${item.card.title}`,pad+40,y+68,'650 40px "Bricolage Grotesque",sans-serif');let textY=y+140;
  if(item.card.value!==null){draw(item.card.value.toLocaleString("fr-FR"),pad+40,y+202,'750 108px "Bricolage Grotesque",sans-serif');textY=y+266;}
  else if(story.gem){for(const line of item.gemTitle){draw(line,pad+40,textY,'650 46px "Bricolage Grotesque",sans-serif');textY+=56;}textY+=12;for(const line of item.company){draw(line,pad+40,textY,'400 32px "Avenir Next",sans-serif');textY+=42;}textY+=20;}
  for(const line of item.detail){draw(line,pad+40,textY,'400 30px "Avenir Next",sans-serif');textY+=40;}y+=item.height+24;
 }
 draw("Radar · image privée, aucun partage automatique",pad,y+36,'400 26px "Avenir Next",sans-serif');if(story.partial)draw("Historique partiel : seules les données enregistrées sont reprises.",pad,y+80,'400 24px "Avenir Next",sans-serif');
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("L’image n’a pas pu être créée. Réessayez.")),"image/png"));
}
