import clsx from 'clsx'
import { FC, ReactNode } from 'react'
import { tss } from 'tss-react'

type RequiredLabelProps = {
  children: ReactNode
}

export const RequiredLabel: FC<RequiredLabelProps> = ({ children }) => {
  const { classes } = useStyles()
  return (
    <>
      {children}
      <span className={clsx('fr-text--bold', classes.asterisk)}>&nbsp;*</span>
    </>
  )
}

const useStyles = tss.create({
  asterisk: {
    color: 'var(--text-default-error)',
  },
})
