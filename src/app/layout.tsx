import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { Provedores, scriptTema } from "@/components/provedores"
import "./globals.css"

const titulo = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  variable: "--font-titulo",
  weight: "200 800",
  display: "swap",
})

const texto = localFont({
  src: [
    { path: "./fonts/instrument-sans.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/instrument-sans-italic.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-texto",
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "My Life", template: "%s | My Life" },
  description: "Seu painel de vida: hábitos, tarefas, projetos, estudos e conteúdo em um só lugar.",
  applicationName: "My Life",
  appleWebApp: { capable: true, title: "My Life", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1121" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${titulo.variable} ${texto.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-dvh">
        <Provedores>{children}</Provedores>
      </body>
    </html>
  )
}
