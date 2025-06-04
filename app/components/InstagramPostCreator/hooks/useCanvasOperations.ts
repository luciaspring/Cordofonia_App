import { useRef, useCallback } from 'react'
import { TextPosition, Line, Point, GroupBoundingBox } from '../types'
import { drawCanvas as drawCanvasUtil, getRotatedBoundingBox, isPointInRotatedBox } from '../utils/canvasUtils'

interface CanvasState {
  titles: string[]
  subtitle: string
  backgroundColor: string
  currentFrame: number
  lines: Line[]
  titlePositionsFrame1: TextPosition[]
  titlePositionsFrame2: TextPosition[]
  subtitlePositionFrame1: TextPosition
  subtitlePositionFrame2: TextPosition
  selectedTexts: ('title1' | 'title2' | 'subtitle')[]
  groupRotation: number
  lineThickness: number
  easingSpeed: number
  staggerDelay: number
  tremblingIntensity: number
  isPlaying: boolean
  setDebug: React.Dispatch<React.SetStateAction<string>>
}

interface CanvasActions {
  setTitlePositionsFrame2: React.Dispatch<React.SetStateAction<TextPosition[]>>
  setSubtitlePositionFrame2: React.Dispatch<React.SetStateAction<TextPosition>>
  setLines: React.Dispatch<React.SetStateAction<Line[]>>
  setSelectedTexts: React.Dispatch<React.SetStateAction<('title1' | 'title2' | 'subtitle')[]>>
  setGroupRotation: React.Dispatch<React.SetStateAction<number>>
  setPositionModalOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useCanvasOperations(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  state: CanvasState,
  actions: CanvasActions
) {
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)
  const currentLine = useRef<Line | null>(null)
  const editingLineIndex = useRef<number | null>(null)
  const isResizing = useRef(false)
  const isDragging = useRef(false)
  const isRotating = useRef(false)
  const resizeHandle = useRef<string | null>(null)
  const resizeStartPosition = useRef<Point | null>(null)
  const initialPosition = useRef<TextPosition | null>(null)
  const initialGroupBox = useRef<GroupBoundingBox | null>(null)

  const drawCanvas = useCallback((progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawCanvasUtil(ctx, state, progress)
    
    state.setDebug(`Canvas rendered. Progress: ${progress.toFixed(2)}, Frame: ${state.currentFrame}, BG: ${state.backgroundColor}`)
  }, [canvasRef, state])

  const isPointInText = useCallback((x: number, y: number): ('title1' | 'title2' | 'subtitle') | null => {
    // Check titles first
    for (let i = 0; i < state.titlePositionsFrame2.length; i++) {
      const box = getRotatedBoundingBox(state.titlePositionsFrame2[i])
      if (isPointInRotatedBox(x, y, box)) {
        return i === 0 ? 'title1' : 'title2'
      }
    }

    // Check subtitle
    const subtitleBox = getRotatedBoundingBox(state.subtitlePositionFrame2)
    if (isPointInRotatedBox(x, y, subtitleBox)) {
      return 'subtitle'
    }

    return null
  }, [state.titlePositionsFrame2, state.subtitlePositionFrame2])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || state.currentFrame !== 2) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    const currentTime = Date.now()
    const isDoubleClick = currentTime - lastClickTime.current <= 300

    const clickedText = isPointInText(x, y)

    if (isDoubleClick && clickedText) {
      actions.setSelectedTexts([clickedText])
      actions.setPositionModalOpen(true)
      lastClickTime.current = 0 // Reset to prevent triple-click
      return
    }

    lastClickTime.current = currentTime
    lastMousePosition.current = { x, y }

    if (clickedText) {
      actions.setSelectedTexts([clickedText])
      isDragging.current = true
    } else {
      actions.setSelectedTexts([])
    }
  }, [state, actions, isPointInText])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !lastMousePosition.current) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    if (isDragging.current && state.selectedTexts.length > 0) {
      const dx = x - lastMousePosition.current.x
      const dy = y - lastMousePosition.current.y

      state.selectedTexts.forEach(selectedText => {
        if (selectedText === 'subtitle') {
          actions.setSubtitlePositionFrame2(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
          }))
        } else {
          const index = selectedText === 'title1' ? 0 : 1
          actions.setTitlePositionsFrame2(prev => {
            const newPositions = [...prev]
            newPositions[index] = {
              ...newPositions[index],
              x: newPositions[index].x + dx,
              y: newPositions[index].y + dy
            }
            return newPositions
          })
        }
      })
    }

    lastMousePosition.current = { x, y }
    drawCanvas()
  }, [state, actions, drawCanvas])

  const handleMouseUp = useCallback(() => {
    lastMousePosition.current = null
    isResizing.current = false
    isDragging.current = false
    isRotating.current = false
    resizeHandle.current = null
    resizeStartPosition.current = null
    initialPosition.current = null
    initialGroupBox.current = null
  }, [])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    drawCanvas
  }
}