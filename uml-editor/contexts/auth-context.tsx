"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { apiClient, tokenManager, type User, type AuthResponseNormalized } from '@/lib/api-client'
import { logger } from '@/lib/logger'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if user is authenticated on app start
  useEffect(() => {
    if (!mounted) return

    const checkAuth = async () => {
      try {
        // Clean up any existing invalid tokens first
        tokenManager.cleanup()
        
        const token = tokenManager.get()
        const currentUserEmail = tokenManager.getCurrentUserEmail()
        
        if (!token || !currentUserEmail) {
          // No token or email, user is not authenticated
          setUser(null)
          setIsLoading(false)
          return
        }
        
        try {
          // Verify token is still valid
          const userData = await apiClient.me(token)
          
          // CRITICAL: Verify that the user data matches the stored email
          if (userData.email === currentUserEmail) {
            // Session is valid, restore user
            setUser(userData)
            // Ensure token is still stored with the correct email (critical for persistence)
            tokenManager.set(token, userData.email)
          } else {
            // User mismatch - this should NEVER happen, but if it does, clear everything
            logger.error('CRITICAL: User email mismatch!', {
              stored: currentUserEmail,
              received: userData.email
            })
            tokenManager.remove()
            setUser(null)
            // Limpiar todos los datos de localStorage relacionados
            const allKeys = Object.keys(localStorage)
            allKeys.forEach(key => {
              if (key.startsWith('currentDiagramId_') || 
                  key.startsWith('currentProjectId_') ||
                  key.startsWith('diagram_data_') ||
                  key.startsWith('shared-token-') ||
                  key === 'global-shared-tokens') {
                localStorage.removeItem(key)
              }
            })
          }
        } catch (error: any) {
          // Token might be expired or invalid
          // Only remove if it's a 401 (unauthorized), otherwise keep it and retry
          if (error?.status === 401 || error?.response?.status === 401) {
            logger.log('Token invalid (401), clearing session')
            tokenManager.remove()
            setUser(null)
            // Limpiar datos relacionados
            const userEmail = tokenManager.getCurrentUserEmail()
            if (userEmail) {
              localStorage.removeItem(`currentDiagramId_${userEmail}`)
              localStorage.removeItem(`currentProjectId_${userEmail}`)
            }
          } else {
            // Network error or other issue - keep token but don't set user
            logger.warn('Network error during auth check, keeping token but not setting user:', error)
            // Don't set user on network errors - wait for retry
          }
        }
      } catch (error) {
        // Unexpected error - don't clear session, might be temporary
        logger.error('Error during auth check:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [mounted])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.login({ email, password })
      
      // Validate response
      if (!response.token || !response.user) {
        logger.error('Invalid response structure:', response)
        throw new Error('Invalid login response from server')
      }
      
      // CRITICAL: Limpiar datos del usuario anterior antes de hacer login
      const previousEmail = tokenManager.getCurrentUserEmail()
      if (previousEmail && previousEmail !== response.user.email) {
        logger.log('Different user logging in, clearing previous user data')
        // Limpiar datos del usuario anterior
        localStorage.removeItem(`currentDiagramId_${previousEmail}`)
        localStorage.removeItem(`currentProjectId_${previousEmail}`)
      }
      
      // Limpiar datos legacy también
      localStorage.removeItem('currentDiagramId')
      localStorage.removeItem('currentProjectId')
      
      logger.log('Login successful for user:', response.user.username || response.user.email)
      tokenManager.set(response.token, response.user.email)
      setUser(response.user)
    } catch (error) {
      logger.error('Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, username: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.register({ email, username, password })
      
      // Limpiar cualquier dato previo antes de registrar nuevo usuario
      const previousEmail = tokenManager.getCurrentUserEmail()
      if (previousEmail) {
        logger.log('Clearing previous user data before registration')
        localStorage.removeItem(`currentDiagramId_${previousEmail}`)
        localStorage.removeItem(`currentProjectId_${previousEmail}`)
      }
      localStorage.removeItem('currentDiagramId')
      localStorage.removeItem('currentProjectId')
      
      // After successful registration, automatically log in
      await login(email, password)
    } catch (error) {
      logger.error('Registration error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    const userEmail = tokenManager.getCurrentUserEmail()
    
    // Clear user-specific data
    if (userEmail) {
      localStorage.removeItem(`currentDiagramId_${userEmail}`)
      localStorage.removeItem(`currentProjectId_${userEmail}`)
    }
    
    // Clear legacy data (without user prefix)
    localStorage.removeItem('currentDiagramId')
    localStorage.removeItem('currentProjectId')
    
    // Clear any shared tokens
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('shared-token-')) {
        localStorage.removeItem(key)
      }
    })
    
    // Remove token and user state
    tokenManager.remove()
    setUser(null)
    
    // Clear unauthenticated state
    localStorage.removeItem('unauthenticated')
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, isLoading: true, login, register, logout }}>
        <div suppressHydrationWarning={true}>
          {children}
        </div>
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}