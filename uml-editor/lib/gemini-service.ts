import { GoogleGenAI } from "@google/genai";
import { validateUMLClassesJSON, validateUMLDiagramJSON, type UMLDiagramJSON } from "./uml-validator"
import type { UMLClass, Association } from "@/types/uml"
import { cleanupJsonString } from "./utils";
import { logger } from "./logger";

// Initialize Gemini AI client
const ai = new GoogleGenAI({apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""});
// Avoid logging secrets / env presence in production

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export interface GenerateDiagramResponse {
  success: boolean
  diagram?: {
    classes: UMLClass[]
    associations: Association[]
  }
  message: string
  error?: string
}

/**
 * Chat with Gemini AI about UML diagrams
 */
export async function chatWithAI(message: string, chatHistory: ChatMessage[] = []): Promise<string> {
  try {
    const context = chatHistory.length > 0 
      ? chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : ''

    const systemPrompt = `You are a helpful UML diagram assistant. Help users with UML design, best practices, and diagram creation.

${context ? `Previous conversation:\n${context}\n` : ''}

Current question: ${message}`

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: systemPrompt,
    })

    return typeof response.text === "string" ? response.text.trim() : "Error: No response from AI"
  } catch (error) {
    logger.error("Error in AI chat:", error)
    return "I'm sorry, I'm having trouble responding right now. Please try again."
  }
}

/**
 * Generate complete UML diagram from prompt using Gemini AI
 */
export async function generateUMLDiagramFromPrompt(prompt: string): Promise<GenerateDiagramResponse> {
  try {
    const systemPrompt = `You are a UML diagram expert. Generate a complete UML diagram with classes and their relationships.

IMPORTANT: You must respond ONLY with valid JSON in this exact format:

{
  "classes": [
    {
      "id": "unique-id",
      "name": "ClassName",
      "attributes": [
        {
          "id": "attr-id",
          "name": "attributeName",
          "type": "String|Integer|Boolean|Double|Long|Date|LocalDateTime"
        }
      ],
      "position": { "x": number, "y": number }
    }
  ],
  "associations": [
    {
      "id": "assoc-id",
      "fromClassId": "class-id-1",
      "toClassId": "class-id-2",
      "fromMultiplicity": "1|*|0..1|1..*|0..*",
      "toMultiplicity": "1|*|0..1|1..*|0..*",
      "relationshipType": "association|inheritance|aggregation|composition",
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
  ]
}

Rules:
1. Create realistic business domain classes based on the prompt
2. Include appropriate attributes with correct data types
3. Add meaningful relationships between classes
4. Position classes in a grid layout (x: 100, 300, 500, etc; y: 100, 300, 500, etc)
5. Use proper UML multiplicities
6. Include inheritance, aggregation, and composition where appropriate
7. Generate 3-6 classes typically
8. NO markdown formatting, NO code blocks, ONLY raw JSON`

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\nUser request: ${prompt}`,
    })

    const responseText = typeof response.text === "string" ? response.text.trim() : ""
    
    // Clean up response - remove markdown formatting if present
    const jsonText = cleanupJsonString(responseText)

    // Fix common format issues - convert x,y to position object
    const fixedJsonText = fixPositionFormat(jsonText)

    // Validate the JSON response
    const validation = validateUMLDiagramJSON(fixedJsonText)
    
    if (validation.isValid && validation.diagram) {
      // Convert to our internal format
      const classes: UMLClass[] = validation.diagram.classes
      const associations: Association[] = validation.diagram.associations.map(assoc => ({
        id: assoc.id,
        fromClassId: assoc.fromClassId,
        toClassId: assoc.toClassId,
        fromMultiplicity: assoc.fromMultiplicity,
        toMultiplicity: assoc.toMultiplicity,
        relationshipType: assoc.relationshipType,
        inheritanceType: assoc.inheritanceType,
        cascadeDelete: assoc.cascadeDelete,
        associationClass: assoc.associationClass ? {
          id: assoc.associationClass.id,
          name: assoc.associationClass.name,
          attributes: assoc.associationClass.attributes.map(attr => ({
            id: attr.id,
            name: attr.name,
            type: attr.type as import("@/types/uml").DataType
          })),
          position: assoc.associationClass.position
        } : undefined
      }))

      return {
        success: true,
        diagram: { classes, associations },
        message: `Successfully generated ${classes.length} classes and ${associations.length} associations`
      }
    } else {
      return {
        success: false,
        message: "Failed to generate valid UML diagram",
        error: validation.error
      }
    }
  } catch (error) {
    logger.error("Error generating UML diagram from prompt:", error)
    return {
      success: false,
      message: "Error communicating with AI service",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Generate complete UML diagram from image using Gemini AI vision capabilities
 */
export async function generateUMLDiagramFromImage(imageFile: File, additionalPrompt?: string): Promise<GenerateDiagramResponse> {
  try {
    // Convert image to base64
    const imageData = await fileToBase64(imageFile)
    
    const systemPrompt = `You are a UML diagram expert. Analyze this image and generate a complete UML diagram with classes and relationships.

IMPORTANT: You must respond ONLY with valid JSON in this exact format:

{
  "classes": [
    {
      "id": "unique-id",
      "name": "ClassName",
      "attributes": [
        {
          "id": "attr-id",
          "name": "attributeName",
          "type": "String|Integer|Boolean|Double|Long|Date|LocalDateTime"
        }
      ],
      "position": { "x": number, "y": number }
    }
  ],
  "associations": [
    {
      "id": "assoc-id",
      "fromClassId": "class-id-1",
      "toClassId": "class-id-2",
      "fromMultiplicity": "1|*|0..1|1..*|0..*",
      "toMultiplicity": "1|*|0..1|1..*|0..*",
      "relationshipType": "association|inheritance|aggregation|composition",
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
  ]
}

Rules:
1. If you see existing UML diagrams, convert them to this format
2. If you see wireframes or sketches, infer the classes and relationships
3. Include appropriate attributes with correct data types
4. Position classes based on the image layout or use grid positioning
5. Identify relationships between classes from visual connections
6. NO markdown formatting, NO code blocks, ONLY raw JSON

Generate a complete diagram based on what you observe in the image.`

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: imageFile.type,
            data: imageData.split(',')[1] // Remove data:image/...;base64, prefix
          },
        },
        { 
          text: additionalPrompt 
            ? `${systemPrompt}\n\nAdditional context: ${additionalPrompt}` 
            : systemPrompt 
        } 
      ],
    });

    const responseText = typeof response.text === "string" ? response.text.trim() : ""
    
    // Clean up response
    const jsonText = cleanupJsonString(responseText)

    // Validate the JSON response
    const validation = validateUMLDiagramJSON(jsonText)
    
    if (validation.isValid && validation.diagram) {
      // Convert to our internal format
      const classes: UMLClass[] = validation.diagram.classes
      const associations: Association[] = validation.diagram.associations.map(assoc => ({
        id: assoc.id,
        fromClassId: assoc.fromClassId,
        toClassId: assoc.toClassId,
        fromMultiplicity: assoc.fromMultiplicity,
        toMultiplicity: assoc.toMultiplicity,
        relationshipType: assoc.relationshipType,
        inheritanceType: assoc.inheritanceType,
        cascadeDelete: assoc.cascadeDelete,
        associationClass: assoc.associationClass ? {
          id: assoc.associationClass.id,
          name: assoc.associationClass.name,
          attributes: assoc.associationClass.attributes.map(attr => ({
            id: attr.id,
            name: attr.name,
            type: attr.type as import("@/types/uml").DataType
          })),
          position: assoc.associationClass.position
        } : undefined
      }))

      return {
        success: true,
        diagram: { classes, associations },
        message: `Successfully generated ${classes.length} classes and ${associations.length} associations from image`
      }
    } else {
      return {
        success: false,
        message: "Failed to generate valid UML diagram from image",
        error: validation.error
      }
    }
  } catch (error) {
    logger.error("Error generating UML diagram from image:", error)
    return {
      success: false,
      message: "Error analyzing image with AI service",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Modify an existing UML diagram based on a modification prompt
 */
/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Don't retry on certain errors (auth, invalid request, etc)
      if (error?.error?.code === 401 || 
          error?.error?.code === 403 || 
          error?.error?.code === 400) {
        throw error
      }
      
      // Only retry on 503 (overloaded) or 429 (rate limit)
      if (error?.error?.code === 503 || 
          error?.error?.code === 429 ||
          error?.error?.status === "UNAVAILABLE") {
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          logger.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      throw error
    }
  }
  
  throw lastError
}

export async function modifyExistingDiagram(
  existingClasses: UMLClass[],
  existingAssociations: Association[],
  modificationPrompt: string
): Promise<GenerateDiagramResponse> {
  try {
    const systemPrompt = `Eres un experto en UML. Te voy a dar un diagrama existente y una solicitud de modificación.

DIAGRAMA ACTUAL:
${JSON.stringify({classes: existingClasses, associations: existingAssociations})}

SOLICITUD: ${modificationPrompt}

Responde SOLO con JSON válido que incluya:
- Las clases existentes MODIFICADAS (mantén IDs originales)
- Las clases NUEVAS (genera nuevos IDs únicos)
- Las asociaciones existentes MODIFICADAS
- Las asociaciones NUEVAS
- NO incluyas elementos que deban eliminarse

Formato JSON requerido:
{
  "classes": [
    {
      "id": "string",
      "name": "string", 
      "attributes": [{"id": "string", "name": "string", "type": "String|Integer|Boolean|Double|Long|Date|LocalDateTime"}],
      "position": {"x": number, "y": number}
    }
  ],
  "associations": [
    {
      "id": "string",
      "fromClassId": "string",
      "toClassId": "string", 
      "fromMultiplicity": "1|*|0..1|1..*|0..*",
      "toMultiplicity": "1|*|0..1|1..*|0..*",
      "relationshipType": "association|inheritance|aggregation|composition"
    }
  ]
}

Reglas:
1. Mantén IDs existentes para clases que no cambian
2. Genera nuevos IDs únicos para elementos nuevos
3. Actualiza atributos/métodos según la solicitud
4. Añade nuevas relaciones si es necesario
5. Posiciona nuevas clases en grid (x: 100, 300, 500; y: 100, 300, 500)
6. NO incluyas elementos que deban eliminarse
7. NO markdown formatting, NO code blocks, ONLY raw JSON`

    // Use retry with exponential backoff for 503 errors
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
      })
    }, 3, 2000) // 3 retries, starting with 2 second delay

    const responseText = typeof response.text === "string" ? response.text.trim() : ""
    
    // Clean up response - remove markdown formatting if present
    const jsonText = cleanupJsonString(responseText)

    // Fix common format issues - convert x,y to position object
    const fixedJsonText = fixPositionFormat(jsonText)

    // Validate the JSON response
    const validation = validateUMLDiagramJSON(fixedJsonText)
    
    if (validation.isValid && validation.diagram) {
      const aiClasses: UMLClass[] = validation.diagram.classes
      const aiAssociations: Association[] = validation.diagram.associations.map(assoc => ({
        id: assoc.id,
        fromClassId: assoc.fromClassId,
        toClassId: assoc.toClassId,
        fromMultiplicity: assoc.fromMultiplicity || "1",
        toMultiplicity: assoc.toMultiplicity || "1",
        relationshipType: assoc.relationshipType || "association"
      }))

      const { mergedClasses, mergedAssociations } = mergeDiagramModifications(
        existingClasses,
        existingAssociations,
        aiClasses,
        aiAssociations
      )

      return {
        success: true,
        diagram: { classes: mergedClasses, associations: mergedAssociations },
        message: `Successfully modified diagram: ${mergedClasses.length} classes and ${mergedAssociations.length} associations`
      }
    } else {
      return {
        success: false,
        message: "Failed to generate valid modified UML diagram",
        error: validation.error
      }
    }
  } catch (error: any) {
    logger.error("Error modifying UML diagram:", error)
    
    // Handle specific error cases
    let errorMessage = "Error modifying diagram with AI service"
    let detailedError = error instanceof Error ? error.message : "Unknown error"
    
    // Check for 503 (Service Unavailable) or model overloaded
    if (error?.error?.code === 503 || 
        error?.error?.status === "UNAVAILABLE" ||
        error?.message?.includes("overloaded") ||
        detailedError.includes("overloaded")) {
      errorMessage = "El modelo de IA está sobrecargado. Por favor, intenta de nuevo en unos momentos."
      detailedError = "Modelo sobrecargado - Servicio temporalmente no disponible"
    } else if (error?.error?.code === 429) {
      errorMessage = "Has excedido el límite de solicitudes. Por favor, espera un momento antes de intentar de nuevo."
      detailedError = "Límite de tasa excedido"
    } else if (error?.error?.code === 401 || error?.error?.code === 403) {
      errorMessage = "Error de autenticación con el servicio de IA. Verifica tu API key."
      detailedError = "Error de autenticación"
    }
    
    return {
      success: false,
      message: errorMessage,
      error: detailedError
    }
  }
}

/**
 * Convert file to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

/**
 * Fix common format issues in AI-generated JSON
 */
function fixPositionFormat(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString)
    
    // Fix classes with x,y instead of position object
    if (parsed.classes && Array.isArray(parsed.classes)) {
      parsed.classes = parsed.classes.map((cls: any) => {
        if (cls.x !== undefined && cls.y !== undefined && !cls.position) {
          cls.position = { x: cls.x, y: cls.y }
          delete cls.x
          delete cls.y
        }
        return cls
      })
    }
    
    return JSON.stringify(parsed)
  } catch (error) {
    // If parsing fails, return original string
    return jsonString
  }
}

function mergeDiagramModifications(
  existingClasses: UMLClass[],
  existingAssociations: Association[],
  aiClasses: UMLClass[],
  aiAssociations: Association[]
) {
  const existingClassById = new Map(existingClasses.map(cls => [cls.id, cls]))
  const existingClassByName = new Map(existingClasses.map(cls => [cls.name.toLowerCase(), cls]))

  const mergedClasses: UMLClass[] = []

  aiClasses.forEach(aiClass => {
    const idMatch = existingClassById.get(aiClass.id)
    if (idMatch) {
      mergedClasses.push({
        ...idMatch,
        ...aiClass,
        position: aiClass.position || idMatch.position
      })
      existingClassById.delete(aiClass.id)
      existingClassByName.delete(idMatch.name.toLowerCase())
    } else {
      const nameMatch = existingClassByName.get(aiClass.name.toLowerCase())
      if (nameMatch) {
        mergedClasses.push({
          ...nameMatch,
          ...aiClass,
          id: nameMatch.id,
          position: aiClass.position || nameMatch.position
        })
        existingClassById.delete(nameMatch.id)
        existingClassByName.delete(nameMatch.name.toLowerCase())
      } else {
        mergedClasses.push(aiClass)
      }
    }
  })

  // keep untouched classes
  existingClassById.forEach(cls => {
    mergedClasses.push(cls)
  })

  // deduplicate by id (in case of accidental duplicates)
  const classMap = new Map<string, UMLClass>()
  mergedClasses.forEach(cls => {
    classMap.set(cls.id, cls)
  })
  const finalClasses = Array.from(classMap.values())

  // Associations merge (similar approach)
  const existingAssocById = new Map(existingAssociations.map(assoc => [assoc.id, assoc]))
  const mergedAssociations: Association[] = []

  aiAssociations.forEach(aiAssoc => {
    const existing = existingAssocById.get(aiAssoc.id)
    if (existing) {
      mergedAssociations.push({
        ...existing,
        ...aiAssoc
      })
      existingAssocById.delete(aiAssoc.id)
    } else {
      mergedAssociations.push(aiAssoc)
    }
  })

  existingAssocById.forEach(assoc => mergedAssociations.push(assoc))

  const assocMap = new Map<string, Association>()
  mergedAssociations.forEach(assoc => {
    assocMap.set(assoc.id, assoc)
  })
  const finalAssociations = Array.from(assocMap.values())

  return {
    mergedClasses: finalClasses,
    mergedAssociations: finalAssociations
  }
}
