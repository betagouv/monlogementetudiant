import Button from '@codegouvfr/react-dsfr/Button'
import { getTranslations } from 'next-intl/server'
import { StudentSpaceTodoNavigationButton } from '~/components/student-space/navigation/student-space-todo-navigation-button'

export const StudentSpaceNavigation = async () => {
  const t = await getTranslations('student.navigation')

  return (
    <>
      <div className="fr-border-bottom fr-p-3w">
        <Button iconPosition="left" iconId="fr-icon-arrow-left-line" priority="tertiary no outline" linkProps={{ href: '/' }}>
          {t('backToHome')}
        </Button>
      </div>
      <div className="fr-flex fr-direction-column fr-flex-gap-2v fr-p-3w">
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-user-line"
          linkProps={{ href: '/mon-espace/tableau-de-bord' }}
        >
          {t('dashboard')}
        </Button>
        <StudentSpaceTodoNavigationButton />
        <Button priority="tertiary no outline" iconPosition="left" iconId="ri-heart-line" linkProps={{ href: '/mon-espace/favoris' }}>
          {t('favorites')}
        </Button>
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="ri-notification-3-line"
          linkProps={{ href: '/mon-espace/alertes' }}
        >
          {t('alerts')}
        </Button>
      </div>
    </>
  )
}
