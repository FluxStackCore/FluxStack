// Página /form (file-based). Demo Live — React normal.
import { LivePage } from '../framework/LivePage'
import { FormDemo } from '../live/FormDemo'

export const title = 'Form'

export default function FormPage() {
  return (
    <LivePage title="Live Form" description="Formulário com campos sincronizados pelo servidor via proxy Live.">
      <FormDemo />
    </LivePage>
  )
}
