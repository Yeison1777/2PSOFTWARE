"use client"

import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

interface AIFabButtonProps {
  onClick: () => void
}

export function AIFabButton({ onClick }: AIFabButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-30">
      <Button
        onClick={onClick}
        size="lg"
        className="rounded-full w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
        <span className="sr-only">Open AI Assistant</span>
      </Button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap">
          AI Diagram Assistant
        </div>
      </div>
    </div>
  )
}