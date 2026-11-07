import type {ProgressEvent} from "./celebrations";
/** Only call after the writer has confirmed the user's action. No content is included. */
export function confirmedProgress(event:ProgressEvent){window.dispatchEvent(new CustomEvent("radar:progress-confirmed",{detail:event}));}
export function cancelEncouragement(){window.dispatchEvent(new Event("radar:celebrations-cancel"));}
