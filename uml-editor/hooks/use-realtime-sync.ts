import { useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'
import { tokenManager } from '@/lib/api-client'
import type { UMLClass, Association } from '@/types/uml'

interface DiagramUpdate {
  type: string
  diagram_id: string
  diagram_data: {
    classes?: UMLClass[]
    associations?: Association[]
  }
  timestamp: string
  user_id?: string
}

interface UseRealtimeSyncOptions {
  diagramId: string | null
  enabled: boolean
  onUpdate: (classes: UMLClass[], associations: Association[]) => void
  currentUserId?: string
}

export function useRealtimeSync({
  diagramId,
  enabled,
  onUpdate,
  currentUserId
}: UseRealtimeSyncOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const is404ErrorRef = useRef(false) // Track if we got a 404 (diagram doesn't exist)

  useEffect(() => {
    // Don't connect if disabled, no diagram ID, or diagram ID is invalid
    if (!enabled || !diagramId || diagramId === 'undefined' || diagramId === 'null') {
      // Clean up if disabled
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    // Resolve diagram ID (handle share tokens)
    const resolveDiagramId = (id: string): string => {
      // If it's a share token (starts with "shared-"), use it as-is
      // The backend will resolve it to the real diagram_id
      // All users connecting with the same share token will connect to the same resolved_id stream
      return id
    }

    const connect = () => {
      // Don't connect if we know it's a 404
      if (is404ErrorRef.current) {
        logger.log('Skipping SSE connection - diagram not found (404)')
        return
      }

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const resolvedId = resolveDiagramId(diagramId)
      const token = tokenManager.get()
      
      // Build SSE URL with token as query param
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const url = `${apiUrl}/diagrams/${resolvedId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`

      logger.log('Connecting to SSE:', url)

      try {
        const eventSource = new EventSource(url)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          logger.log('SSE connection opened')
          reconnectAttemptsRef.current = 0
          is404ErrorRef.current = false // Reset 404 flag on successful connection
          
          // Clear any pending reconnect
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }
        }

        eventSource.onmessage = (event) => {
          try {
            // Ignorar mensajes keepalive
            if (event.data.trim() === '' || event.data.startsWith(':')) {
              return
            }
            
            const data: DiagramUpdate = JSON.parse(event.data)
            
            if (data.type === 'update' && data.diagram_data) {
              // Only update if it's not from current user (avoid loops)
              if (data.user_id && data.user_id === currentUserId) {
                logger.log('Ignoring update from current user')
                return
              }

              logger.log('Received real-time update:', data)
              
              // Update state with new data
              onUpdate(
                data.diagram_data.classes || [],
                data.diagram_data.associations || []
              )
            } else if (data.type === 'connected') {
              logger.log('SSE connected to diagram:', data.diagram_id)
            } else if (data.type === 'error') {
              logger.error('SSE error:', data)
            }
          } catch (error) {
            logger.error('Error parsing SSE message:', error)
          }
        }

        eventSource.onerror = (error) => {
          // Check connection state
          if (eventSource.readyState === EventSource.CLOSED) {
            // Connection was closed - might be a 404
            // Try to detect 404 by checking if connection closed immediately
            // (EventSource doesn't give us status code, but 404 usually closes immediately)
            logger.log('SSE connection closed')
            
            // If this is the first attempt and it closed immediately, likely a 404
            if (reconnectAttemptsRef.current === 0) {
              // Mark as potential 404 and don't reconnect aggressively
              is404ErrorRef.current = true
              logger.log('SSE connection closed immediately - likely diagram not found (404). Will not reconnect.')
              return
            }
            
            // Only reconnect if we haven't exceeded max attempts and it's not a 404
            if (!is404ErrorRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++
              const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
              
              logger.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
              
              reconnectTimeoutRef.current = setTimeout(() => {
                connect()
              }, delay)
            } else if (is404ErrorRef.current) {
              logger.log('Not reconnecting - diagram not found (404)')
            } else {
              logger.error('Max reconnection attempts reached')
            }
          } else if (eventSource.readyState === EventSource.CONNECTING) {
            // Still connecting, wait
            logger.log('SSE still connecting...')
          } else {
            // Other error state
            logger.error('SSE connection error, state:', eventSource.readyState)
          }
        }
      } catch (error) {
        logger.error('Error creating EventSource:', error)
      }
    }

    // Reset 404 flag when diagram ID changes
    is404ErrorRef.current = false
    reconnectAttemptsRef.current = 0

    // Initial connection
    connect()

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      // Reset flags
      is404ErrorRef.current = false
      reconnectAttemptsRef.current = 0
    }
  }, [diagramId, enabled, onUpdate, currentUserId])
}

