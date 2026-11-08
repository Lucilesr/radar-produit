import {planHeld,validTimeZone,weekKey,type WeekPlan} from "./week-plan";
export type SeriesSettings={version:number;startedWeek:string;timeZone:string;pausedWeeks:string[];welcomeWeek?:string};
export type WeekOutcome={week:string;outcome:"held"|"pause"|"joker"|"open"|"blank";streak:number;jokers:number};
export type WeekSeries={version:number;week:string;startedWeek:string;timeZone:string;streak:number;heldTotal:number;jokers:number;welcomeSeen:boolean;paused:boolean;pauseStart:string|null;pauseEnd:string|null;justReset:boolean;weeks:WeekOutcome[]};
export function weekMonday(key:string){if(!/^20\d\d-W\d{2}$/.test(key))return null;const [year,n]=key.split('-W').map(Number),day=new Date(Date.UTC(year,0,4));day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7)+(n-1)*7);return weekKey(day,"UTC")===key?day:null;}
export function shiftWeek(key:string,count:number){const day=weekMonday(key);if(!day)throw new Error("Semaine invalide.");day.setUTCDate(day.getUTCDate()+count*7);return weekKey(day,"UTC");}
export function seriesSettings(profile:Record<string,unknown>,now=new Date(),zone="UTC"):SeriesSettings{
 const raw=(profile.weekSeries??{}) as Partial<SeriesSettings>,plan=profile.weekPlan as WeekPlan|undefined;
 const timeZone=validTimeZone(raw.timeZone)?raw.timeZone:validTimeZone(plan?.timeZone)?plan!.timeZone:validTimeZone(zone)?zone:"UTC",week=weekKey(now,timeZone);
 const plans=[...(Array.isArray(profile.weekPlans)?profile.weekPlans:[]),plan].filter((p):p is WeekPlan=>!!p&&typeof p.week==="string"&&!!weekMonday(p.week)&&p.week<=week);
 const earliest=plans.map(p=>p.week).sort()[0]??week;
 const minimum=shiftWeek(week,-1040);
 const startedWeek=raw.startedWeek&&weekMonday(raw.startedWeek)&&raw.startedWeek<=week?raw.startedWeek:earliest;
 return {version:Number.isInteger(raw.version)&&Number(raw.version)>=0?Number(raw.version):0,startedWeek:startedWeek<minimum?minimum:startedWeek,timeZone,pausedWeeks:Array.isArray(raw.pausedWeeks)?[...new Set(raw.pausedWeeks.filter(w=>typeof w==="string"&&!!weekMonday(w)&&w>=minimum&&w<=shiftWeek(week,4)))].sort():[],...(typeof raw.welcomeWeek==="string"?{welcomeWeek:raw.welcomeWeek}:{})};
}
export function weekSeries(profile:Record<string,unknown>,now=new Date(),zone="UTC"):WeekSeries{
 const settings=seriesSettings(profile,now,zone),week=weekKey(now,settings.timeZone),plans=[...(Array.isArray(profile.weekPlans)?profile.weekPlans:[]),profile.weekPlan].filter((p):p is WeekPlan=>!!p&&typeof p==="object"&&typeof (p as WeekPlan).week==="string");
 const held=new Set(plans.filter(p=>Array.isArray(p.commitments)&&planHeld(p)).map(p=>p.week));let streak=0,heldTotal=0,jokers=0,justReset=false;const weeks:WeekOutcome[]=[];
 for(let cursor=settings.startedWeek;cursor<=week;cursor=shiftWeek(cursor,1)){
  let outcome:WeekOutcome['outcome'];
  if(held.has(cursor)){outcome="held";streak++;heldTotal++;if(heldTotal%4===0)jokers=Math.min(2,jokers+1);justReset=false;}
  else if(settings.pausedWeeks.includes(cursor)){outcome="pause";justReset=false;}
  else if(cursor===week){outcome="open";}
  else if(streak>0&&jokers>0){outcome="joker";jokers--;justReset=false;}
  else{outcome="blank";justReset=streak>0;streak=0;}
  weeks.push({week:cursor,outcome,streak,jokers});
 }
 const futurePause=settings.pausedWeeks.filter(w=>w>=week),pauseStart=futurePause[0]??null,pauseEnd=futurePause.at(-1)??null;
 return {...settings,week,streak,heldTotal,jokers,welcomeSeen:settings.welcomeWeek===week,paused:settings.pausedWeeks.includes(week),pauseStart,pauseEnd,justReset,weeks};
}

export function pauseLabel(start:string,end:string){const from=weekMonday(start),to=weekMonday(end);if(!from||!to)return "Dates à relire";to.setUTCDate(to.getUTCDate()+6);const format=(date:Date)=>date.toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});return `du ${format(from)} au ${format(to)}`;}
