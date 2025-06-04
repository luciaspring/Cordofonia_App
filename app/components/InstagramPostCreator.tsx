'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings as SettingsIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Point { x: number, y: number }
interface Line { start: Point, end: Point, frame: number }
interface TextPosition { x: number, y: number, width: number, height: number, rotation: number, fontSize: number, aspectRatio?: number }
interface GroupBoundingBox { x: number, y: number, width: number, height: number, rotation: number }

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

export default function InstagramPostCreator() {
  // Text content states
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')

  // Animation / playback states
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)

  // Lines drawn by user
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // Text position & style states for Frame 1 and Frame 2
  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36 })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36 })

  // Selected text blocks (for dragging/rotating/resizing)
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)

  // Modal for direct numeric editing
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  // Settings states
  const [lineThickness, setLineThickness] = useState(2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025) // base “speed” multiplier
  const [frameRate, setFrameRate] = useState(60) // frames per second for stop-motion effect

  // Rotation group tracking
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)

  // Refs for animation timing and interactions
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  // Track last known rotations for each text block (so multi-selection preserves rotation)
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0
  })

  // --- Setup keyboard listeners to detect Shift for multi-select ---
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

  // --- Whenever text content, positions, background, or interaction states change, redraw the canvas ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        updateTextDimensions(ctx)
        drawCanvas()
      }
    }
  }, [
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    lines,
    lineThickness,
    tremblingIntensity,
    titlePositionsFrame1,
    titlePositionsFrame2,
    subtitlePositionFrame1,
    subtitlePositionFrame2,
    groupRotation
  ])

  // --- Trigger animation loop when isPlaying changes ---
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
  }, [isPlaying, frameRate, animationSpeed, isLooping])

  // --- Measure text widths/heights to update bounding boxes dynamically ---
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }

    // Titles Frame 1
    setTitlePositionsFrame1(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )
    // Titles Frame 2
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Subtitle both frames
    const { width: subW, height: subH } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    setSubtitlePositionFrame1(prev => ({ ...prev, width: subW, height: subH, aspectRatio: subW / subH }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: subW, height: subH, aspectRatio: subW / subH }))
  }

  // --- Main drawing routine: draws static or animated content depending on play state ---
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Separate lines by frame
    const frame1Lines = lines.filter(l => l.frame === 1)
    const frame2Lines = lines.filter(l => l.frame === 2)

    if (isPlaying) {
      // Animation timeline: 0–0.3 grow frame1, 0.3–0.6 shrink frame1,
      // 0.6–0.7 text transition to frame2, 0.7–1.0 grow frame2, 1.0–1.3 shrink frame2,
      // 1.3–1.4 text transition back to frame1.
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {
        const t = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, t, 1, 2)
      } else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {
        const t = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, t, 2, 1)
      }
    } else {
      // Static view: current frame's lines + text + bounding box if selected
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) drawGroupBoundingBox(ctx, groupBox)
        else {
          // Draw individual bounding boxes for single selection
          const positions = titlePositionsFrame2
          selectedTexts.forEach(sel => {
            if (sel === 'title1') drawBoundingBox(ctx, positions[0])
            if (sel === 'title2') drawBoundingBox(ctx, positions[1])
            if (sel === 'subtitle') drawBoundingBox(ctx, subtitlePositionFrame2)
          })
        }
      }
    }
  }

  // --- Interpolate text positions during transition (1→2 or 2→1) ---
  const drawAnimatedText = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const ease = (t: number) => {
      if (t < 0.5) return Math.pow(2 * t, 16) / 2
      return 1 - Math.pow(-2 * t + 2, 16) / 2
    }
    const t = ease(progress)

    titles.forEach((title, i) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const pos2 = toFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const interp: TextPosition = {
        x: lerp(pos1.x, pos2.x, t),
        y: lerp(pos1.y, pos2.y, t),
        width: lerp(pos1.width, pos2.width, t),
        height: lerp(pos1.height, pos2.height, t),
        rotation: lerp(pos1.rotation, pos2.rotation, t),
        fontSize: lerp(pos1.fontSize, pos2.fontSize, t)
      }
      drawRotatedText(ctx, interp, title)
    })

    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const interpSub: TextPosition = {
      x: lerp(sub1.x, sub2.x, t),
      y: lerp(sub1.y, sub2.y, t),
      width: lerp(sub1.width, sub2.width, t),
      height: lerp(sub1.height, sub2.height, t),
      rotation: lerp(sub1.rotation, sub2.rotation, t),
      fontSize: lerp(sub1.fontSize, sub2.fontSize, t)
    }
    drawRotatedText(ctx, interpSub, subtitle)
  }

  // --- Draw static text blocks (no animation) for a given frame ---
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((title, i) => {
      drawRotatedText(ctx, positions[i], title)
    })
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  // --- Core routine to draw a single piece of rotated (and trembling) text ---
  const drawRotatedText = (ctx: CanvasRenderingContext2D, position: TextPosition, text: string) => {
    ctx.save()
    // Translate to the center of the bounding box
    ctx.translate(position.x + position.width / 2, position.y + position.height / 2)
    ctx.rotate(position.rotation)
    ctx.font = `bold ${position.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    // Tremble effect for text (same as lines)
    const trembleX = (Math.random() - 0.5) * tremblingIntensity
    const trembleY = (Math.random() - 0.5) * tremblingIntensity

    // Draw text at a tiny random offset
    ctx.fillText(text, trembleX, trembleY)
    ctx.restore()
  }

  // --- Draw all static lines for a frame ---
  const drawLines = (ctx: CanvasRenderingContext2D, frameLines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'

    frameLines.forEach(line => {
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

  // --- Draw animated lines (grow/shrink) with trembling ---
  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    mode: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = isPlaying ? '#000000' : '#0000FF'

    const duration = 0.3
    const maxStagger = 0.2
    const drawFrameSet = (linesArr: Line[], p: number) => {
      const stagger = linesArr.length > 1 ? maxStagger / (linesArr.length - 1) : 0
      linesArr.forEach((line, idx) => {
        let t = Math.max(0, Math.min(1, (p - idx * stagger) / duration))
        // Use same ultra-fast ease as text
        t = t < 0.5 ? Math.pow(2 * t, 16) / 2 : 1 - Math.pow(-2 * t + 2, 16) / 2

        const { start, end } = line
        const currentEnd = {
          x: start.x + (end.x - start.x) * (mode === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (mode === 'grow' ? t : 1 - t)
        }
        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + tremX, start.y + tremY)
        ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length > 0) drawFrameSet(frame1Lines, progress)
    if (frame2Lines.length > 0) drawFrameSet(frame2Lines, progress)
  }

  // --- Draw bounding box around a single text block ---
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(pos.rotation)

    const halfW = pos.width / 2
    const halfH = pos.height / 2
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, pos.width, pos.height)

    const handleSize = 10
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ]
    corners.forEach(corner => {
      ctx.beginPath()
      ctx.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    ctx.restore()
  }

  // --- Draw bounding box around a group of selected text blocks ---
  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(box.rotation)

    const halfW = box.width / 2
    const halfH = box.height / 2
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, box.width, box.height)

    const handleSize = 10
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ]
    corners.forEach(corner => {
      ctx.beginPath()
      ctx.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    ctx.restore()
  }

  // --- Calculate bounding box that contains all selected text blocks (for group transforms) ---
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    // Collect all relevant positions for Frame 2
    const selectedPositions: TextPosition[] = []
    selectedTexts.forEach(sel => {
      if (sel === 'title1') selectedPositions.push(titlePositionsFrame2[0])
      if (sel === 'title2') selectedPositions.push(titlePositionsFrame2[1])
      if (sel === 'subtitle') selectedPositions.push(subtitlePositionFrame2)
    })
    if (selectedPositions.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    selectedPositions.forEach(pos => {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + pos.width)
      maxY = Math.max(maxY, pos.y + pos.height)
    })
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation
    }
  }

  // --- Mouse coordinate utilities ---
  const isPointNear = (pt: Point, target: Point | Line, threshold = 10): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = pt.x - target.x
      const dy = pt.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(pt, target.start, target.end) < threshold
    }
  }

  const pointToLineDistance = (pt: Point, a: Point, b: Point) => {
    const A = pt.x - a.x
    const B = pt.y - a.y
    const C = b.x - a.x
    const D = b.y - a.y
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq

    let xx: number, yy: number
    if (param < 0) {
      xx = a.x
      yy = a.y
    } else if (param > 1) {
      xx = b.x
      yy = b.y
    } else {
      xx = a.x + param * C
      yy = a.y + param * D
    }
    const dx = pt.x - xx
    const dy = pt.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  // --- Check if a point lies within a rotated polygon (text bounding box or group box) ---
  const isPointInRotatedBox = (x: number, y: number, corners: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const xi = corners[i].x, yi = corners[i].y
      const xj = corners[j].x, yj = corners[j].y
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  // --- Given a TextPosition, return its rotated-corner coordinates ---
  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const w = pos.width
    const h = pos.height
    const angle = pos.rotation
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ]
    return corners.map(c => ({
      x: c.x * Math.cos(angle) - c.y * Math.sin(angle) + cx,
      y: c.x * Math.sin(angle) + c.y * Math.cos(angle) + cy
    }))
  }

  // --- Given a GroupBoundingBox, return its rotated-corner coordinates ---
  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const w = box.width
    const h = box.height
    const angle = box.rotation
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ]
    return corners.map(c => ({
      x: c.x * Math.cos(angle) - c.y * Math.sin(angle) + cx,
      y: c.x * Math.sin(angle) + c.y * Math.cos(angle) + cy
    }))
  }

  // --- Determine which resize handle (if any) the mouse is over for a box or group ---
  const getResizeHandle = (
    x: number,
    y: number,
    box: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = 20
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const angle = box.rotation
    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-angle) - dy * Math.sin(-angle)
    const ry = dx * Math.sin(-angle) + dy * Math.cos(-angle)

    const halfW = box.width / 2
    const halfH = box.height / 2
    // corners: top-left, top-right, bottom-right, bottom-left
    if (
      Math.abs(rx + halfW) <= handleSize / 2 &&
      Math.abs(ry + halfH) <= handleSize / 2
    )
      return 'nw-resize'
    if (
      Math.abs(rx - halfW) <= handleSize / 2 &&
      Math.abs(ry + halfH) <= handleSize / 2
    )
      return 'ne-resize'
    if (
      Math.abs(rx - halfW) <= handleSize / 2 &&
      Math.abs(ry - halfH) <= handleSize / 2
    )
      return 'se-resize'
    if (
      Math.abs(rx + halfW) <= handleSize / 2 &&
      Math.abs(ry - halfH) <= handleSize / 2
    )
      return 'sw-resize'

    // If inside the box but not on a handle, it's a move
    if (Math.abs(rx) < halfW && Math.abs(ry) < halfH) return 'move'
    return null
  }

  // --- Determine if a point is near the “rotation area” around a box corner ---
  const isPointNearRotationArea = (
    x: number,
    y: number,
    box: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = 20
    const rotationRadius = 15
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const angle = box.rotation
    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-angle) - dy * Math.sin(-angle)
    const ry = dx * Math.sin(-angle) + dy * Math.cos(-angle)

    const halfW = box.width / 2
    const halfH = box.height / 2
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ]
    for (const c of corners) {
      const dist = Math.hypot(rx - c.x, ry - c.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationRadius) return true
    }
    return false
  }

  // --- Rotate a single text block around (cx,cy) by angle radians ---
  const rotateAroundPoint = (
    pos: TextPosition,
    cx: number,
    cy: number,
    angleDelta: number
  ): TextPosition => {
    const dx = pos.x + pos.width / 2 - cx
    const dy = pos.y + pos.height / 2 - cy
    const dist = Math.hypot(dx, dy)
    const currentAngle = Math.atan2(dy, dx)
    const newAngle = currentAngle + angleDelta
    const nx = cx + dist * Math.cos(newAngle) - pos.width / 2
    const ny = cy + dist * Math.sin(newAngle) - pos.height / 2
    return {
      ...pos,
      x: nx,
      y: ny,
      rotation: pos.rotation + angleDelta
    }
  }

  // --- Group rotation using rotateAroundPoint on each selected block ---
  const rotateGroup = (x: number, y: number, groupBox: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = groupBox.x + groupBox.width / 2
    const cy = groupBox.y + groupBox.height / 2

    const lastAngle = Math.atan2(
      lastMousePosition.current.y - cy,
      lastMousePosition.current.x - cx
    )
    const currentAngle = Math.atan2(y - cy, x - cx)
    let delta = currentAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    // Rotate each selected block
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const key = `title${i + 1}`
        if (selectedTexts.includes(key as 'title1' | 'title2')) {
          // store individual rotations
          setLastKnownRotations(pk => ({ ...pk, [key]: pos.rotation + delta }))
          return rotateAroundPoint(pos, cx, cy, delta)
        }
        return pos
      })
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const rotated = rotateAroundPoint(prev, cx, cy, delta)
        setLastKnownRotations(pk => ({ ...pk, subtitle: rotated.rotation }))
        return rotated
      })
    }

    setGroupRotation(gr => {
      const nr = gr + delta
      setLastKnownRotations(pk => ({ ...pk, group: nr }))
      return nr
    })

    lastMousePosition.current = { x, y }
  }

  // --- Resize a single text block via handle ---
  const resizeSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textKey: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!lastMousePosition.current) return
    // center of the block
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2

    const startVector = {
      x: lastMousePosition.current.x - cx,
      y: lastMousePosition.current.y - cy
    }
    const currentVector = { x: x - cx, y: y - cy }

    const speedFactor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const sd = Math.abs(startVector.x)
      const cd = Math.abs(currentVector.x)
      scale = sd !== 0 ? 1 + ((cd / sd - 1) * speedFactor) : 1
    } else {
      const sd = Math.abs(startVector.y)
      const cd = Math.abs(currentVector.y)
      scale = sd !== 0 ? 1 + ((cd / sd - 1) * speedFactor) : 1
    }
    scale = Math.max(0.1, scale)

    const newW = pos.width * scale
    const newH = pos.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updated: TextPosition = {
      ...pos,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: pos.fontSize * scale
    }
    if (textKey === 'subtitle') {
      setSubtitlePositionFrame2(updated)
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textKey === 'title1' ? 0 : 1
        arr[idx] = updated
        return arr
      })
    }
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  // --- Drag a single text block ---
  const dragSingle = (x: number, y: number, textKey: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    if (textKey === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textKey === 'title1' ? 0 : 1
        arr[idx] = { ...arr[idx], x: arr[idx].x + dx, y: arr[idx].y + dy }
        return arr
      })
    }
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  // --- Drag a group of selected text blocks ---
  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const key = `title${i + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(key)) {
          return { ...pos, x: pos.x + dx, y: pos.y + dy }
        }
        return pos
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  // --- Handle mouse move: dragging/resizing/rotating or adjusting line endpoints ---
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If text elements selected in Frame 2, handle their transforms first
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
          const key = selectedTexts[0]
          const pos = key === 'subtitle'
            ? subtitlePositionFrame2
            : titlePositionsFrame2[key === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, key, resizeHandle)
        } else {
          const groupBox = calculateGroupBoundingBox()
          if (groupBox) resizeGroup(x, y, resizeHandle, groupBox)
        }
      }
      drawCanvas()
      updateCursor(canvas, x, y)
      return
    }

    // If currently drawing or editing a line:
    if (currentLine) {
      setCurrentLine(prev => ({
        ...prev!,
        end: { x, y }
      }))
      drawCanvas()
      updateCursor(canvas, x, y)
      return
    } else if (editingLineIndex !== null) {
      setLines(prev => {
        const arr = [...prev]
        const ln = { ...arr[editingLineIndex] }
        if (isPointNear({ x, y }, ln.start)) ln.start = { x, y }
        else if (isPointNear({ x, y }, ln.end)) ln.end = { x, y }
        arr[editingLineIndex] = ln
        return arr
      })
      drawCanvas()
      updateCursor(canvas, x, y)
      return
    }

    // If no text transform or current line, update cursor (hover feedback)
    updateCursor(canvas, x, y)
  }

  // --- Handle mouse down: selecting text or starting a line ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    lastMousePosition.current = { x, y }

    // Check if clicked on any text block in Frame 2
    if (currentFrame === 2) {
      // Titles:
      for (let i = 0; i < 2; i++) {
        const pos = titlePositionsFrame2[i]
        if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))) {
          handleTextInteraction(pos, `title${i + 1}` as 'title1' | 'title2', x, y)
          return
        }
      }
      // Subtitle:
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePositionFrame2))) {
        handleTextInteraction(subtitlePositionFrame2, 'subtitle', x, y)
        return
      }
    }

    // If we clicked elsewhere, start drawing/editing a line
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }
    const clickedLineIdx = lines.findIndex(line =>
      line.frame === currentFrame &&
      (isPointNear({ x, y }, line.start) ||
        isPointNear({ x, y }, line.end) ||
        isPointNear({ x, y }, line))
    )
    if (clickedLineIdx !== -1) {
      setEditingLineIndex(clickedLineIdx)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  // --- Handle mouse up: finalize line or finish transforms ---
  const handleMouseUp = () => {
    if (isPlaying) return

    if (currentLine) {
      setLines(prev => [...prev, currentLine])
      setCurrentLine(null)
    }
    setEditingLineIndex(null)
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)
    lastMousePosition.current = null
    drawCanvas()
  }

  // --- Handle selection, dragging, resizing, rotating text blocks ---
  const handleTextInteraction = (
    pos: TextPosition,
    key: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    // Only allow transforms in Frame 2
    if (currentFrame === 2) {
      lastMousePosition.current = { x, y }

      // Preserve existing rotations if multi-select or single-select
      if (selectedTexts.length > 0) {
        setLastKnownRotations(pk => ({ ...pk, group: groupRotation }))
      }

      // Handle multi-select with Shift
      if (isShiftPressed.current) {
        setSelectedTexts(prev => {
          const newSel = prev.includes(key)
            ? prev.filter(t => t !== key)
            : [...prev, key]

          if (newSel.length > 1) {
            setGroupRotation(lastKnownRotations.group)
          } else if (newSel.length === 1) {
            setGroupRotation(lastKnownRotations[newSel[0]])
          }
          return newSel
        })
      } else {
        // Single-select
        setSelectedTexts([key])
        setGroupRotation(lastKnownRotations[key])
      }

      // Reset transform flags
      setIsResizing(false)
      setIsDragging(false)
      setIsRotating(false)
      setResizeHandle(null)

      // Check if near rotation handle
      if (isPointNearRotationArea(x, y, pos)) {
        setIsRotating(true)
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) setInitialGroupBox(groupBox)
      } else {
        // Check for resize handle on that block
        const handle = getResizeHandle(x, y, pos)
        if (handle) {
          if (handle === 'move') {
            setIsDragging(true)
          } else {
            setResizeHandle(handle)
            setIsResizing(true)
          }
        } else {
          // If not resize or rotate, treat as drag
          setIsDragging(true)
        }
      }
      drawCanvas()
    }
  }

  // --- Animate loop with custom frame rate throttle ---
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp

    const elapsedSinceLastFrame = timestamp - lastFrameTimeRef.current
    const frameInterval = 1000 / frameRate
    if (elapsedSinceLastFrame < frameInterval) {
      // Not yet time for next “frame”
      animationRef.current = requestAnimationFrame(animate)
      return
    }
    lastFrameTimeRef.current = timestamp

    const elapsedTime = timestamp - startTimeRef.current
    let progress = elapsedTime * animationSpeed

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

  // --- When user switches frame, clear selections and redraw ---
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  // --- Utility: pick text color (black/white) based on background luminance ---
  const getContrastColor = (bg: string) => {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  // --- Resize group of blocks when multiple selected ---
  const resizeGroup = (
    x: number,
    y: number,
    handle: string,
    groupBox: GroupBoundingBox
  ) => {
    if (!lastMousePosition.current) return
    const cx = groupBox.x + groupBox.width / 2
    const cy = groupBox.y + groupBox.height / 2
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / groupBox.width) * 0.5
    } else {
      scale = 1 + (dy / groupBox.height) * 0.5
    }
    scale = Math.max(scale, 0.1)

    const newW = groupBox.width * scale
    const newH = groupBox.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (pos: TextPosition) => {
      const relX = (pos.x + pos.width / 2 - cx) / (groupBox.width / 2)
      const relY = (pos.y + pos.height / 2 - cy) / (groupBox.height / 2)
      return {
        ...pos,
        x: cx + relX * (newW / 2) - pos.width / 2 * scale,
        y: cy + relY * (newH / 2) - pos.height / 2 * scale,
        width: pos.width * scale,
        height: pos.height * scale,
        fontSize: pos.fontSize * scale
      }
    }

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
          ? updatePos(pos)
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }

    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: groupBox.rotation })
    drawCanvas()
    lastMousePosition.current = { x, y }
  }

  // --- Update cursor style based on hovered element (resize, rotate, move) ---
  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    // If group selected
    const groupBox = calculateGroupBoundingBox()
    if (groupBox && currentFrame === 2 && isPointInRotatedBox(x, y, getRotatedGroupBoundingBox(groupBox))) {
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

    // If single text hovered
    const allPositions = currentFrame === 1
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]

    for (let i = 0; i < allPositions.length; i++) {
      const pos = allPositions[i]
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))) {
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

    // Otherwise default cursor
    canvas.style.cursor = 'default'
  }

  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* Sidebar controls */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">Title 1</Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={e => setTitles([e.target.value, titles[1]])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">Title 2</Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={e => setTitles([titles[0], e.target.value])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">Subtitle</Label>
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

        {/* Canvas & controls */}
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
              variant={currentFrame === 1 ? "default" : "outline"}
              onClick={() => handleFrameChange(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? "default" : "outline"}
              onClick={() => handleFrameChange(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button
              onClick={() => setIsPlaying(p => !p)}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black"
            >
              {isPlaying ? <PauseIcon className="h-5 w-5 text-white" /> : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button
              onClick={() => setIsLooping(l => !l)}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${isLooping ? 'ring-2 ring-blue-500' : ''}`}
            >
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={() => console.log('Export not implemented')}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
            >
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={() => setSettingsOpen(true)}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
            >
              <SettingsIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Position-editing modal (double-click to open) */}
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
                  onChange={e => setEditingPosition({
                    ...editingPosition,
                    x: Number(e.target.value)
                  })}
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={e => setEditingPosition({
                    ...editingPosition,
                    y: Number(e.target.value)
                  })}
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (deg)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={e => setEditingPosition({
                    ...editingPosition,
                    rotation: Number(e.target.value) * (Math.PI / 180)
                  })}
                />
              </div>
              <Button onClick={() => {
                // Apply the edited position to whichever block is selected
                if (editingPosition) {
                  if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
                    setTitlePositionsFrame2(prev => {
                      const arr = [...prev]
                      selectedTexts.forEach(sel => {
                        if (sel === 'title1') arr[0] = editingPosition
                        if (sel === 'title2') arr[1] = editingPosition
                      })
                      return arr
                    })
                  }
                  if (selectedTexts.includes('subtitle')) {
                    setSubtitlePositionFrame2(editingPosition)
                  }
                  setPositionModalOpen(false)
                  drawCanvas()
                }
              }}>
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings modal */}
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
                onValueChange={val => setLineThickness(val[0])}
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
                onValueChange={val => setAnimationSpeed(val[0])}
              />
            </div>
            <div>
              <Label htmlFor="staggerDelay">Trembling Intensity</Label>
              <Slider
                id="staggerDelay"
                min={0}
                max={10}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={val => setTremblingIntensity(val[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRate">Frame Rate (FPS)</Label>
              <Slider
                id="frameRate"
                min={50}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={val => setFrameRate(val[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
