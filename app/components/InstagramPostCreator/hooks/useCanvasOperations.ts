import { useRef, useCallback } from 'react'
import { TextPosition, Line, Point } from '../types'
import { drawCanvas as drawCanvasUtil } from '../utils/canvasUtils'

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

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // ... (implement mouse down logic)
  }, [state, actions])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // ... (implement mouse move logic)
  }, [state, actions])

  const handleMouseUp = useCallback(() => {
    // ... (implement mouse up logic)
  }, [state, actions])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    drawCanvas
  }
}