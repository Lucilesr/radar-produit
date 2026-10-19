// Same-origin static worker: no CDN, no document sent to another service.
import {copyFile,mkdir} from "node:fs/promises";
const target=new URL("../public/vendor/",import.meta.url);
await mkdir(target,{recursive:true});
await copyFile(new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url),new URL("pdf.worker.min.mjs",target));
await copyFile(new URL("../node_modules/pdfjs-dist/LICENSE",import.meta.url),new URL("pdfjs-LICENSE.txt",target));
