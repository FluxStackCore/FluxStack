/**
 * SSR Feature Card — reusable card component for landing pages
 * Pure React, no hooks, SSR-safe.
 */

export function FeatureCard({ icon, title, description, color = 'purple' }: {
  icon: string
  title: string
  description: string
  color?: 'purple' | 'indigo' | 'cyan' | 'emerald' | 'pink' | 'amber'
}) {
  const colorMap = {
    purple: { bg: 'bg-purple-500/10', hover: 'hover:border-purple-500/20', hoverBg: 'group-hover:bg-purple-500/20' },
    indigo: { bg: 'bg-indigo-500/10', hover: 'hover:border-indigo-500/20', hoverBg: 'group-hover:bg-indigo-500/20' },
    cyan: { bg: 'bg-cyan-500/10', hover: 'hover:border-cyan-500/20', hoverBg: 'group-hover:bg-cyan-500/20' },
    emerald: { bg: 'bg-emerald-500/10', hover: 'hover:border-emerald-500/20', hoverBg: 'group-hover:bg-emerald-500/20' },
    pink: { bg: 'bg-pink-500/10', hover: 'hover:border-pink-500/20', hoverBg: 'group-hover:bg-pink-500/20' },
    amber: { bg: 'bg-amber-500/10', hover: 'hover:border-amber-500/20', hoverBg: 'group-hover:bg-amber-500/20' },
  }

  const c = colorMap[color]

  return (
    <div className={`group bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.06] ${c.hover} transition-all duration-300`}>
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center mb-3 ${c.hoverBg} transition-colors`}>
        <span className="text-lg">{icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-gray-500 text-xs leading-relaxed">{description}</p>
    </div>
  )
}
