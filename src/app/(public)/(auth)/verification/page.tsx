import { notFound, redirect } from 'next/navigation'

interface VerificationPageProps {
  searchParams: { sesame?: string; error?: string }
}

export default async function VerificationPage({ searchParams }: VerificationPageProps) {
  const { sesame, error } = searchParams

  if (error) {
    return (
      <div>
        <p>Erreur de vérification</p>
      </div>
    )
  }

  if (!sesame) {
    return notFound()
  }

  redirect(`/api/authentication/verify?sesame=${encodeURIComponent(sesame)}`)
}
