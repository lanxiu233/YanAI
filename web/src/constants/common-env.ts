const developmentApiUrl = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_API_URL
    if (configuredUrl) {
        return configuredUrl
    }

    if (typeof window !== 'undefined') {
        const {protocol, hostname} = window.location
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `${protocol}//${hostname}:8000`
        }
    }

    return 'http://127.0.0.1:8000'
}

const browserOrigin = () => {
    if (typeof window === 'undefined') {
        return ''
    }
    return window.location.origin
}

const resolvedApiUrl = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_API_URL
    if (configuredUrl) {
        return configuredUrl
    }
    if (process.env.NODE_ENV === 'development') {
        return developmentApiUrl()
    }
    return browserOrigin()
}

const webConfig = {
    apiUrl: resolvedApiUrl(),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
}

export default webConfig
