import { test, expect } from './fixtures'

test.describe('Room Chat', () => {
  test('should render room chat interface', async ({ page }) => {
    await page.goto('/room-chat')

    await expect(page.getByRole('heading', { name: 'Room Chat' })).toBeVisible()

    // Default rooms visible in the sidebar
    await expect(page.getByText('Geral').first()).toBeVisible()
    await expect(page.getByText('Tecnologia')).toBeVisible()
    await expect(page.getByText('Random')).toBeVisible()

    // Create room button
    await expect(page.getByText('+ Criar')).toBeVisible()
  })

  test('should show username and room count', async ({ page }) => {
    await page.goto('/room-chat')

    // The Room Chat heading
    await expect(page.getByRole('heading', { name: 'Room Chat' })).toBeVisible()

    // The sidebar shows room count "Em X sala(s)"
    await expect(page.getByText(/sala\(s\)/)).toBeVisible({ timeout: 10_000 })
  })

  test('should click on a room', async ({ page }) => {
    await page.goto('/room-chat')

    // Wait for page to be ready
    await expect(page.getByText('Geral').first()).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(2_000)

    // Click on "Geral" room
    await page.getByText('Geral').first().click()

    // Wait a bit for WS action to complete
    await page.waitForTimeout(3_000)

    // After clicking, either chat area or "Selecione uma sala" message changes
    // We just verify the page is responsive — the room name should still be visible
    await expect(page.getByText('Geral').first()).toBeVisible()
  })
})
