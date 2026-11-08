import type {RadarInitialState} from "./radar-bootstrap";
/** A demonstration can exercise the real retry/loading views, never a real account. */
export function demoTodayInitialState(owner:string,mode:string|undefined,state:RadarInitialState):RadarInitialState|undefined{
 if(!owner.startsWith("demo:"))return state;
 if(mode==="today-loading")return undefined;
 if(mode==="today-error")return {...state,errors:{...state.errors,jobs:true}};
 return state;
}
