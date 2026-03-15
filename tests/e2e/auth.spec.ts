import { test, expect } from './fixtures'

test.describe('Auth Demo', () => {
  test('should render auth demo page', async ({ page }) => {
    await page.goto('/auth')

    await expect(page.getByRole('heading', { name: 'Live Components Auth' })).toBeVisible({ timeout: 10_000 })

    // Auth controls section with token input
    await expect(page.getByPlaceholder(/Token/)).toBeVisible({ timeout: 10_000 })
  })

  test('should show auth controls with test tokens', async ({ page }) => {
    await page.goto('/auth')

    // Wait for auth controls to render
    await expect(page.getByPlaceholder(/Token/)).toBeVisible({ timeout: 10_000 })

    // "Não autenticado" should be displayed initially
    await expect(page.getByText(/autenticado/i)).toBeVisible({ timeout: 10_000 })

    // Login button
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })

  test('should fill token and click login', async ({ page }) => {
    await page.goto('/auth')

    // Wait for auth controls
    const tokenInput = page.getByPlaceholder(/Token/)
    await expect(tokenInput).toBeVisible({ timeout: 10_000 })

    // Type token directly
    await tokenInput.fill('admin-token')
    await expect(tokenInput).toHaveValue('admin-token')

    // Click Login
    await page.getByRole('button', { name: 'Login' }).click()

    // After auth, "Autenticado" status should appear
    await expect(page.getByText('Autenticado')).toBeVisible({ timeout: 15_000 })
  })
})
