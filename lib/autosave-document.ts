export type SavedText = { value: string; version: number };
type Draft = SavedText & { base: string; time: number };
export type AutosaveSnapshot = { value: string; loaded: boolean; phase: "loading"|"saved"|"pending"|"saving"|"error"|"conflict"; error: string; storageError: boolean; remote?: SavedText };
export type AutosaveTransport = { read: () => Promise<SavedText>; write: (value:string,base:SavedText) => Promise<SavedText> };
export class SaveConflict extends Error { constructor(public current:SavedText) { super("Une autre version a été enregistrée. Votre saisie est conservée."); } }

/** One serial queue per owner/document, independent from the lifetime of a modal. */
export class AutosaveDocument {
  private base:SavedText = {value:"",version:0};
  private state:AutosaveSnapshot;
  private listeners = new Set<()=>void>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  private writing = false;
  private started = false;
  private recover:Draft|null = null;
  constructor(private transport:AutosaveTransport, private cache:{read:()=>Draft|null;write:(draft:Draft)=>void;clear:(saved?:string)=>void}, initial="", private limit=30000, private onSaved?:(value:string)=>void, private delay=750) {
    this.state={value:initial,loaded:false,phase:"loading",error:"",storageError:false};
  }
  getSnapshot = () => this.state;
  subscribe = (listener:()=>void) => {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<AutosaveSnapshot>) { this.state={...this.state,...patch};for(const listener of this.listeners)listener(); }
  private persist() {
    try {this.cache.write({value:this.state.value,version:this.base.version,base:this.base.value,time:Date.now()});this.publish({storageError:false});}
    catch {this.publish({storageError:true});}
  }
  async start() {
    if(this.started)return;this.started=true;
    try {this.recover=this.cache.read();}catch {this.publish({storageError:true});}
    try {
      this.base=await this.transport.read();
      const cached=this.recover;
      const value=cached?.value ?? (this.base.version===0&&!this.base.value?this.state.value:this.base.value);
      const conflict=!!cached && cached.value!==this.base.value && (cached.version!==this.base.version||cached.base!==this.base.value);
      this.publish({value,loaded:true,phase:conflict?"conflict":"saved",remote:conflict?this.base:undefined,error:conflict?"Ce texte a changé ailleurs. Comparez les versions avant d’enregistrer.":""});
      if(cached&&!conflict&&value!==this.base.value){this.publish({phase:"pending"});this.schedule();}
      else if(cached&&!conflict)try{this.cache.clear(this.base.value);}catch{}
    } catch {this.started=false;this.publish({value:this.recover?.value??this.state.value,phase:"error",error:"Chargement impossible. Réessayez ; le brouillon local est conservé."});}
  }
  change(value:string) {
    if(!this.state.loaded)return;
    this.publish({value,phase:this.state.phase==="conflict"?"conflict":"pending",error:this.state.phase==="conflict"?this.state.error:""});
    this.persist();this.schedule();
  }
  private schedule() {clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),this.delay);}
  async flush() {
    clearTimeout(this.timer);
    if(!this.state.loaded){await this.start();return;}
    if(this.writing||this.state.phase==="conflict")return;
    if(this.state.value.length>this.limit){this.publish({phase:"error",error:`Limite de ${this.limit} caractères dépassée. Votre saisie reste conservée localement.`});return;}
    if(this.state.value===this.base.value){this.publish({phase:"saved",error:""});return;}
    const value=this.state.value,base=this.base;
    this.writing=true;this.publish({phase:"saving",error:""});
    try {
      const result=await this.transport.write(value,base);this.base=result;
      this.onSaved?.(result.value);
      const pending=this.state.value!==value;
      if(pending){this.publish({phase:"pending"});this.persist();}
      else {this.publish({value:result.value,phase:"saved",error:"",remote:undefined});try{this.cache.clear(this.base.value);}catch{}}
    } catch(problem) {
      this.publish(problem instanceof SaveConflict?{phase:"conflict",remote:problem.current,error:problem.message}:{phase:"error",error:"Enregistrement non confirmé. Votre brouillon est conservé ; réessayez."});
      this.persist();
    } finally {this.writing=false;if(this.state.phase==="pending")this.schedule();}
  }
  /** Deliberate conflict resolution. The server keeps every previous revision. */
  async saveComparedVersion() {
    if(!this.state.remote||this.writing)return;
    this.base=this.state.remote;this.publish({phase:"pending",remote:undefined,error:""});this.persist();await this.flush();
  }
  confirmedElsewhere(value:string) {
    // A successful explicit form submission becomes the next draft baseline too.
    this.change(value);void this.flush();
  }
  get pending() {return this.state.loaded ? this.state.phase!=="saved"&&this.state.phase!=="loading" : !!this.recover;}
}
