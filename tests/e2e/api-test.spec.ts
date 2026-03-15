import { test, expect } from './fixtures'

test.describe('API Test Page', () => {
  test('should render API test page', async ({ page }) => {
    await page.goto('/api-test')

    await expect(page.getByRole('heading', { name: 'Eden Treaty API Test' })).toBeVisible()

    // 3 action card buttons visible in the grid
    await expect(page.getByText('Health Check')).toBeVisible()
    await expect(page.getByText('List Users')).toBeVisible()
    await expect(page.getByText('Create User')).toBeVisible()
  })

  test('should call health check API', async ({ page }) => {
    await page.goto('/api-test')

    // Wait for page to render
    await expect(page.getByText('Health Check')).toBeVisible({ timeout: 10_000 })

    // Click the Health Check card button
    await page.getByText('Health Check').click()

    // Wait for response to appear in the pre/code block
    const responseBlock = page.locator('pre code')
    await expect(responseBlock).toContainText('status', { timeout: 10_000 })
  })

  test('should create user via API', async ({ page }) => {
    await page.goto('/api-test')

    // Wait for page to render
    await expect(page.getByText('Create User')).toBeVisible({ timeout: 10_000 })

    // Click the Create User card button
    await page.getByText('Create User').click()

    // Wait for response showing user created
    const responseBlock = page.locator('pre code')
    await expect(responseBlock).toContainText('success', { timeout: 10_000 })
  })
})
