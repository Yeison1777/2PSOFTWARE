"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useProjects } from '@/contexts/project-context'
import { FolderPlus, Folder, FileText, Plus, Loader2, Trash2, Share2 } from 'lucide-react'
import type { Project, Diagram } from '@/lib/api-client'
import { logger } from '@/lib/logger'

interface ProjectManagerProps {
  onSelectDiagram?: (diagram: Diagram) => void
}

export function ProjectManager({ onSelectDiagram }: ProjectManagerProps) {
  const {
    projects,
    currentProject,
    isLoadingProjects,
    createProject,
    selectProject,
    deleteProject,
    diagrams,
    currentDiagram,
    isLoadingDiagrams,
    createDiagram,
    deleteDiagram,
    error,
    clearError
  } = useProjects()

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [isCreateDiagramOpen, setIsCreateDiagramOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState<string | null>(null)
  const [isDeletingDiagram, setIsDeletingDiagram] = useState<string | null>(null)

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return

    setIsCreatingProject(true)
    try {
      const projectData = { name: projectName.trim() }

      const newProject = await createProject(projectData)
      setProjectName('')
      setIsCreateProjectOpen(false)
      selectProject(newProject) // Auto-select the new project
    } catch (error) {
      logger.error('Project creation failed in component:', error)
      // Error is handled by the context
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleCreateDiagram = async () => {
    if (!currentProject) return

    setIsCreatingDiagram(true)
    try {
      const newDiagram = await createDiagram({
        project_id: currentProject.id,
        diagram_data: { classes: [], associations: [] } // Empty diagram
      })
      setIsCreateDiagramOpen(false)

      if (onSelectDiagram) {
        onSelectDiagram(newDiagram)
      }
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsCreatingDiagram(false)
    }
  }

  const handleSelectDiagram = (diagram: Diagram) => {
    if (onSelectDiagram) {
      onSelectDiagram(diagram)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    setIsDeletingProject(projectId)
    try {
      await deleteProject(projectId)
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsDeletingProject(null)
    }
  }

  const handleDeleteDiagram = async (diagramId: string) => {
    setIsDeletingDiagram(diagramId)
    try {
      await deleteDiagram(diagramId)
    } catch (error) {
      // Error is handled by the context
    } finally {
      setIsDeletingDiagram(null)
    }
  }

  // Verificar si un diagrama está compartido
  const isDiagramShared = (diagramId: string): boolean => {
    if (typeof window === 'undefined') return false
    
    try {
      // Si el ID mismo es un token compartido (empieza con "shared-")
      if (diagramId.startsWith('shared-')) {
        return true
      }
      
      // Verificar en localStorage si hay tokens compartidos para este diagrama
      const globalTokens = localStorage.getItem('global-shared-tokens')
      if (globalTokens) {
        const tokensObj = JSON.parse(globalTokens) as Record<string, any>
        // Buscar si algún token apunta a este diagrama
        for (const token in tokensObj) {
          const tokenData = tokensObj[token]
          if (tokenData.diagramId === diagramId && tokenData.isActive) {
            return true
          }
        }
      }
      
      // También verificar tokens individuales
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('shared-token-')) {
          try {
            const sharedData = JSON.parse(localStorage.getItem(key) || '{}')
            if (sharedData.diagramId === diagramId && sharedData.isActive) {
              return true
            }
          } catch {
            // Ignorar errores de parsing
          }
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <div>
              {error}
              {error.includes('session has expired') && (
                <div className="mt-2">
                  <Button size="sm" onClick={() => window.location.reload()}>
                    Recargar Página
                  </Button>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              ×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Projects Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Proyectos
              </CardTitle>
              <CardDescription>
                Gestiona tus proyectos UML
              </CardDescription>
            </div>
            <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4" />
                  Nuevo Proyecto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
                  <DialogDescription>
                    Ingresa un nombre para tu nuevo proyecto UML.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Nombre del Proyecto</Label>
                    <Input
                      id="projectName"
                      placeholder="Mi Proyecto UML"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                      disabled={isCreatingProject}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateProjectOpen(false)}
                      disabled={isCreatingProject}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isCreatingProject}>
                      {isCreatingProject ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Proyecto'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingProjects ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Cargando proyectos...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No se encontraron proyectos. Crea tu primer proyecto para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 rounded-lg border transition-colors ${currentProject?.id === project.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => selectProject(project)}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{project.name}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Creado {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                          disabled={isDeletingProject === project.id}
                        >
                          {isDeletingProject === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar Proyecto</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de que quieres eliminar "{project.name}"? Esta acción no se puede deshacer y eliminará todos los diagramas en este proyecto.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteProject(project.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar Proyecto
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagrams Section */}
      {currentProject && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Diagramas
                </CardTitle>
                <CardDescription>
                  Diagramas en {currentProject.name}
                </CardDescription>
              </div>
              <Dialog open={isCreateDiagramOpen} onOpenChange={setIsCreateDiagramOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nuevo Diagrama
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Diagrama</DialogTitle>
                    <DialogDescription>
                      Crea un nuevo diagrama UML en {currentProject.name}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDiagramOpen(false)}
                      disabled={isCreatingDiagram}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateDiagram} disabled={isCreatingDiagram}>
                      {isCreatingDiagram ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Diagrama'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDiagrams ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Cargando diagramas...</span>
              </div>
            ) : diagrams.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No se encontraron diagramas. Crea tu primer diagrama para comenzar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {diagrams.map((diagram) => (
                  <div
                    key={diagram.id}
                    className={`p-3 rounded-lg border transition-colors ${currentDiagram?.id === diagram.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleSelectDiagram(diagram)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              Diagrama v{diagram.version}
                            </span>
                            {isDiagramShared(diagram.id) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                                <Share2 className="w-3 h-3" />
                                Compartido
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(diagram.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Última modificación {new Date(diagram.updated_at).toLocaleString()}
                        </p>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                            disabled={isDeletingDiagram === diagram.id}
                          >
                            {isDeletingDiagram === diagram.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar Diagrama</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que quieres eliminar "Diagrama v{diagram.version}"? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDiagram(diagram.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Eliminar Diagrama
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}