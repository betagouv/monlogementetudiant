'use client'

import { useEffect } from 'react'

const sendHeight = () => {
  const height = document.body.scrollHeight
  window.parent.postMessage(
    {
      type: 'resize',
      height,
      source: 'mle-widget',
    },
    '*',
  )
}

export const useWidgetResize = () => {
  useEffect(() => {
    sendHeight()

    const mutationObserver = new MutationObserver(sendHeight)
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    const resizeObserver = new ResizeObserver(sendHeight)
    resizeObserver.observe(document.body)

    const handleImageLoad = () => sendHeight()
    const observeImages = () => {
      document.querySelectorAll('img').forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', handleImageLoad, { once: true })
        }
      })
    }
    observeImages()
    const imageObserver = new MutationObserver(observeImages)
    imageObserver.observe(document.body, { childList: true, subtree: true })

    const interval = setInterval(sendHeight, 1000)

    window.addEventListener('resize', sendHeight)

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      imageObserver.disconnect()
      clearInterval(interval)
      window.removeEventListener('resize', sendHeight)
    }
  }, [])
}
