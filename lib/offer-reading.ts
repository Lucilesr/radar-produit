/** A short accessible preview; the complete announcement is available in the disclosure. */
export function announcementPreview(value:string|undefined,limit=280){
 if(!value?.trim())return "Annonce complète à ajouter.";
 const text=value.trim(),characters=Array.from(text);
 if(characters.length<=limit)return text;
 const prefix=characters.slice(0,limit).join("");
 return (prefix.replace(/\s+\S*$/,"")||prefix)+"…";
}
