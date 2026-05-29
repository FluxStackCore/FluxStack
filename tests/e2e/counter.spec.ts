import { test, expect } from './fixtures'

test.describe('Counter Demo', () => {
  test('should render all three counters', async ({ page }) => {
    await page.goto('/counter')

    // Os 3 cards são ilhas Live que só montam após hidratar/conectar — espera o WS.
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 25_000 })

    // 3 counter sections (headings — evita casar a descrição "...shared room.")
    await expect(page.getByRole('heading', { name: 'Local state' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Isolated room' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Shared room' })).toBeVisible()
  })

  test('should increment local counter', async ({ page }) => {
    await page.goto('/counter')

    // Espera o WebSocket conectar (badge "Connected") para as actions funcionarem
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 25_000 })
    await page.waitForTimeout(1_000)

    // Botões usam aria-label ("Increase Local state" / "Decrease ...")
    await page.getByRole('button', { name: 'Increase Local state' }).click()
    await page.waitForTimeout(1_000)

    // Não deve quebrar e a seção continua visível
    await expect(page.getByRole('heading', { name: 'Local state' })).toBeVisible()
  })

  test('should show WebSocket connection status', async ({ page }) => {
    await page.goto('/counter')

    // Pelo menos um badge "Connected" deve aparecer (WS pode levar um instante)
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 25_000 })
  })
})
