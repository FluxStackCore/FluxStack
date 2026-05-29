import { test, expect } from './fixtures'

test.describe('Auth Demo', () => {
  test('should render auth demo page', async ({ page }) => {
    await page.goto('/auth')

    await expect(page.getByRole('heading', { name: 'Authenticate the Live connection' })).toBeVisible({ timeout: 25_000 })

    // Input de token (placeholder real do redesign)
    await expect(page.getByPlaceholder('admin-token, user-token, mod-token')).toBeVisible()
  })

  test('should show auth controls with login button', async ({ page }) => {
    await page.goto('/auth')

    await expect(page.getByPlaceholder('admin-token, user-token, mod-token')).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })

  test('should fill token and click login', async ({ page }) => {
    await page.goto('/auth')

    const tokenInput = page.getByPlaceholder('admin-token, user-token, mod-token')
    await expect(tokenInput).toBeVisible({ timeout: 25_000 })

    await tokenInput.fill('admin-token')
    await expect(tokenInput).toHaveValue('admin-token')

    await page.getByRole('button', { name: 'Login' }).click()

    // Após autenticar, o status "Authenticated" aparece.
    await expect(page.getByText('Authenticated').first()).toBeVisible({ timeout: 15_000 })
  })
})
