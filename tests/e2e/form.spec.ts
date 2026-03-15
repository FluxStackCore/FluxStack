import { test, expect } from './fixtures'

test.describe('Form Demo', () => {
  test('should render form with all fields', async ({ page }) => {
    await page.goto('/form')

    await expect(page.getByRole('heading', { name: 'Live Form' })).toBeVisible()

    // Fields visible
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible()
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible()
    await expect(page.getByPlaceholder('Sua mensagem...')).toBeVisible()
  })

  test('should show connection status indicator', async ({ page }) => {
    await page.goto('/form')

    // The form shows a connection status badge (Conectado / Desconectado)
    // Wait for either state to appear
    const connected = page.getByText('Conectado')
    const disconnected = page.getByText('Desconectado')

    await expect(connected.or(disconnected)).toBeVisible({ timeout: 10_000 })
  })

  test('should fill form fields', async ({ page }) => {
    await page.goto('/form')

    // Wait for form to render
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible()

    // Fill fields (doesn't require WS)
    await page.getByPlaceholder('Seu nome').fill('Test User')
    await expect(page.getByPlaceholder('Seu nome')).toHaveValue('Test User')

    await page.getByPlaceholder('seu@email.com').fill('test@example.com')
    await expect(page.getByPlaceholder('seu@email.com')).toHaveValue('test@example.com')

    await page.getByPlaceholder('Sua mensagem...').fill('Hello e2e')
    await expect(page.getByPlaceholder('Sua mensagem...')).toHaveValue('Hello e2e')
  })
})
