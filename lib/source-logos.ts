export function sourceLogoPath(name: string) {
  const label = name.toLowerCase();
  if (label.includes("jobgether")) return "/source-logos/jobgether.jpeg";
  if (label.includes("linkedin")) return "/source-logos/linkedin.jpeg";
  if (label.includes("collective")) return "/source-logos/collective.png";
  if (label.includes("malt")) return "/source-logos/malt.png";
  if (label.includes("welcome to the jungle")) return "/source-logos/welcome-to-the-jungle.png";
  if (label.includes("apec")) return "/source-logos/apec.jpeg";
  if (label.includes("free-work") || label.includes("freework")) return "/source-logos/free-work.png";
  if (label.includes("indeed")) return "/source-logos/indeed.svg";
  if (label.includes("hello") && label.includes("work")) return "/source-logos/hellowork.svg";
  if (label.includes("we work remotely")) return "/source-logos/we-work-remotely.png";
  if (label.includes("wellfound")) return "/source-logos/wellfound.png";
  if (label.includes("himalayas")) return "/source-logos/himalayas.jpeg";
  if (label.includes("remote") && label.includes("ok")) return "/source-logos/remote-ok.png";
  if (label.includes("remotive")) return "/source-logos/remotive.png";
  if (label.includes("freelancerepublik")) return "/source-logos/freelancerepublik.svg";
  if (label.includes("mindquest")) return "/source-logos/mindquest.svg";
  return "/source-logos/source-generic.svg";
}

