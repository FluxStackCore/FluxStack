import { useNavigate } from 'react-router'
import { FaArrowLeft } from 'react-icons/fa6'

export function BackButton() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
    >
      <FaArrowLeft className="h-3 w-3" />
      Back
    </button>
  )
}
