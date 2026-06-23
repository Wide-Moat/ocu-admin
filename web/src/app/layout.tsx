// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "OCU Operator Console",
  description:
    "Read-only operator console for an Open Computer Use deployment.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
