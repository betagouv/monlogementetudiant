'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import DOMPurify from 'dompurify'
import { useState } from 'react'
import styles from './logement.module.css'

type VirtualTourType = 'iframe' | 'video' | 'link'

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov)(\?.*)?$/i

function toEmbedUrl(url: string): string {
  // youtube.com/watch?v=ID → youtube.com/embed/ID
  const ytWatch = url.match(/(?:youtube\.com\/watch\?v=)([\w-]+)/)
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`

  // youtu.be/ID → youtube.com/embed/ID
  const ytShort = url.match(/youtu\.be\/([\w-]+)/)
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`

  return url
}

function detectVirtualTourType(input: string): VirtualTourType | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.includes('<iframe')) return 'iframe'
  if (VIDEO_EXTENSIONS.test(trimmed)) return 'video'
  if (/^https?:\/\//i.test(trimmed)) return 'link'
  return null
}

const IframeEmbed = ({ html }: { html: string }) => {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['iframe'],
    ALLOWED_ATTR: ['src', 'width', 'height', 'title', 'frameborder', 'allow', 'allowfullscreen', 'referrerpolicy'],
    ALLOW_DATA_ATTR: false,
  })

  if (!sanitized) return null

  const responsive = sanitized
    .replace(/width="[^"]*"/g, '')
    .replace(/height="[^"]*"/g, 'style="position:absolute;top:0;left:0;width:100%;height:100%"')

  return (
    <div
      style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: responsive }}
    />
  )
}

const VideoPlayer = ({ src }: { src: string }) => {
  const [videoError, setVideoError] = useState(false)

  if (videoError) {
    return (
      <Button
        iconId="ri-external-link-line"
        iconPosition="right"
        priority="secondary"
        linkProps={{
          href: src,
          target: '_blank',
          rel: 'noopener noreferrer',
        }}
      >
        Accéder à la visite virtuelle
      </Button>
    )
  }

  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
      <video
        controls
        preload="metadata"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        onError={() => setVideoError(true)}
      >
        <source src={src} />
      </video>
    </div>
  )
}

const TourEmbed = ({ url }: { url: string }) => {
  const [iframeError, setIframeError] = useState(false)

  return (
    <>
      {!iframeError && (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
          <iframe
            src={url}
            title="Visite virtuelle"
            allow="fullscreen"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            onError={() => setIframeError(true)}
          />
        </div>
      )}
      {iframeError && (
        <Button
          iconId="ri-external-link-line"
          iconPosition="right"
          priority="secondary"
          linkProps={{
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
          }}
        >
          Accéder à la visite virtuelle
        </Button>
      )}
    </>
  )
}

export const AccommodationVirtualTour = ({ url }: { url: string | null }) => {
  if (!url) return null

  const type = detectVirtualTourType(url)
  if (!type) return null

  return (
    <div className={styles.section}>
      <h4>Visite virtuelle</h4>
      {type === 'iframe' && <IframeEmbed html={url} />}
      {type === 'video' && <VideoPlayer src={url.trim()} />}
      {type === 'link' && <TourEmbed url={toEmbedUrl(url.trim())} />}
    </div>
  )
}
