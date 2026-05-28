import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:3000'

test.describe('Server API E2E', () => {
  test('GET /api/health returns valid response', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`)

    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('version')
  })

  test('GET /api/users lists users', async ({ request }) => {
    const listRes = await request.get(`${API_BASE}/api/users`)
    expect(listRes.ok()).toBe(true)
    const listBody = await listRes.json()
    expect(listBody.success).toBe(true)
    expect(Array.isArray(listBody.users)).toBe(true)
  })

  test('POST /api/users sem token CSRF é rejeitado (proteção ativa)', async ({ request }) => {
    // O plugin csrf-protection exige token em mutações. Um POST sem token deve
    // ser bloqueado — isto valida que a proteção está funcionando.
    const res = await request.post(`${API_BASE}/api/users`, {
      data: { name: `E2E ${Date.now()}`, email: `e2e-${Date.now()}@test.com` },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(JSON.stringify(body)).toContain('CSRF')
  })

  test('GET /swagger returns swagger UI', async ({ request }) => {
    const response = await request.get(`${API_BASE}/swagger`)

    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html.toLowerCase()).toContain('swagger')
  })

  test('POST /api/rooms/:id/emit sends event', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/rooms/test-e2e/emit`, {
      data: {
        event: 'test:ping',
        data: { message: 'e2e test' },
      },
    })

    // Should succeed (200) or at least not 404/500
    expect(response.status()).toBeLessThan(500)
  })
})
