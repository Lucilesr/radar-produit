/** Local coordination only: a session never closes before its action is confirmed. */
export function sessionWrite(key:string,busy:boolean){window.dispatchEvent(new CustomEvent("radar:session-write",{detail:{key,busy}}));}
