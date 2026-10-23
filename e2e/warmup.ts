/**
 * Le serveur e2e tourne en mode dev : chaque route est compilée à sa première visite, ce qui
 * dépasse le timeout des tests sur une machine lente (CI). On visite donc une fois les routes
 * parcourues par les specs avant de lancer les tests.
 */
const ROUTES = [
  '/trouver-un-logement-etudiant',
  '/trouver-un-logement-etudiant/ville/saint-etienne',
  '/trouver-un-logement-etudiant/ville/saint-etienne/residence-e2e-du-centre',
  '/mon-espace/tableau-de-bord',
  '/bailleur/tableau-de-bord',
  '/gestionnaire/se-connecter',
]

export default async function warmup() {
  const baseURL = process.env.BASE_URL as string
  for (const route of ROUTES) {
    await fetch(new URL(route, baseURL), { redirect: 'manual', signal: AbortSignal.timeout(180_000) })
  }
}
