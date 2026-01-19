import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { sPluriel } from '~/utils/sPluriel'
import styles from './student-alert-count-button.module.css'

export const StudentAlertCountButton = ({ count }: { count: number }) => {
  return (
    <Button priority="secondary">
      {count} résidence{sPluriel(count)}
      <span className={clsx(styles.icon, 'fr-ml-1w ri-arrow-right-line')} />
    </Button>
  )
}
