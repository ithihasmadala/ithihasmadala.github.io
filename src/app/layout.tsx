import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'antd/dist/reset.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Ithihas Madala',
    description: 'Personal website of Ithihas Madala',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>{children}</body>
        </html>
    )
}
