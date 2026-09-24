import { defineConfig, devices } from '@playwright/test'

const PORT = 3200
export const E2E = {
  password: 'e2e-passwort',
  token: 'e2e-token-0123456789abcdef',
}

/** Builds the app and runs it against a throwaway database. */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `rm -rf .e2e-data && npx next build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_PATH: '.e2e-data/e2e.db',
      APP_PASSWORD: E2E.password,
      SESSION_SECRET: 'e2e-session-secret-0123456789abcdef',
      LERNRAUM_API_TOKEN: E2E.token,
      PUBLIC_URL: `http://127.0.0.1:${PORT}`,
      APP_USER_NAME: 'Moritz Bibow',
      BACKUP_DISABLED: '1',
    },
  },
})
