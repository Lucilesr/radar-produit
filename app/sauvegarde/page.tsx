import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { BackupDownload } from "@/components/backup-download";
export const dynamic = "force-dynamic";
export default async function BackupPage() {
  await requireChatGPTUser("/sauvegarde");
  return <main style={{ maxWidth: 800, margin: "8vh auto", padding: 32 }}>
    <p>Radar Produit · Espace privé</p>
    <h1>Sauvegarde de votre compte</h1>
    <p>Un export intégral de vos données, versions, décisions et fichiers originaux. Cette opération est en lecture seule : elle ne modifie ni vos candidatures, ni vos droits, ni vos veilles.</p>
    <p>Le fichier contient des informations privées. Conservez-le dans un emplacement protégé ; il ne doit pas être transmis au pilote.</p>
    <p>Si une limite est atteinte ou si les données changent pendant la préparation, l’export est refusé : aucun fichier incomplet n’est présenté comme une sauvegarde.</p>
    <BackupDownload />
    <p>Les accès et tâches de veille sont inventoriés séparément. Les secrets et connexions personnelles ne sont jamais clonés.</p>
    <a href="/">Revenir à Radar</a>
  </main>;
}
