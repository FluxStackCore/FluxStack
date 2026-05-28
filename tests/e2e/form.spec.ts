import { test, expect } from './fixtures'

test.describe('Form Demo', () => {
  test('should render form with all fields', async ({ page }) => {
    await page.goto('/form')

    await expect(page.getByRole('heading', { name: 'Contact workflow' })).toBeVisible({ timeout: 25_000 })

    // Campos visíveis (placeholders reais do redesign)
    await expect(page.getByPlaceholder('Ada Lovelace')).toBeVisible()
    await expect(page.getByPlaceholder('ada@company.dev')).toBeVisible()
    await expect(page.getByPlaceholder('Tell us what you want to build...')).toBeVisible()
  })

  test('should show connection status indicator', async ({ page }) => {
    await page.goto('/form')

    // Badge de conexão (Connected / Offline) — qualquer um dos dois.
    const connected = page.getByText('Connected')
    const offline = page.getByText('Offline')
    await expect(connected.or(offline).first()).toBeVisible({ timeout: 25_000 })
  })

  test('should fill form fields', async ({ page }) => {
    await page.goto('/form')
    await expect(page.getByPlaceholder('Ada Lovelace')).toBeVisible({ timeout: 25_000 })

    await page.getByPlaceholder('Ada Lovelace').fill('Test User')
    await expect(page.getByPlaceholder('Ada Lovelace')).toHaveValue('Test User')

    await page.getByPlaceholder('ada@company.dev').fill('test@example.com')
    await expect(page.getByPlaceholder('ada@company.dev')).toHaveValue('test@example.com')

    await page.getByPlaceholder('Tell us what you want to build...').fill('Hello e2e')
    await expect(page.getByPlaceholder('Tell us what you want to build...')).toHaveValue('Hello e2e')
  })
})
