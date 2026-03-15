import { test as base, expect } from '@playwright/test'

/**
 * Custom Playwright test fixture that auto-removes the vite-plugin-checker
 * error overlay. The overlay is a custom element that intercepts pointer
 * events and blocks button clicks when TypeScript errors exist in dev mode.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const remove = () =>
        document
          .querySelectorAll('vite-plugin-checker-error-overlay')
          .forEach((el) => el.remove())

      // Wait for DOM to be ready before observing
      const observe = () => {
        remove()
        if (document.documentElement) {
          new MutationObserver(remove).observe(document.documentElement, {
            childList: true,
            subtree: true,
          })
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observe)
      } else {
        observe()
      }
    })
    await use(page)
  },
})

export { expect }
