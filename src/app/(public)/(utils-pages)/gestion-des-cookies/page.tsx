import { fr } from '@codegouvfr/react-dsfr'
import { getTranslations } from 'next-intl/server'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import styles from '../pages.module.css'

export default async function GestionDesCookiesPage() {
  const t = await getTranslations('cookies')
  const items = [
    {
      description:
        'Nulla exercitation labore magna et exercitation ex laboris sunt cupidatat cupidatat. Duis aliquip cillum magna enim. Esse adipisicing amet est cillum enim sit officia ad tempor est incididunt deserunt officia. Adipisicing Lorem minim exercitation non. Enim incididunt consequat laborum eu qui minim tempor reprehenderit ad laboris eu minim. Tempor sunt veniam ea anim eiusmod quis id culpa excepteur ipsum dolore dolor sunt reprehenderit incididunt. Incididunt sit cillum mollit ea adipisicing.',
      title: 'Lorem ipsum dolor consectetur 1',
    },
    {
      description:
        'Nulla exercitation labore magna et exercitation ex laboris sunt cupidatat cupidatat. Duis aliquip cillum magna enim. Esse adipisicing amet est cillum enim sit officia ad tempor est incididunt deserunt officia. Adipisicing Lorem minim exercitation non. Enim incididunt consequat laborum eu qui minim tempor reprehenderit ad laboris eu minim. Tempor sunt veniam ea anim eiusmod quis id culpa excepteur ipsum dolore dolor sunt reprehenderit incididunt. Incididunt sit cillum mollit ea adipisicing.',
      title: 'Lorem ipsum dolor consectetur 2',
    },
    {
      description:
        'Nulla exercitation labore magna et exercitation ex laboris sunt cupidatat cupidatat. Duis aliquip cillum magna enim. Esse adipisicing amet est cillum enim sit officia ad tempor est incididunt deserunt officia. Adipisicing Lorem minim exercitation non. Enim incididunt consequat laborum eu qui minim tempor reprehenderit ad laboris eu minim. Tempor sunt veniam ea anim eiusmod quis id culpa excepteur ipsum dolore dolor sunt reprehenderit incididunt. Incididunt sit cillum mollit ea adipisicing.',
      title: 'Lorem ipsum dolor consectetur 3',
    },
  ]
  return (
    <div className={fr.cx('fr-container')}>
      <DynamicBreadcrumb margin={false} />
      <div className={styles.borderBottom}>
        <h1>{t('title')}</h1>
        <p>
          Mis à jour le <span className={fr.cx('fr-text--bold')}>01/01/25</span>
        </p>
      </div>
      <div className={fr.cx('fr-py-3w')}>
        <p>
          Duis veniam est voluptate laborum excepteur fugiat anim tempor elit velit mollit fugiat eu enim nulla. Cillum sit sint ullamco
          dolor. Excepteur consectetur tempor voluptate. Pariatur proident fugiat aute adipisicing labore et ipsum sit officia Lorem quis.
          Esse laboris velit quis amet velit cillum ipsum pariatur aliquip ea tempor cillum. Magna eiusmod id esse. Aliqua non excepteur ea
          cillum non incididunt consectetur eiusmod et eu Lorem voluptate.
        </p>
        <div className={styles.itemsContainer}>
          {items.map((item, index) => (
            <div className={styles.borderBottom} key={index}>
              <h1 className={index !== 0 ? styles.titleMargin : undefined}>{item.title}</h1>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
