import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: {
    default: 'Meal Planner',
    template: 'Meal Planner - %s',
  },
  description: 'Family meal planner',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Meal Planner',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#14b8a6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-stone-900 h-dvh flex flex-col overscroll-none">
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-none w-full max-w-lg mx-auto">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
