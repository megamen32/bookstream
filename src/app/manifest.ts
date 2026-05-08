import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bookstream',
    short_name: 'Bookstream',
    description: 'Интерактивная платформа для чтения книг с офлайн-режимом',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0c12',
    theme_color: '#131722',
    lang: 'ru',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
