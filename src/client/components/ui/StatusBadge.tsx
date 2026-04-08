type StatusBadgeProps = {
  status: 'online' | 'offline' | 'away'
  size?: 'sm' | 'md' | 'lg'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const statusClasses = {
    online: 'bg-green-100 text-green-700',
    offline: 'bg-gray-100 text-gray-700',
    away: 'bg-yellow-100 text-yellow-700',
  }
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${statusClasses[status]} ${sizeClasses[size]}`}>
      {status}
    </span>
  )
}
