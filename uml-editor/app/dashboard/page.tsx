"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectManager } from '@/components/project-manager'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useProjects } from '@/contexts/project-context'
import { ArrowRight, LogOut, User } from 'lucide-react'
import type { Diagram } from '@/lib/api-client'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { currentProject, currentDiagram, projects, diagrams } = useProjects()
  const router = useRouter()
  const [selectedDiagram, setSelectedDiagram] = useState<Diagram | null>(null)
  const [mounted, setMounted] = useState(false)

  // Prevenir problemas de hidratación
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelectDiagram = (diagram: Diagram) => {
    setSelectedDiagram(diagram)
  }

  const handleOpenEditor = () => {
    if (selectedDiagram && user) {
      // Store the selected diagram in localStorage with user prefix
      const userEmail = user.email
      if (userEmail) {
        localStorage.setItem(`currentDiagramId_${userEmail}`, selectedDiagram.id)
      }
      localStorage.setItem('currentDiagramId', selectedDiagram.id) // Fallback
      router.push('/editor')
    }
  }

  // Prevenir renderizado en servidor si hay datos del cliente
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-3" suppressHydrationWarning>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white" suppressHydrationWarning>
            Panel de Editor UML
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <User className="w-4 h-4" />
            <span suppressHydrationWarning>
              {mounted ? (user?.username || user?.email || 'Usuario') : 'Usuario'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Manager - Takes 2 columns */}
          <div className="lg:col-span-2">
            <ProjectManager onSelectDiagram={handleSelectDiagram} />
          </div>

          {/* Action Panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>

              {currentProject ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Proyecto Actual
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300" suppressHydrationWarning>
                      {currentProject.name}
                    </p>
                  </div>

                  {selectedDiagram ? (
                    <>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Diagrama Seleccionado
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300" suppressHydrationWarning>
                          Versión {selectedDiagram.version}
                        </p>
                      </div>

                      <Button
                        onClick={handleOpenEditor}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        Abrir en Editor
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Selecciona un diagrama para abrirlo en el editor
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-4">
                    Crea o selecciona un proyecto para comenzar
                  </p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Estadísticas</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Proyectos</span>
                  <span className="font-medium" suppressHydrationWarning>
                    {mounted ? projects.length : 0}
                  </span>
                </div>
                {currentProject && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Diagramas</span>
                    <span className="font-medium" suppressHydrationWarning>
                      {mounted ? diagrams.length : 0}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}