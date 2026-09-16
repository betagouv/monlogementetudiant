import { env } from '~/server/env'
import { maskEmail } from '~/utils/mask-email'

const SENDER_EMAIL = 'no-reply@monlogementetudiant.beta.gouv.fr'

const brevoHeaders = {
  'api-key': env.BREVO_API_KEY,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

// --- Brevo Emails ---

interface TemplateEmailParams {
  to: string
  templateId: number
  params?: Record<string, string>
}

export async function sendTemplateEmail({ to, templateId, params }: TemplateEmailParams): Promise<void> {
  const response = await fetch(env.BREVO_API_URL, {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      to: [{ email: to }],
      templateId,
      replyTo: { email: SENDER_EMAIL },
      ...(params && { params }),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Brevo email failed: ${response.status} ${error}`)
  }
}

interface RawEmailParams {
  to: string[]
  subject: string
  textContent: string
  /** Coupe l'appel au-delà du délai : un Brevo bloqué ne doit pas faire traîner un conteneur cron. */
  timeoutMs?: number
}

/**
 * Envoi en texte libre (sans template Brevo), réservé aux mails internes d'exploitation dont
 * le contenu est trop variable pour un template (message d'erreur, stack). Contrairement aux
 * envois par template, l'expéditeur doit être fourni explicitement.
 */
export async function sendRawEmail({ to, subject, textContent, timeoutMs = 10_000 }: RawEmailParams): Promise<void> {
  const response = await fetch(env.BREVO_API_URL, {
    method: 'POST',
    headers: brevoHeaders,
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: 'MLE Crons' },
      to: to.map((email) => ({ email })),
      replyTo: { email: SENDER_EMAIL },
      subject,
      textContent,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Brevo raw email failed: ${response.status} ${error}`)
  }
}

export async function sendVerificationEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_VALIDATION,
    params: { VALIDATION_LINK: url },
  })
}

export async function sendResetPasswordEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_RESET_PASSWORD,
    params: { RESET_LINK: url },
  })
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_MAGIC_LINK,
    params: { MAGIC_LINK: url },
  })
}

/**
 * Double opt-in d'une demande de contact laissée en visiteur : tant que ce lien n'est pas cliqué,
 * les coordonnées ne sont pas transmises au gestionnaire.
 */
export async function sendContactRequestConfirmationEmail(
  email: string,
  params: { url: string; accommodationName: string },
): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_CONTACT_CONFIRMATION,
    params: { CONFIRMATION_LINK: params.url, ACCOMMODATION_NAME: params.accommodationName },
  })
}

export async function sendOwnerAccountActivated(email: string, url: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_MAGIC_LINK,
    params: { MAGIC_LINK: url },
  })
}

export async function sendOwnerWelcomeEmail(
  email: string,
  { firstname, lastname }: { firstname: string; lastname: string },
): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_OWNER_WELCOME,
  })
  await syncBrevoOwnerCreated(email, { firstname, lastname })
}

export async function sendAdminResetPasswordEmail(email: string): Promise<void> {
  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_ADMIN_RESET_PASSWORD,
  })
}

export async function sendAlertCreationConfirmationEmail(
  email: string,
  params: {
    alertName: string
    city?: string
    academy?: string
    maxBudget: number
  },
): Promise<void> {
  try {
    const UNDEFINED = 'Non définie'
    await sendTemplateEmail({
      to: email,
      templateId: env.BREVO_TEMPLATE_ALERT_CREATION,
      params: {
        alertName: params.alertName,
        maxBudget: String(params.maxBudget),
        city: params.city ?? UNDEFINED,
        academy: params.academy ?? UNDEFINED,
      },
    })
  } catch (error) {
    console.error('sendAlertCreationConfirmationEmail failed:', error)
  }
}

export async function sendAlertExpiryReminderEmail(email: string, params: { alertName: string; alertsUrl: string }): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] relance de péremption non envoyée à ${maskEmail(email)}`)
    return
  }

  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_ALERT_EXPIRY_REMINDER,
    params: { alertName: params.alertName, alertsUrl: params.alertsUrl },
  })
}

export async function sendAlertDeactivationEmail(email: string, params: { alertName: string; alertsUrl: string }): Promise<void> {
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] désactivation d'alerte non envoyée à ${maskEmail(email)}`)
    return
  }

  await sendTemplateEmail({
    to: email,
    templateId: env.BREVO_TEMPLATE_ALERT_DEACTIVATION,
    params: { alertName: params.alertName, alertsUrl: params.alertsUrl },
  })
}

export async function sendStudentAlertEmail(
  email: string,
  params: { firstName: string; alertName?: string; accommodations: { nom: string; url: string }[] },
): Promise<void> {
  // Anti-spam : on n'envoie réellement les alertes qu'en production.
  // Jamais en dev, jamais en staging. Eviter les spam intempestifs.
  if (env.NEXT_PUBLIC_APP_ENV !== 'production') {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] email d'alerte non envoyé à ${maskEmail(email)}`)
    return
  }

  const response = await fetch(env.BREVO_API_URL, {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      to: [{ email }],
      templateId: env.BREVO_TEMPLATE_STUDENT_ALERT,
      replyTo: { email: SENDER_EMAIL },
      params,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Brevo student alert email failed: ${response.status} ${error}`)
  }
}

// --- Brevo Contacts ---
type BrevoEspaceGestionnaire = {
  COMPTE_ESPACE_GESTIONNAIRE: boolean
  // Date 'YYYY-MM-DD' pour les gestionnaires, chaîne vide pour vider l'attribut (étudiants)
  DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE: string
  NOM: string
  PRENOM: string
}
type BrevoDataUpdated = {
  DATE_DERNIERE_MAJ_DONNEES: string
}

async function updateBrevoContactAttributes(email: string, attributes: BrevoDataUpdated | BrevoEspaceGestionnaire): Promise<void> {
  const response = await fetch(env.BREVO_CONTACTS_API_URL, {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      email,
      attributes,
      updateEnabled: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Échec de la mise à jour du contact Brevo : ${response.status} ${error}`)
  }
}

export async function syncBrevoOwnerCreated(
  email: string,
  { firstname, lastname, createdAt }: { firstname: string; lastname: string; createdAt?: Date },
): Promise<void> {
  await updateBrevoContactAttributes(email, {
    COMPTE_ESPACE_GESTIONNAIRE: true,
    DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE: (createdAt ?? new Date()).toISOString().split('T')[0],
    NOM: lastname,
    PRENOM: firstname,
  })
}

export async function syncBrevoStudentCreated(
  email: string,
  { firstname, lastname }: { firstname: string; lastname: string },
): Promise<void> {
  await updateBrevoContactAttributes(email, {
    COMPTE_ESPACE_GESTIONNAIRE: false,
    DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE: '',
    NOM: lastname,
    PRENOM: firstname,
  })
}

export async function syncBrevoDataUpdated(email: string): Promise<void> {
  await updateBrevoContactAttributes(email, {
    DATE_DERNIERE_MAJ_DONNEES: new Date().toISOString().split('T')[0],
  })
}
