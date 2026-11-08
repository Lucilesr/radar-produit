# P4 — Une prochaine étape commune

La fonction pure nextSteps reçoit l’heure et le calendrier, les offres, le lot, le plan, la portée et les sources déjà relus. Elle ne lit aucun stockage et n’écrit rien. Elle renvoie une file de sept types d’étapes au plus : entretien dans les 48 heures, relances arrivées à échéance, lot du jour, plan à poser, candidature sélectionnée pas encore soignée, réglage et source manuelle non visitée depuis sept jours.

Une identité d’action évite de proposer deux fois la même visite ou la même histoire au titre d’un réglage. Une étape absente n’est pas inventée ; un plan déjà confirmé pour cette semaine reste fait. La portée et ses calculs ne changent pas. Les échéances reposent sur les helpers existants.

Un contexte de présentation transmet cette file à l’accueil, la portée, le plan et la candidature soignée. La séance prend ses étapes dans la même file. Le plan n’ajoute plus ses propres suggestions ; ses pistes viennent des actions compatibles déjà proposées. Le carnet, les relances et les préparations gardent leurs règles de sauvegarde.

Les séances précédentes restent relisibles et conservent leur ordre de reprise. Les nouvelles utilisent les sept priorités ; une étape devenue vide est sautée. La continuité et ses protections de concurrence sont conservées. Le bilan peut compter une candidature passée de moins de trois à au moins trois repères pendant une nouvelle séance : seuls des nombres de repères entrent dans son instantané, jamais les textes privés. Les anciennes séances sans ce repère ne sont pas enrichies rétroactivement.

Après la fin, l’accueil laisse le droit d’arrêter. Le repère de confort reste dans l’onglet pour le compte et la journée, sans service tiers ; une nouvelle journée ou Revoir les étapes retrouve les propositions. Il ne recrée jamais une séance terminée. Aucune migration.
