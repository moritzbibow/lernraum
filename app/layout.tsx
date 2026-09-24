import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import 'katex/dist/katex.min.css'
import './globals.css'
import './prose.css'

import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { default: 'Lernraum', template: '%s · Lernraum' },
  description: 'Persönliches Lerntool – Lernseiten und Quizze, eingespeist von Claude.',
  robots: { index: false, follow: false },
  applicationName: 'Lernraum',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Dark is the default; localStorage is only a mirror of the cookie (see components/providers/theme.ts).
const themeScript = `try{var m=document.cookie.match(/(?:^|; )lr_theme=(dark|light)/);var s=localStorage.getItem('lr_theme');if(!m&&(s==='light'||s==='dark')){document.documentElement.dataset.theme=s;document.cookie='lr_theme='+s+'; path=/; max-age=31536000; samesite=lax'}}catch(e){}`

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get('lr_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <html lang="de" data-theme={theme} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={theme === 'dark' ? '#131211' : '#f5f3ef'} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
