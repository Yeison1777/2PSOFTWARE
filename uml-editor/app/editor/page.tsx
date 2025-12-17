"use client"

import { useState, useEffect, useRef, useCallback, startTransition } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { DiagramCanvas } from "@/components/diagram-canvas"
import { Toolbar } from "@/components/toolbar"
import { AIAssistantPanel } from "@/components/ai-assistant-panel"
import { AIFabButton } from "@/components/ai-fab-button"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { apiClient, tokenManager, type Diagram } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import { ArrowLeft, Save, LogOut, User, Loader2, Share2, Users } from "lucide-react"
import type { UMLClass, Association } from "@/types/uml"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"

function LoadingSpinner() {
  // Texto fijo que coincide en SSR y cliente para evitar errores de hidratación
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-600">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  )
}

// Componente completamente dinámico - solo cliente
const DynamicEditorContent = dynamic(() => Promise.resolve(EditorContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-gray-600">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  )
})

function EditorContent() {
  const { user, logout } = useAuth()
  const router = useRouter()
  
  // Independent diagram state - don't depend on context
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null)
  const [classes, setClasses] = useState<UMLClass[]>([])
  const [associations, setAssociations] = useState<Association[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinToken, setJoinToken] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSharedDiagram, setIsSharedDiagram] = useState(false)
  const [sharedUsers, setSharedUsers] = useState<string[]>([])
  const isDraggingRef = useRef(false)
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load diagram data independently
  useEffect(() => {
    const loadDiagram = async () => {
      try {
        // Limpiar tokens expirados al inicio
        const globalTokens = localStorage.getItem('global-shared-tokens')
        if (globalTokens) {
          try {
            const tokensObj = JSON.parse(globalTokens) as Record<string, any>
            const now = new Date()
            const cleanedTokens: Record<string, any> = {}
            
            Object.keys(tokensObj).forEach(token => {
              const tokenData = tokensObj[token]
              const sharedAt = new Date(tokenData.sharedAt)
              const hoursDiff = (now.getTime() - sharedAt.getTime()) / (1000 * 60 * 60)
              
              // Mantener tokens que no tengan más de 24 horas
              if (hoursDiff < 24) {
                cleanedTokens[token] = tokenData
              }
            })
            
            localStorage.setItem('global-shared-tokens', JSON.stringify(cleanedTokens))
            logger.log('Tokens expirados limpiados')
          } catch (error) {
            logger.error('Error cleaning expired tokens:', error)
          }
        }
        
        // Get diagram ID from localStorage (user-specific)
        const userEmail = tokenManager.getCurrentUserEmail()
        const diagramId = userEmail 
          ? localStorage.getItem(`currentDiagramId_${userEmail}`) || localStorage.getItem('currentDiagramId')
          : localStorage.getItem('currentDiagramId')
        
        if (!diagramId) {
          logger.log('No diagram ID found in localStorage')
          router.push('/dashboard')
          return
        }

        logger.log('Loading diagram with ID:', diagramId)
        
        // Get token
        const token = tokenManager.get()
        if (!token) {
          logger.log('No token found')
          router.push('/login')
          return
        }

        // Load diagram directly from API
        // This will fail if user doesn't own the diagram (unless it's a shared diagram)
        let diagram: Diagram
        try {
          diagram = await apiClient.getDiagram(diagramId, token)
          logger.log('Loaded diagram:', diagram)
        } catch (error: any) {
          // 401 errors are already handled in api-client.ts
          // Just redirect if it's a 401
          if (error?.status === 401) {
            return
          }
          // If 403 or 404, user doesn't have access to this diagram
          if (error?.status === 403 || error?.status === 404) {
            // This can happen when localStorage still points to a diagram from another user/session.
            // Treat as expected and recover cleanly.
            logger.warn('Access denied to diagram:', diagramId)
            // Clear invalid diagram ID and redirect
            const userEmail = tokenManager.getCurrentUserEmail()
            if (userEmail) {
              localStorage.removeItem(`currentDiagramId_${userEmail}`)
            }
            localStorage.removeItem('currentDiagramId')
            router.push('/dashboard')
            return
          }
          throw error
        }
        
        setCurrentDiagram(diagram)
        
        // Load diagram data
        const diagramData = diagram.diagram_data
        if (diagramData) {
          // Filtrar duplicados al cargar
          const classes = diagramData.classes || []
          const associations = diagramData.associations || []
          
          const uniqueClasses = classes.filter((cls: UMLClass, index: number, self: UMLClass[]) => 
            index === self.findIndex((c: UMLClass) => c.id === cls.id)
          )
          const uniqueAssociations = associations.filter((assoc: Association, index: number, self: Association[]) => 
            index === self.findIndex((a: Association) => a.id === assoc.id)
          )
          
          setClasses(uniqueClasses)
          setAssociations(uniqueAssociations)
        } else {
          // Try to load from localStorage as backup
          const savedData = localStorage.getItem(`diagram_data_${diagram.id}`)
          if (savedData) {
            try {
              const parsedData = JSON.parse(savedData)
              const classes = parsedData.classes || []
              const associations = parsedData.associations || []
              
              // Filtrar duplicados
              const uniqueClasses = classes.filter((cls: UMLClass, index: number, self: UMLClass[]) => 
                index === self.findIndex((c: UMLClass) => c.id === cls.id)
              )
              const uniqueAssociations = associations.filter((assoc: Association, index: number, self: Association[]) => 
                index === self.findIndex((a: Association) => a.id === assoc.id)
              )
              
              setClasses(uniqueClasses)
              setAssociations(uniqueAssociations)
              logger.log('Loaded diagram data from localStorage backup')
            } catch (error) {
              logger.error('Error parsing saved diagram data:', error)
            }
          }
        }
        
        setIsLoading(false)
        
      } catch (error) {
        logger.error('Error loading diagram:', error)
        // Clear invalid diagram ID and redirect
        const userEmail = tokenManager.getCurrentUserEmail()
        if (userEmail) {
          localStorage.removeItem(`currentDiagramId_${userEmail}`)
        }
        localStorage.removeItem('currentDiagramId')
        router.push('/dashboard')
      }
    }

    if (user) {
      loadDiagram()
    } else {
      router.push('/login')
    }
  }, [user, router])

  // Mark as having unsaved changes when data changes
  useEffect(() => {
    if (!isLoading) {
      setHasUnsavedChanges(true)
    }
  }, [classes, associations, isLoading])

  // Auto-save diagram data when classes or associations change
  // Guardar más frecuentemente para diagramas compartidos (tiempo real)
  useEffect(() => {
    if (!currentDiagram || classes.length === 0 || isDraggingRef.current) return

    const autoSave = async () => {
      try {
        const diagramData = {
          classes: classes,
          associations: associations
        }
        
        // Save to localStorage first
        localStorage.setItem(`diagram_data_${currentDiagram.id}`, JSON.stringify(diagramData))
        
        // If it's a shared diagram (starts with "shared-"), guardar en backend usando el token
        if (currentDiagram.id.startsWith('shared-')) {
          const token = currentDiagram.id.replace('shared-', '')
          
          // Actualizar localStorage
          localStorage.setItem(`shared-token-${token}`, JSON.stringify({
            diagramId: currentDiagram.id,
            diagramData: diagramData,
            sharedAt: new Date().toISOString(),
            isActive: true,
            lastUpdated: new Date().toISOString()
          }))
          
          // Actualizar en backend usando el token compartido (esto activará SSE)
          try {
            const backendToken = tokenManager.get()
            if (backendToken) {
              // Usar el ID compartido directamente - el backend lo resolverá al diagram_id real
              // El backend buscará el share por token y usará el diagram_id real para el broadcast
              await apiClient.updateDiagram(currentDiagram.id, { diagram_data: diagramData }, backendToken)
              // Esto activará el broadcast SSE para todos los usuarios conectados al diagram_id real
            }
          } catch (error: any) {
            // Si falla, solo usar localStorage (modo offline)
            logger.error('Error guardando diagrama compartido en backend:', error)
            if (error?.status === 403) {
              logger.error('Acceso denegado al diagrama compartido')
            }
          }
          return
        }
        
        // For real diagrams, save to backend
        const token = tokenManager.get()
        if (token && currentDiagram.id && !currentDiagram.id.startsWith('shared-')) {
          try {
            const updatedDiagram = await apiClient.updateDiagram(currentDiagram.id, { diagram_data: diagramData }, token)
            logger.log('Diagrama guardado exitosamente:', updatedDiagram.version)
            // Update current diagram with new version
            setCurrentDiagram(updatedDiagram)
            setHasUnsavedChanges(false)
          } catch (error: any) {
            // Log error for debugging
            logger.error('Error guardando diagrama:', error)
            if (error?.status === 403) {
              logger.error('Acceso denegado al diagrama')
            } else if (error?.status === 404) {
              logger.warn('Diagrama no encontrado en backend')
            }
          }
        }
      } catch (error) {
        // Log error but don't block UI
        logger.error('Error inesperado en auto-save:', error)
      }
    }

    // Para diagramas compartidos, guardar más frecuentemente (1 segundo) para tiempo real
    // Para diagramas normales, 3 segundos es suficiente
    const debounceTime = currentDiagram.id.startsWith('shared-') ? 1000 : 3000
    const timeoutId = setTimeout(autoSave, debounceTime)
    return () => clearTimeout(timeoutId)
  }, [classes, associations, currentDiagram, isSharedDiagram])

  // Callback para actualizaciones en tiempo real
  const handleRealtimeUpdate = useCallback((newClasses: UMLClass[], newAssociations: Association[]) => {
    // Solo actualizar si no estamos arrastrando (evitar conflictos)
    if (!isDraggingRef.current) {
      startTransition(() => {
        // Filtrar duplicados antes de actualizar
        const uniqueClasses = newClasses.filter((cls: UMLClass, index: number, self: UMLClass[]) => 
          index === self.findIndex((c: UMLClass) => c.id === cls.id)
        )
        const uniqueAssociations = newAssociations.filter((assoc: Association, index: number, self: Association[]) => 
          index === self.findIndex((a: Association) => a.id === assoc.id)
        )
        
        // Actualizar solo si hay cambios reales (evitar loops)
        setClasses((prev) => {
          const prevStr = JSON.stringify(prev)
          const newStr = JSON.stringify(uniqueClasses)
          if (prevStr !== newStr) {
            return uniqueClasses
          }
          return prev
        })
        
        setAssociations((prev) => {
          const prevStr = JSON.stringify(prev)
          const newStr = JSON.stringify(uniqueAssociations)
          if (prevStr !== newStr) {
            return uniqueAssociations
          }
          return prev
        })
      })
    }
  }, [])

  // Sistema de sincronización en tiempo real usando SSE
  // Habilitar para TODOS los diagramas (incluyendo compartidos) si tienen un ID válido
  const shouldEnableRealtime = !!currentDiagram && 
                                !isLoading && 
                                currentDiagram.id !== 'undefined'
  
  useRealtimeSync({
    diagramId: shouldEnableRealtime ? currentDiagram.id : null,
    enabled: shouldEnableRealtime,
    onUpdate: handleRealtimeUpdate,
    currentUserId: user?.id
  })

  // WebSockets eliminados - solo mantenemos funcionalidad local

  const addClass = useCallback((newClass: UMLClass) => {
    startTransition(() => {
      setClasses((prev) => {
        // Verificar que no exista una clase con el mismo ID
        if (prev.some(cls => cls.id === newClass.id)) {
          logger.warn(`Class with ID ${newClass.id} already exists. Skipping duplicate.`)
          return prev
        }
        return [...prev, newClass]
      })
    })
  }, [])

  const updateClass = useCallback((id: string, updatedClass: Partial<UMLClass>) => {
    // Si es un movimiento (position), usar actualización diferida más agresiva
    if (updatedClass.position) {
      isDraggingRef.current = true
      // Usar startTransition + setTimeout para diferir completamente fuera del ciclo de render
      startTransition(() => {
        // Diferir aún más usando setTimeout para evitar conflictos DOM
        setTimeout(() => {
          setClasses((prev) => {
            // Verificar que la clase aún existe antes de actualizar
            const existingClass = prev.find(c => c.id === id)
            if (!existingClass) return prev
            return prev.map((cls) => (cls.id === id ? { ...cls, ...updatedClass } : cls))
          })
        }, 0)
      })
      // Resetear flag después de un delay más largo
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current)
      }
      dragTimeoutRef.current = setTimeout(() => {
        isDraggingRef.current = false
        dragTimeoutRef.current = null
      }, 200)
    } else {
      // Para otras actualizaciones, usar transición normal pero también diferida
      startTransition(() => {
        setTimeout(() => {
          setClasses((prev) => {
            const existingClass = prev.find(c => c.id === id)
            if (!existingClass) return prev
            return prev.map((cls) => (cls.id === id ? { ...cls, ...updatedClass } : cls))
          })
        }, 0)
      })
    }
  }, [])

  const removeClass = useCallback((id: string) => {
    startTransition(() => {
      setClasses((prev) => prev.filter((cls) => cls.id !== id))
      setAssociations((prev) => prev.filter((assoc) => assoc.fromClassId !== id && assoc.toClassId !== id))
    })
    if (selectedClass === id) {
      setSelectedClass(null)
    }
  }, [selectedClass])

  const addAssociation = useCallback((association: Association) => {
    startTransition(() => {
      setAssociations((prev) => {
        // Verificar que no exista una asociación con el mismo ID
        if (prev.some(assoc => assoc.id === association.id)) {
          logger.warn(`Association with ID ${association.id} already exists. Skipping duplicate.`)
          return prev
        }
        return [...prev, association]
      })
    })
  }, [])

  const updateAssociation = useCallback((updatedAssociation: Association) => {
    startTransition(() => {
      setAssociations((prev) => 
        prev.map((assoc) => assoc.id === updatedAssociation.id ? updatedAssociation : assoc)
      )
    })
  }, [])

  const removeAssociation = useCallback((id: string) => {
    startTransition(() => {
      setAssociations((prev) => prev.filter((assoc) => assoc.id !== id))
    })
  }, [])

  const handleGenerateClasses = useCallback((newClasses: UMLClass[]) => {
    startTransition(() => {
      setClasses((prev) => {
        // Filtrar duplicados antes de agregar
        const existingIds = new Set(prev.map(cls => cls.id))
        const uniqueNewClasses = newClasses.filter(cls => !existingIds.has(cls.id))
        return [...prev, ...uniqueNewClasses]
      })
    })
  }, [])

  const handleGenerateAssociations = useCallback((newAssociations: Association[]) => {
    startTransition(() => {
      setAssociations((prev) => {
        // Filtrar duplicados antes de agregar
        const existingIds = new Set(prev.map(assoc => assoc.id))
        const uniqueNewAssociations = newAssociations.filter(assoc => !existingIds.has(assoc.id))
        return [...prev, ...uniqueNewAssociations]
      })
    })
  }, [])

  // CRITICAL: Function to modify/replace entire diagram (used by AI modification mode)
  const handleModifyDiagram = useCallback((newClasses: UMLClass[], newAssociations: Association[]) => {
    startTransition(() => {
      // Filtrar duplicados antes de reemplazar
      const uniqueClasses = newClasses.filter((cls: UMLClass, index: number, self: UMLClass[]) => 
        index === self.findIndex((c: UMLClass) => c.id === cls.id)
      )
      const uniqueAssociations = newAssociations.filter((assoc: Association, index: number, self: Association[]) => 
        index === self.findIndex((a: Association) => a.id === assoc.id)
      )
      
      // REEMPLAZAR todas las clases y asociaciones (no agregar)
      setClasses(uniqueClasses)
      setAssociations(uniqueAssociations)
      
      logger.log('Diagrama modificado:', {
        classes: uniqueClasses.length,
        associations: uniqueAssociations.length
      })
    })
  }, [])

  // Funciones de compartir
  const handleShareDiagram = async () => {
    if (!currentDiagram) return
    
    try {
      // Solo crear share si NO es un diagrama compartido (solo diagramas reales)
      if (currentDiagram.id.startsWith('shared-')) {
        // Si ya es compartido, solo mostrar el token
        const existingToken = currentDiagram.id.replace('shared-', '')
        setShareToken(existingToken)
        setShowShareModal(true)
        return
      }
      
      // Generar token simple (8 caracteres)
      const token = Math.random().toString(36).substring(2, 10).toUpperCase()
      
      // Crear datos del diagrama actual
      const currentDiagramData = {
        classes: classes,
        associations: associations
      }
      
      // Crear share en el backend PRIMERO
      const backendToken = tokenManager.get()
      if (backendToken) {
        try {
          // Crear el share en el backend
          await apiClient.createShare(currentDiagram.id, backendToken, token, 24)
          logger.log('Share creado en backend con token:', token)
          
          // Guardar también en localStorage como backup
          localStorage.setItem(`shared-token-${token}`, JSON.stringify({
            diagramId: currentDiagram.id,
            diagramData: currentDiagramData,
            sharedAt: new Date().toISOString(),
            isActive: true
          }))
          
          setShareToken(token)
          setShowShareModal(true)
        } catch (error: any) {
          logger.error('Error creando share en backend:', error)
          // Si falla, usar solo localStorage
          localStorage.setItem(`shared-token-${token}`, JSON.stringify({
            diagramId: currentDiagram.id,
            diagramData: currentDiagramData,
            sharedAt: new Date().toISOString(),
            isActive: true
          }))
          setShareToken(token)
          setShowShareModal(true)
        }
      } else {
        // Sin token de backend, usar solo localStorage
        localStorage.setItem(`shared-token-${token}`, JSON.stringify({
          diagramId: currentDiagram.id,
          diagramData: currentDiagramData,
          sharedAt: new Date().toISOString(),
          isActive: true
        }))
        setShareToken(token)
        setShowShareModal(true)
      }
    } catch (error) {
      logger.error('Error sharing diagram:', error)
      alert('Error al compartir el diagrama')
    }
  }

  const handleJoinDiagram = async () => {
    if (!joinToken.trim()) return
    
    try {
      logger.log('Intentando unirse con token:', joinToken)
      
      let foundData = null
      let diagramId: string | null = null
      
      // PRIMERO: Intentar buscar en el backend
      try {
        const share = await apiClient.getShare(joinToken)
        if (share) {
          diagramId = share.diagram_id
          foundData = {
            diagramId: share.diagram_id,
            diagramData: share.diagram_data || { classes: [], associations: [] },
            isActive: share.is_active !== false
          }
          logger.log('Share encontrado en backend:', share)
        }
      } catch (backendError: any) {
        // Si no se encuentra en backend, buscar en localStorage
        logger.log('No se encontró en backend, buscando en localStorage')
      }
      
      // Si no se encontró en backend, buscar en localStorage
      if (!foundData) {
        const sharedData = localStorage.getItem(`shared-token-${joinToken}`)
        if (sharedData) {
          foundData = JSON.parse(sharedData)
        } else {
          const globalTokens = localStorage.getItem('global-shared-tokens')
          if (globalTokens) {
            const globalTokensObj = JSON.parse(globalTokens)
            if (globalTokensObj[joinToken]) {
              foundData = globalTokensObj[joinToken]
            }
          }
        }
      }
      
      if (foundData) {
        const { diagramId: resolvedDiagramId, diagramData, isActive } = foundData
        
        // Verificar si el token está activo
        if (!isActive) {
          alert(`Token ${joinToken} ha expirado o no está activo.`)
          setShowJoinModal(false)
          setJoinToken("")
          return
        }
        
        // Usar el diagramId del share si está disponible, sino usar el del foundData
        const finalDiagramId = diagramId || resolvedDiagramId
        
        logger.log('Diagrama encontrado, ID real:', finalDiagramId)
        
        // Crear diagrama compartido con datos reales
        const sharedDiagram: Diagram = {
          id: `shared-${joinToken}`,
          project_id: `shared-project-${joinToken}`,
          diagram_data: diagramData,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Cargar el diagrama compartido
        setCurrentDiagram(sharedDiagram)
        setIsSharedDiagram(true) // Marcar como diagrama compartido
        
        // Cargar datos del diagrama
        if (sharedDiagram.diagram_data) {
          const classes = sharedDiagram.diagram_data.classes || []
          const associations = sharedDiagram.diagram_data.associations || []
          
          // Filtrar duplicados
          const uniqueClasses = classes.filter((cls: UMLClass, index: number, self: UMLClass[]) => 
            index === self.findIndex((c: UMLClass) => c.id === cls.id)
          )
          const uniqueAssociations = associations.filter((assoc: Association, index: number, self: Association[]) => 
            index === self.findIndex((a: Association) => a.id === assoc.id)
          )
          
          // Usar startTransition para cargar datos sin bloquear
          startTransition(() => {
            setClasses(uniqueClasses)
            setAssociations(uniqueAssociations)
          })
          
          // Guardar en localStorage para persistencia
          const userEmail = tokenManager.getCurrentUserEmail()
          if (userEmail) {
            localStorage.setItem(`currentDiagramId_${userEmail}`, sharedDiagram.id)
          }
          localStorage.setItem('currentDiagramId', sharedDiagram.id) // Fallback
          localStorage.setItem(`diagram_data_${sharedDiagram.id}`, JSON.stringify(diagramData))
        }
        
        alert(`¡Te has unido al diagrama con token: ${joinToken}!`)
        setShowJoinModal(false)
        setJoinToken("")
      } else {
        // Si no encuentra en ningún lado, mostrar error
        alert(`Token ${joinToken} no encontrado. Asegúrate de que el token sea correcto y que el diagrama esté compartido.`)
        setShowJoinModal(false)
        setJoinToken("")
      }
    } catch (error) {
      logger.error('Error joining diagram:', error)
      alert('Error al unirse al diagrama')
    }
  }

  const copyTokenToClipboard = () => {
    if (shareToken) {
      navigator.clipboard.writeText(shareToken)
      alert('Token copiado al portapapeles!')
    }
  }

  const handleSave = async () => {
    if (!currentDiagram) return

    setIsSaving(true)
    try {
      const token = tokenManager.get()
      if (!token) {
        router.push('/login')
        return
      }

      const diagramData = {
        classes,
        associations
      }
      
      // Save directly using API client
      const updatedDiagram = await apiClient.updateDiagram(
        currentDiagram.id, 
        { diagram_data: diagramData }, 
        token
      )
      
      logger.log('Diagram saved successfully:', updatedDiagram)
      setCurrentDiagram(updatedDiagram)
      setHasUnsavedChanges(false)
      
    } catch (error) {
      logger.error('Error saving diagram:', error)
      // Show error to user (you might want to add a toast notification here)
      alert('Error saving diagram. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      // Limpiar todos los timeouts pendientes
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current)
      }
    }
  }, [])

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        // Remove user-specific and legacy diagram IDs
        const userEmail = tokenManager.getCurrentUserEmail()
        if (userEmail) {
          localStorage.removeItem(`currentDiagramId_${userEmail}`)
        }
        localStorage.removeItem('currentDiagramId')
        router.push('/dashboard')
      }
    } else {
      const userEmail = tokenManager.getCurrentUserEmail()
      if (userEmail) {
        localStorage.removeItem(`currentDiagramId_${userEmail}`)
      }
      localStorage.removeItem('currentDiagramId')
      router.push('/dashboard')
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToDashboard}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            UML Editor {currentDiagram && `- v${currentDiagram.version}`}
          </h1>
          {hasUnsavedChanges && (
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
          {isSharedDiagram && (
            <div className="flex items-center gap-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              <Users className="w-3 h-3" />
              <span>Compartido ({sharedUsers.length} usuarios)</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowJoinModal(true)}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Unirse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareDiagram}
            className="flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <User className="w-4 h-4" />
            <span>{user?.username || user?.email}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      <Toolbar
        classes={classes}
        associations={associations}
        selectedClass={selectedClass}
        onAddClass={addClass}
        onUpdateClass={updateClass}
        onRemoveClass={removeClass}
        onAddAssociation={addAssociation}
        onRemoveAssociation={removeAssociation}
        onSelectClass={setSelectedClass}
      />
      
      <main className="flex-1 overflow-hidden">
        {classes.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-6xl mb-4">📊</div>
              <p className="text-gray-600 dark:text-gray-300 font-medium text-lg mb-2">No hay clases en el diagrama</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {currentDiagram?.id?.startsWith('shared-') 
                  ? 'Diagrama compartido vacío' 
                  : 'Crea tu primera clase o únete a un diagrama compartido'
                }
              </p>
              {!currentDiagram?.id?.startsWith('shared-') && (
                <div className="mt-4 space-y-2">
                  <Button 
                    onClick={() => addClass({ 
                      id: `class-${Date.now()}`,
                      name: 'Nueva Clase', 
                      attributes: [], 
                      position: { x: 100, y: 100 }
                    })}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Crear Primera Clase
                  </Button>
                  <div className="text-xs text-gray-500">
                    O prueba el sistema de compartir:
                  </div>
                  <Button 
                    onClick={() => {
                      // Crear algunas clases de ejemplo con posición
                      addClass({ 
                        id: `class-usuario-${Date.now()}`,
                        name: 'Usuario', 
                        attributes: [
                          { id: `attr-id-${Date.now()}`, name: 'id', type: 'String' },
                          { id: `attr-nombre-${Date.now()}`, name: 'nombre', type: 'String' }
                        ], 
                        position: { x: 100, y: 100 }
                      })
                      addClass({ 
                        id: `class-producto-${Date.now()}`,
                        name: 'Producto', 
                        attributes: [
                          { id: `attr-precio-${Date.now()}`, name: 'precio', type: 'Double' }
                        ], 
                        position: { x: 400, y: 100 }
                      })
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Crear Diagrama de Ejemplo
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <DiagramCanvas
            classes={classes}
            associations={associations}
            selectedClass={selectedClass}
            onUpdateClass={updateClass}
            onSelectClass={setSelectedClass}
            onRemoveAssociation={removeAssociation}
            onUpdateAssociation={updateAssociation}
          />
        )}
      </main>
      
      {/* AI Assistant Components */}
      <AIFabButton onClick={() => setIsAIAssistantOpen(true)} />
      
      {/* Modal Compartir */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Compartir Diagrama</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Token de acceso:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareToken || ""}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700"
                />
                <Button onClick={copyTokenToClipboard} size="sm">
                  Copiar
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Comparte este token con otros usuarios para que puedan editar el diagrama.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowShareModal(false)} className="flex-1">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unirse */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Unirse a Diagrama</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Token de acceso:</label>
              <input
                type="text"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value.toUpperCase())}
                placeholder="Ingresa el token"
                className="w-full px-3 py-2 border rounded-md"
                maxLength={8}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowJoinModal(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleJoinDiagram} className="flex-1" disabled={!joinToken.trim()}>
                Unirse
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <AIAssistantPanel
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        onGenerateClasses={handleGenerateClasses}
        onGenerateAssociations={handleGenerateAssociations}
        onModifyDiagram={handleModifyDiagram}
        existingClasses={classes}
        existingAssociations={associations}
      />
    </div>
  )
}

// Componente principal que exporta el editor dinámico
export default function EditorPage() {
  return <DynamicEditorContent />
}