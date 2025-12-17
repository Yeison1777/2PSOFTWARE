import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import { ProjectProvider } from '@/contexts/project-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'Editor UML',
  description: 'Editor de diagramas UML profesional',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">

      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning={true}>
        <AuthProvider>
          <ProjectProvider>
            <div suppressHydrationWarning={true}>
              {children}
            </div>
          </ProjectProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
