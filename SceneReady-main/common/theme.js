const THEME_KEY = 'app-theme'
const DEFAULT_THEME = 'dark'

const isH5 = typeof document !== 'undefined'

export function getTheme() {
  return uni.getStorageSync(THEME_KEY) || DEFAULT_THEME
}

export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'

  if (isH5) {
    document.documentElement.setAttribute('data-theme', next)
  }

  try {
    uni.setNavigationBarColor({
      frontColor: next === 'light' ? '#000000' : '#ffffff',
      backgroundColor: next === 'light' ? '#ffffff' : '#000000'
    })
  } catch (e) {
    // ignore platform limitations
  }

  return next
}

export function setTheme(theme) {
  const next = applyTheme(theme)
  uni.setStorageSync(THEME_KEY, next)
  return next
}

export function toggleTheme() {
  const current = getTheme()
  const next = current === 'light' ? 'dark' : 'light'
  return setTheme(next)
}

export function initTheme() {
  const saved = getTheme()
  return setTheme(saved)
}
