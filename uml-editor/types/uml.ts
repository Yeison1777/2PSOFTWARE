export interface UMLAttribute {
  id: string
  name: string
  type: DataType
}

export interface UMLClass {
  id: string
  name: string
  attributes: UMLAttribute[]
  position: { x: number; y: number }
}

export interface AssociationClass {
  id: string
  name: string
  attributes: UMLAttribute[]
  position: { x: number; y: number }
}

export type RelationshipType = 
  | "association" 
  | "inheritance" 
  | "aggregation" 
  | "composition"

export interface Association {
  id: string
  fromClassId: string
  toClassId: string
  fromMultiplicity: string
  toMultiplicity: string
  relationshipType: RelationshipType
  associationClass?: AssociationClass
  // Optional properties for specific relationship types
  inheritanceType?: "extends" | "implements" // For inheritance
  cascadeDelete?: boolean // For composition
}

export type DataType = "String" | "Integer" | "Boolean" | "Double" | "Long" | "Date" | "LocalDateTime"

export const DATA_TYPES: DataType[] = ["String", "Integer", "Boolean", "Double", "Long", "Date", "LocalDateTime"]

export const MULTIPLICITY_OPTIONS = ["1", "0..1", "*", "1..*", "0..*"]

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string; description: string }[] = [
  { value: "association", label: "Association", description: "Basic relationship between classes" },
  { value: "inheritance", label: "Inheritance", description: "IS-A relationship (extends/implements)" },
  { value: "aggregation", label: "Aggregation", description: "HAS-A relationship (weak ownership)" },
  { value: "composition", label: "Composition", description: "PART-OF relationship (strong ownership)" }
]
