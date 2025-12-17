import { logger } from './logger'

// Default to relative API base so deployments behind a reverse proxy (Nginx) work
// regardless of host/port. This avoids browsers trying to call 127.0.0.1.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export interface RegisterRequest {
  email: string
  username: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface AuthResponseNormalized {
  token: string
  user: {
    id: string
    email: string
    username: string
  }
}

export interface User {
  id: string
  email: string
  username: string
}

// Project interfaces
export interface CreateProjectRequest {
  name: string
}

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

// Diagram interfaces
export interface CreateDiagramRequest {
  project_id: string
  diagram_data: any // jsonb type - will contain UML classes and associations
}

export interface UpdateDiagramRequest {
  diagram_data: any // jsonb type
}

export interface Diagram {
  id: string
  project_id: string
  diagram_data: any // jsonb type
  version: number
  created_at: string
  updated_at: string
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Centralized 401 error handler - clears auth and redirects to login
 * This function is called automatically when any API request returns 401
 */
function handle401Error(): void {
  if (typeof window === 'undefined') return
  
  // 401s can be routine (expired token). Don't spam dev overlay with console.error.
  logger.warn('Authentication error (401) - clearing session and redirecting to login')
  
  // Clear all user-specific data from localStorage
  const allKeys = Object.keys(localStorage)
  allKeys.forEach(key => {
    if (
      key.startsWith('currentDiagramId_') ||
      key.startsWith('currentProjectId_') ||
      key.startsWith('diagram_data_') ||
      key.startsWith('shared-token-') ||
      key === 'global-shared-tokens' ||
      key === 'currentDiagramId' ||
      key === 'currentProjectId' ||
      key.startsWith('auth_token_') ||
      key === 'current_user_email'
    ) {
      localStorage.removeItem(key)
    }
  })
  
  // Redirect to login
  window.location.href = '/login'
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  logger.log('Making API request to:', url)
  logger.log('Request method:', options.method)
  
  // Don't set Content-Type for FormData, let browser handle it
  const isFormData = options.body instanceof FormData
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...options.headers as Record<string, string>,
  }
  
  // Only set default Content-Type if not already set and not FormData
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  
  const response = await fetch(url, {
    headers,
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    // Avoid treating expected auth/permission errors as "console errors" in dev overlay
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      logger.warn('API Error:', response.status, errorText)
    } else {
      logger.error('API Error:', response.status, errorText)
    }
    
    // Handle 401 errors centrally - clear auth and redirect
    if (response.status === 401) {
      handle401Error()
    }
    
    throw new ApiError(response.status, errorText || 'API request failed')
  }

  return response.json()
}

export const apiClient = {
  // Register new user
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Login user
  login: async (data: LoginRequest): Promise<AuthResponseNormalized> => {
    try {
      logger.log('Making login request to:', `${API_BASE_URL}/login`)
      const response = await apiRequest<AuthResponse>('/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      
      if (!response.access_token) {
        throw new Error('No access_token in login response')
      }
      
      // Get user info using the token
      const user = await apiRequest<User>('/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${response.access_token}`,
        },
      })
      
      logger.log('Login successful for user:', user.email)
      
      return {
        token: response.access_token,
        user
      }
    } catch (error) {
      logger.error('Login API error:', error)
      throw error
    }
  },

  // Get current user info
  me: async (token: string): Promise<User> => {
    return apiRequest<User>('/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  // Project management
  createProject: async (data: CreateProjectRequest, token: string): Promise<Project> => {
    logger.log('Creating project:', data.name)
    
    return apiRequest<Project>('/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  },

  getProjects: async (token: string): Promise<Project[]> => {
    return apiRequest<Project[]>('/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  getProject: async (projectId: string, token: string): Promise<Project> => {
    return apiRequest<Project>(`/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  deleteProject: async (projectId: string, token: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  // Diagram management
  createDiagram: async (data: CreateDiagramRequest, token: string): Promise<Diagram> => {
    logger.log('Creating diagram for project:', data.project_id)
    
    return apiRequest<Diagram>('/diagrams', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  },

  getProjectDiagrams: async (projectId: string, token: string): Promise<Diagram[]> => {
    return apiRequest<Diagram[]>(`/projects/${projectId}/diagrams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  getDiagram: async (diagramId: string, token: string): Promise<Diagram> => {
    return apiRequest<Diagram>(`/diagrams/${diagramId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  updateDiagram: async (diagramId: string, data: UpdateDiagramRequest, token: string): Promise<Diagram> => {
    logger.log('Updating diagram:', diagramId)
    
    return apiRequest<Diagram>(`/diagrams/${diagramId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  },

  deleteDiagram: async (diagramId: string, token: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/diagrams/${diagramId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
  },

  // Share management
  createShare: async (diagramId: string, token: string, shareToken?: string, expiresHours?: number): Promise<any> => {
    return apiRequest<any>('/shares', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        diagram_id: diagramId,
        token: shareToken,
        expires_hours: expiresHours || 24
      }),
    })
  },

  getShare: async (shareToken: string): Promise<any> => {
    return apiRequest<any>(`/shares/${shareToken}`, {
      method: 'GET',
    })
  },
}

// Token management utilities
export const tokenManager = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null
    
    try {
      // Get the current user's token from the most recent login
      const currentUserEmail = localStorage.getItem('current_user_email')
      if (!currentUserEmail) {
        logger.log('No current user email found')
        return null
      }
      
      // Get token for specific user
      const token = localStorage.getItem(`auth_token_${currentUserEmail}`)
      if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
        if (token) {
          localStorage.removeItem(`auth_token_${currentUserEmail}`)
        }
        logger.log('No valid token found for user:', currentUserEmail)
        return null
      }
      return token
    } catch (error) {
      logger.error('Error getting token from localStorage:', error)
      return null
    }
  },

  set: (token: string, userEmail: string): void => {
    if (typeof window === 'undefined') return
    
    try {
      // Don't save if token is falsy or the string 'undefined'
      if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
        logger.warn('Attempting to save invalid token')
        return
      }
      
      if (!userEmail) {
        logger.warn('No user email provided for token storage')
        return
      }
      
      // Save token for specific user
      localStorage.setItem(`auth_token_${userEmail}`, token)
      localStorage.setItem('current_user_email', userEmail)
      
      // Clear unauthenticated state
      localStorage.removeItem('unauthenticated')
      logger.log('User authenticated successfully:', userEmail)
    } catch (error) {
      logger.error('Error saving token to localStorage:', error)
    }
  },

  remove: (): void => {
    if (typeof window === 'undefined') return
    
    try {
      const currentUserEmail = localStorage.getItem('current_user_email')
      
      if (currentUserEmail) {
        // Remove token for specific user
        localStorage.removeItem(`auth_token_${currentUserEmail}`)
        localStorage.removeItem('current_user_email')
        logger.log('Token removed from localStorage for user:', currentUserEmail)
      }
      
      // Mark as unauthenticated
      localStorage.setItem('unauthenticated', 'true')
      
      // Also clear user-specific data
      localStorage.removeItem('currentDiagramId')
      localStorage.removeItem('currentProjectId')
      
      // Clear any shared tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('shared-token-')) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      logger.error('Error removing token from localStorage:', error)
    }
  },

  // Clean up any existing invalid tokens
  cleanup: (): void => {
    if (typeof window === 'undefined') return
    
    try {
      // Clean up old system
      const token = localStorage.getItem('auth_token')
      if (token === 'undefined' || token === 'null' || (token && token.trim() === '')) {
        logger.log('Cleaning up invalid token (legacy)')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('currentDiagramId')
        localStorage.removeItem('currentProjectId')
      }
      
      // Clean up user-specific tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('auth_token_')) {
          const token = localStorage.getItem(key)
          if (token === 'undefined' || token === 'null' || (token && token.trim() === '')) {
            logger.log('Cleaning up invalid token for:', key)
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      logger.error('Error cleaning up token:', error)
    }
  },

  // Get current user email
  getCurrentUserEmail: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('current_user_email')
  }
}