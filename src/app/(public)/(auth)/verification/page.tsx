import { notFound, redirect } from 'next/navigation'

interface VerificationPageProps {
  searchParams: { sesame?: string; validation_token?: string; error?: string }
}

export default async function VerificationPage({ searchParams }: VerificationPageProps) {
  const { sesame, validation_token, error } = searchParams

  if (error) {
    return (
      <div>
        <p>Erreur de vérification</p>
      </div>
    )
  }

  if (!sesame && !validation_token) {
    return notFound()
  }

  if (sesame) {
    redirect(`/api/authentication/verify?sesame=${encodeURIComponent(sesame)}`)
  }
  if (validation_token) {
    redirect(`/api/accounts/students/validate?validation_token=${encodeURIComponent(validation_token)}`)
  }
}
