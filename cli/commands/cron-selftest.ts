/**
 * Provoque volontairement un échec pour valider la chaîne d'alerte de bout en bout
 * (wrapper → Sentry → mail Brevo) sans attendre un vrai incident :
 *
 *   scalingo -a mle-prod --region osc-secnum-fr1 run npx tsx cli/index.ts cron-selftest
 *
 * Ne touche ni la base ni aucune API métier. Absente de `SCHEDULED_COMMANDS`, mais listée dans
 * `CRON_COMMANDS` pour être traitée comme un job planifié.
 */
export async function cronSelftest(): Promise<void> {
  console.log("🧪 Self-test de l'alerte d'échec des crons : levée d'une erreur volontaire...")
  throw new Error("Self-test de l'alerte cron — cet échec est volontaire, aucune action requise.")
}
