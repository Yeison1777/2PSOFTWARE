import type { UMLClass, Association } from "@/types/uml"

// Interfaces for diagram validation
export interface UMLAssociationJSON {
  id: string
  fromClassId: string
  toClassId: string
  fromMultiplicity: string
  toMultiplicity: string
  relationshipType: "association" | "inheritance" | "aggregation" | "composition"
  inheritanceType?: "extends" | "implements"
  cascadeDelete?: boolean
  associationClass?: {
    id: string
    name: string
    attributes: Array<{
      id: string
      name: string
      type: string
      visibility: "public" | "private" | "protected"
    }>
    position: { x: number; y: number }
  }
}

export interface UMLDiagramJSON {
  classes: UMLClass[]
  associations: UMLAssociationJSON[]
}

/**
 * Validates if the provided JSON string represents a valid array of UMLClass objects
 */
export function validateUMLClassesJSON(jsonString: string): { 
  isValid: boolean
  classes?: UMLClass[]
  error?: string 
} {
  try {
    const parsed = JSON.parse(jsonString)
    
    // Check if it's an array
    if (!Array.isArray(parsed)) {
      return {
        isValid: false,
        error: "JSON must be an array of classes"
      }
    }

    // Validate each class object
    for (const [index, cls] of parsed.entries()) {
      const validation = validateUMLClass(cls, index)
      if (!validation.isValid) {
        return validation
      }
    }

    return {
      isValid: true,
      classes: parsed as UMLClass[]
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Validates a single UMLClass object
 */
function validateUMLClass(cls: any, index: number): { isValid: boolean; error?: string } {
  if (typeof cls !== 'object' || cls === null) {
    return {
      isValid: false,
      error: `Class at index ${index} must be an object`
    }
  }

  // Required fields
  if (!cls.id || typeof cls.id !== 'string') {
    return {
      isValid: false,
      error: `Class at index ${index} missing required field 'id' (string)`
    }
  }

  if (!cls.name || typeof cls.name !== 'string') {
    return {
      isValid: false,
      error: `Class at index ${index} missing required field 'name' (string)`
    }
  }

  if (!cls.attributes || !Array.isArray(cls.attributes)) {
    return {
      isValid: false,
      error: `Class at index ${index} missing required field 'attributes' (array)`
    }
  }

  if (!cls.position || typeof cls.position !== 'object') {
    return {
      isValid: false,
      error: `Class at index ${index} missing required field 'position' (object)`
    }
  }

  if (typeof cls.position.x !== 'number' || typeof cls.position.y !== 'number') {
    return {
      isValid: false,
      error: `Class at index ${index} position must have numeric x and y coordinates`
    }
  }

  // Validate attributes
  for (const [attrIndex, attr] of cls.attributes.entries()) {
    if (!attr.id || typeof attr.id !== 'string') {
      return {
        isValid: false,
        error: `Attribute ${attrIndex} in class '${cls.name}' missing required field 'id' (string)`
      }
    }

    if (!attr.name || typeof attr.name !== 'string') {
      return {
        isValid: false,
        error: `Attribute ${attrIndex} in class '${cls.name}' missing required field 'name' (string)`
      }
    }

    if (!attr.type || typeof attr.type !== 'string') {
      return {
        isValid: false,
        error: `Attribute ${attrIndex} in class '${cls.name}' missing required field 'type' (string)`
      }
    }

    // Validate type against allowed DataTypes
    const allowedTypes = ["String", "Integer", "Boolean", "Double", "Long", "Date", "LocalDateTime"]
    if (!allowedTypes.includes(attr.type)) {
      return {
        isValid: false,
        error: `Attribute '${attr.name}' in class '${cls.name}' has invalid type '${attr.type}'. Allowed: ${allowedTypes.join(', ')}`
      }
    }
  }

  return { isValid: true }
}

/**
 * Validates if the provided JSON string represents valid UML associations
 */
export function validateUMLAssociationsJSON(jsonString: string, classIds: string[]): { 
  isValid: boolean
  associations?: UMLAssociationJSON[]
  error?: string 
} {
  try {
    const parsed = JSON.parse(jsonString)
    
    if (!Array.isArray(parsed)) {
      return {
        isValid: false,
        error: "JSON must be an array of associations"
      }
    }

    for (const [index, assoc] of parsed.entries()) {
      const validation = validateUMLAssociation(assoc, index, classIds)
      if (!validation.isValid) {
        return validation
      }
    }

    return {
      isValid: true,
      associations: parsed as UMLAssociationJSON[]
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Validates a complete UML diagram with classes and associations
 */
export function validateUMLDiagramJSON(jsonString: string): {
  isValid: boolean
  diagram?: UMLDiagramJSON
  error?: string
} {
  try {
    const data = JSON.parse(jsonString) as UMLDiagramJSON

    // Validate classes
    const classValidation = validateUMLClassesJSON(JSON.stringify(data.classes))
    if (!classValidation.isValid) {
      return { isValid: false, error: `Classes validation failed: ${classValidation.error}` }
    }

    // Validate associations if present
    if (data.associations) {
      if (!Array.isArray(data.associations)) {
        return { isValid: false, error: "associations must be an array" }
      }

      const classIds = data.classes.map(c => c.id)
      const assocValidation = validateUMLAssociationsJSON(JSON.stringify(data.associations), classIds)
      if (!assocValidation.isValid) {
        return { isValid: false, error: `Associations validation failed: ${assocValidation.error}` }
      }
    }

    return { isValid: true, diagram: data }
  } catch (error) {
    return { isValid: false, error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Validates a single UML Association object
 */
function validateUMLAssociation(assoc: any, index: number, classIds: string[]): { isValid: boolean; error?: string } {
  if (typeof assoc !== 'object' || assoc === null) {
    return {
      isValid: false,
      error: `Association at index ${index} must be an object`
    }
  }

  // Required fields
  if (!assoc.id || typeof assoc.id !== 'string') {
    return {
      isValid: false,
      error: `Association at index ${index} missing required field 'id' (string)`
    }
  }

  if (!assoc.fromClassId || typeof assoc.fromClassId !== 'string') {
    return {
      isValid: false,
      error: `Association at index ${index} missing required field 'fromClassId' (string)`
    }
  }

  if (!assoc.toClassId || typeof assoc.toClassId !== 'string') {
    return {
      isValid: false,
      error: `Association at index ${index} missing required field 'toClassId' (string)`
    }
  }

  // Validate class IDs exist
  if (!classIds.includes(assoc.fromClassId)) {
    return {
      isValid: false,
      error: `Association ${index}: fromClassId "${assoc.fromClassId}" does not exist`
    }
  }

  if (!classIds.includes(assoc.toClassId)) {
    return {
      isValid: false,
      error: `Association ${index}: toClassId "${assoc.toClassId}" does not exist`
    }
  }

  // Validate relationship type
  const validRelationships = ["association", "inheritance", "aggregation", "composition"]
  if (!validRelationships.includes(assoc.relationshipType)) {
    return {
      isValid: false,
      error: `Association ${index}: relationshipType must be one of: ${validRelationships.join(", ")}`
    }
  }

  // Validate multiplicities
  const validMultiplicities = ["1", "*", "0..1", "1..*", "0..*"]
  if (!validMultiplicities.includes(assoc.fromMultiplicity)) {
    return {
      isValid: false,
      error: `Association ${index}: fromMultiplicity must be one of: ${validMultiplicities.join(", ")}`
    }
  }

  if (!validMultiplicities.includes(assoc.toMultiplicity)) {
    return {
      isValid: false,
      error: `Association ${index}: toMultiplicity must be one of: ${validMultiplicities.join(", ")}`
    }
  }

  return { isValid: true }
}

/**
 * Example of valid JSON format for classes only
 */
export const EXAMPLE_CLASSES_JSON = `[
  {
    "id": "user-1",
    "name": "User",
    "attributes": [
      { "id": "attr-1", "name": "id", "type": "Long" },
      { "id": "attr-2", "name": "email", "type": "String" },
      { "id": "attr-3", "name": "password", "type": "String" }
    ],
    "position": { "x": 100, "y": 100 }
  },
  {
    "id": "product-1",
    "name": "Product",
    "attributes": [
      { "id": "attr-4", "name": "id", "type": "Long" },
      { "id": "attr-5", "name": "name", "type": "String" },
      { "id": "attr-6", "name": "price", "type": "Double" }
    ],
    "position": { "x": 300, "y": 100 }
  }
]`

/**
 * Example of valid JSON format for complete diagram
 */
export const EXAMPLE_DIAGRAM_JSON = `{
  "classes": [
    {
      "id": "user-1",
      "name": "User",
      "attributes": [
        { "id": "attr-1", "name": "id", "type": "Long" },
        { "id": "attr-2", "name": "username", "type": "String" },
        { "id": "attr-3", "name": "email", "type": "String" }
      ],
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "product-1",
      "name": "Product", 
      "attributes": [
        { "id": "attr-4", "name": "id", "type": "Long" },
        { "id": "attr-5", "name": "name", "type": "String" },
        { "id": "attr-6", "name": "price", "type": "Double" }
      ],
      "position": { "x": 400, "y": 100 }
    },
    {
      "id": "order-1",
      "name": "Order",
      "attributes": [
        { "id": "attr-7", "name": "id", "type": "Long" },
        { "id": "attr-8", "name": "date", "type": "Date" },
        { "id": "attr-9", "name": "total", "type": "Double" }
      ],
      "position": { "x": 250, "y": 300 }
    }
  ],
  "associations": [
    {
      "id": "assoc-1",
      "fromClassId": "user-1",
      "toClassId": "order-1",
      "fromMultiplicity": "1",
      "toMultiplicity": "*",
      "relationshipType": "association"
    },
    {
      "id": "assoc-2", 
      "fromClassId": "order-1",
      "toClassId": "product-1",
      "fromMultiplicity": "*",
      "toMultiplicity": "*",
      "relationshipType": "association"
    }
  ]
}`