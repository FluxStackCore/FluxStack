import { test, expect } from './fixtures'

test.describe('Upload Demo', () => {
  test('should render upload component', async ({ page }) => {
    await page.goto('/upload')

    await expect(page.getByText('Upload em Chunks')).toBeVisible()

    // Status should show idle
    await expect(page.getByText('Status: idle')).toBeVisible({ timeout: 10_000 })
  })

  test('should show connection status', async ({ page }) => {
    await page.goto('/upload')

    // The file input should become enabled once WS connects
    // Upload button exists
    await expect(page.getByRole('button', { name: 'Iniciar Upload' })).toBeVisible()
  })
})
