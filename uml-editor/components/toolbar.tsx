"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { 
  Plus, 
  Download, 
  Trash2, 
  GitBranch, 
  Box,
  Layers,
  Code,
  FileText,
  Settings,
  Zap
} from "lucide-react"
import { ClassEditor } from "./class-editor"
import { AssociationEditor } from "./association-editor"
import { CodePreview } from "./code-preview"
import type { UMLClass, Association } from "@/types/uml"
import { generateSpringBootCode } from "@/lib/code-generator"

interface ToolbarProps {
  classes: UMLClass[]
  associations: Association[]
  selectedClass: string | null
  onAddClass: (newClass: UMLClass) => void
  onUpdateClass: (id: string, updatedClass: Partial<UMLClass>) => void
  onRemoveClass: (id: string) => void
  onAddAssociation: (association: Association) => void
  onRemoveAssociation: (id: string) => void
  onSelectClass: (id: string | null) => void
}

export function Toolbar({
  classes,
  associations,
  selectedClass,
  onAddClass,
  onUpdateClass,
  onRemoveClass,
  onAddAssociation,
  onRemoveAssociation,
  onSelectClass,
}: ToolbarProps) {
  const [showClassEditor, setShowClassEditor] = useState(false)
  const [editingClass, setEditingClass] = useState<UMLClass | null>(null)
  const [showAssociationEditor, setShowAssociationEditor] = useState(false)
  const [showCodePreview, setShowCodePreview] = useState(false)
  const [newClassName, setNewClassName] = useState("")
  const [showAddClassInput, setShowAddClassInput] = useState(false)

  const handleAddClass = () => {
    setShowAddClassInput(true)
  }

  const handleCreateClass = () => {
    if (newClassName.trim()) {
      const newClass: UMLClass = {
        id: crypto.randomUUID(),
        name: newClassName.trim(),
        attributes: [],
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      }
      onAddClass(newClass)
      setNewClassName("")
      setShowAddClassInput(false)
    }
  }

  const handleEditClass = (umlClass: UMLClass) => {
    setEditingClass(umlClass)
    setShowClassEditor(true)
  }

  const handleDeleteSelectedClass = () => {
    if (selectedClass) {
      onRemoveClass(selectedClass)
      onSelectClass(null)
    }
  }

  const handleGenerateCode = () => {
    const generatedCode = generateSpringBootCode(classes, associations)
    setShowCodePreview(true)
  }

  const selectedClassData = selectedClass 
    ? classes.find(c => c.id === selectedClass)
    : null

  return (
    <>
      <div className="h-16 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-6 flex items-center justify-between shadow-sm">
        {/* Left Section - Main Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              UML Designer
            </span>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex items-center gap-2">
            {!showAddClassInput ? (
              <Button
                onClick={handleAddClass}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border rounded-md px-3 py-1">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleCreateClass()
                    } else if (e.key === "Escape") {
                      setShowAddClassInput(false)
                      setNewClassName("")
                    }
                  }}
                  placeholder="Class name..."
                  className="text-sm bg-transparent border-0 outline-none focus:ring-0 w-32"
                  autoFocus
                />
                <Button
                  onClick={handleCreateClass}
                  size="sm"
                  disabled={!newClassName.trim()}
                  className="h-6 px-2 text-xs"
                >
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setShowAddClassInput(false)
                    setNewClassName("")
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            <Button
              onClick={() => setShowAssociationEditor(true)}
              variant="outline"
              size="sm"
              disabled={classes.length < 2}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <GitBranch className="w-4 h-4 mr-2" />
              Add Relation
            </Button>

            {selectedClass && (
              <Button
                onClick={handleDeleteSelectedClass}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Center Section - Stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Classes</span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {classes.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span>Relations</span>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {associations.length}
            </Badge>
          </div>

          {selectedClassData && (
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4" />
              <span>Selected:</span>
              <Badge variant="outline" className="border-green-200 text-green-700 dark:border-green-800 dark:text-green-300">
                {selectedClassData.name}
              </Badge>
            </div>
          )}
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          {selectedClassData && (
            <Button
              onClick={() => handleEditClass(selectedClassData)}
              variant="outline"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit Class
            </Button>
          )}

          <Button
            onClick={handleGenerateCode}
            variant="outline"
            size="sm"
            disabled={classes.length === 0}
            className="border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950"
          >
            <Code className="w-4 h-4 mr-2" />
            Generate Code
          </Button>

          <Button
            onClick={handleGenerateCode}
            disabled={classes.length === 0}
            size="sm"
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Modals */}
      {showClassEditor && editingClass && (
        <ClassEditor
          classId={editingClass.id}
          classes={classes}
          onUpdateClass={onUpdateClass}
          onClose={() => {
            setShowClassEditor(false)
            setEditingClass(null)
          }}
        />
      )}

      {showAssociationEditor && (
        <AssociationEditor
          classes={classes}
          onAddAssociation={onAddAssociation}
          onClose={() => setShowAssociationEditor(false)}
        />
      )}

      {showCodePreview && (
        <CodePreview
          generatedCode={generateSpringBootCode(classes, associations)}
          classes={classes}
          associations={associations}
          onClose={() => setShowCodePreview(false)}
        />
      )}
    </>
  )
}