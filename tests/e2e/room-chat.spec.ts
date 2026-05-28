import { test, expect } from './fixtures'

test.describe('Room Chat', () => {
  test('should render room chat interface', async ({ page }) => {
    await page.goto('/room-chat')

    // Sidebar de salas
    await expect(page.getByRole('heading', { name: 'Rooms' })).toBeVisible({ timeout: 25_000 })

    // Salas padrão (redesign: nomes em inglês)
    await expect(page.getByText('General').first()).toBeVisible()
    await expect(page.getByText('Engineering')).toBeVisible()
    await expect(page.getByText('Support')).toBeVisible()
  })

  test('should click on a room', async ({ page }) => {
    await page.goto('/room-chat')
    await expect(page.getByText('General').first()).toBeVisible({ timeout: 25_000 })

    // Clica numa sala — não deve quebrar
    await page.getByText('Engineering').first().click()
    await page.waitForTimeout(1_500)
    await expect(page.getByText('Engineering').first()).toBeVisible()
  })
})
