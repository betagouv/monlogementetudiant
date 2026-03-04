const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

interface EmailParams {
  to: string
  subject: string
  htmlContent: string
}

export async function sendEmail({ to, subject, htmlContent }: EmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set')
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'Mon Logement Étudiant',
        email: process.env.BREVO_SENDER_EMAIL || 'noreply@monlogementetudiant.beta.gouv.fr',
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Brevo email failed: ${response.status} ${error}`)
  }
}

export async function sendVerificationEmail(email: string, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Confirmez votre adresse email — Mon Logement Étudiant',
    htmlContent: `
      <h2>Bienvenue sur Mon Logement Étudiant !</h2>
      <p>Cliquez sur le lien ci-dessous pour confirmer votre adresse email :</p>
      <p><a href="${url}">Confirmer mon email</a></p>
      <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
    `,
  })
}

export async function sendResetPasswordEmail(email: string, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe — Mon Logement Étudiant',
    htmlContent: `
      <h2>Réinitialisation de votre mot de passe</h2>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${url}">Réinitialiser mon mot de passe</a></p>
      <p>Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email.</p>
    `,
  })
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Votre lien de connexion — Mon Logement Étudiant',
    htmlContent: `
      <h2>Connexion à Mon Logement Étudiant</h2>
      <p>Cliquez sur le lien ci-dessous pour vous connecter :</p>
      <p><a href="${url}">Se connecter</a></p>
      <p>Ce lien est valable pour une durée limitée. Si vous n'avez pas demandé cette connexion, vous pouvez ignorer cet email.</p>
    `,
  })
}
