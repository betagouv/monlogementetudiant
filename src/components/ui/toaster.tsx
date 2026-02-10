'use client'

import { Toaster as BaseToaster } from 'react-hot-toast'

const Toaster = () => (
  <BaseToaster
    position="top-center"
    reverseOrder={false}
    gutter={8}
    toastOptions={{
      duration: 10_000,
      ariaProps: {
        role: 'status',
        'aria-live': 'polite',
      },
    }}
  />
)

export default Toaster
