import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck, LockKeyhole, Search, SlidersHorizontal } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser, safeReturnPath } from "@/app/chatgpt-auth";
import { WorkspaceBrand } from "@/components/workspace-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion · Radar Produit" };

const promises = [
  { icon: SlidersHorizontal, title: "Vos critères, vos sources", detail: "Choisissez le poste visé, vos contrats et vos minimums. Radar rassemble les offres de vos sources." },
  { icon: Search, title: "Des offres expliquées", detail: "Chaque offre indique pourquoi elle correspond, et ce qui reste à vérifier avant de candidater." },
  { icon: ClipboardCheck, title: "Le suivi jusqu’à l’entretien", detail: "Candidatures, relances, entretiens et réponses préparées à partir de faits que vous avez validés." },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).return_to;
  const returnTo = safeReturnPath(typeof raw === "string" ? raw : "/");
  // An account already signed in goes straight back to Radar.
  if (await getChatGPTUser()) redirect(returnTo);

  return <main className="signin-page">
    <div className="signin-layout">
      <section className="signin-card" aria-labelledby="signin-title">
        <WorkspaceBrand />
        <h1 id="signin-title">Votre recherche d’emploi, triée et suivie au même endroit</h1>
        <p className="signin-lead">Radar rassemble les offres qui correspondent à votre recherche, signale ce qu’il faut vérifier et suit vos candidatures.</p>
        <a className="radar-add-button signal-form-button signin-primary" href={chatGPTSignInPath(returnTo)}>Se connecter avec ChatGPT</a>
        <p className="signin-help">Radar utilise votre compte ChatGPT pour vous identifier : aucun mot de passe à créer. À la première connexion, votre espace est créé, vide et privé.</p>
        <div className="signin-demo">
          <span>Envie d’essayer d’abord ?</span>
          <a className="secondary-button signal-form-button" href="/demo">Voir la démo</a>
        </div>
        <p className="signin-privacy"><LockKeyhole size={13} aria-hidden /> Vos offres, documents et notes ne sont visibles que par vous. Vous pouvez exporter vos données ou supprimer votre compte à tout moment.</p>
      </section>
      <ul className="signin-promises" aria-label="Ce que fait Radar">
        {promises.map(({ icon: Icon, title, detail }) => <li key={title}>
          <span className="signin-promise-icon"><Icon size={18} aria-hidden /></span>
          <div><strong>{title}</strong><p>{detail}</p></div>
        </li>)}
      </ul>
    </div>
  </main>;
}
