"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type { UMLClass, UMLAttribute, DataType } from "@/types/uml"
import { DATA_TYPES } from "@/types/uml"

interface ClassEditorProps {
  classId: string
  classes: UMLClass[]
  onUpdateClass: (id: string, updates: Partial<UMLClass>) => void
  onClose: () => void
}

export function ClassEditor({ classId, classes, onUpdateClass, onClose }: ClassEditorProps) {
  const currentClass = classes.find((c) => c.id === classId)
  const [className, setClassName] = useState(currentClass?.name || "")
  const [attributes, setAttributes] = useState<UMLAttribute[]>(currentClass?.attributes || [])

  useEffect(() => {
    if (currentClass) {
      setClassName(currentClass.name)
      setAttributes(currentClass.attributes)
    }
  }, [currentClass])

  const addAttribute = () => {
    const newAttribute: UMLAttribute = {
      id: crypto.randomUUID(),
      name: "",
      type: "String",
    }
    setAttributes([...attributes, newAttribute])
  }

  const updateAttribute = (id: string, field: keyof UMLAttribute, value: string | DataType) => {
    setAttributes(attributes.map((attr) => (attr.id === id ? { ...attr, [field]: value } : attr)))
  }

  const removeAttribute = (id: string) => {
    setAttributes(attributes.filter((attr) => attr.id !== id))
  }

  const handleSave = () => {
    if (className.trim()) {
      onUpdateClass(classId, {
        name: className.trim(),
        attributes: attributes.filter((attr) => attr.name.trim() !== ""),
      })
      onClose()
    }
  }

  if (!currentClass) return null

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Class: {currentClass.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Class Name */}
          <div>
            <Label htmlFor="editClassName">Class Name</Label>
            <Input
              id="editClassName"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Enter class name"
            />
          </div>

          {/* Attributes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Attributes</Label>
              <Button onClick={addAttribute} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Attribute
              </Button>
            </div>

            <div className="space-y-3">
              {attributes.map((attr) => (
                <div key={attr.id} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label htmlFor={`attr-name-${attr.id}`}>Name</Label>
                    <Input
                      id={`attr-name-${attr.id}`}
                      value={attr.name}
                      onChange={(e) => updateAttribute(attr.id, "name", e.target.value)}
                      placeholder="Attribute name"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={`attr-type-${attr.id}`}>Type</Label>
                    <Select
                      value={attr.type}
                      onValueChange={(value: DataType) => updateAttribute(attr.id, "type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => removeAttribute(attr.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {attributes.length === 0 && <p className="text-muted-foreground text-sm">No attributes added yet</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!className.trim()}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
