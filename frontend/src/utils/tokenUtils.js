/**
 * Utility functions for JWT token management
 */

/**
 * Decode JWT token without verification (client-side only)
 * @param {string} token - JWT token string
 * @returns {object|null} Decoded payload or null if invalid
 */
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error decoding token:', error)
    return null
  }
}

/**
 * Check if token is expired
 * @param {string} token - JWT token string
 * @returns {boolean} True if token is expired or invalid
 */
export const isTokenExpired = (token) => {
  if (!token) return true
  
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) return true
  
  // Check if token has expired (exp is in seconds, Date.now() is in milliseconds)
  const currentTime = Date.now() / 1000
  return decoded.exp < currentTime
}

/**
 * Get remaining time until token expires
 * @param {string} token - JWT token string
 * @returns {number} Milliseconds until expiration, or 0 if expired/invalid
 */
export const getTokenExpirationTime = (token) => {
  if (!token) return 0
  
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) return 0
  
  const currentTime = Date.now() / 1000
  const remainingSeconds = decoded.exp - currentTime
  
  return remainingSeconds > 0 ? remainingSeconds * 1000 : 0
}

/**
 * Clear token and redirect to login
 */
export const handleTokenExpiration = () => {
  localStorage.removeItem('access_token')
  if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login'
  }
}