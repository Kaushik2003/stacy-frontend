import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ChatProvider } from '@/contexts/ChatContext'
import { GitHubProvider } from '@/contexts/GitHubContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Stacy',
  description: 'Build Web3 dapps with dual-mode IDE for smart contracts and frontend',
  generator: 'Stacy',
  icons: {
    icon: '/logo.webp',
    shortcut: '/logo.webp',
    apple: '/logo.webp',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0f0f0f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans antialiased bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 transition-colors duration-300`}>
        <ThemeProvider>
          <GitHubProvider>
            <ChatProvider>
              {children}
            </ChatProvider>
          </GitHubProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
