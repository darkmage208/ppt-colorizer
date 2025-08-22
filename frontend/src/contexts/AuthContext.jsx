import React, { createContext, useState, useContext, useEffect } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'

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
      checkAuth()
    } else {
      setLoading(false)
    }
  }, [])

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('access_token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const formData = new FormData()
      formData.append('username', username)
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