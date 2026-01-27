import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { expandBbox } from '~/components/map/map-utils'
import { TAlert } from '~/schemas/alerts/get-alerts'
import { sPluriel } from '~/utils/sPluriel'
import styles from './student-alert-count-button.module.css'

export const StudentAlertCountButton = ({ alert }: { alert: TAlert }) => {
  const getHref = () => {
    const searchParams = new URLSearchParams()

    if (alert.has_coliving) {
      searchParams.set('colocation', 'true')
    }

    if (alert.is_accessible) {
      searchParams.set('accessible', 'true')
    }

    if (alert.city) {
      const { bbox } = alert.city
      const expanded = expandBbox(bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax)
      searchParams.set('bbox', `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`)
      searchParams.set('vue', 'carte')
      return `/trouver-un-logement-etudiant/ville/${alert.city.slug}?${searchParams.toString()}`
    }

    if (alert.academy) {
      searchParams.set('academie', alert.academy.id.toString())
      return `/trouver-un-logement-etudiant/academie/${alert.academy.name}?${searchParams.toString()}`
    }

    if (alert.department) {
      const { bbox } = alert.department
      const expanded = expandBbox(bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax)
      searchParams.set('bbox', `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`)
      searchParams.set('vue', 'carte')
      return `/trouver-un-logement-etudiant/departement/${alert.department.name}?${searchParams.toString()}`
    }

    return '/trouver-un-logement-etudiant'
  }

  return (
    <Button priority="secondary" linkProps={{ href: getHref() }}>
      {alert.count} résidence{sPluriel(alert.count)}
      <span className={clsx(styles.icon, 'fr-ml-1w ri-arrow-right-line')} />
    </Button>
  )
}
