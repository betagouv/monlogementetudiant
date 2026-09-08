'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import z from 'zod'
import { DossierFacileConnectButton } from '~/components/dossier-facile/dossier-facile-connect-button'
import { CompleteProfileModal, completeProfileModal } from '~/components/student-space/profile/complete-profile-modal'
import { createToast } from '~/components/ui/createToast'
import { ModalPortal } from '~/components/ui/modal-portal'
import { NewWindowHint } from '~/components/ui/new-window'
import { RequiredFieldsNotice, RequiredLabel } from '~/components/ui/required-mark'
import type { ApartmentType } from '~/enums/apartment-type'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { trackEvent } from '~/lib/tracking'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { authClient } from '~/services/better-auth-client'
import { isStudentProfileComplete } from '~/utils/student-profile'
import { CandidatureModal, useCandidatureModal } from './candidature-modal'
import styles from './contact-request-modal.module.css'

interface Props {
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
  isAuthenticated: boolean
  contactMode: EOwnerContactMode
}

export const DossierFacileLinkButton = ({ accommodationSlug, availableApartmentTypes, isAuthenticated, contactMode }: Props) => {
  if (contactMode === EOwnerContactMode.NONE) return null
  if (availableApartmentTypes.length === 0) return null
  if (contactMode === EOwnerContactMode.CONTACTS) return <ContactRequestButton accommodationSlug={accommodationSlug} />
  if (!isAuthenticated) return null
  return <DossierFacileApplyButton accommodationSlug={accommodationSlug} availableApartmentTypes={availableApartmentTypes} />
}

const ContactRequestButton = ({ accommodationSlug }: { accommodationSlug: string }) => {
  const t = useTranslations('accomodation')
  const trpc = useTRPC()
  const { data: session } = authClient.useSession()
  const contactRequestModal = useContactRequestModal(accommodationSlug)
  const isStudent = session?.user.role === 'user'

  const { data: existing, isLoading } = useQuery({ ...trpc.contacts.myRequest.queryOptions({ accommodationSlug }), enabled: isStudent })

  if (isStudent && isLoading) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          {t('sidebar.buttons.contactRequestLoading')}
        </Button>
      </div>
    )
  }

  if (existing) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          {t('sidebar.buttons.contactRequestSent')}
        </Button>
      </div>
    )
  }

  return (
    <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
      <Button {...contactRequestModal.buttonProps} priority="primary" className="fr-width-full fr-flex fr-justify-content-center">
        {t('sidebar.buttons.contactRequest')}
      </Button>
      <span className="fr-text--xs fr-mb-0">{t('sidebar.buttons.contactRequestDescription')}</span>
      <ContactRequestModal accommodationSlug={accommodationSlug} />
    </div>
  )
}

const useContactRequestModal = (accommodationSlug: string) => {
  return useMemo(() => createModal({ id: `contact-request-modal-${accommodationSlug}`, isOpenedByDefault: false }), [accommodationSlug])
}

const ZContactRequestForm = z.object({
  firstname: z.string().trim().min(1, 'Le prénom est requis'),
  lastname: z.string().trim().min(1, 'Le nom est requis'),
  email: z.string().trim().email("L'e-mail est invalide"),
  phone: z.string().trim(),
  consent: z.boolean().refine((value) => value, 'Vous devez accepter le partage de vos informations'),
})

type TContactRequestForm = z.infer<typeof ZContactRequestForm>

type TContactRequestField = 'firstname' | 'lastname' | 'email' | 'phone'

/**
 * Une information déjà connue du compte n'est pas redemandée : elle s'affiche verrouillée.
 * Le champ verrouillé n'est pas enregistré auprès de react-hook-form — sa valeur vient de `values`,
 * donc elle part quand même dans la soumission.
 */
const LockableInput = ({
  label,
  name,
  type,
  autoComplete,
  required,
  lockedValue,
  form,
}: {
  label: ReactNode
  name: TContactRequestField
  type: 'text' | 'email' | 'tel'
  autoComplete: string
  required?: boolean
  lockedValue: string
  form: UseFormReturn<TContactRequestForm>
}) => {
  if (lockedValue) {
    return <Input label={label} disabled nativeInputProps={{ type, autoComplete, value: lockedValue, readOnly: true }} />
  }

  const error = form.formState.errors[name]?.message

  return (
    <Input
      label={label}
      state={error ? 'error' : 'default'}
      stateRelatedMessage={error}
      nativeInputProps={{ type, ...form.register(name), autoComplete, 'aria-required': required }}
    />
  )
}

const ContactRequestModal = ({ accommodationSlug }: { accommodationSlug: string }) => {
  const t = useTranslations('accomodation.sidebar.contactRequestModal')
  const buttonT = useTranslations('accomodation.sidebar.buttons')
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const modal = useContactRequestModal(accommodationSlug)
  const { data: session } = authClient.useSession()
  const isAuthenticated = session?.user.role === 'user'
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [claimToken, setClaimToken] = useState<string | null>(null)

  // Seul un étudiant connecté a des coordonnées à réutiliser ; un gestionnaire de passage saisit tout.
  const account = isAuthenticated ? session?.user : undefined
  const known = {
    firstname: account?.firstname || '',
    lastname: account?.lastname || '',
    email: account?.email || '',
    phone: account?.phone || '',
  }
  const hasKnownFields = Object.values(known).some(Boolean)

  const form = useForm<TContactRequestForm>({
    resolver: zodResolver(ZContactRequestForm),
    values: { ...known, consent: false },
    resetOptions: { keepDirtyValues: true },
  })

  const { mutate, isPending } = useMutation(
    trpc.contacts.create.mutationOptions({
      onSuccess: (request) => {
        trackEvent({ category: 'Contacts', action: 'Laisser mes coordonnées' })
        queryClient.invalidateQueries({ queryKey: trpc.contacts.myRequest.queryKey({ accommodationSlug }) })
        setClaimToken(request?.claimToken ?? null)
        setStep('success')
      },
      onError: () => createToast({ priority: 'error', message: buttonT('contactRequestError') }),
    }),
  )

  const handleClose = () => {
    modal.close()
    setStep('form')
    setClaimToken(null)
    form.reset()
  }

  const handleSubmit = form.handleSubmit(({ consent: _consent, ...data }) => {
    mutate({ accommodationSlug, ...data })
  })

  return (
    <ModalPortal>
      <modal.Component title={t('title')} size="large">
        {step === 'form' ? (
          <form onSubmit={handleSubmit}>
            <div className={styles.title}>
              <span className="ri-mail-send-line" aria-hidden="true" />
              <h2 className="fr-h2 fr-mb-0">{t('title')}</h2>
            </div>
            <p className="fr-text--lead">{t('description')}</p>
            {hasKnownFields && <p className="fr-text--sm fr-mb-0">{t('prefilledFromAccount')}</p>}
            <RequiredFieldsNotice />
            <div className={styles.formGrid}>
              <LockableInput
                label={<RequiredLabel>{t('firstname')}</RequiredLabel>}
                name="firstname"
                type="text"
                autoComplete="given-name"
                required
                lockedValue={known.firstname}
                form={form}
              />
              <LockableInput
                label={<RequiredLabel>{t('lastname')}</RequiredLabel>}
                name="lastname"
                type="text"
                autoComplete="family-name"
                required
                lockedValue={known.lastname}
                form={form}
              />
              <LockableInput
                label={<RequiredLabel>{t('email')}</RequiredLabel>}
                name="email"
                type="email"
                autoComplete="email"
                required
                lockedValue={known.email}
                form={form}
              />
              <LockableInput label={t('phone')} name="phone" type="tel" autoComplete="tel-national" lockedValue={known.phone} form={form} />
            </div>
            <Checkbox
              state={form.formState.errors.consent ? 'error' : 'default'}
              stateRelatedMessage={form.formState.errors.consent?.message}
              options={[
                {
                  label: (
                    <>
                      {t('consentStart')}{' '}
                      <Link href="/politique-de-confidentialite" target="_blank">
                        {t('privacyPolicy')}
                        <NewWindowHint />
                      </Link>{' '}
                      {t('consentEnd')}
                    </>
                  ),
                  nativeInputProps: form.register('consent'),
                },
              ]}
            />
            <div className={styles.footer}>
              <Button priority="secondary" type="button" onClick={handleClose}>
                {t('cancel')}
              </Button>
              <Button priority="primary" type="submit" disabled={isPending}>
                {isPending ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <div className={styles.title}>
              <span className="ri-check-line" aria-hidden="true" />
              <h2 className="fr-h2 fr-mb-0">{t('successTitle')}</h2>
            </div>
            <p className="fr-text--lead">{isAuthenticated ? t('successDescriptionAuthenticated') : t('successDescriptionGuest')}</p>
            <div className={styles.footer}>
              <Button priority="secondary" type="button" onClick={handleClose}>
                {t('cancel')}
              </Button>
              {!isAuthenticated && (
                <Button
                  priority="primary"
                  linkProps={{ href: claimToken ? `/s-inscrire?claim=${encodeURIComponent(claimToken)}` : '/s-inscrire' }}
                >
                  {t('createAccount')}
                </Button>
              )}
            </div>
          </div>
        )}
      </modal.Component>
    </ModalPortal>
  )
}

const DossierFacileApplyButton = ({
  accommodationSlug,
  availableApartmentTypes,
}: {
  accommodationSlug: string
  availableApartmentTypes: ApartmentType[]
}) => {
  const t = useTranslations('accomodation')
  const tA11y = useTranslations('accessibility')
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const candidatureModal = useCandidatureModal(accommodationSlug)
  const { data: session } = authClient.useSession()
  const profileComplete = isStudentProfileComplete(session?.user)

  const { data: tenant, isLoading: isTenantLoading } = useQuery({
    ...trpc.dossierFacile.tenant.queryOptions(),
  })

  const { data: application, isLoading: isApplicationLoading } = useQuery({
    ...trpc.dossierFacile.listApplications.queryOptions({ accommodationSlug }),
    enabled: !!tenant,
  })

  const handleConnect = async () => {
    trackEvent({ category: 'Dossier Facile', action: 'Candidater avec Dossier Facile' })
    const { authorizationUrl } = await trpcClient.dossierFacile.connectUrl.mutate({
      returnTo: window.location.pathname + window.location.search,
    })
    window.location.href = authorizationUrl
  }

  const tenantUrl = tenant?.url ?? z.string().parse(process.env.NEXT_PUBLIC_DOSSIERFACILE_LOCATAIRE_URL)

  if (isTenantLoading || isApplicationLoading) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          {t('sidebar.buttons.dossierFacileLoading')}
        </Button>
      </div>
    )
  }

  // Pas encore de dossier lié, ou accès perdu : dans les deux cas c'est le CTA officiel de connexion.
  if (!tenant || tenant.status === 'access_revoked' || tenant.status === 'inactive') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <DossierFacileConnectButton onClick={handleConnect} />
        <span className="fr-text--xs fr-mt-1w fr-mb-0">{t('sidebar.buttons.dossierFacileConnectDescription')}</span>
      </div>
    )
  }

  if (tenant.status === 'incomplete') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button
          priority="primary"
          className="fr-width-full fr-flex fr-justify-content-center"
          linkProps={{
            href: tenantUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: tA11y('linkNewWindow', { label: 'DossierFacile' }),
          }}
        >
          {t('sidebar.buttons.dossierFacileIncomplete')}
        </Button>
      </div>
    )
  }

  if (tenant.status === 'denied') {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button
          priority="primary"
          className="fr-width-full fr-flex fr-justify-content-center"
          linkProps={{
            href: tenantUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: tA11y('linkNewWindow', { label: 'DossierFacile' }),
          }}
        >
          {t('sidebar.buttons.dossierFacileDenied')}
        </Button>
      </div>
    )
  }

  if (application) {
    // Candidature enregistrée, mais transmise au gestionnaire seulement une fois le dossier validé.
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button priority="primary" className="fr-width-full fr-flex fr-justify-content-center" disabled>
          {t(tenant.status === 'verified' ? 'sidebar.buttons.dossierFacileApplied' : 'sidebar.buttons.dossierFacilePending')}
        </Button>
      </div>
    )
  }

  if (!profileComplete) {
    return (
      <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
        <Button {...completeProfileModal.buttonProps} priority="primary" className="fr-width-full fr-flex fr-justify-content-center">
          {t('sidebar.buttons.dossierFacileApply')}
        </Button>
        <span className="fr-text--xs fr-mb-0">{t('sidebar.buttons.dossierFacileDescription')}</span>
        <CompleteProfileModal mandatory />
      </div>
    )
  }

  return (
    <div className="fr-flex fr-direction-column fr-align-items-center fr-mt-2w fr-width-full">
      <Button {...candidatureModal.buttonProps} priority="primary" className="fr-width-full fr-flex fr-justify-content-center">
        {t('sidebar.buttons.dossierFacileApply')}
      </Button>
      <span className="fr-text--xs fr-mb-0">{t('sidebar.buttons.dossierFacileDescription')}</span>
      <CandidatureModal accommodationSlug={accommodationSlug} availableApartmentTypes={availableApartmentTypes} />
    </div>
  )
}
