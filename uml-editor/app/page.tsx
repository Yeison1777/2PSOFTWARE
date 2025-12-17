"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DiagramCanvas } from "@/components/diagram-canvas"
import { Toolbar } from "@/components/toolbar"
import { AIAssistantPanel } from "@/components/ai-assistant-panel"
import { AIFabButton } from "@/components/ai-fab-button"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"
import type { UMLClass, Association } from "@/types/uml"

function LoadingSpinner() {
  // Texto fijo que coincide en SSR y cliente para evitar errores de hidratación
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-600">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  )
}

function UMLEditor() {
  const [classes, setClasses] = useState<UMLClass[]>([])
  const [associations, setAssociations] = useState<Association[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false)

  const addClass = (newClass: UMLClass) => {
    setClasses((prev) => [...prev, newClass])
  }

  const updateClass = (id: string, updatedClass: Partial<UMLClass>) => {
    setClasses((prev) => prev.map((cls) => (cls.id === id ? { ...cls, ...updatedClass } : cls)))
  }

  const removeClass = (id: string) => {
    setClasses((prev) => prev.filter((cls) => cls.id !== id))
    setAssociations((prev) => prev.filter((assoc) => assoc.fromClassId !== id && assoc.toClassId !== id))
    if (selectedClass === id) {
      setSelectedClass(null)
    }
  }

  const addAssociation = (association: Association) => {
    setAssociations((prev) => [...prev, association])
  }

  const updateAssociation = (updatedAssociation: Association) => {
    setAssociations((prev) => 
      prev.map((assoc) => assoc.id === updatedAssociation.id ? updatedAssociation : assoc)
    )
  }

  const removeAssociation = (id: string) => {
    setAssociations((prev) => prev.filter((assoc) => assoc.id !== id))
  }

  const handleGenerateClasses = (newClasses: UMLClass[]) => {
    setClasses((prev) => [...prev, ...newClasses])
  }

  const { user, logout } = useAuth()

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header with user info and logout */}
      <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">UML Editor</h1>
        </div>
        <div className="flex items-center gap-3">
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
        <DiagramCanvas
          classes={classes}
          associations={associations}
          selectedClass={selectedClass}
          onUpdateClass={updateClass}
          onSelectClass={setSelectedClass}
          onRemoveAssociation={removeAssociation}
          onUpdateAssociation={updateAssociation}
        />
      </main>
      
      {/* AI Assistant Components */}
      <AIFabButton onClick={() => setIsAIAssistantOpen(true)} />
      <AIAssistantPanel
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        onGenerateClasses={handleGenerateClasses}
        onGenerateAssociations={setAssociations}
      />
    </div>
  )
}

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login')
      } else {
        router.push('/dashboard')
      }
    }
  }, [user, isLoading, router])

  return <LoadingSpinner />
}
