import React, { createContext, useState, useContext, useEffect } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { isTokenExpired, handleTokenExpiration } from '../utils/tokenUtils'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      // Check if token is expired before making API call
      if (isTokenExpired(token)) {
        handleTokenExpiration()
        setLoading(false)
        return
      }
      
      // Check if token exists and validate it
      checkAuth()
      
      // Set up periodic token validation (every 5 minutes)
      const intervalId = setInterval(() => {
        const currentToken = localStorage.getItem('access_token')
        if (currentToken) {
          if (isTokenExpired(currentToken)) {
            handleTokenExpiration()
            setUser(null)
          } else {
            checkAuth()
          }
        }
      }, 5 * 60 * 1000) // 5 minutes
      
      return () => clearInterval(intervalId)
    } else {
      setLoading(false)
    }
  }, [])

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      // Token is invalid or expired
      localStorage.removeItem('access_token')
      setUser(null)
      // If we're not already on the login page, redirect
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const formData = new FormData()
      formData.append('username', email)  // OAuth2PasswordRequestForm expects 'username' field
      formData.append('password', password)
      
      const response = await api.post('/auth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      
      const { access_token } = response.data
      localStorage.setItem('access_token', access_token)
      
      await checkAuth()
      toast.success('Login successful!')
      return true
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed')
      return false
    }
  }

  const register = async (userData) => {
    try {
      await api.post('/auth/register', userData)
      toast.success('Registration successful! Please login.')
      return true
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed')
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setUser(null)
    toast.success('Logged out successfully')
  }

  const value = {
    user,
    login,
    register,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}