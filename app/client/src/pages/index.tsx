// Página HOME — rota / (file-based: app/client/src/pages/index.tsx)
// Componente React normal. Server component (sem Live) → 0 JS no client.
import { RscHomePage } from '../framework/RscHomePage'

export const title = 'Home'

export default function HomePage() {
  return <RscHomePage />
}
