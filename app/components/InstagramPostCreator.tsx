'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Point { x: number; y: number }
interface Line { start: Point; end: Point; frame: number }
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

const ultraFastEaseInOutFunction = (t: number): number => {
  if (t < 0.5) {
    return Math.pow(2 * t, 16) / 2
  } else {
    return 1 - Math.pow(-2 * t + 2, 16) / 2
  }
}

export default function InstagramPostCreator() {
  // ─── STATE ─────────────────────────────────────────────────────────────────────

  // Text content
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')

  // Background color
  const colorOptions = [
    { name: 'Light Pink', value: '#F6A69B' },
    { name: 'Light Blue', value: '#5894D0' },
    { name: 'Olive Green', value: '#5B6B4E' },
    { name: 'Orange', value: '#FF6700' },
    { name: 'Gray', value: '#6B6B6B' },
    { name: 'Purple', value: '#E0B0FF' },
    { name: 'Mint Green', value: '#D0EBDA' },
  ]
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')

  // Frame & playback
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)

  // Line‐drawing
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // Text positions for Frame 1 & Frame 2
  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({
    x: 40,
    y: 1000,
    width: 1000,
    height: 30,
    rotation: 0,
    fontSize: 36,
  })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({
    x: 40,
    y: 1000,
    width: 1000,
    height: 30,
    rotation: 0,
    fontSize: 36,
  })

  // Selection / bounding‐box / dragging / rotating / resizing
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)       // <─── THIS WAS MISSING
  const [isDragging, setIsDragging] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  // Animation settings
  const [lineThickness, setLineThickness] = useState(2)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025) // how fast “progress” advances
  const [frameRate, setFrameRate] = useState(60)               // new “frame‐per‐second” slider
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Rotation tracking
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)

  // Canvas refs for animation
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  // Mouse & keyboard
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  // Track individual rotations for multi‐select
  const [lastKnownRotations, setLastKnownRotations] = useState<{ [key: string]: number }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0,
  })

  // ─── EFFECT: Listen for Shift key on/off ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressed.current = true
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressed.current = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // ─── EFFECT: Recalculate text dimensions & redraw whenever content/props change ────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    updateTextDimensions(ctx)
    drawCanvas()
  }, [
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    lines,
    lineThickness,
    tremblingIntensity,
    frameRate,
  ])

  // ─── EFFECT: Start/stop animation when play/pause or frameRate/animationSpeed changes ─
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      lastFrameTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas()
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, frameRate, animationSpeed])

  // ─── TEXT DIMENSIONS ───────────────────────────────────────────────────────────────
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height:
          metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent ||
          fontSize * 0.8,
      }
    }

    // Frame 1 titles
    setTitlePositionsFrame1((prev) =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Frame 2 titles
    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Subtitles for both frames
    const { width: subW, height: subH } = measureText(
      subtitle,
      subtitlePositionFrame2.fontSize
    )
    setSubtitlePositionFrame1((prev) => ({
      ...prev,
      width: subW,
      height: subH,
      aspectRatio: subW / subH,
    }))
    setSubtitlePositionFrame2((prev) => ({
      ...prev,
      width: subW,
      height: subH,
      aspectRatio: subW / subH,
    }))
  }

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null

    const selectedPositions = titlePositionsFrame2
      .filter((_, i) => selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : [])

    if (selectedPositions.length === 0) return null
    let minX = Math.min(...selectedPositions.map((p) => p.x))
    let minY = Math.min(...selectedPositions.map((p) => p.y))
    let maxX = Math.max(...selectedPositions.map((p) => p.x + p.width))
    let maxY = Math.max(...selectedPositions.map((p) => p.y + p.height))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation,
    }
  }

  // ─── DRAWING & ANIMATION ────────────────────────────────────────────────────────────
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const frame1Lines = lines.filter((l) => l.frame === 1)
    const frame2Lines = lines.filter((l) => l.frame === 2)

    if (isPlaying) {
      // Frame 1 grow (0 ≤ prog ≤ 0.3)
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      }
      // Frame 1 shrink (0.3 < prog ≤ 0.6)
      else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      }
      // Transition text 1 → 2 (0.6 < prog ≤ 0.7)
      else if (progress <= 0.7) {
        const textProgress = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, textProgress, 1, 2)
      }
      // Frame 2 grow (0.7 < prog ≤ 1.0)
      else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      }
      // Frame 2 shrink (1.0 < prog ≤ 1.3)
      else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      }
      // Transition text 2 → 1 (1.3 < prog ≤ 1.4)
      else if (progress <= 1.4) {
        const textProgress = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, textProgress, 2, 1)
      }
    } else {
      // Static draw when paused
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      // If any text selected in frame 2, draw box(es)
      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          const positions = titlePositionsFrame2
          selectedTexts.forEach((txt) => {
            if (txt === 'title1' || txt === 'title2') {
              const idx = txt === 'title1' ? 0 : 1
              drawBoundingBox(ctx, positions[idx])
            } else {
              drawBoundingBox(ctx, subtitlePositionFrame2)
            }
          })
        }
      }
    }
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((t, i) => {
      drawRotatedText(ctx, positions[i], t)
    })
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  const drawRotatedText = (
    ctx: CanvasRenderingContext2D,
    pos: TextPosition,
    text: string
  ) => {
    ctx.save()
    ctx.translate(pos.x + pos.width / 2, pos.y + pos.height / 2)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  const drawLines = (ctx: CanvasRenderingContext2D, frameLines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'

    frameLines.forEach((line) => {
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    })

    if (currentLine) {
      ctx.beginPath()
      ctx.moveTo(currentLine.start.x, currentLine.start.y)
      ctx.lineTo(currentLine.end.x, currentLine.end.y)
      ctx.stroke()
    }
  }

  type AnimationType = 'grow' | 'shrink'
  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: AnimationType
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = isPlaying ? '#000000' : '#0000FF'

    const animationDuration = 0.3
    const maxStagger = 0.2

    const drawFrameLines = (linesArr: Line[], frameProg: number) => {
      const stagger = linesArr.length > 1 ? maxStagger / (linesArr.length - 1) : 0
      linesArr.forEach((line, idx) => {
        let t = Math.max(0, Math.min(1, (frameProg - idx * stagger) / animationDuration))
        t = ultraFastEaseInOutFunction(t)

        const { start, end } = line
        const currentEnd = {
          x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t),
        }

        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + tremX, start.y + tremY)
        ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length) {
      drawFrameLines(frame1Lines, progress)
    }
    if (frame2Lines.length) {
      drawFrameLines(frame2Lines, progress)
    }
  }

  const drawBoundingBox = (
    ctx: CanvasRenderingContext2D,
    pos: TextPosition
  ) => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(pos.rotation)

    const halfW = pos.width / 2
    const halfH = pos.height / 2

    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, pos.width, pos.height)

    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })

    ctx.restore()
  }

  const drawGroupBoundingBox = (
    ctx: CanvasRenderingContext2D,
    box: GroupBoundingBox
  ) => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(box.rotation)

    const halfW = box.width / 2
    const halfH = box.height / 2

    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, box.width, box.height)

    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })

    ctx.restore()
  }

  // ─── CURSOR HELPERS & COLLISIONS ────────────────────────────────────────────────
  const getResizeHandle = (
    x: number,
    y: number,
    pos: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = 20
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const rot = pos.rotation

    const dx = x - cx
    const dy = y - cy
    const rX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const rY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const halfW = pos.width / 2
    const halfH = pos.height / 2

    if (Math.abs(rX + halfW) <= handleSize / 2 && Math.abs(rY + halfH) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(rX - halfW) <= handleSize / 2 && Math.abs(rY + halfH) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(rX - halfW) <= handleSize / 2 && Math.abs(rY - halfH) <= handleSize / 2) return 'se-resize'
    if (Math.abs(rX + halfW) <= handleSize / 2 && Math.abs(rY - halfH) <= handleSize / 2) return 'sw-resize'
    if (Math.abs(rX) < halfW && Math.abs(rY) < halfH) return 'move'
    return null
  }

  const isPointNearRotationArea = (
    x: number,
    y: number,
    pos: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const rot = pos.rotation

    const dx = x - cx
    const dy = y - cy
    const rX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const rY = dx * Math.sin(-rot) + dy * Math.cos(-rot)

    const halfW = pos.width / 2
    const halfH = pos.height / 2

    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ]

    for (const c of corners) {
      const dist = Math.hypot(rX - c.x, rY - c.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationAreaSize) {
        return true
      }
    }
    return false
  }

  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const w = pos.width
    const h = pos.height

    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]

    return corners.map((c) => {
      const rx = c.x * Math.cos(pos.rotation) - c.y * Math.sin(pos.rotation)
      const ry = c.x * Math.sin(pos.rotation) + c.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const { x, y, width, height, rotation } = box
    const cx = x + width / 2
    const cy = y + height / 2
    const w = width
    const h = height

    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]

    return corners.map((c) => {
      const rx = c.x * Math.cos(rotation) - c.y * Math.sin(rotation)
      const ry = c.x * Math.sin(rotation) + c.y * Math.cos(rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x
      const yi = box[i].y
      const xj = box[j].x
      const yj = box[j].y
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  const isPointNear = (point: Point, target: Point | Line, threshold = 10): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold
    }
  }

  const pointToLineDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq

    let xx, yy
    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  // ─── MOUSE EVENTS ─────────────────────────────────────────────────────────────────

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If text is selected in Frame 2
    if (selectedTexts.length > 0 && currentFrame === 2) {
      if (isRotating) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) rotateGroup(x, y, groupBox)
      } else if (isDragging) {
        if (selectedTexts.length === 1) {
          dragSingle(x, y, selectedTexts[0])
        } else {
          dragGroup(x, y)
        }
      } else if (isResizing && resizeHandle) {
        if (selectedTexts.length === 1) {
          const textType = selectedTexts[0]
          const pos =
            textType === 'subtitle'
              ? subtitlePositionFrame2
              : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, textType, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
      return
    }

    // Otherwise, if drawing/editing lines:
    if (currentLine) {
      setCurrentLine((prev) => ({
        ...prev!,
        end: { x, y },
      }))
      drawCanvas()
    } else if (editingLineIndex !== null) {
      setLines((prev) => {
        const newLines = [...prev]
        const edited = { ...newLines[editingLineIndex] }
        if (isPointNear({ x, y }, edited.start)) {
          edited.start = { x, y }
        } else if (isPointNear({ x, y }, edited.end)) {
          edited.end = { x, y }
        }
        newLines[editingLineIndex] = edited
        return newLines
      })
      drawCanvas()
    } else {
      updateCursor(canvas, x, y)
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    lastMousePosition.current = { x, y }

    // Check if clicking on a text box
    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    for (let i = 0; i < positions.length; i++) {
      if (
        isPointInRotatedBox(
          x,
          y,
          getRotatedBoundingBox(positions[i])
        )
      ) {
        handleTextInteraction(
          positions[i],
          `title${i + 1}` as 'title1' | 'title2',
          x,
          y
        )
        return
      }
    }
    if (
      isPointInRotatedBox(
        x,
        y,
        getRotatedBoundingBox(subPos)
      )
    ) {
      handleTextInteraction(subPos, 'subtitle', x, y)
      return
    }

    // If Shift not held, clear selection
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    // Check if clicking an existing line
    const clickedIdx = lines.findIndex(
      (l) =>
        l.frame === currentFrame &&
        (isPointNear({ x, y }, l) ||
          isPointNear({ x, y }, l.start) ||
          isPointNear({ x, y }, l.end))
    )
    if (clickedIdx !== -1) {
      setEditingLineIndex(clickedIdx)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  const handleMouseUp = () => {
    if (isPlaying) return
    if (currentLine) {
      setLines((prev) => [...prev, currentLine])
      setCurrentLine(null)
    }
    setEditingLineIndex(null)
    setIsResizing(false)   // ← now defined
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)
    lastMousePosition.current = null
    drawCanvas()
  }

  const updateCursor = (
    canvas: HTMLCanvasElement,
    x: number,
    y: number
  ) => {
    const groupBox = calculateGroupBoundingBox()
    if (
      groupBox &&
      currentFrame === 2 &&
      isPointInRotatedBox(x, y, getRotatedGroupBoundingBox(groupBox))
    ) {
      if (isPointNearRotationArea(x, y, groupBox)) {
        canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
        return
      }
      const handle = getResizeHandle(x, y, groupBox)
      if (handle) {
        canvas.style.cursor = handle
        return
      }
      canvas.style.cursor = 'move'
      return
    }

    const currentPositions =
      currentFrame === 1
        ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
        : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]
    for (let i = 0; i < currentPositions.length; i++) {
      const pos = currentPositions[i]
      if (
        isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))
      ) {
        if (currentFrame === 2) {
          if (isPointNearRotationArea(x, y, pos)) {
            canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
            return
          }
          const handle = getResizeHandle(x, y, pos)
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

  // ─── TEXT INTERACTIONS (select / move / rotate / resize) ──────────────────────────
  const handleTextInteraction = (
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    if (currentFrame !== 2) return
    lastMousePosition.current = { x, y }

    if (selectedTexts.length > 0) {
      setLastKnownRotations((prev) => ({
        ...prev,
        group: groupRotation,
      }))
    }

    if (isShiftPressed.current) {
      setSelectedTexts((prev) => {
        const newSel = prev.includes(textType)
          ? prev.filter((t) => t !== textType)
          : [...prev, textType]
        if (newSel.length > 1) {
          setGroupRotation(lastKnownRotations.group)
        } else if (newSel.length === 1) {
          setGroupRotation(lastKnownRotations[newSel[0]])
        }
        return newSel
      })
    } else {
      setSelectedTexts([textType])
      setGroupRotation(lastKnownRotations[textType])
    }

    // Reset any in‐progress interaction
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

    if (isPointNearRotationArea(x, y, pos)) {
      setIsRotating(true)
      const box = calculateGroupBoundingBox()
      if (box) setInitialGroupBox(box)
    } else {
      const handle = getResizeHandle(x, y, pos)
      if (handle) {
        if (handle === 'move') {
          setIsDragging(true)
        } else {
          setResizeHandle(handle)
          setIsResizing(true)
        }
      } else {
        setIsDragging(true)
      }
    }

    drawCanvas()
  }

  const resizeSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!lastMousePosition.current) return

    const currentPos =
      textType === 'subtitle'
        ? subtitlePositionFrame2
        : titlePositionsFrame2[textType === 'title1' ? 0 : 1]

    const cx = currentPos.x + currentPos.width / 2
    const cy = currentPos.y + currentPos.height / 2

    const startVec = {
      x: lastMousePosition.current.x - cx,
      y: lastMousePosition.current.y - cy,
    }
    const curVec = { x: x - cx, y: y - cy }

    const resizeFactor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const curDist = Math.abs(curVec.x)
      if (startDist !== 0) {
        scale = 1 + ((curDist / startDist - 1) * resizeFactor)
      }
    } else if (handle.includes('n') || handle.includes('s')) {
      const startDist = Math.abs(startVec.y)
      const curDist = Math.abs(curVec.y)
      if (startDist !== 0) {
        scale = 1 + ((curDist / startDist - 1) * resizeFactor)
      }
    }

    scale = Math.max(0.1, scale)
    const newW = currentPos.width * scale
    const newH = currentPos.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updated: TextPosition = {
      ...currentPos,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: currentPos.fontSize * scale,
    }

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(updated)
    } else {
      setTitlePositionsFrame2((prev) => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = updated
        return copy
      })
    }

    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !lastMousePosition.current) return

    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    const cx = initialGroupBox.x + initialGroupBox.width / 2
    const cy = initialGroupBox.y + initialGroupBox.height / 2

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / initialGroupBox.width) * 0.1
    } else if (handle.includes('n') || handle.includes('s')) {
      scale = 1 + (dy / initialGroupBox.height) * 0.1
    }
    scale = Math.max(0.1, scale)

    const newW = initialGroupBox.width * scale
    const newH = initialGroupBox.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (p: TextPosition): TextPosition => {
      const relX = (p.x - cx) / (initialGroupBox.width / 2)
      const relY = (p.y - cy) / (initialGroupBox.height / 2)
      return {
        ...p,
        x: cx + relX * (newW / 2),
        y: cy + relY * (newH / 2),
        width: p.width * scale,
        height: p.height * scale,
        fontSize: p.fontSize * scale,
      }
    }

    setTitlePositionsFrame2((prev) =>
      prev.map((p, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
          ? updatePos(p)
          : p
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => updatePos(prev))
    }

    setInitialGroupBox({
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      rotation: initialGroupBox.rotation,
    })
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  const rotateGroup = (
    x: number,
    y: number,
    groupBox: GroupBoundingBox
  ) => {
    if (!lastMousePosition.current) return

    const cx = groupBox.x + groupBox.width / 2
    const cy = groupBox.y + groupBox.height / 2

    const lastAngle = Math.atan2(
      lastMousePosition.current.y - cy,
      lastMousePosition.current.x - cx
    )
    const curAngle = Math.atan2(y - cy, x - cx)
    let delta = curAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    setTitlePositionsFrame2((prev) =>
      prev.map((pos, i) => {
        const key = `title${i + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(key)) {
          setLastKnownRotations((lk) => ({
            ...lk,
            [key]: pos.rotation + delta,
          }))
          return rotateAroundPoint(pos, cx, cy, delta)
        }
        return pos
      })
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => {
        const newPos = rotateAroundPoint(prev, cx, cy, delta)
        setLastKnownRotations((lk) => ({
          ...lk,
          subtitle: newPos.rotation,
        }))
        return newPos
      })
    }

    setGroupRotation((prev) => {
      const nr = prev + delta
      setLastKnownRotations((lk) => ({
        ...lk,
        group: nr,
      }))
      return nr
    })

    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  const rotateAroundPoint = (
    pos: TextPosition,
    cx: number,
    cy: number,
    angle: number
  ): TextPosition => {
    const dx = pos.x + pos.width / 2 - cx
    const dy = pos.y + pos.height / 2 - cy
    const dist = Math.hypot(dx, dy)
    const origAng = Math.atan2(dy, dx)
    const newAng = origAng + angle
    const newX = cx + dist * Math.cos(newAng) - pos.width / 2
    const newY = cy + dist * Math.sin(newAng) - pos.height / 2
    return {
      ...pos,
      x: newX,
      y: newY,
      rotation: pos.rotation + angle,
    }
  }

  // ─── ANIMATION LOOP (honoring frameRate) ─────────────────────────────────────────
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
    }
    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = timestamp
    }

    const elapsedSinceLastFrame = timestamp - lastFrameTimeRef.current!
    const frameInterval = 1000 / frameRate
    if (elapsedSinceLastFrame < frameInterval) {
      animationRef.current = requestAnimationFrame(animate)
      return
    }
    lastFrameTimeRef.current = timestamp

    const elapsed = timestamp - startTimeRef.current!
    let progress = elapsed * animationSpeed

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

    if (isLooping || isPlaying) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawCanvas(0)
    }
  }

  // ─── CONTROL HANDLERS ─────────────────────────────────────────────────────────────

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const togglePlay = () => {
    setIsPlaying((prev) => !prev)
  }

  const toggleLoop = () => {
    setIsLooping((prev) => !prev)
  }

  const handleExport = () => {
    console.log('Export functionality not implemented yet')
  }

  const updatePosition = (newPos: TextPosition) => {
    if (
      selectedTexts.includes('title1') ||
      selectedTexts.includes('title2')
    ) {
      setTitlePositionsFrame2((prev) => {
        const copy = [...prev]
        selectedTexts.forEach((sel) => {
          if (sel === 'title1' || sel === 'title2') {
            const idx = sel === 'title1' ? 0 : 1
            copy[idx] = newPos
          }
        })
        return copy
      })
    }
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(newPos)
    }
    setPositionModalOpen(false)
    drawCanvas()
  }

  const handleSettingsChange = (name: string, value: number) => {
    switch (name) {
      case 'lineThickness':
        setLineThickness(value)
        break
      case 'animationSpeed':
        setAnimationSpeed(value)
        break
      case 'staggerDelay':
        setStaggerDelay(value)
        break
      case 'tremblingIntensity':
        setTremblingIntensity(value)
        break
      case 'frameRate':
        setFrameRate(value)
        break
    }
    drawCanvas()
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ── Left Panel ───────────────────────────────────────────────────────────── */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">
              Title 1
            </Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={(e) => setTitles([e.target.value, titles[1]])}
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
              onChange={(e) => setTitles([titles[0], e.target.value])}
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
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-600">Background Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setBackgroundColor(color.value)}
                  className="w-8 h-8 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  style={{ backgroundColor: color.value }}
                  aria-label={color.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Canvas & Controls ───────────────────────────────────────────────── */}
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
              onMouseLeave={handleMouseUp}
            />
          </div>
          <div className="flex space-x-2 w-[540px]">
            <Button
              variant={currentFrame === 1 ? 'default' : 'outline'}
              onClick={() => handleFrameChange(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? 'default' : 'outline'}
              onClick={() => handleFrameChange(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button
              onClick={togglePlay}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black"
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5 text-white" />
              ) : (
                <PlayIcon className="h-5 w-5 text-white" />
              )}
            </Button>
            <Button
              onClick={toggleLoop}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${
                isLooping ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={handleExport}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
            >
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={() => setSettingsOpen(true)}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
            >
              <Settings className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Position Editor Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editingPosition && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="xPosition">X Position</Label>
                <Input
                  id="xPosition"
                  type="number"
                  value={editingPosition.x}
                  onChange={(e) =>
                    setEditingPosition({
                      ...editingPosition,
                      x: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="yPosition">Y Position</Label>
                <Input
                  id="yPosition"
                  type="number"
                  value={editingPosition.y}
                  onChange={(e) =>
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
                  onChange={(e) =>
                    setEditingPosition({
                      ...editingPosition,
                      rotation: Number(e.target.value) * (Math.PI / 180),
                    })
                  }
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)}>
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lineThickness">Line Thickness</Label>
              <Slider
                id="lineThickness"
                min={1}
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={(val) => handleSettingsChange('lineThickness', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="animationSpeed">Animation Speed</Label>
              <Slider
                id="animationSpeed"
                min={0.00005}
                max={0.0005}
                step={0.00001}
                value={[animationSpeed]}
                onValueChange={(val) => handleSettingsChange('animationSpeed', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="staggerDelay">Line Stagger Delay</Label>
              <Slider
                id="staggerDelay"
                min={0}
                max={0.5}
                step={0.01}
                value={[staggerDelay]}
                onValueChange={(val) => handleSettingsChange('staggerDelay', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="tremblingIntensity">Trembling Intensity</Label>
              <Slider
                id="tremblingIntensity"
                min={0}
                max={10}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={(val) => handleSettingsChange('tremblingIntensity', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRate">Frame Rate</Label>
              <Slider
                id="frameRate"
                min={1}
                max={60}
                step={1}
                value={[frameRate]}
                onValueChange={(val) => handleSettingsChange('frameRate', val[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── UTILITY: Contrast color (black or white) based on background ─────────────────
function getContrastColor(bgColor: string): string {
  const r = parseInt(bgColor.slice(1, 3), 16)
  const g = parseInt(bgColor.slice(3, 5), 16)
  const b = parseInt(bgColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}
