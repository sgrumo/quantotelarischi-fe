import enTranslations from '../../i18n/en.json'
import itTranslations from '../../i18n/it.json'

export type Locale = 'en' | 'it'

const translations = {
    en: enTranslations,
    it: itTranslations,
}

export function getTranslations(locale: Locale = 'en') {
    return translations[locale] || translations.en
}

export function t(
    key: string,
    locale: Locale = 'en',
    params?: Record<string, string | number>,
): string {
    const keys = key.split('.')
    let value: any = translations[locale] || translations.en

    for (const k of keys) {
        value = value?.[k]
        if (value === undefined) break
    }

    if (typeof value !== 'string') {
        console.warn(`Translation key not found: ${key}`)
        return key
    }

    if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
            return params[paramKey]?.toString() || `{{${paramKey}}}`
        })
    }

    return value
}

export function getLocaleFromUrl(url: URL): Locale {
    const locale = url.searchParams.get('lang')
    if (locale === 'it' || locale === 'en') {
        return locale
    }
    return 'it' // Default to Italian
}

export function getLocaleFromBrowser(): Locale {
    if (typeof window === 'undefined') return 'it'

    const browserLang = navigator.language.toLowerCase()
    if (browserLang.startsWith('it')) {
        return 'it'
    }
    return 'en'
}
