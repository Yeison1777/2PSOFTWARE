"use client"

import { useState } from "react"
import type { Association, UMLClass } from "@/types/uml"
import { Button } from "@/components/ui/button"
import { Trash2, Edit } from "lucide-react"

interface AssociationLineProps {
  association: Association
  classes: UMLClass[]
  onRemoveAssociation?: (id: string) => void
  onEditAssociationClass?: (associationId: string) => void
}

export function AssociationLine({ association, classes, onRemoveAssociation, onEditAssociationClass }: AssociationLineProps) {
  const [isHovered, setIsHovered] = useState(false)
  const fromClass = classes.find((c) => c.id === association.fromClassId)
  const toClass = classes.find((c) => c.id === association.toClassId)

  if (!fromClass || !toClass) return null

  // Calculate connection points (center of each class)
  const fromX = fromClass.position.x + 96 // Half of min-w-48 (192px)
  const fromY = fromClass.position.y + 40 // Approximate center height
  const toX = toClass.position.x + 96
  const toY = toClass.position.y + 40

  // Calculate midpoint for delete button
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2

  // Calculate line length and angle for better positioning
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)

  // Offset multiplicity labels perpendicular to the line
  const offsetDistance = 15
  const perpX = -Math.sin(angle) * offsetDistance
  const perpY = Math.cos(angle) * offsetDistance

  // Calculate arrow/marker positions
  const arrowLength = 15
  const arrowWidth = 8
  const endX = toX - (arrowLength * Math.cos(angle))
  const endY = toY - (arrowLength * Math.sin(angle))
  
  // Diamond dimensions for aggregation/composition
  const diamondSize = 12

  // Render different arrow/marker types based on relationship
  const renderArrowHead = () => {
    const arrowPoints = [
      [toX, toY],
      [toX - arrowLength * Math.cos(angle - Math.PI / 6), toY - arrowLength * Math.sin(angle - Math.PI / 6)],
      [toX - arrowLength * Math.cos(angle + Math.PI / 6), toY - arrowLength * Math.sin(angle + Math.PI / 6)]
    ].map(point => point.join(',')).join(' ')

    switch (association.relationshipType) {
      case "inheritance":
        // Hollow triangle for inheritance
        return (
          <polygon
            points={arrowPoints}
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground"
          />
        )
      
      case "association":
      default:
        // Simple arrow for association
        return (
          <polygon
            fill="currentColor"
            className="text-foreground"
          />
        )
    }
  }

  const renderStartMarker = () => {
    if (association.relationshipType === "aggregation" || association.relationshipType === "composition") {
      // Diamond for aggregation/composition at start
      const diamondPoints = [
        [fromX + diamondSize * Math.cos(angle), fromY + diamondSize * Math.sin(angle)],
        [fromX + diamondSize/2 * Math.cos(angle + Math.PI/2), fromY + diamondSize/2 * Math.sin(angle + Math.PI/2)],
        [fromX, fromY],
        [fromX + diamondSize/2 * Math.cos(angle - Math.PI/2), fromY + diamondSize/2 * Math.sin(angle - Math.PI/2)]
      ].map(point => point.join(',')).join(' ')

      return (
        <polygon
          points={diamondPoints}
          fill={association.relationshipType === "composition" ? "currentColor" : "white"}
          stroke="currentColor"
          strokeWidth="2"
          className="text-foreground"
        />
      )
    }
    return null
  }

  // Adjust line start/end points based on markers
  const lineStartX = association.relationshipType === "aggregation" || association.relationshipType === "composition" 
    ? fromX + diamondSize * Math.cos(angle) 
    : fromX
  const lineStartY = association.relationshipType === "aggregation" || association.relationshipType === "composition" 
    ? fromY + diamondSize * Math.sin(angle) 
    : fromY
  
  const lineEndX = association.relationshipType === "inheritance" || association.relationshipType === "association" 
    ? endX 
    : toX
  const lineEndY = association.relationshipType === "inheritance" || association.relationshipType === "association" 
    ? endY 
    : toY

  // Line style based on relationship type
  const getLineStyle = () => {
    switch (association.relationshipType) {
      case "inheritance":
        return { strokeDasharray: "none" }
      case "aggregation":
      case "composition":
        return { strokeDasharray: "none" }
      case "association":
      default:
        return { strokeDasharray: "none" }
    }
  }

  return (
    <g>
      {/* Association line */}
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={lineEndX}
        y2={lineEndY}
        stroke="currentColor"
        strokeWidth={isHovered ? "3" : "2"}
        className={`transition-all duration-200 ${isHovered ? "text-primary" : "text-foreground"}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: "pointer", ...getLineStyle() }}
      />

      {/* Render start marker (diamond for aggregation/composition) */}
      {renderStartMarker()}

      {/* Render end marker (arrow for inheritance/association) */}
      {renderArrowHead()}

      {/* From multiplicity - Don't show for inheritance */}
      {association.relationshipType !== "inheritance" && (
        <text
          x={fromX + dx * 0.15 + perpX}
          y={fromY + dy * 0.15 + perpY}
          className="text-xs fill-current text-foreground font-medium"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {association.fromMultiplicity}
        </text>
      )}

      {/* To multiplicity - Don't show for inheritance */}
      {association.relationshipType !== "inheritance" && (
        <text
          x={fromX + dx * 0.85 + perpX}
          y={fromY + dy * 0.85 + perpY}
          className="text-xs fill-current text-foreground font-medium"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {association.toMultiplicity}
        </text>
      )}

      {/* Relationship type label */}
      <text
        x={midX}
        y={midY - 20}
        className="text-xs fill-current text-muted-foreground font-medium"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {association.relationshipType === "inheritance" && association.inheritanceType 
          ? association.inheritanceType 
          : association.relationshipType}
      </text>

      {/* Tooltip when hovered */}
      {isHovered && (
        <g>
          <rect
            x={midX - 50}
            y={midY + 25}
            width="100"
            height="30"
            fill="rgba(0,0,0,0.8)"
            rx="4"
            className="drop-shadow-lg"
          />
          <text
            x={midX}
            y={midY + 35}
            className="text-xs fill-white font-medium"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            Doble clic para
          </text>
          <text
            x={midX}
            y={midY + 45}
            className="text-xs fill-white font-medium"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            eliminar
          </text>
        </g>
      )}

      {/* Association Class (if exists) */}
      {association.associationClass && (
        <>
          {/* Association Class Rectangle */}
          <rect
            x={association.associationClass.position.x}
            y={association.associationClass.position.y}
            width="160"
            height={Math.max(60, 40 + association.associationClass.attributes.length * 20)}
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground"
          />
          
          {/* Association Class Name */}
          <text
            x={association.associationClass.position.x + 80}
            y={association.associationClass.position.y + 20}
            className="text-sm font-semibold fill-current text-foreground"
            textAnchor="middle"
          >
            {association.associationClass.name}
          </text>
          
          {/* Separator line */}
          <line
            x1={association.associationClass.position.x + 5}
            y1={association.associationClass.position.y + 30}
            x2={association.associationClass.position.x + 155}
            y2={association.associationClass.position.y + 30}
            stroke="currentColor"
            strokeWidth="1"
            className="text-foreground"
          />
          
          {/* Association Class Attributes */}
          {association.associationClass.attributes.map((attr, index) => (
            <text
              key={attr.id}
              x={association.associationClass!.position.x + 10}
              y={association.associationClass!.position.y + 50 + index * 20}
              className="text-xs fill-current text-foreground"
            >
              {attr.name}: {attr.type}
            </text>
          ))}
          
          {/* Dashed line from association to association class */}
          <line
            x1={midX}
            y1={midY}
            x2={association.associationClass.position.x + 80}
            y2={association.associationClass.position.y + Math.max(60, 40 + association.associationClass.attributes.length * 20)}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5,5"
            className="text-foreground"
          />
        </>
      )}

      {/* Control buttons using SVG elements (appears on hover) */}
      {isHovered && (
        <>
          {onRemoveAssociation && (
            <g>
              {/* Delete button background */}
              <circle
                cx={midX - 15}
                cy={midY}
                r="12"
                fill="#dc2626"
                stroke="#b91c1c"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200 hover:fill-red-700"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRemoveAssociation(association.id)
                }}
              />
              {/* Delete icon (X) */}
              <g className="pointer-events-none">
                <line
                  x1={midX - 20}
                  y1={midY - 5}
                  x2={midX - 10}
                  y2={midY + 5}
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1={midX - 10}
                  y1={midY - 5}
                  x2={midX - 20}
                  y2={midY + 5}
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            </g>
          )}
          
          {association.associationClass && onEditAssociationClass && (
            <g>
              {/* Edit button background */}
              <circle
                cx={midX + 15}
                cy={midY}
                r="12"
                fill="#3b82f6"
                stroke="#2563eb"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200 hover:fill-blue-700"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onEditAssociationClass(association.id)
                }}
              />
              {/* Edit icon (pencil) */}
              <g className="pointer-events-none">
                <path
                  d={`M ${midX + 10} ${midY - 3} L ${midX + 13} ${midY} L ${midX + 20} ${midY - 7} L ${midX + 17} ${midY - 10} Z`}
                  fill="white"
                  stroke="white"
                  strokeWidth="1"
                />
                <line
                  x1={midX + 10}
                  y1={midY + 2}
                  x2={midX + 20}
                  y2={midY + 2}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            </g>
          )}
        </>
      )}

      {/* Hover area for better interaction */}
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={lineEndX}
        y2={lineEndY}
        stroke="transparent"
        strokeWidth="10"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (onRemoveAssociation && window.confirm('¿Eliminar esta asociación?')) {
            onRemoveAssociation(association.id)
          }
        }}
        style={{ cursor: "pointer" }}
      />
      
      {/* Alternative: Right-click context menu */}
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={lineEndX}
        y2={lineEndY}
        stroke="transparent"
        strokeWidth="15"
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (onRemoveAssociation && window.confirm('¿Eliminar esta asociación?')) {
            onRemoveAssociation(association.id)
          }
        }}
        style={{ cursor: "context-menu" }}
      />
    </g>
  )
}
