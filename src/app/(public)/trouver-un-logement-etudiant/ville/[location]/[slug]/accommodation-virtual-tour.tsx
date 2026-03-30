'use client'

import DOMPurify from 'dompurify'
import styles from './logement.module.css'

export const AccommodationVirtualTour = ({ embedCode }: { embedCode: string }) => {
  const sanitized = DOMPurify.sanitize(embedCode, {
    ALLOWED_TAGS: ['iframe'],
    ALLOWED_ATTR: ['src', 'width', 'height', 'title', 'frameborder', 'allow', 'allowfullscreen', 'referrerpolicy'],
    ALLOW_DATA_ATTR: false,
  })

  if (!sanitized) return null

  // Remove inline width/height to let CSS control sizing
  const responsive = sanitized
    .replace(/width="[^"]*"/g, '')
    .replace(/height="[^"]*"/g, 'style="position:absolute;top:0;left:0;width:100%;height:100%"')

  return (
    <div className={styles.section}>
      <h4>Visite virtuelle</h4>
      <div
        style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: responsive }}
      />
    </div>
  )
}
