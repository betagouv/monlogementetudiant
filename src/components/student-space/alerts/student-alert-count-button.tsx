import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import styles from './student-alert-count-button.module.css'

export const StudentAlertCountButton = ({ count }: { count: number }) => {
  return (
    <Button priority="secondary">
      {count} résidences
      <span className={clsx(styles.icon, 'fr-ml-1w ri-arrow-right-line')} />
    </Button>
  )
}
