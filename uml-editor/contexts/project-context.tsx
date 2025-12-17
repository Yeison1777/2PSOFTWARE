"use client"

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiClient, tokenManager, type Project, type Diagram, type CreateProjectRequest, type CreateDiagramRequest, type UpdateDiagramRequest } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { useAuth } from './auth-context'

interface ProjectContextType {
  // Projects
  projects: Project[]
  currentProject: Project | null
  isLoadingProjects: boolean
  createProject: (data: CreateProjectRequest) => Promise<Project>
  loadProjects: () => Promise<void>
  selectProject: (project: Project) => void
  deleteProject: (projectId: string) => Promise<void>
  
  // Diagrams
  diagrams: Diagram[]
  currentDiagram: Diagram | null
  isLoadingDiagrams: boolean
  createDiagram: (data: CreateDiagramRequest) => Promise<Diagram>
  loadProjectDiagrams: (projectId: string) => Promise<void>
  selectDiagram: (diagram: Diagram) => void
  saveDiagram: (diagramId: string, diagramData: any) => Promise<Diagram>
  deleteDiagram: (diagramId: string) => Promise<void>
  
  // UI State
  error: string | null
  clearError: () => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function useProjects() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider')
  }
  return context
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  
  // Diagrams state
  const [diagrams, setDiagrams] = useState<Diagram[]>([])
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null)
  const [isLoadingDiagrams, setIsLoadingDiagrams] = useState(false)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // Mounted state
  const [mounted, setMounted] = useState(false)

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  const restoreCurrentDiagram = useCallback(async () => {
    try {
      const userEmail = tokenManager.getCurrentUserEmail()
      if (!userEmail) {
        return
      }

      // Get user-specific diagram ID
      const diagramId = localStorage.getItem(`currentDiagramId_${userEmail}`) || 
                        localStorage.getItem('currentDiagramId') // Fallback to old format
      
      if (!diagramId || diagramId === 'undefined' || diagramId === 'null') {
        // Try to restore project instead
        const projectId = localStorage.getItem(`currentProjectId_${userEmail}`) ||
                          localStorage.getItem('currentProjectId') // Fallback
        if (projectId && projectId !== 'undefined' && projectId !== 'null') {
          try {
            const token = tokenManager.get()
            if (token) {
              const project = await apiClient.getProject(projectId, token)
              if (project) {
                setCurrentProject(project)
                await loadProjectDiagrams(project.id)
              }
            }
          } catch (error) {
            // Project not found or invalid, clear it
            localStorage.removeItem(`currentProjectId_${userEmail}`)
            localStorage.removeItem('currentProjectId')
          }
        }
        return
      }

      const token = tokenManager.get()
      if (!token) {
        return
      }

      // Get the diagram from the API
      const diagram = await apiClient.getDiagram(diagramId, token)
      
      if (diagram) {
        setCurrentDiagram(diagram)
        
        // Also set the current project
        try {
          const project = await apiClient.getProject(diagram.project_id, token)
          
          if (project) {
            setCurrentProject(project)
            // Save project ID with user prefix
            localStorage.setItem(`currentProjectId_${userEmail}`, project.id)
            // Load all diagrams for this project
            await loadProjectDiagrams(diagram.project_id)
          }
        } catch (projectError) {
          // Project not found, clear diagram ID
          localStorage.removeItem(`currentDiagramId_${userEmail}`)
          localStorage.removeItem('currentDiagramId')
        }
      }
    } catch (error) {
      // Diagram not found or invalid, clear it
      const userEmail = tokenManager.getCurrentUserEmail()
      if (userEmail) {
        localStorage.removeItem(`currentDiagramId_${userEmail}`)
      }
      localStorage.removeItem('currentDiagramId')
    }
  }, [])

  // Load projects when user is authenticated
  useEffect(() => {
    if (!mounted) return
    
    if (user) {
      // CRITICAL: Verificar que el usuario actual coincide con el email almacenado
      const storedEmail = tokenManager.getCurrentUserEmail()
      if (storedEmail && storedEmail !== user.email) {
        // Usuario diferente - limpiar TODO
        logger.error('CRITICAL: User mismatch detected!', {
          stored: storedEmail,
          current: user.email
        })
        setProjects([])
        setCurrentProject(null)
        setDiagrams([])
        setCurrentDiagram(null)
        // Limpiar localStorage de otros usuarios
        const allKeys = Object.keys(localStorage)
        allKeys.forEach(key => {
          if (key.startsWith('currentDiagramId_') || 
              key.startsWith('currentProjectId_') ||
              key.startsWith('diagram_data_')) {
            if (!key.endsWith(`_${user.email}`)) {
              localStorage.removeItem(key)
            }
          }
        })
        // Actualizar el email almacenado al usuario actual
        const token = tokenManager.get()
        if (token) {
          tokenManager.set(token, user.email)
        }
        return
      }
      
      // Asegurar que el email almacenado coincide
      if (!storedEmail || storedEmail !== user.email) {
        const token = tokenManager.get()
        if (token) {
          tokenManager.set(token, user.email)
        }
      }
      
      // Cargar proyectos solo del usuario actual
      loadProjects()
      // Also try to restore current diagram from localStorage
      restoreCurrentDiagram()
    } else {
      // Clear state when user logs out
      setProjects([])
      setCurrentProject(null)
      setDiagrams([])
      setCurrentDiagram(null)
    }
  }, [user, mounted, restoreCurrentDiagram])

  const loadProjects = async () => {
    const token = tokenManager.get()
    if (!token) return

    setIsLoadingProjects(true)
    setError(null)

    try {
      const projectList = await apiClient.getProjects(token)
      setProjects(projectList)
    } catch (error) {
      logger.error('Error loading projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to load projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const createProject = async (data: CreateProjectRequest): Promise<Project> => {
    const token = tokenManager.get()
    logger.log('Creating project with token:', token ? 'Token exists' : 'No token')
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      const newProject = await apiClient.createProject(data, token)
      setProjects(prev => [...prev, newProject])
      return newProject
    } catch (error: any) {
      logger.error('Error creating project:', error)
      
      // Handle specific error types
      if (error?.status === 401) {
        setError('Your session has expired. Please log in again.')
      } else if (error?.status === 422) {
        setError('Invalid project data. Please check your input.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
        setError(errorMessage)
      }
      
      throw error
    }
  }

  const selectProject = (project: Project) => {
    setCurrentProject(project)
    // Save project ID to localStorage with user prefix for persistence
    const userEmail = tokenManager.getCurrentUserEmail()
    if (userEmail) {
      localStorage.setItem(`currentProjectId_${userEmail}`, project.id)
    }
    loadProjectDiagrams(project.id)
  }

  const deleteProject = async (projectId: string): Promise<void> => {
    const token = tokenManager.get()
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      await apiClient.deleteProject(projectId, token)
      
      // Remove project from state
      setProjects(prev => prev.filter(p => p.id !== projectId))
      
      // If the deleted project was current, clear it
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setDiagrams([])
        setCurrentDiagram(null)
        const userEmail = tokenManager.getCurrentUserEmail()
        if (userEmail) {
          localStorage.removeItem(`currentDiagramId_${userEmail}`)
          localStorage.removeItem(`currentProjectId_${userEmail}`)
        }
        localStorage.removeItem('currentDiagramId')
        localStorage.removeItem('currentProjectId')
      }
    } catch (error: any) {
      logger.error('Error deleting project:', error)
      
      if (error.status === 401) {
        setError('Your session has expired. Please log in again.')
      } else if (error.status === 404) {
        setError('Project not found or access denied.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete project'
        setError(errorMessage)
      }
      
      throw error
    }
  }

  const loadProjectDiagrams = async (projectId: string) => {
    const token = tokenManager.get()
    if (!token) return

    setIsLoadingDiagrams(true)
    setError(null)

    try {
      // Verificar que el usuario actual coincide antes de cargar
      const currentUserEmail = tokenManager.getCurrentUserEmail()
      if (user && currentUserEmail && user.email !== currentUserEmail) {
        logger.log('User mismatch in loadProjectDiagrams, skipping')
        setDiagrams([])
        return
      }
      
      const diagramList = await apiClient.getProjectDiagrams(projectId, token)
      // Filtrar solo diagramas del proyecto actual (doble verificación)
      setDiagrams(diagramList.filter(d => d.project_id === projectId))
    } catch (error: any) {
      logger.error('Error loading diagrams:', error)
      
      // 401 errors are handled centrally in api-client.ts
      if (error?.status === 401) {
        setDiagrams([])
        setCurrentProject(null)
        return
      }
      
      if (error?.status === 403 || error?.status === 404) {
        // Proyecto no encontrado o sin acceso - limpiar
        setDiagrams([])
        setCurrentProject(null)
      }
      setError(error instanceof Error ? error.message : 'Failed to load diagrams')
    } finally {
      setIsLoadingDiagrams(false)
    }
  }

  const createDiagram = async (data: CreateDiagramRequest): Promise<Diagram> => {
    const token = tokenManager.get()
    logger.log('Creating diagram with token:', token ? 'Token exists' : 'No token')
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      const newDiagram = await apiClient.createDiagram(data, token)
      setDiagrams(prev => [...prev, newDiagram])
      return newDiagram
    } catch (error: any) {
      logger.error('Error creating diagram:', error)
      
      // 401 errors are handled centrally in api-client.ts
      if (error?.status === 401) {
        throw new Error('Your session has expired. Please log in again.')
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create diagram'
      setError(errorMessage)
      throw error
    }
  }

  const selectDiagram = (diagram: Diagram) => {
    setCurrentDiagram(diagram)
    // Save diagram ID to localStorage with user prefix for persistence
    const userEmail = tokenManager.getCurrentUserEmail()
    if (userEmail) {
      localStorage.setItem(`currentDiagramId_${userEmail}`, diagram.id)
      // Also save project ID if available
      if (diagram.project_id) {
        localStorage.setItem(`currentProjectId_${userEmail}`, diagram.project_id)
      }
    }
  }

  const saveDiagram = async (diagramId: string, diagramData: any): Promise<Diagram> => {
    const token = tokenManager.get()
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      const updatedDiagram = await apiClient.updateDiagram(diagramId, { diagram_data: diagramData }, token)
      
      // Update the diagram in our state
      setDiagrams(prev => 
        prev.map(d => d.id === diagramId ? updatedDiagram : d)
      )
      
      // Update current diagram if it's the one we just saved
      if (currentDiagram?.id === diagramId) {
        setCurrentDiagram(updatedDiagram)
      }
      
      return updatedDiagram
    } catch (error: any) {
      logger.error('Error saving diagram:', error)
      
      // 401 errors are handled centrally in api-client.ts
      if (error?.status === 401) {
        throw new Error('Your session has expired. Please log in again.')
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to save diagram'
      setError(errorMessage)
      throw error
    }
  }

  const deleteDiagram = async (diagramId: string): Promise<void> => {
    const token = tokenManager.get()
    if (!token) throw new Error('No authentication token')

    setError(null)

    try {
      await apiClient.deleteDiagram(diagramId, token)
      
      // Remove diagram from state
      setDiagrams(prev => prev.filter(d => d.id !== diagramId))
      
      // If the deleted diagram was current, clear it
      if (currentDiagram?.id === diagramId) {
        setCurrentDiagram(null)
        const userEmail = tokenManager.getCurrentUserEmail()
        if (userEmail) {
          localStorage.removeItem(`currentDiagramId_${userEmail}`)
        }
        localStorage.removeItem('currentDiagramId')
      }
    } catch (error: any) {
      logger.error('Error deleting diagram:', error)
      
      if (error?.status === 401) {
        setError('Your session has expired. Please log in again.')
      } else if (error?.status === 404) {
        setError('Diagram not found or access denied.')
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete diagram'
        setError(errorMessage)
      }
      
      throw error
    }
  }

  const clearError = () => setError(null)

  return (
    <ProjectContext.Provider value={{
      // Projects
      projects,
      currentProject,
      isLoadingProjects,
      createProject,
      loadProjects,
      selectProject,
      deleteProject,
      
      // Diagrams
      diagrams,
      currentDiagram,
      isLoadingDiagrams,
      createDiagram,
      loadProjectDiagrams,
      selectDiagram,
      saveDiagram,
      deleteDiagram,
      
      // UI State
      error,
      clearError
    }}>
      <div suppressHydrationWarning={true}>
        {children}
      </div>
    </ProjectContext.Provider>
  )
}