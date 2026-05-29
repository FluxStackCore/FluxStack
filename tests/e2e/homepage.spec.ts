import { test, expect } from './fixtures'

test.describe('Homepage', () => {
  test('should render homepage with FluxStack title', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /FluxStack/ })).toBeVisible()

    // 3 feature cards (headings, p/ evitar match com o parágrafo descritivo)
    await expect(page.getByRole('heading', { name: 'Runtime rapido' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Type-safe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Live Components' })).toBeVisible()
  })

  test('should show API status as online', async ({ page }) => {
    await page.goto('/')

    // Wait for the health check to resolve (proxied to backend)
    await expect(page.getByText('API Online')).toBeVisible({ timeout: 15_000 })
  })
})
