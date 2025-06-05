// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────────
interface Point {
  x: number
  y: number
}
interface Line {
  start: Point
  end: Point
  frame: number
}
interface TextPosition {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fontSize: number
  aspectRatio?: number
}
interface GroupBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

// ─── COLOR PRESETS ───────────────────────────────────────────────────────────────
const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

// Ultra‐fast ease‐in‐out (quint‐inspired, raised to 16 for “snappier” feel)
const ultraFastEaseInOut = (t: number): number => {
  return t < 0.5
    ? Math.pow(2 * t, 16) / 2
    : 1 - Math.pow(-2 * t + 2, 16) / 2
}

export default function InstagramPostCreator() {
  // ─── REFS & STATE ───────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Text content
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')

  // Animation / frame
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [frameRate, setFrameRate] = useState(60)

  // Lines
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [lineThickness, setLineThickness] = useState(4)
  const [isDraggingLine, setIsDraggingLine] = useState(false)
  const [draggedMode, setDraggedMode] = useState<'move' | 'start' | 'end' | null>(null)
  const lastMousePosForLine = useRef<{ x: number; y: number } | null>(null)

  // Text positions for frame 1 and frame 2
  const [titlePosF1, setTitlePosF1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [titlePosF2, setTitlePosF2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [subtitlePosF1, setSubtitlePosF1] = useState<TextPosition>({
    x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36
  })
  const [subtitlePosF2, setSubtitlePosF2] = useState<TextPosition>({
    x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36
  })

  // Text interaction (Frame 2 only)
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [isDraggingText, setIsDraggingText] = useState(false)
  const [isResizingText, setIsResizingText] = useState(false)
  const [isRotatingText, setIsRotatingText] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [resizeStartPos, setResizeStartPos] = useState<Point | null>(null)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [lastMousePosForText, setLastMousePosForText] = useState<Point | null>(null)
  const [groupRotation, setGroupRotation] = useState(0)

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Path2D cache for lines (used in hit‐testing)
  const linePathsRef = useRef<Path2D[]>([])

  // Animation loop refs
  const startTimeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Track Shift key
  const isShiftPressed = useRef(false)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressed.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressed.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ─── EFFECT: redraw whenever important state changes ───────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Recompute text dimensions each time content or fontSize changes
    updateTextDimensions(ctx)

    // If not playing, draw static
    if (!isPlaying) {
      drawCanvas(0)
    }
  }, [
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    lines,
    lineThickness,
    tremblingIntensity,
    frameRate,
    titlePosF1,
    titlePosF2,
    subtitlePosF1,
    subtitlePosF2,
    selectedTexts,
    groupRotation,
  ])

  // ─── EFFECT: animation loop start/stop ───────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      animationFrameRef.current = requestAnimationFrame(animateLoop)
    } else {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      drawCanvas(0)
    }
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, isLooping, frameRate])

  // ─── UPDATE TEXT DIMENSIONS ───────────────────────────────────────────────────────
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    // Helper to measure “bold {fontSize}px Arial”
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const m = ctx.measureText(text)
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || fontSize * 0.8
      return { width: m.width, height: h }
    }

    // Titles F1 & F2
    setTitlePosF1(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )
    setTitlePosF2(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Subtitle dims for F1 & F2
    const { width: sw, height: sh } = measureText(subtitle, subtitlePosF2.fontSize)
    const subAR = sw / sh
    setSubtitlePosF1(prev => ({ ...prev, width: sw, height: sh, aspectRatio: subAR }))
    setSubtitlePosF2(prev => ({ ...prev, width: sw, height: sh, aspectRatio: subAR }))
  }

  // ─── UTIL: convert mouse event to canvas coordinates ─────────────────────────────
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // offsetX / offsetY are available on <canvas> nativeEvent
    // @ts-ignore
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
  }

  // ─── DRAWING ROUTINES ─────────────────────────────────────────────────────────────
  const drawLines = (ctx: CanvasRenderingContext2D, frameLines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
    ctx.strokeStyle = '#0000FF' // hard‐coded blue ink

    linePathsRef.current = []

    frameLines.forEach((ln, idx) => {
      const path = new Path2D()
      path.moveTo(ln.start.x, ln.start.y)
      path.lineTo(ln.end.x, ln.end.y)
      ctx.beginPath()
      ctx.stroke(path)
      linePathsRef.current[idx] = path
    })

    // Draw “in‐progress” line if any
    if (currentLine) {
      const path = new Path2D()
      path.moveTo(currentLine.start.x, currentLine.start.y)
      path.lineTo(currentLine.end.x, currentLine.end.y)
      ctx.beginPath()
      ctx.stroke(path)
    }
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) => {
    ctx.save()
    ctx.translate(pos.x + pos.width / 2, pos.y + pos.height / 2)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const tPosArray = frame === 1 ? titlePosF1 : titlePosF2
    tPosArray.forEach((pos, i) => drawRotatedText(ctx, pos, titles[i]))
    const subPos = frame === 1 ? subtitlePosF1 : subtitlePosF2
    drawRotatedText(ctx, subPos, subtitle)
  }

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(pos.rotation)
    const hw = pos.width / 2
    const hh = pos.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, pos.width, pos.height)

    // Draw corner handles
    const handleSize = 10
    const corners: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(box.rotation)
    const hw = box.width / 2
    const hh = box.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, box.width, box.height)

    // Corner handles
    const handleSize = 10
    const corners: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    const selectedPositions: TextPosition[] = titlePosF2.filter((_, i) =>
      selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
    )
    if (selectedTexts.includes('subtitle')) {
      selectedPositions.push(subtitlePosF2)
    }
    if (selectedPositions.length === 0) return null

    const xs = selectedPositions.map(p => p.x)
    const ys = selectedPositions.map(p => p.y)
    const ws = selectedPositions.map(p => p.width)
    const hs = selectedPositions.map(p => p.height)

    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs.map((x, i) => x + ws[i]))
    const maxY = Math.max(...ys.map((y, i) => y + hs[i]))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation,
    }
  }

  const drawEverything = (ctx: CanvasRenderingContext2D, progress: number) => {
    // Fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Draw static lines & text
    const frameLines = lines.filter(l => l.frame === currentFrame)
    drawLines(ctx, frameLines)
    drawStaticText(ctx, currentFrame)

    // If Frame 2 and any texts are selected, draw bounding boxes
    if (currentFrame === 2 && selectedTexts.length > 0) {
      const box = calculateGroupBoundingBox()
      if (box) {
        drawGroupBoundingBox(ctx, box)
      } else {
        // If only single text selected, we drew them above. But to be safe:
        titlePosF2.forEach((pos, i) => {
          if (selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')) {
            drawBoundingBox(ctx, pos)
          }
        })
        if (selectedTexts.includes('subtitle')) {
          drawBoundingBox(ctx, subtitlePosF2)
        }
      }
    }
  }

  const drawCanvas = (progress: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawEverything(ctx, progress)
  }

  // ─── MOUSE & INTERACTION HANDLERS ────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    lastMousePosForLine.current = null
    setIsDraggingLine(false)

    const { x, y } = getCanvasCoords(e)

    // 1) TEXT interaction if Frame 2
    if (currentFrame === 2) {
      // Check titles
      for (let i = 0; i < titlePosF2.length; i++) {
        const pos = titlePosF2[i]
        const rotBox = getRotatedBoundingBox(pos)
        if (isPointInRotatedRegion(x, y, rotBox)) {
          beginTextInteraction(pos, (`title${i + 1}` as 'title1' | 'title2'), x, y)
          return
        }
      }
      // Check subtitle
      const subBox = getRotatedBoundingBox(subtitlePosF2)
      if (isPointInRotatedRegion(x, y, subBox)) {
        beginTextInteraction(subtitlePosF2, 'subtitle', x, y)
        return
      }
    }

    // 2) LINE hit‐testing (endpoints first, then stroke)
    let foundIdx: number | null = null
    let mode: 'start' | 'end' | 'move' | null = null

    // 2a) endpoints
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]
      if (ln.frame !== currentFrame) continue
      const dStart = Math.hypot(x - ln.start.x, y - ln.start.y)
      if (dStart <= lineThickness) {
        foundIdx = i
        mode = 'start'
        break
      }
      const dEnd = Math.hypot(x - ln.end.x, y - ln.end.y)
      if (dEnd <= lineThickness) {
        foundIdx = i
        mode = 'end'
        break
      }
    }

    // 2b) body (isPointInStroke via Path2D)
    if (foundIdx === null) {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      ctx.lineWidth = lineThickness
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]
        if (ln.frame !== currentFrame) continue
        const path = linePathsRef.current[i]
        if (!path) continue
        if (ctx.isPointInStroke(path, x, y)) {
          foundIdx = i
          mode = 'move'
          break
        }
      }
    }

    if (foundIdx !== null && mode) {
      // Start dragging existing line
      setEditingLineIndex(foundIdx)
      setDraggedMode(mode)
      lastMousePosForLine.current = { x, y }
      setIsDraggingLine(true)
      setCurrentLine(null)
      drawCanvas(0)
      return
    }

    // 3) No hit → start drawing new line
    setEditingLineIndex(null)
    setDraggedMode(null)
    setIsDraggingLine(false)
    const newLine: Line = { start: { x, y }, end: { x, y }, frame: currentFrame }
    setCurrentLine(newLine)
    drawCanvas(0)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = getCanvasCoords(e)

    // 1) If text is being dragged/resized/rotated (Frame 2)
    if (currentFrame === 2 && selectedTexts.length > 0) {
      if (isRotatingText) {
        const box = calculateGroupBoundingBox()
        if (box) rotateGroup(x, y, box)
        drawCanvas(0)
        return
      }
      if (isResizingText && resizeHandle) {
        if (selectedTexts.length === 1) {
          const which = selectedTexts[0]
          const pos = which === 'subtitle' ? subtitlePosF2 : titlePosF2[which === 'title1' ? 0 : 1]
          resizeSingleText(x, y, pos, which, resizeHandle)
        } else {
          resizeGroupTexts(x, y, resizeHandle)
        }
        drawCanvas(0)
        return
      }
      if (isDraggingText) {
        if (selectedTexts.length === 1) {
          const which = selectedTexts[0]
          dragSingleText(x, y, which)
        } else {
          dragGroupTexts(x, y)
        }
        drawCanvas(0)
        return
      }
    }

    // 2) If dragging an existing line
    if (isDraggingLine && editingLineIndex !== null && draggedMode && lastMousePosForLine.current) {
      const dx = x - lastMousePosForLine.current.x
      const dy = y - lastMousePosForLine.current.y
      setLines(prev => {
        const arr = [...prev]
        const ln = { ...arr[editingLineIndex] }
        if (draggedMode === 'start') {
          ln.start = { x, y }
        } else if (draggedMode === 'end') {
          ln.end = { x, y }
        } else {
          // move entire line
          ln.start = { x: ln.start.x + dx, y: ln.start.y + dy }
          ln.end = { x: ln.end.x + dx, y: ln.end.y + dy }
        }
        arr[editingLineIndex] = ln
        return arr
      })
      lastMousePosForLine.current = { x, y }
      drawCanvas(0)
      return
    }

    // 3) If creating a new line, update its “end”
    if (currentLine) {
      setCurrentLine(prev => (prev ? { ...prev, end: { x, y } } : null))
      drawCanvas(0)
      return
    }

    // 4) Otherwise, update cursor (hover feedback)
    updateCursor(canvas, x, y)
  }

  const handleMouseUp = () => {
    if (isPlaying) return

    // Finalize new line
    if (currentLine) {
      setLines(prev => [...prev, currentLine])
      setCurrentLine(null)
    }

    // End line dragging
    if (isDraggingLine) {
      setIsDraggingLine(false)
      setEditingLineIndex(null)
      setDraggedMode(null)
      lastMousePosForLine.current = null
      drawCanvas(0)
      return
    }

    // End any text interaction
    if (selectedTexts.length > 0) {
      setIsDraggingText(false)
      setIsResizingText(false)
      setIsRotatingText(false)
      setResizeHandle(null)
      setLastMousePosForText(null)
      drawCanvas(0)
      return
    }
  }

  const handleMouseLeave = () => {
    handleMouseUp()
  }

  // ─── FRAME CONTROLS ──────────────────────────────────────────────────────────────
  const changeFrame = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas(0)
  }

  const togglePlayState = () => {
    setIsPlaying(prev => !prev)
  }

  const toggleLoopState = () => {
    setIsLooping(prev => !prev)
  }

  // ─── TEXT INTERACTION HELPERS ─────────────────────────────────────────────────────
  const beginTextInteraction = (
    pos: TextPosition,
    type: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    if (currentFrame !== 2) return
    const now = Date.now()
    const isDouble = now - (lastMousePosForText?.current?.x || 0) < 300
    setLastMousePosForText({ x, y })

    if (isShiftPressed.current) {
      setSelectedTexts(prev =>
        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      )
    } else {
      setSelectedTexts([type])
    }

    setIsResizingText(false)
    setIsDraggingText(false)
    setIsRotatingText(false)
    setResizeHandle(null)

    // Check if clicked near a rotation “ring” for this pos
    if (isNearRotation(x, y, pos)) {
      setIsRotatingText(true)
      const grpBox = calculateGroupBoundingBox()
      if (grpBox) setInitialGroupBox(grpBox)
    } else {
      // Otherwise, see if we clicked on a resize handle or inside to move
      const handle = detectResizeHandle(x, y, pos)
      if (handle) {
        if (handle === 'move') {
          setIsDraggingText(true)
        } else {
          setIsResizingText(true)
          setResizeHandle(handle)
          setResizeStartPos({ x, y })
          const grpBox = calculateGroupBoundingBox()
          if (grpBox) setInitialGroupBox(grpBox)
        }
      } else {
        setIsDraggingText(true)
      }
    }

    drawCanvas(0)
    if (isDouble) {
      setPositionModalOpen(true)
      setEditingPosition(pos)
    }
  }

  const dragSingleText = (
    x: number,
    y: number,
    type: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosForText) return
    const dx = x - lastMousePosForText.x
    const dy = y - lastMousePosForText.y

    if (type === 'subtitle') {
      setSubtitlePosF2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    } else {
      setTitlePosF2(prev => {
        const copy = [...prev]
        const idx = type === 'title1' ? 0 : 1
        copy[idx] = { ...copy[idx], x: copy[idx].x + dx, y: copy[idx].y + dy }
        return copy
      })
    }

    setLastMousePosForText({ x, y })
  }

  const dragGroupTexts = (x: number, y: number) => {
    if (!lastMousePosForText) return
    const dx = x - lastMousePosForText.x
    const dy = y - lastMousePosForText.y

    // Move all selected titles
    setTitlePosF2(prev =>
      prev.map((pos, idx) =>
        selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
          ? { ...pos, x: pos.x + dx, y: pos.y + dy }
          : pos
      )
    )
    // Move subtitle if selected
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePosF2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }

    setLastMousePosForText({ x, y })
  }

  const resizeSingleText = (
    x: number,
    y: number,
    pos: TextPosition,
    type: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!resizeStartPos) return

    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const startVec = { x: resizeStartPos.x - cx, y: resizeStartPos.y - cy }
    const currVec = { x: x - cx, y: y - cy }
    let scale = 1
    const factor = 0.1

    if (handle.includes('e') || handle.includes('w')) {
      const sDist = Math.abs(startVec.x)
      const cDist = Math.abs(currVec.x)
      scale = sDist !== 0 ? 1 + ((cDist / sDist - 1) * factor) : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const sDist = Math.abs(startVec.y)
      const cDist = Math.abs(currVec.y)
      scale = sDist !== 0 ? 1 + ((cDist / sDist - 1) * factor) : 1
    }

    scale = Math.max(0.1, scale)
    const newW = pos.width * scale
    const newH = pos.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const newPos: TextPosition = {
      ...pos,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: pos.fontSize * scale,
    }

    if (type === 'subtitle') {
      setSubtitlePosF2(newPos)
    } else {
      setTitlePosF2(prev => {
        const copy = [...prev]
        const idx = type === 'title1' ? 0 : 1
        copy[idx] = newPos
        return copy
      })
    }
  }

  const resizeGroupTexts = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPos) return
    const dx = x - resizeStartPos.x
    const dy = y - resizeStartPos.y
    const cx = initialGroupBox.x + initialGroupBox.width / 2
    const cy = initialGroupBox.y + initialGroupBox.height / 2

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / initialGroupBox.width) * 0.5
    } else if (handle.includes('n') || handle.includes('s')) {
      scale = 1 + (dy / initialGroupBox.height) * 0.5
    }
    scale = Math.max(0.1, scale)
    const newW = initialGroupBox.width * scale
    const newH = initialGroupBox.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (pos: TextPosition) => {
      const relX = (pos.x + pos.width / 2 - cx) / (initialGroupBox.width / 2)
      const relY = (pos.y + pos.height / 2 - cy) / (initialGroupBox.height / 2)
      return {
        ...pos,
        x: cx + relX * (newW / 2) - (pos.width * scale) / 2,
        y: cy + relY * (newH / 2) - (pos.height * scale) / 2,
        width: pos.width * scale,
        height: pos.height * scale,
        fontSize: pos.fontSize * scale,
      }
    }

    setTitlePosF2(prev =>
      prev.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
          ? updatePos(pos)
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePosF2(prev => updatePos(prev))
    }
    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
  }

  const rotateSingleText = (
    x: number,
    y: number,
    pos: TextPosition,
    type: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosForText) return
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const lastAngle = Math.atan2(lastMousePosForText.y - cy, lastMousePosForText.x - cx)
    const currAngle = Math.atan2(y - cy, x - cx)
    let delta = currAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    if (type === 'subtitle') {
      setSubtitlePosF2(prev => ({ ...prev, rotation: prev.rotation + delta }))
    } else {
      setTitlePosF2(prev => {
        const copy = [...prev]
        const idx = type === 'title1' ? 0 : 1
        copy[idx] = { ...copy[idx], rotation: copy[idx].rotation + delta }
        return copy
      })
    }
    setLastMousePosForText({ x, y })
  }

  const rotateGroup = (x: number, y: number, box: GroupBoundingBox) => {
    if (!lastMousePosForText) return
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const lastAng = Math.atan2(lastMousePosForText.y - cy, lastMousePosForText.x - cx)
    const currAng = Math.atan2(y - cy, x - cx)
    let delta = currAng - lastAng
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    setTitlePosF2(prev =>
      prev.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
          ? rotateAround(pos, cx, cy, delta)
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePosF2(prev => rotateAround(prev, cx, cy, delta))
    }
    setGroupRotation(prev => prev + delta)
    setLastMousePosForText({ x, y })
  }

  const rotateAround = (
    pos: TextPosition,
    cx: number,
    cy: number,
    angle: number
  ): TextPosition => {
    const dx = pos.x + pos.width / 2 - cx
    const dy = pos.y + pos.height / 2 - cy
    const dist = Math.hypot(dx, dy)
    const currAng = Math.atan2(dy, dx)
    const newAng = currAng + angle
    const newX = cx + dist * Math.cos(newAng) - pos.width / 2
    const newY = cy + dist * Math.sin(newAng) - pos.height / 2
    return { ...pos, x: newX, y: newY, rotation: pos.rotation + angle }
  }

  // ─── SETTINGS HANDLER ────────────────────────────────────────────────────────────
  const handleSettings = (name: string, val: number) => {
    if (name === 'trembling') setTremblingIntensity(val)
    if (name === 'frameRate') setFrameRate(val)
    drawCanvas(0)
  }

  // ─── ANIMATION LOOP ───────────────────────────────────────────────────────────────
  const animateLoop = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current
    const msPerFrame = 1000 / frameRate
    let progress = elapsed / (msPerFrame * 150)
    if (progress > 1.4) {
      if (isLooping) {
        startTimeRef.current = timestamp
        progress = 0
      } else {
        progress = 1.4
        setIsPlaying(false)
      }
    }
    drawCanvas(progress)
    if (isPlaying || isLooping) {
      animationFrameRef.current = requestAnimationFrame(animateLoop)
    } else {
      drawCanvas(0)
    }
  }

  // ─── CURSOR MANAGEMENT ────────────────────────────────────────────────────────────
  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    // If Frame 2 and we hover over rotated group bounding box:
    const grpBox = calculateGroupBoundingBox()
    if (grpBox && currentFrame === 2 && isPointInRotatedRegion(x, y, getRotatedGroupBox(grpBox))) {
      if (isNearRotation(x, y, grpBox)) {
        canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
        return
      }
      const handle = detectResizeHandle(x, y, grpBox as any)
      if (handle) {
        canvas.style.cursor = handle
        return
      }
      canvas.style.cursor = 'move'
      return
    }

    // Otherwise, check each text’s rotated box
    const allPositions = [
      ...(currentFrame === 1 ? titlePosF1 : titlePosF2),
      currentFrame === 1 ? subtitlePosF1 : subtitlePosF2,
    ]
    if (currentFrame === 2) {
      for (const pos of allPositions) {
        const rotBox = getRotatedBoundingBox(pos)
        if (isPointInRotatedRegion(x, y, rotBox)) {
          if (isNearRotation(x, y, pos)) {
            canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
            return
          }
          const handle = detectResizeHandle(x, y, pos)
          if (handle) {
            canvas.style.cursor = handle
            return
          }
          canvas.style.cursor = 'move'
          return
        }
      }
    }

    canvas.style.cursor = 'default'
  }

  // ─── UTIL: Return True if (x,y) lies within the polygon “box” (rotated corners) ─────
  const isPointInRotatedRegion = (x: number, y: number, region: Point[]) => {
    let inside = false
    for (let i = 0, j = region.length - 1; i < region.length; j = i++) {
      const xi = region[i].x, yi = region[i].y
      const xj = region[j].x, yj = region[j].y
      const intersect =
        (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  // ─── UTIL: get rotated corners of a TextPosition ─────────────────────────────────
  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const w = pos.width
    const h = pos.height
    const corners: Point[] = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(pos.rotation) - corner.y * Math.sin(pos.rotation)
      const ry = corner.x * Math.sin(pos.rotation) + corner.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  // ─── UTIL: get rotated corners of a GroupBoundingBox ─────────────────────────────
  const getRotatedGroupBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const w = box.width
    const h = box.height
    const corners: Point[] = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(box.rotation) - corner.y * Math.sin(box.rotation)
      const ry = corner.x * Math.sin(box.rotation) + corner.y * Math.cos(box.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  // ─── UTIL: Return “move”, “ne-resize”, “nw-resize”, “se-resize”, “sw-resize” or null ──
  const detectResizeHandle = (
    x: number,
    y: number,
    pos: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = 20
    const cx = (pos as TextPosition).x + (pos as TextPosition).width / 2
    const cy = (pos as TextPosition).y + (pos as TextPosition).height / 2
    const rot = pos.rotation
    const dx = x - cx
    const dy = y - cy
    const ux = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const uy = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = (pos as TextPosition).width / 2
    const hh = (pos as TextPosition).height / 2

    // corners: NW, NE, SE, SW
    if (Math.abs(ux + hw) <= handleSize / 2 && Math.abs(uy + hh) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(ux - hw) <= handleSize / 2 && Math.abs(uy + hh) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(ux - hw) <= handleSize / 2 && Math.abs(uy - hh) <= handleSize / 2) return 'se-resize'
    if (Math.abs(ux + hw) <= handleSize / 2 && Math.abs(uy - hh) <= handleSize / 2) return 'sw-resize'

    // inside region → “move”
    if (Math.abs(ux) < hw && Math.abs(uy) < hh) return 'move'
    return null
  }

  // ─── UTIL: return true if clicked near rotation “ring” around a TextPosition ─────
  const isNearRotation = (
    x: number,
    y: number,
    pos: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = 20
    const rotArea = 15
    const cx = (pos as TextPosition).x + (pos as TextPosition).width / 2
    const cy = (pos as TextPosition).y + (pos as TextPosition).height / 2
    const rot = pos.rotation
    const dx = x - cx
    const dy = y - cy
    const ux = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const uy = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = (pos as TextPosition).width / 2
    const hh = (pos as TextPosition).height / 2

    const corners: { x: number; y: number }[] = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]
    for (const c of corners) {
      const dist = Math.hypot(ux - c.x, uy - c.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotArea) return true
    }
    return false
  }

  // ─── UTILITY: contrast text color (black or white) based on bg hex ──────────────
  function getContrastColor(bg: string): string {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ─── LEFT PANEL ─────────────────────────────────────────────────────────────── */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">
              Title 1
            </Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={e => setTitles([e.target.value, titles[1]])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">
              Title 2
            </Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={e => setTitles([titles[0], e.target.value])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">
              Subtitle
            </Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-600">Background Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {colorOptions.map(c => (
                <button
                  key={c.value}
                  onClick={() => setBackgroundColor(c.value)}
                  className="w-8 h-8 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  style={{ backgroundColor: c.value }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL ────────────────────────────────────────────────────────────── */}
        <div className="w-[600px] flex flex-col">
          <div
            className="w-[540px] h-[675px] bg-white rounded-lg shadow-lg mb-4 relative overflow-hidden"
            style={{ backgroundColor }}
          >
            <canvas
              ref={canvasRef}
              width={1080}
              height={1350}
              className="absolute inset-0 w-full h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
          </div>
          <div className="flex space-x-2 w-[540px]">
            <Button
              variant={currentFrame === 1 ? 'default' : 'outline'}
              onClick={() => changeFrame(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? 'default' : 'outline'}
              onClick={() => changeFrame(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button onClick={togglePlayState} className="w-[40px] h-[40px] p-0 rounded-full bg-black">
              {isPlaying ? (
                <PauseIcon className="h-5 w-5 text-white" />
              ) : (
                <PlayIcon className="h-5 w-5 text-white" />
              )}
            </Button>
            <Button
              onClick={toggleLoopState}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${
                isLooping ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => console.log('Export not implemented')} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── POSITION EDIT MODAL ──────────────────────────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editingPosition && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={e =>
                    setEditingPosition({
                      ...editingPosition,
                      x: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={e =>
                    setEditingPosition({
                      ...editingPosition,
                      y: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (degrees)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={e =>
                    setEditingPosition({
                      ...editingPosition,
                      rotation: Number(e.target.value) * (Math.PI / 180),
                    })
                  }
                />
              </div>
              <Button
                onClick={() => {
                  if (editingPosition) {
                    // Update the actual state
                    const type = selectedTexts[0]
                    if (type === 'subtitle') {
                      setSubtitlePosF2(editingPosition)
                    } else {
                      setTitlePosF2(prev => {
                        const copy = [...prev]
                        const idx = type === 'title1' ? 0 : 1
                        copy[idx] = editingPosition
                        return copy
                      })
                    }
                    setPositionModalOpen(false)
                    setEditingPosition(null)
                    drawCanvas(0)
                  }
                }}
              >
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SETTINGS MODAL ───────────────────────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lineThicknessSlider">Line Thickness (max 10)</Label>
              <Slider
                id="lineThicknessSlider"
                min={1}
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={value => {
                  setLineThickness(value[0])
                  drawCanvas(0)
                }}
              />
            </div>
            <div>
              <Label htmlFor="trembleSlider">Trembling Intensity</Label>
              <Slider
                id="trembleSlider"
                min={0}
                max={10}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={value => handleSettings('trembling', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate (50–120)</Label>
              <Slider
                id="frameRateSlider"
                min={50}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={value => handleSettings('frameRate', value[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
