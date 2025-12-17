"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"
import type { Association, AssociationClass, UMLAttribute } from "@/types/uml"
import { DATA_TYPES } from "@/types/uml"

interface AssociationClassEditorProps {
  association: Association
  onUpdateAssociation: (association: Association) => void
  onClose: () => void
}

export function AssociationClassEditor({ 
  association, 
  onUpdateAssociation, 
  onClose 
}: AssociationClassEditorProps) {
  const [className, setClassName] = useState<string>("")
  const [attributes, setAttributes] = useState<UMLAttribute[]>([])

  useEffect(() => {
    if (association.associationClass) {
      setClassName(association.associationClass.name)
      setAttributes([...association.associationClass.attributes])
    }
  }, [association])

  const addAttribute = () => {
    const newAttribute: UMLAttribute = {
      id: crypto.randomUUID(),
      name: "",
      type: "String"
    }
    setAttributes([...attributes, newAttribute])
  }

  const updateAttribute = (id: string, field: keyof UMLAttribute, value: string) => {
    setAttributes(prev =>
      prev.map(attr => attr.id === id ? { ...attr, [field]: value } : attr)
    )
  }

  const removeAttribute = (id: string) => {
    setAttributes(prev => prev.filter(attr => attr.id !== id))
  }

  const handleSave = () => {
    if (className.trim() && association.associationClass) {
      const updatedAssociationClass: AssociationClass = {
        ...association.associationClass,
        name: className,
        attributes: attributes.filter(attr => attr.name.trim() !== "")
      }

      const updatedAssociation: Association = {
        ...association,
        associationClass: updatedAssociationClass
      }

      onUpdateAssociation(updatedAssociation)
      onClose()
    }
  }

  const handleRemoveAssociationClass = () => {
    const updatedAssociation: Association = {
      ...association,
      associationClass: undefined
    }
    onUpdateAssociation(updatedAssociation)
    onClose()
  }

  const canSave = className.trim() !== ""

  if (!association.associationClass) {
    return null
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Edit Association Class
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveAssociationClass}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Association Class
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Class Name */}
          <div>
            <Label htmlFor="className">Association Class Name</Label>
            <Input
              id="className"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Enter association class name"
            />
          </div>

          {/* Attributes Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">Attributes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAttribute}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Attribute
              </Button>
            </div>

            {attributes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No attributes defined. Click "Add Attribute" to add some.
              </p>
            ) : (
              <div className="space-y-3">
                {attributes.map((attr, index) => (
                  <div key={attr.id} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-sm">Attribute Name</Label>
                      <Input
                        value={attr.name}
                        onChange={(e) => updateAttribute(attr.id, "name", e.target.value)}
                        placeholder="Enter attribute name"
                      />
                    </div>
                    
                    <div className="w-40">
                      <Label className="text-sm">Type</Label>
                      <Select
                        value={attr.type}
                        onValueChange={(value) => updateAttribute(attr.id, "type", value)}
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
                    
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAttribute(attr.id)}
                      className="mb-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}