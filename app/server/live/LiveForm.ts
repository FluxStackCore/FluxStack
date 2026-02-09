// 🔥 LiveForm - Formulário reativo com estado no servidor
// ZERO interfaces! TypeScript infere tudo automaticamente.
import { LiveComponent } from "@core/types/types"

export class LiveForm extends LiveComponent<typeof LiveForm.defaultState> {
  static componentName = 'LiveForm'
  static defaultState = {
    name: '',
    email: '',
    message: '',
    submitted: false,
    submittedAt: null as string | null
  }

  async submit() {
    const { name, email, message } = this.state

    if (!name || !email) {
      throw new Error('Nome e email são obrigatórios')
    }

    console.log(`📝 Form submitted:`, { name, email, message })

    this.setState({
      submitted: true,
      submittedAt: new Date().toISOString()
    })

    return {
      success: true,
      data: { name, email, message },
      submittedAt: this.state.submittedAt
    }
  }

  async reset() {
    this.setState({
      name: '',
      email: '',
      message: '',
      submitted: false,
      submittedAt: null
    })

    return { success: true }
  }

  async validate() {
    const errors: Record<string, string> = {}

    if (!this.state.name) errors.name = 'Nome é obrigatório'
    if (!this.state.email) errors.email = 'Email é obrigatório'
    else if (!this.state.email.includes('@')) errors.email = 'Email inválido'

    return {
      valid: Object.keys(errors).length === 0,
      errors
    }
  }
}
