import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// next/headers and next/navigation are only needed at request time: stub them.
const stub = "data:text/javascript;base64," + Buffer.from("export const cookies=async()=>({get:()=>undefined});export const headers=async()=>new Headers();export const redirect=()=>{throw new Error('redirect')};").toString("base64");
let code = ts.transpileModule(readFileSync(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
code = code.replaceAll('"next/headers"', JSON.stringify(stub)).replaceAll('"next/navigation"', JSON.stringify(stub));
const auth = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("connexion : un visiteur non connecté arrive sur la page Radar, avec son retour", () => {
  assert.equal(auth.radarSignInPagePath("/"), "/connexion");
  assert.equal(auth.radarSignInPagePath("/sauvegarde"), "/connexion?return_to=%2Fsauvegarde");
  assert.equal(auth.chatGPTSignInPath("/sauvegarde"), "/signin-with-chatgpt?return_to=%2Fsauvegarde");
});

test("connexion : le retour refuse les adresses externes et les pages d'authentification", () => {
  for (const unsafe of ["https://exemple.test", "//exemple.test", "/connexion", "/signin-with-chatgpt", "/signout-with-chatgpt", "javascript:alert(1)", null])
    assert.equal(auth.safeReturnPath(unsafe), "/");
  assert.equal(auth.safeReturnPath("/?tab=offers"), "/?tab=offers");
});

test("déconnexion : retour vers Radar, qui renvoie vers la page de connexion", () => {
  assert.equal(auth.chatGPTSignOutPath("/"), "/signout-with-chatgpt?return_to=%2F");
});
