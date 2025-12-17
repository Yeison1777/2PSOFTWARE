"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Send, Bot, Upload, Image, MessageCircle, Mic, MicOff } from "lucide-react"
import { generateUMLDiagramFromPrompt, generateUMLDiagramFromImage, chatWithAI, modifyExistingDiagram, type ChatMessage } from "@/lib/gemini-service"
import { logger } from "@/lib/logger"
import type { UMLClass, Association } from "@/types/uml"

interface AIAssistantPanelProps {
	isOpen: boolean
	onClose: () => void
	onGenerateClasses: (classes: UMLClass[]) => void
	onGenerateAssociations: (associations: Association[]) => void
	onModifyDiagram?: (classes: UMLClass[], associations: Association[]) => void
	existingClasses?: UMLClass[]
	existingAssociations?: Association[]
}

export function AIAssistantPanel({ 
  isOpen, 
  onClose, 
  onGenerateClasses,
  onGenerateAssociations,
  onModifyDiagram,
  existingClasses = [],
  existingAssociations = []
}: AIAssistantPanelProps) {
  const [prompt, setPrompt] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatMode, setIsChatMode] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [modificationMode, setModificationMode] = useState(false)
  const [modificationPrompt, setModificationPrompt] = useState("")
  const [isModifying, setIsModifying] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [listeningTarget, setListeningTarget] = useState<"prompt" | "modify" | "chat" | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const dictationBaseRef = useRef<string>("")
  const micStreamRef = useRef<MediaStream | null>(null)

  const stopDictation = () => {
    try {
      recognitionRef.current?.stop?.()
    } catch {}
    try {
      micStreamRef.current?.getTracks?.().forEach(t => t.stop())
    } catch {}
    micStreamRef.current = null
    recognitionRef.current = null
    setIsListening(false)
    setListeningTarget(null)
  }

  const startDictation = async (target: "prompt" | "modify" | "chat") => {
    try {
      // @ts-expect-error - browser speech API
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognitionCtor) {
        setError("Tu navegador no soporta dictado por voz (SpeechRecognition). Usa Chrome/Edge.")
        return
      }

      // Stop previous session if any
      stopDictation()

      // Force permission prompt (more reliable than relying on SpeechRecognition alone)
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (e) {
          logger.error("Microphone permission denied:", e)
          setError("No hay permiso de micrófono. Actívalo en el navegador y vuelve a intentar.")
          stopDictation()
          return
        }
      }

      const recognition = new SpeechRecognitionCtor()
      recognition.lang = "es-ES"
      recognition.interimResults = true
      recognition.continuous = false
      recognition.maxAlternatives = 1

      // Capture current text as base so interim results overwrite cleanly
      if (target === "prompt") dictationBaseRef.current = prompt
      if (target === "modify") dictationBaseRef.current = modificationPrompt
      if (target === "chat") dictationBaseRef.current = chatInput

      recognition.onaudiostart = () => {
        // Useful signal that mic is actually capturing
        setError(null)
      }

      recognition.onresult = (event: any) => {
        const lastResult = event.results?.[event.results.length - 1]
        const transcript = (lastResult?.[0]?.transcript ?? "").trim()
        if (!transcript) return

        const base = dictationBaseRef.current.trim()
        const merged = base ? `${base} ${transcript}` : transcript

        if (target === "prompt") setPrompt(merged)
        if (target === "modify") setModificationPrompt(merged)
        if (target === "chat") setChatInput(merged)
      }

      recognition.onerror = (e: any) => {
        // Dictation errors are common (permissions/service). Avoid console.error to prevent Next Dev Overlay spam.
        logger.warn("SpeechRecognition error:", e)
        const code = e?.error || e?.name
        if (code === "not-allowed" || code === "permission-denied") {
          setError("Permiso de micrófono denegado. Actívalo y vuelve a intentar.")
        } else if (code === "network") {
          setError("SpeechRecognition falló por red/servicio. Prueba de nuevo.")
        } else if (code === "not-supported") {
          setError("Dictado por voz no soportado en este navegador. Usa Chrome/Edge.")
        } else if (typeof window !== "undefined" && !window.isSecureContext) {
          setError("El dictado por voz requiere un contexto seguro (HTTPS) o localhost.")
        } else {
          setError("SpeechRecognition falló. Revisa permisos del micrófono e intenta de nuevo.")
        }
        stopDictation()
      }

      recognition.onend = () => {
        // Some browsers end without firing final result
        stopDictation()
      }

      recognitionRef.current = recognition
      setIsListening(true)
      setListeningTarget(target)
      setError(null)
      recognition.start()
    } catch (e) {
      logger.error("Error starting dictation:", e)
      setError("Error iniciando dictado por voz.")
      stopDictation()
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedImage) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      let response
      
      if (selectedImage && prompt.trim()) {
        // Both image and text prompt
        response = await generateUMLDiagramFromImage(selectedImage, prompt)
      } else if (selectedImage) {
        // Only image
        response = await generateUMLDiagramFromImage(selectedImage)
      } else {
        // Only text prompt
        response = await generateUMLDiagramFromPrompt(prompt)
      }

      if (response.success && response.diagram && response.diagram.classes && response.diagram.associations) {
        onGenerateClasses(response.diagram.classes)
        onGenerateAssociations(response.diagram.associations)
        setPrompt("")
        setSelectedImage(null)
        setError(null)
      } else {
        setError(response.error || response.message)
      }
    } catch (error) {
      setError("Error generating diagram")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleModifyDiagram = async () => {
    if (!modificationPrompt.trim()) return
    
    setIsModifying(true)
    setError(null)
    
    try {
      const response = await modifyExistingDiagram(
        existingClasses,
        existingAssociations,
        modificationPrompt
      )

      if (response.success && response.diagram && response.diagram.classes && response.diagram.associations) {
        // CRITICAL: Use onModifyDiagram if available (replaces all), otherwise use generate functions (adds)
        if (onModifyDiagram) {
          // Replace all classes and associations with the modified diagram
          onModifyDiagram(response.diagram.classes, response.diagram.associations)
        } else {
          // Fallback: add new classes and associations (may cause duplicates)
          onGenerateClasses(response.diagram.classes)
          onGenerateAssociations(response.diagram.associations)
        }
        setModificationPrompt("")
        setModificationMode(false)
        setError(null)
      } else {
        // Show user-friendly error message
        const errorMsg = response.error || response.message || "Error desconocido al modificar el diagrama"
        setError(errorMsg)
      }
    } catch (error: any) {
      logger.error('Error modifying diagram:', error)
      
      // Show user-friendly error based on error type
      let errorMessage = "Error modificando el diagrama. Por favor, intenta de nuevo."
      
      if (error?.message?.includes("overloaded") || 
          error?.error?.includes("overloaded") ||
          error?.error?.code === 503) {
        errorMessage = "El modelo de IA está sobrecargado. Por favor, espera unos momentos e intenta de nuevo."
      } else if (error?.error?.code === 429) {
        errorMessage = "Has excedido el límite de solicitudes. Por favor, espera un momento."
      }
      
      setError(errorMessage)
    } finally {
      setIsModifying(false)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim()) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput("")
    setIsChatLoading(true)
    
    try {
      const aiResponse = await chatWithAI(chatInput, chatMessages)
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date()
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I'm having trouble responding right now. Please try again.",
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file && file.type.startsWith('image/')) {
			setSelectedImage(file)
		}
	}

	return (
		<>
			{/* Overlay */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/20 z-40"
					onClick={onClose}
				/>
			)}

			{/* Panel */}
			<div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'
				}`}>


				{/* Content */}
				<div className="flex flex-col h-full">

					{/* Header */}
					<div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Bot className="w-5 h-5" />
								<h2 className="font-semibold">AI Diagram Assistant</h2>
							</div>
							<Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-white/20">
								<X className="w-4 h-4" />
							</Button>
						</div>
					</div>

					{/* Mode Toggle */}
					<div className="p-4 border-b bg-gray-50">
						<div className="flex gap-2">
							<Button
								onClick={() => setIsChatMode(false)}
								variant={!isChatMode ? "default" : "outline"}
								size="sm"
								className="flex-1"
							>
								<Bot className="w-4 h-4 mr-2" />
								Generate
							</Button>
							<Button
								onClick={() => setIsChatMode(true)}
								variant={isChatMode ? "default" : "outline"}
								size="sm"
								className="flex-1"
							>
								<MessageCircle className="w-4 h-4 mr-2" />
								Chat
							</Button>
						</div>
					</div>
					
					{!isChatMode ? (
						/* Generation Mode */
						<>
							<div className="flex-1 overflow-y-auto p-6 space-y-6">
								{/* Mode Selection */}
								<div className="flex gap-2 mb-4">
									<Button
										variant={!modificationMode ? "default" : "outline"}
										size="sm"
										onClick={() => setModificationMode(false)}
									>
										Create New
									</Button>
									<Button
										variant={modificationMode ? "default" : "outline"}
										size="sm"
										onClick={() => setModificationMode(true)}
										disabled={existingClasses.length === 0}
									>
										Modify Existing
									</Button>
								</div>

								{modificationMode ? (
									/* Modification Mode */
									<div className="space-y-3">
										<Label className="text-sm font-medium text-gray-700">
											Modify existing diagram
										</Label>
										<div className="flex gap-2">
											<Input
												value={modificationPrompt}
												onChange={(e) => setModificationPrompt(e.target.value)}
												placeholder="e.g. Add a User class, modify Product to include price..."
												className="flex-1"
											/>
											<Button
												type="button"
												variant="outline"
												onClick={() =>
													isListening && listeningTarget === "modify" ? stopDictation() : startDictation("modify")
												}
												title={isListening && listeningTarget === "modify" ? "Stop dictation" : "Dictate prompt"}
											>
												{isListening && listeningTarget === "modify" ? (
													<MicOff className="w-4 h-4" />
												) : (
													<Mic className="w-4 h-4" />
												)}
											</Button>
										</div>
										<Button
											onClick={handleModifyDiagram}
											disabled={!modificationPrompt.trim() || isModifying}
											className="w-full"
										>
											{isModifying ? (
												<>
													<Bot className="w-4 h-4 mr-2 animate-spin" />
													Modifying...
												</>
											) : (
												<>
													<Bot className="w-4 h-4 mr-2" />
													Modify Diagram
												</>
											)}
										</Button>
									</div>
								) : (
									/* Creation Mode */
									<>
									{/* Text Prompt */}
									<div className="space-y-3">
										<Label className="text-sm font-medium text-gray-700">
											Describe your system
										</Label>
										<div className="flex gap-2">
											<Input
												value={prompt}
												onChange={(e) => setPrompt(e.target.value)}
												placeholder="e.g. Create a library management system..."
												className="flex-1"
											/>
											<Button
												type="button"
												variant="outline"
												onClick={() =>
													isListening && listeningTarget === "prompt" ? stopDictation() : startDictation("prompt")
												}
												title={isListening && listeningTarget === "prompt" ? "Stop dictation" : "Dictate prompt"}
											>
												{isListening && listeningTarget === "prompt" ? (
													<MicOff className="w-4 h-4" />
												) : (
													<Mic className="w-4 h-4" />
												)}
											</Button>
										</div>
									</div>

								{/* Image Upload */}
								<div className="space-y-3">
									<Label className="text-sm font-medium text-gray-700">
										Attach image (optional)
									</Label>
									<div className="flex gap-2">
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											onChange={handleImageSelect}
											className="hidden"
										/>
										<Button
											onClick={() => fileInputRef.current?.click()}
											variant="outline"
											className="flex-1"
										>
											<Upload className="w-4 h-4 mr-2" />
											Upload Image
										</Button>
										{selectedImage && (
											<Button
												onClick={() => setSelectedImage(null)}
												variant="outline"
												size="sm"
											>
												<X className="w-4 h-4" />
											</Button>
										)}
									</div>

									{selectedImage && (
										<div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
											<Image className="w-4 h-4 text-gray-500" />
											<span className="text-sm text-gray-600 truncate">
												{selectedImage.name}
											</span>
										</div>
									)}
								</div>

								{/* Error Display */}
								{error && (
									<div className="p-3 bg-red-50 border border-red-200 rounded-lg">
										<p className="text-sm text-red-600">{error}</p>
									</div>
								)}
								{isListening && (
									<div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
										<p className="text-sm text-indigo-700">
											Escuchando… habla ahora. Si no avanza, revisa permisos del micrófono.
										</p>
									</div>
								)}
									</>
								)}
							</div>

							{/* Generate Button - Only show in creation mode */}
							{!modificationMode && (
								<div className="p-6 border-t">
									<Button
										onClick={handleGenerate}
										disabled={(!prompt.trim() && !selectedImage) || isGenerating}
										className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
									>
										{isGenerating ? (
											<div className="flex items-center gap-2">
												<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
												Generating...
											</div>
										) : (
											<div className="flex items-center gap-2">
												<Send className="w-4 h-4" />
												Generate Diagram
											</div>
										)}
									</Button>
								</div>
							)}
						</>
					) : (
						/* Chat Mode */
						<>
							<div className="flex-1 overflow-y-auto p-4">
								{chatMessages.length === 0 ? (
									<div className="text-center text-gray-500 mt-8">
										<Bot className="w-8 h-8 mx-auto mb-2 text-gray-400" />
										<p className="text-sm">Ask me anything about UML diagrams!</p>
									</div>
								) : (
									<div className="space-y-4">
										{chatMessages.map((message) => (
											<div
												key={message.id}
												className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
											>
												<div
													className={`max-w-[80%] p-3 rounded-lg ${
														message.role === 'user'
															? 'bg-purple-600 text-white'
															: 'bg-gray-100 text-gray-900'
													}`}
												>
													<p className="text-sm whitespace-pre-wrap">{message.content}</p>
													<p className={`text-xs mt-1 ${
														message.role === 'user' ? 'text-purple-200' : 'text-gray-500'
													}`}>
														{message.timestamp.toLocaleTimeString()}
													</p>
												</div>
											</div>
										))}
										{isChatLoading && (
											<div className="flex justify-start">
												<div className="bg-gray-100 p-3 rounded-lg">
													<div className="flex items-center gap-2">
														<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
														<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
														<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
													</div>
												</div>
											</div>
										)}
									</div>
								)}
							</div>

							{/* Chat Input */}
							<div className="p-4 border-t">
								<div className="flex gap-2">
									<Input
										value={chatInput}
										onChange={(e) => setChatInput(e.target.value)}
										placeholder="Ask about UML design patterns, best practices..."
										onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
										className="flex-1"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											isListening && listeningTarget === "chat" ? stopDictation() : startDictation("chat")
										}
										title={isListening && listeningTarget === "chat" ? "Stop dictation" : "Dictate message"}
									>
										{isListening && listeningTarget === "chat" ? (
											<MicOff className="w-4 h-4" />
										) : (
											<Mic className="w-4 h-4" />
										)}
									</Button>
									<Button
										onClick={handleChatSend}
										disabled={!chatInput.trim() || isChatLoading}
										className="bg-purple-600 hover:bg-purple-700"
									>
										<Send className="w-4 h-4" />
									</Button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	)
}

