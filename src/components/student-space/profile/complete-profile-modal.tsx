'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { StudentProfileFields } from '~/components/student-space/profile/student-profile-fields'
import { createToast } from '~/components/ui/createToast'
import { ModalPortal } from '~/components/ui/modal-portal'
import { useDsfrModalIsBound } from '~/hooks/use-dsfr-modal-is-bound'
import { type TStudentProfileInfo, ZStudentProfileInfo } from '~/schemas/student-profile/student-profile'
import { authClient } from '~/services/better-auth-client'

const completeProfileModalId = 'complete-profile-modal'

export const completeProfileModal = createModal({
  id: completeProfileModalId,
  isOpenedByDefault: false,
})

interface Props {
  mandatory?: boolean
  autoOpen?: boolean
  onCompleted?: () => void
}

export const CompleteProfileModal = ({ mandatory = false, autoOpen = false, onCompleted }: Props) => {
  const t = useTranslations('student.profile')
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [completed, setCompleted] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)
  const isOpen = useIsModalOpen(completeProfileModal)
  const isBound = useDsfrModalIsBound(completeProfileModalId)

  const form = useForm<TStudentProfileInfo>({
    resolver: zodResolver(ZStudentProfileInfo),
    values: {
      phone: session?.user?.phone ?? '',
      birthdate: session?.user?.birthdate ?? '',
      scholarshipStatus: session?.user?.scholarshipStatus as TStudentProfileInfo['scholarshipStatus'],
    },
    resetOptions: { keepDirtyValues: true },
  })

  useEffect(() => {
    if (isOpen) setHasOpened(true)
  }, [isOpen])

  useEffect(() => {
    if (autoOpen && isBound && !autoOpened && !completed) {
      setAutoOpened(true)
      completeProfileModal.open()
    }
  }, [autoOpen, isBound, autoOpened, completed])

  useEffect(() => {
    if (mandatory && hasOpened && !isOpen && !completed) {
      completeProfileModal.open()
    }
  }, [mandatory, hasOpened, isOpen, completed])

  const handleSubmit = form.handleSubmit(async (data) => {
    const { error } = await authClient.updateUser({
      phone: data.phone,
      birthdate: data.birthdate,
      scholarshipStatus: data.scholarshipStatus,
    })

    if (error) {
      createToast({ priority: 'error', message: error.message || t('saveError') })
      return
    }

    setCompleted(true)
    createToast({ priority: 'success', message: t('saveSuccess') })
    completeProfileModal.close()
    onCompleted?.()
    router.refresh()
  })

  return (
    <ModalPortal>
      <completeProfileModal.Component title={<span className="fr-text--bold">{t('modalTitle')}</span>}>
        <FormProvider {...form}>
          <form onSubmit={handleSubmit} className="fr-flex fr-direction-column fr-flex-gap-4v">
            <span>{t('modalIntro')}</span>
            <StudentProfileFields />
            <div className="fr-flex fr-justify-content-end fr-flex-gap-2v">
              {!mandatory && (
                <Button priority="secondary" type="button" onClick={() => completeProfileModal.close()}>
                  {t('later')}
                </Button>
              )}
              <Button priority="primary" type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        </FormProvider>
      </completeProfileModal.Component>
    </ModalPortal>
  )
}
