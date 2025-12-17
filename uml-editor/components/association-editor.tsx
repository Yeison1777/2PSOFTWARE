"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import type { UMLClass, Association, AssociationClass, UMLAttribute, RelationshipType } from "@/types/uml"
import { MULTIPLICITY_OPTIONS, DATA_TYPES, RELATIONSHIP_TYPES } from "@/types/uml"

interface AssociationEditorProps {
  classes: UMLClass[]
  onAddAssociation: (association: Association) => void
  onClose: () => void
}

export function AssociationEditor({ classes, onAddAssociation, onClose }: AssociationEditorProps) {
  const [fromClassId, setFromClassId] = useState<string>("")
  const [toClassId, setToClassId] = useState<string>("")
  const [fromMultiplicity, setFromMultiplicity] = useState<string>("1")
  const [toMultiplicity, setToMultiplicity] = useState<string>("1")
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("association")
  const [inheritanceType, setInheritanceType] = useState<"extends" | "implements">("extends")
  const [cascadeDelete, setCascadeDelete] = useState<boolean>(false)
  const [hasAssociationClass, setHasAssociationClass] = useState<boolean>(false)
  const [associationClassName, setAssociationClassName] = useState<string>("")
  const [associationClassAttributes, setAssociationClassAttributes] = useState<UMLAttribute[]>([])

  // Check if current multiplicities form a Many-to-Many relationship
  const isManyToMany = (fromMultiplicity === "*" || fromMultiplicity === "1..*" || fromMultiplicity === "0..*") &&
                      (toMultiplicity === "*" || toMultiplicity === "1..*" || toMultiplicity === "0..*")

  // Check if association class is applicable (only for associations and many-to-many)
  const canHaveAssociationClass = relationshipType === "association" && isManyToMany

  // Handle relationship type changes
  const handleRelationshipTypeChange = (newType: RelationshipType) => {
    setRelationshipType(newType)
    
    // Reset association class when changing away from association
    if (newType !== "association") {
      setHasAssociationClass(false)
      setAssociationClassName("")
      setAssociationClassAttributes([])
    }
    
    // Set appropriate multiplicities for inheritance
    if (newType === "inheritance") {
      setFromMultiplicity("1")
      setToMultiplicity("1")
    }
  }

  const addAssociationAttribute = () => {
    const newAttribute: UMLAttribute = {
      id: crypto.randomUUID(),
      name: "",
      type: "String"
    }
    setAssociationClassAttributes([...associationClassAttributes, newAttribute])
  }

  const updateAssociationAttribute = (id: string, field: keyof UMLAttribute, value: string) => {
    setAssociationClassAttributes(prev =>
      prev.map(attr => attr.id === id ? { ...attr, [field]: value } : attr)
    )
  }

  const removeAssociationAttribute = (id: string) => {
    setAssociationClassAttributes(prev => prev.filter(attr => attr.id !== id))
  }

  const handleSave = () => {
    if (fromClassId && toClassId && fromClassId !== toClassId) {
      let associationClass: AssociationClass | undefined = undefined
      
      if (hasAssociationClass && associationClassName.trim()) {
        // Calculate position for association class (between the two related classes)
        const fromClass = classes.find(c => c.id === fromClassId)
        const toClass = classes.find(c => c.id === toClassId)
        
        if (fromClass && toClass) {
          const midX = (fromClass.position.x + toClass.position.x) / 2
          const midY = (fromClass.position.y + toClass.position.y) / 2 - 100 // Offset above the line
          
          associationClass = {
            id: crypto.randomUUID(),
            name: associationClassName,
            attributes: associationClassAttributes.filter(attr => attr.name.trim() !== ""),
            position: { x: midX, y: midY }
          }
        }
      }
      
      const newAssociation: Association = {
        id: crypto.randomUUID(),
        fromClassId,
        toClassId,
        fromMultiplicity,
        toMultiplicity,
        relationshipType,
        associationClass,
        ...(relationshipType === "inheritance" && { inheritanceType }),
        ...(relationshipType === "composition" && { cascadeDelete })
      }
      onAddAssociation(newAssociation)
      onClose()
    }
  }

  const canSave = fromClassId && toClassId && fromClassId !== toClassId &&
                 (!hasAssociationClass || associationClassName.trim() !== "")

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Association</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Relationship Type */}
          <div>
            <Label>Relationship Type</Label>
            <Select value={relationshipType} onValueChange={handleRelationshipTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Class */}
          <div>
            <Label>
              {relationshipType === "inheritance" ? "Child Class (inherits from)" : "From Class"}
            </Label>
            <Select value={fromClassId} onValueChange={setFromClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Multiplicity - Hidden for inheritance */}
          {relationshipType !== "inheritance" && (
            <div>
              <Label>From Multiplicity</Label>
              <Select value={fromMultiplicity} onValueChange={setFromMultiplicity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTIPLICITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* To Class */}
          <div>
            <Label>
              {relationshipType === "inheritance" 
                ? "Parent Class (to inherit from)" 
                : relationshipType === "aggregation" 
                  ? "Whole Class (contains)" 
                  : relationshipType === "composition" 
                    ? "Composite Class (owns)" 
                    : "To Class"}
            </Label>
            <Select value={toClassId} onValueChange={setToClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target class" />
              </SelectTrigger>
              <SelectContent>
                {classes
                  .filter((cls) => cls.id !== fromClassId)
                  .map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Multiplicity - Hidden for inheritance */}
          {relationshipType !== "inheritance" && (
            <div>
              <Label>To Multiplicity</Label>
              <Select value={toMultiplicity} onValueChange={setToMultiplicity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTIPLICITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Inheritance Type - Only for inheritance */}
          {relationshipType === "inheritance" && (
            <div>
              <Label>Inheritance Type</Label>
              <Select value={inheritanceType} onValueChange={(value: "extends" | "implements") => setInheritanceType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extends">
                    <div>
                      <div className="font-medium">Extends</div>
                      <div className="text-xs text-muted-foreground">Concrete class inheritance</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="implements">
                    <div>
                      <div className="font-medium">Implements</div>
                      <div className="text-xs text-muted-foreground">Interface implementation</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cascade Delete - Only for composition */}
          {relationshipType === "composition" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cascade-delete"
                checked={cascadeDelete}
                onCheckedChange={(checked) => setCascadeDelete(checked as boolean)}
              />
              <Label htmlFor="cascade-delete" className="text-sm">
                Cascade Delete (When composite is deleted, delete parts)
              </Label>
            </div>
          )}

          {/* Association Class Section (only for Many-to-Many associations) */}
          {canHaveAssociationClass && (
            <>
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="association-class"
                    checked={hasAssociationClass}
                    onCheckedChange={(checked) => {
                      setHasAssociationClass(checked as boolean)
                      if (!checked) {
                        setAssociationClassName("")
                        setAssociationClassAttributes([])
                      }
                    }}
                  />
                  <Label htmlFor="association-class" className="text-sm font-medium">
                    Add Association Class (Many-to-Many)
                  </Label>
                </div>

                {hasAssociationClass && (
                  <div className="space-y-3 pl-6">
                    {/* Association Class Name */}
                    <div>
                      <Label>Association Class Name</Label>
                      <Input
                        value={associationClassName}
                        onChange={(e) => setAssociationClassName(e.target.value)}
                        placeholder="e.g., Enrollment, Assignment"
                      />
                    </div>

                    {/* Association Class Attributes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Attributes</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addAssociationAttribute}
                        >
                          Add Attribute
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {associationClassAttributes.map((attr) => (
                          <div key={attr.id} className="flex gap-2 items-center">
                            <Input
                              value={attr.name}
                              onChange={(e) => updateAssociationAttribute(attr.id, "name", e.target.value)}
                              placeholder="Attribute name"
                              className="flex-1"
                            />
                            <Select
                              value={attr.type}
                              onValueChange={(value) => updateAssociationAttribute(attr.id, "type", value)}
                            >
                              <SelectTrigger className="w-32">
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
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeAssociationAttribute(attr.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Add Association
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
