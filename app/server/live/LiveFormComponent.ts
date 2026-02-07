// 🔥 LiveForm - Formulário reativo com estado no servidor
import { LiveComponent } from "@core/types/types"

interface FormState {
  name: string
  email: string
  message: string
  submitted: boolean
  submittedAt: string | null
}

export class LiveFormComponent extends LiveComponent<FormState> {
  constructor(initialState: Partial<FormState>, ws: any, options?: { room?: string; userId?: string }) {
    const defaults: FormState = {
      name: '',
      email: '',
      message: '',
      submitted: false,
      submittedAt: null
    }
    super({ ...defaults, ...initialState }, ws, options)
    console.log(`📝 LiveForm created: ${this.id}`)
  }

  // Submit do formulário
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

  // Reset do formulário
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

  // Validação em tempo real
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
