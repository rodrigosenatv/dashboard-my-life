import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Life",
    short_name: "My Life",
    description: "Seu painel de vida: hábitos, tarefas, projetos, estudos e conteúdo em um só lugar.",
    lang: "pt-BR",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // As cores do tema escuro, que é o padrão do app
    background_color: "#191919",
    theme_color: "#191919",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tarefas", url: "/rotina/tarefas" },
      { name: "Hábitos", url: "/rotina/habitos" },
      { name: "Caixa de Entrada", url: "/projetos/entrada" },
    ],
  }
}
