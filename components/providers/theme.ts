export type Theme = 'dark' | 'light'

export const THEME_COOKIE = 'lr_theme'

/** Applies a theme immediately (no reload) and persists it in cookie + localStorage. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.dataset.theme = theme
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
  try {
    localStorage.setItem(THEME_COOKIE, theme)
  } catch {
    // private mode – cookie is enough
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'dark' ? '#131211' : '#f5f3ef')
  window.setTimeout(() => root.classList.remove('theme-switching'), 220)
  window.dispatchEvent(new CustomEvent('lernraum:theme', { detail: theme }))
}

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}
