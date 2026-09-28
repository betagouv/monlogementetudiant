import { Alert } from '@codegouvfr/react-dsfr/Alert'
import Button, { ButtonProps } from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { JSX } from 'react'
import { toast } from 'react-hot-toast'
import styles from './toaster.module.css'

export type ToastPriority = 'info' | 'warning' | 'error' | 'success'

export const createToast = ({
  priority,
  message,
  action,
  duration,
  id,
}: {
  priority: ToastPriority
  message: JSX.Element | string | null
  action?: ButtonProps
  duration?: number
  id?: string
}) => {
  toast.custom(
    (t) => (
      <div className={clsx(styles.toast, 'fr-no-print')}>
        <Alert
          small
          closable
          severity={priority}
          onClose={() => toast.dismiss(t.id)}
          description={
            action ? (
              <span className={styles.toastContent}>
                {message}
                <Button className={clsx('fr-ml-1w', styles.action)} priority="tertiary no outline" size="small" {...action} />
              </span>
            ) : (
              (message ?? '')
            )
          }
        />
      </div>
    ),
    { duration, id },
  )
}
