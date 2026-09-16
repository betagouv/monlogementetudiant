import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ContactModePromoBanner } from '~/components/bailleur/contact-mode-promo-banner'
import { OwnerFeedbackBanner } from '~/components/bailleur/owner-feedback-banner'
import { ImpersonationBanner } from '~/components/impersonation/impersonation-banner'
import { CommonFooter } from '~/components/ui/footer/footer'
import { WorkspaceHeaderComponent } from '~/components/ui/header/workspace-header'
import { canAccessOwnerSpace } from '~/lib/roles'
import { getServerSession } from '~/services/better-auth'
import styles from './layout.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('workspace.description'),
    title: t('workspace.title'),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession()

  // Une session absente n'est pas une page introuvable : c'est le cas d'un lien de connexion périmé
  // ou d'une session expirée, on renvoie l'utilisateur au formulaire de connexion.
  if (!session) {
    redirect('/gestionnaire/se-connecter')
  }

  // Un étudiant authentifié (ou un rôle inattendu), en revanche, n'a pas à découvrir l'existence de
  // l'espace gestionnaire.
  if (!canAccessOwnerSpace(session.user.role)) {
    return notFound()
  }

  const showFeedbackBanner = session.user.role !== 'admin' && !!session.user.bailleurRole

  return (
    <>
      <WorkspaceHeaderComponent />
      <ImpersonationBanner />
      <ContactModePromoBanner />
      <main className={styles.container}>{children}</main>
      {showFeedbackBanner && <OwnerFeedbackBanner />}
      <CommonFooter />
    </>
  )
}
