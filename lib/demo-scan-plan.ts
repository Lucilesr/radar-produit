/** Fictional scan only; these names do not enable real collectors. */
export const demoScanActive = ["We Work Remotely", "Jobgether", "Apec", "Collective", "Free-Work", "LinkedIn Jobs", "Welcome to the Jungle"] as const;
export const demoScanPaused = ["Malt", "HelloWork"] as const;
export const demoScanSources = [...demoScanActive, ...demoScanPaused] as const;
export function demoScanState(name:string,settings:readonly {source:string;selected?:boolean;state?:string}[]){
 const setting=settings.find(item=>item.source===name);
 return (demoScanPaused as readonly string[]).includes(name)||setting?.selected===false||setting?.state==="paused"?"paused" as const:"waiting" as const;
}
