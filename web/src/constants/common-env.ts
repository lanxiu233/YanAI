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

const webConfig = {
    apiUrl: process.env.NODE_ENV === 'development' ? developmentApiUrl() : process.env.NEXT_PUBLIC_API_URL || '',
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
}

export default webConfig
