// Rota DINÂMICA /blog/:slug (file-based: pages/blog/[slug].tsx).
// Server component (0 JS) — recebe os params como PROP. Funciona no server.
import type { PageProps } from '../../framework/routes'

export const title = 'Blog Post'

export default function BlogPost({ params }: PageProps) {
  const slug = params.slug as string
  return (
    <div className="relative min-h-[calc(100vh-57px)] px-4 py-10">
      <div className="absolute inset-0 app-grid-bg opacity-70" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <a href="/blog" className="text-sm text-gray-400 hover:text-white">← Blog</a>
        <h1 className="mt-4 text-4xl font-semibold text-white">Post: {slug}</h1>
        <p className="mt-4 text-gray-400">
          Rota dinâmica renderizada no <strong>server</strong> (0 JS). O slug
          <code className="text-theme"> {slug} </code> veio de <code className="text-theme">params</code>,
          extraído da URL pelo roteador file-based — arquivo <code className="text-theme">pages/blog/[slug].tsx</code>.
        </p>
      </div>
    </div>
  )
}
