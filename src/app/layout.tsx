import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import 'antd/dist/reset.css'

const inter = localFont({
    src: './fonts/Inter-Variable.ttf',
    display: 'swap',
    weight: '100 900',
})

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
