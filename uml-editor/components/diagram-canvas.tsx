"use client"

import type React from "react"

import { useRef, useState, useCallback, useMemo, memo, useEffect } from "react"
import type { UMLClass, Association } from "@/types/uml"
import { logger } from "@/lib/logger"
import { ClassNode } from "./class-node"
import { AssociationLine } from "./association-line"
import { AssociationClassEditor } from "./association-class-editor"
import { ClassEditor } from "./class-editor"


interface DiagramCanvasProps {
  classes: UMLClass[]
  associations: Association[]
  selectedClass: string | null
  onUpdateClass: (id: string, updates: Partial<UMLClass>) => void
  onSelectClass: (id: string | null) => void
  onRemoveAssociation?: (id: string) => void
  onUpdateAssociation?: (association: Association) => void
}

function DiagramCanvasComponent({
  classes,
  associations,
  selectedClass,
  onUpdateClass,
  onSelectClass,
  onRemoveAssociation,
  onUpdateAssociation,
}: DiagramCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggedClass, setDraggedClass] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [editingAssociationId, setEditingAssociationId] = useState<string | null>(null)
  const [editingClassId, setEditingClassId] = useState<string | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, classId: string) => {
      e.preventDefault()
      const classElement = e.currentTarget as HTMLElement
      const rect = classElement.getBoundingClientRect()
      const canvasRect = canvasRef.current?.getBoundingClientRect()

      if (canvasRect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
        setDraggedClass(classId)
        onSelectClass(classId)
      }
    },
    [onSelectClass],
  )

  const rafRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<{ x: number; y: number } | null>(null)
  const pendingUpdateRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggedClass && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect()
        const newX = Math.max(0, e.clientX - canvasRect.left - dragOffset.x)
        const newY = Math.max(0, e.clientY - canvasRect.top - dragOffset.y)

        // Guardar la actualización pendiente
        pendingUpdateRef.current = { id: draggedClass, x: newX, y: newY }

        // Throttle más agresivo: solo actualizar cada 16ms (60fps) y con mínimo de 5px de diferencia
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            const pending = pendingUpdateRef.current
            if (pending) {
              const lastPos = lastUpdateRef.current
              // Solo actualizar si cambió más de 5px para reducir actualizaciones
              if (!lastPos || Math.abs(lastPos.x - pending.x) > 5 || Math.abs(lastPos.y - pending.y) > 5) {
                lastUpdateRef.current = { x: pending.x, y: pending.y }
                // Usar setTimeout para diferir la actualización fuera del frame de animación
                if (throttleTimeoutRef.current) {
                  clearTimeout(throttleTimeoutRef.current)
                }
                throttleTimeoutRef.current = setTimeout(() => {
                  onUpdateClass(pending.id, {
                    position: { x: pending.x, y: pending.y },
                  })
                }, 0)
              }
            }
            rafRef.current = null
          })
        }
      }
    },
    [draggedClass, dragOffset, onUpdateClass],
  )

  const handleMouseUp = useCallback(() => {
    // Aplicar última actualización pendiente antes de soltar
    const pending = pendingUpdateRef.current
    if (pending) {
      onUpdateClass(pending.id, {
        position: { x: pending.x, y: pending.y },
      })
      pendingUpdateRef.current = null
    }

    // Limpiar todas las referencias y timeouts
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current)
      throttleTimeoutRef.current = null
    }
    lastUpdateRef.current = null
    setDraggedClass(null)
    setDragOffset({ x: 0, y: 0 })
  }, [onUpdateClass])

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      // Limpiar todas las referencias y timeouts al desmontar
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [])

  const handleCanvasClick = useCallback(() => {
    onSelectClass(null)
  }, [onSelectClass])

  const handleEditAssociationClass = useCallback((associationId: string) => {
    setEditingAssociationId(associationId)
  }, [])

  const handleUpdateAssociation = useCallback((association: Association) => {
    if (onUpdateAssociation) {
      onUpdateAssociation(association)
    }
    setEditingAssociationId(null)
  }, [onUpdateAssociation])

  const handleClassContextMenu = useCallback((e: React.MouseEvent, umlClass: UMLClass) => {
    setEditingClassId(umlClass.id)
  }, [])

  const handleUpdateEditingClass = useCallback((id: string, updates: Partial<UMLClass>) => {
    onUpdateClass(id, updates)
    setEditingClassId(null)
  }, [onUpdateClass])

  const editingAssociation = editingAssociationId 
    ? associations.find(a => a.id === editingAssociationId)
    : null

  const editingClass = editingClassId 
    ? classes.find(c => c.id === editingClassId)
    : null

  // Filtrar duplicados y memoizar las listas para evitar re-renders innecesarios y conflictos DOM
  const memoizedClasses = useMemo(() => {
    // Filtrar clases duplicadas por ID, manteniendo solo la primera ocurrencia
    const seen = new Set<string>()
    return classes.filter(cls => {
      if (seen.has(cls.id)) {
        logger.warn(`Duplicate class ID detected: ${cls.id}. Removing duplicate.`)
        return false
      }
      seen.add(cls.id)
      return true
    })
  }, [classes])
  
  const memoizedAssociations = useMemo(() => {
    // Filtrar asociaciones duplicadas por ID, manteniendo solo la primera ocurrencia
    const seen = new Set<string>()
    return associations.filter(assoc => {
      if (seen.has(assoc.id)) {
        logger.warn(`Duplicate association ID detected: ${assoc.id}. Removing duplicate.`)
        return false
      }
      seen.add(assoc.id)
      return true
    })
  }, [associations])

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-auto cursor-default bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20px 20px, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* SVG container for association lines - memoizado */}
      <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 1 }}>
        <g className="pointer-events-auto">
          {memoizedAssociations.map((association, index) => (
            <AssociationLine
              key={`assoc-${association.id}-${index}`}
              association={association}
              classes={memoizedClasses}
              onRemoveAssociation={onRemoveAssociation}
              onEditAssociationClass={handleEditAssociationClass}
            />
          ))}
        </g>
      </svg>

      {/* Render classes - usar lista memoizada para estabilidad */}
      {memoizedClasses.map((umlClass, index) => (
        <ClassNode
          key={`class-${umlClass.id}-${index}`}
          umlClass={umlClass}
          isSelected={selectedClass === umlClass.id}
          onMouseDown={(e) => handleMouseDown(e, umlClass.id)}
          onContextMenu={handleClassContextMenu}
        />
      ))}

      {/* Instructions overlay when no classes exist */}
      {classes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Welcome to UML Designer
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Create your first class to start designing your UML diagram
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border rounded text-xs">+</kbd>
                <span>Add Class</span>
              </div>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-white dark:bg-slate-800 border rounded text-xs">Right Click</kbd>
                <span>Edit Class</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Association Class Editor */}
      {editingAssociation && editingAssociation.associationClass && (
        <AssociationClassEditor
          association={editingAssociation}
          onUpdateAssociation={handleUpdateAssociation}
          onClose={() => setEditingAssociationId(null)}
        />
      )}

      {/* Class Editor */}
      {editingClassId && (
        <ClassEditor
          classId={editingClassId}
          classes={classes}
          onUpdateClass={handleUpdateEditingClass}
          onClose={() => setEditingClassId(null)}
        />
      )}
    </div>
  )
}

// Memoizar el componente para evitar re-renders innecesarios
export const DiagramCanvas = memo(DiagramCanvasComponent)

