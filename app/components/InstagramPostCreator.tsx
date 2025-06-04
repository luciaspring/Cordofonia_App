// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

//
// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────────
//
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
// We keep RigidBoundingBox if you ever want to track a pre‐rotated bounding box
interface RigidBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  centerX: number
  centerY: number
}

//
// ─── CONSTANTS ───────────────────────────────────────────────────────────────────
//
const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

// Ultra‐fast ease‐in/out (powered by t^16)
const ultraFastEaseInOutFunction = (t: number): number => {
  if (t < 0.5) {
    return Math.pow(2 * t, 16) / 2
  } else {
    return 1 - Math.pow(-2 * t + 2, 16) / 2
  }
}

//
// ─── COMPONENT ───────────────────────────────────────────────────────────────────
//
export default function InstagramPostCreator() {
  //
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────────
  //
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')

  const [currentFrame, setCurrentFrame] = useState(1)          // either 1 or 2
  const [isPlaying, setIsPlaying] = useState(false)            // animation on/off
  const [isLooping, setIsLooping] = useState(false)            // if true, loop continuously

  const [lines, setLines] = useState<Line[]>([])               // all lines (frame 1 & 2)
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // Two sets of “text‐boxes”: one for frame1, one for frame2
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

  // Selection tracking
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Double‐click popup editing
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  // Line style / animation “tremble” / speeds
  const [lineThickness, setLineThickness] = useState(2)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025)    // base speed factor
  const [staggerDelay, setStaggerDelay] = useState(0.2)            // per‐line stagger
  const [tremblingIntensity, setTremblingIntensity] = useState(5)  // “shake” amount

  // Settings panel open/close
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Group rotation + bounding boxes
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)
  const [lastResizePosition, setLastResizePosition] = useState<Point | null>(null)
  const [resizeSpeed, setResizeSpeed] = useState(0.5)

  // Keep track of last mouse coords
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0,
  })

  //
  // ─── REF HOOKS ──────────────────────────────────────────────────────────────────
  //
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  //
  // ─── EFFECT: TRACK SHIFT KEY ──────────────────────────────────────────────────
  //
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

  //
  // ─── EFFECT: REDRAW STATIC CANVAS WHEN NOT PLAYING ─────────────────────────────
  //
  // The important change: if isPlaying === true, we bail out of this effect and let
  // the animation loop alone handle drawing. Only when isPlaying===false do we re‐
  // compute text dimensions and call drawCanvas() once (progress=0).
  //
  useEffect(() => {
    if (isPlaying) {
      // While animation is running, do NOT trigger a “static” redraw.
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    updateTextDimensions(ctx)
    drawCanvas()   // draw with progress=0
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
    groupRotation,
    isPlaying,    // ← include isPlaying here so the effect re‐fires when it changes
  ])

  //
  // ─── EFFECT: START/STOP ANIMATION ──────────────────────────────────────────────
  //
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      // Draw a final “static” frame at progress=0 once playback stops
      drawCanvas(0)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, isLooping])

  //
  // ─── MEASURES & LAYOUT: TEXT DIMENSIONS ────────────────────────────────────────
  //
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8,
      }
    }

    // Frame 1 titles
    setTitlePositionsFrame1((prev) =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )

    // Frame 2 titles
    setTitlePositionsFrame2((prev) =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )

    // Subtitle dims (same for frame1 & frame2)
    const { width: subW, height: subH } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const subAR = subW / subH
    setSubtitlePositionFrame1((prev) => ({
      ...prev,
      width: subW,
      height: subH,
      aspectRatio: subAR,
    }))
    setSubtitlePositionFrame2((prev) => ({
      ...prev,
      width: subW,
      height: subH,
      aspectRatio: subAR,
    }))
  }

  //
  // ─── DRAW: MAIN CANVAS ROUTINE ──────────────────────────────────────────────────
  //
  function drawCanvas(progress: number = 0) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear + fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Separate out lines by frame
    const frame1Lines = lines.filter((line) => line.frame === 1)
    const frame2Lines = lines.filter((line) => line.frame === 2)

    if (isPlaying) {
      // ‣ Frame 1 grow (0 → 0.3)
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      }
      // ‣ Frame 1 shrink (0.3 → 0.6)
      else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      }
      // ‣ Text interpolate 1 → 2 (0.6 → 0.7)
      else if (progress <= 0.7) {
        const t = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, t, 1, 2)
      }
      // ‣ Frame 2 grow (0.7 → 1.0)
      else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      }
      // ‣ Frame 2 shrink (1.0 → 1.3)
      else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      }
      // ‣ Text back 2 → 1 (1.3 → 1.4)
      else if (progress <= 1.4) {
        const t = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, t, 2, 1)
      }
    } else {
      // Not playing: draw whichever frame is current, static
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      // If we have a selected box in frame2, draw bounding boxes
      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          titlePositionsFrame2.forEach((pos, idx) => {
            const key = idx === 0 ? 'title1' : 'title2'
            if (selectedTexts.includes(key)) {
              drawBoundingBox(ctx, pos)
            }
          })
          if (selectedTexts.includes('subtitle')) {
            drawBoundingBox(ctx, subtitlePositionFrame2)
          }
        }
      }
    }
  }

  //
  // ─── DRAW: STATIC TEXT FOR A GIVEN FRAME ────────────────────────────────────────
  //
  function drawStaticText(ctx: CanvasRenderingContext2D, frame: number) {
    const titlePositions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titlePositions.forEach((pos, index) => {
      drawRotatedText(ctx, pos, titles[index])
    })
    const subtitlePos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subtitlePos, subtitle)
  }

  //
  // ─── DRAW: ROTATED TEXT ─────────────────────────────────────────────────────────
  //
  function drawRotatedText(ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) {
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

  //
  // ─── DRAW: STATIC LINES ─────────────────────────────────────────────────────────
  //
  function drawLines(ctx: CanvasRenderingContext2D, frameLines: Line[]) {
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

    // If the user is in the middle of drawing a new line:
    if (currentLine) {
      ctx.beginPath()
      ctx.moveTo(currentLine.start.x, currentLine.start.y)
      ctx.lineTo(currentLine.end.x, currentLine.end.y)
      ctx.stroke()
    }
  }

  //
  // ─── DRAW: ANIMATED LINES (GROW / SHRINK) ────────────────────────────────────────
  //
  function drawAnimatedLines(
    ctx: CanvasRenderingContext2D,
    frameProgress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = isPlaying ? '#000000' : '#0000FF'

    const animationDuration = 0.3
    const maxStaggerDelay = 0.2

    const drawFrame = (linesArray: Line[], prog: number) => {
      const stagger = linesArray.length > 1 ? maxStaggerDelay / (linesArray.length - 1) : 0
      linesArray.forEach((line, idx) => {
        let t = Math.max(0, Math.min(1, (prog - idx * stagger) / animationDuration))
        t = ultraFastEaseInOutFunction(t)

        const { start, end } = line
        const currentEnd = {
          x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t),
        }

        // Tremble
        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + tremX, start.y + tremY)
        ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length > 0) {
      drawFrame(frame1Lines, frameProgress)
    }
    if (frame2Lines.length > 0) {
      drawFrame(frame2Lines, frameProgress)
    }
  }

  //
  // ─── DRAW: ANIMATED TEXT INTERPOLATION ───────────────────────────────────────────
  //
  function drawAnimatedText(
    ctx: CanvasRenderingContext2D,
    progress: number,
    fromFrame: number,
    toFrame: number
  ) {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const lerpPos = (p1: TextPosition, p2: TextPosition, t: number): TextPosition => ({
      x: lerp(p1.x, p2.x, t),
      y: lerp(p1.y, p2.y, t),
      width: lerp(p1.width, p2.width, t),
      height: lerp(p1.height, p2.height, t),
      rotation: lerp(p1.rotation, p2.rotation, t),
      fontSize: lerp(p1.fontSize, p2.fontSize, t),
    })
    const t = ultraFastEaseInOutFunction(progress)

    titles.forEach((title, idx) => {
      const a = fromFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const b = toFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const interp = lerpPos(a, b, t)
      drawRotatedText(ctx, interp, title)
    })

    const subA = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subB = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const interpSub = lerpPos(subA, subB, t)
    drawRotatedText(ctx, interpSub, subtitle)
  }

  //
  // ─── DRAW: INDIVIDUAL BOUNDING BOX ───────────────────────────────────────────────
  //
  function drawBoundingBox(ctx: CanvasRenderingContext2D, pos: TextPosition) {
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(pos.rotation)

    const halfW = pos.width / 2
    const halfH = pos.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, pos.width, pos.height)

    // Draw corner handles
    const handleSize = 10
    const corners = [
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

  //
  // ─── DRAW: GROUP BOUNDING BOX ───────────────────────────────────────────────────
  //
  function drawGroupBoundingBox(ctx: CanvasRenderingContext2D, box: GroupBoundingBox) {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(box.rotation)

    const halfW = box.width / 2
    const halfH = box.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, box.width, box.height)

    const handleSize = 10
    const corners = [
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

  //
  // ─── HELPERS: CALCULATE GROUP BOUNDING BOX ──────────────────────────────────────
  //
  function calculateGroupBoundingBox(): GroupBoundingBox | null {
    if (selectedTexts.length === 0) return null
    const selectedPositions: TextPosition[] = []

    titlePositionsFrame2.forEach((pos, idx) => {
      const key = idx === 0 ? 'title1' : 'title2'
      if (selectedTexts.includes(key)) selectedPositions.push(pos)
    })
    if (selectedTexts.includes('subtitle')) selectedPositions.push(subtitlePositionFrame2)

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

  //
  // ─── HELPERS: HIT‐TESTS ─────────────────────────────────────────────────────────
  //
  // 1) Point near any corner or line
  function isPointNear(point: Point, target: Point | Line, threshold: number = 10): boolean {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold
    }
  }

  function pointToLineDistance(p: Point, a: Point, b: Point): number {
    const A = p.x - a.x
    const B = p.y - a.y
    const C = b.x - a.x
    const D = b.y - a.y
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let t = -1
    if (lenSq !== 0) t = dot / lenSq
    let xx, yy
    if (t < 0) {
      xx = a.x
      yy = a.y
    } else if (t > 1) {
      xx = b.x
      yy = b.y
    } else {
      xx = a.x + t * C
      yy = a.y + t * D
    }
    const dx = p.x - xx
    const dy = p.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 2) Rotate a point (x,y) around (cx, cy) by angle
  function rotateAroundPoint(
    pos: TextPosition,
    centerX: number,
    centerY: number,
    angle: number
  ): TextPosition {
    const dx = pos.x + pos.width / 2 - centerX
    const dy = pos.y + pos.height / 2 - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const currentAngle = Math.atan2(dy, dx)
    const newAngle = currentAngle + angle
    const newX = centerX + dist * Math.cos(newAngle) - pos.width / 2
    const newY = centerY + dist * Math.sin(newAngle) - pos.height / 2
    return {
      ...pos,
      x: newX,
      y: newY,
      rotation: pos.rotation + angle,
    }
  }

  // 3) Is point inside rotated quadrilateral?
  function isPointInRotatedBox(x: number, y: number, box: Point[]): boolean {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x,
        yi = box[i].y
      const xj = box[j].x,
        yj = box[j].y
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  function getRotatedBoundingBox(pos: TextPosition): Point[] {
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
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
      return { x: rx + centerX, y: ry + centerY }
    })
  }

  function getRotatedGroupBoundingBox(groupBox: GroupBoundingBox): Point[] {
    const { x, y, width, height, rotation } = groupBox
    const centerX = x + width / 2
    const centerY = y + height / 2
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
    ]
    return corners.map((c) => {
      const rx = c.x * Math.cos(rotation) - c.y * Math.sin(rotation)
      const ry = c.x * Math.sin(rotation) + c.y * Math.cos(rotation)
      return { x: rx + centerX, y: ry + centerY }
    })
  }

  // 4) Find which resize handle (if any) is under (x,y)
  function getResizeHandle(x: number, y: number, pos: TextPosition | GroupBoundingBox): string | null {
    const handleSize = 20
    const centerX = 'x' in pos ? pos.x + pos.width / 2 : 0
    const centerY = 'y' in pos ? pos.y + pos.height / 2 : 0
    const rotation = 'rotation' in pos ? pos.rotation : 0
    const halfW = 'width' in pos ? pos.width / 2 : 0
    const halfH = 'height' in pos ? pos.height / 2 : 0

    // Un‐rotate the mouse point into the box’s local space
    const dx = x - centerX
    const dy = y - centerY
    const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)

    // Check each corner
    if (Math.abs(localX + halfW) < handleSize / 2 && Math.abs(localY + halfH) < handleSize / 2)
      return 'nw-resize'
    if (Math.abs(localX - halfW) < handleSize / 2 && Math.abs(localY + halfH) < handleSize / 2)
      return 'ne-resize'
    if (Math.abs(localX - halfW) < handleSize / 2 && Math.abs(localY - halfH) < handleSize / 2)
      return 'se-resize'
    if (Math.abs(localX + halfW) < handleSize / 2 && Math.abs(localY - halfH) < handleSize / 2)
      return 'sw-resize'

    // If inside the box at all, return “move”
    if (Math.abs(localX) < halfW && Math.abs(localY) < halfH) return 'move'
    return null
  }

  // 5) Is (x,y) near the “rotation circle” (just outside corners)?
  function isPointNearRotationArea(x: number, y: number, pos: TextPosition | GroupBoundingBox): boolean {
    const handleSize = 20
    const rotationAreaSize = 15
    const centerX = 'x' in pos ? pos.x + pos.width / 2 : 0
    const centerY = 'y' in pos ? pos.y + pos.height / 2 : 0
    const rotation = 'rotation' in pos ? pos.rotation : 0
    const halfW = 'width' in pos ? pos.width / 2 : 0
    const halfH = 'height' in pos ? pos.height / 2 : 0

    // Un‐rotate the point
    const dx = x - centerX
    const dy = y - centerY
    const localX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const localY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)

    // Check distance from each corner
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ]
    for (const corner of corners) {
      const dist = Math.sqrt((localX - corner.x) ** 2 + (localY - corner.y) ** 2)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationAreaSize) {
        return true
      }
    }
    return false
  }

  //
  // ─── DRAG / RESIZE / ROTATE HANDLERS ─────────────────────────────────────────────
  //
  function dragSingle(x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }))
    } else {
      setTitlePositionsFrame2((prev) => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = {
          ...copy[idx],
          x: copy[idx].x + dx,
          y: copy[idx].y + dy,
        }
        return copy
      })
    }
    lastMousePosition.current = { x, y }
  }

  function dragGroup(x: number, y: number) {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) =>
        selectedTexts.includes(idx === 0 ? 'title1' : 'title2')
          ? { ...pos, x: pos.x + dx, y: pos.y + dy }
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }))
    }
    lastMousePosition.current = { x, y }
  }

  function resizeSingle(
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) {
    if (!resizeStartPosition) return
    // Center‐based scale
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const startVec = {
      x: resizeStartPosition.x - centerX,
      y: resizeStartPosition.y - centerY,
    }
    const currVec = { x: x - centerX, y: y - centerY }

    const factor = 0.1 // sensitivity
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const currDist = Math.abs(currVec.x)
      scale = startDist !== 0 ? 1 + ((currDist / startDist - 1) * factor) : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const startDist = Math.abs(startVec.y)
      const currDist = Math.abs(currVec.y)
      scale = startDist !== 0 ? 1 + ((currDist / startDist - 1) * factor) : 1
    }
    scale = Math.max(0.1, scale)

    const newW = position.width * scale
    const newH = position.height * scale
    const newX = centerX - newW / 2
    const newY = centerY - newH / 2
    const newPosition: TextPosition = {
      ...position,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: position.fontSize * scale,
    }

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPosition)
    } else {
      setTitlePositionsFrame2((prev) => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = newPosition
        return copy
      })
    }
    drawCanvas()
  }

  function resizeGroup(x: number, y: number, handle: string) {
    if (!initialGroupBox || !resizeStartPosition) return
    const dx = x - resizeStartPosition.x
    const dy = y - resizeStartPosition.y
    const centerX = initialGroupBox.x + initialGroupBox.width / 2
    const centerY = initialGroupBox.y + initialGroupBox.height / 2

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / initialGroupBox.width) * resizeSpeed
    } else if (handle.includes('n') || handle.includes('s')) {
      scale = 1 + (dy / initialGroupBox.height) * resizeSpeed
    }
    scale = Math.max(0.1, scale)

    const newW = initialGroupBox.width * scale
    const newH = initialGroupBox.height * scale
    const newX = centerX - newW / 2
    const newY = centerY - newH / 2

    const updatePos = (pos: TextPosition) => {
      const relX = (pos.x - centerX) / (initialGroupBox.width / 2)
      const relY = (pos.y - centerX) / (initialGroupBox.height / 2)
      return {
        ...pos,
        x: centerX + relX * (newW / 2),
        y: centerY + relY * (newH / 2),
        width: pos.width * scale,
        height: pos.height * scale,
        fontSize: pos.fontSize * scale,
      }
    }

    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) =>
        selectedTexts.includes(idx === 0 ? 'title1' : 'title2') ? updatePos(pos) : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => updatePos(prev))
    }
    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
    drawCanvas()
  }

  function rotateGroup(x: number, y: number, groupBox: GroupBoundingBox) {
    if (!lastMousePosition.current) return
    const centerX = groupBox.x + groupBox.width / 2
    const centerY = groupBox.y + groupBox.height / 2

    const lastAngle = Math.atan2(
      lastMousePosition.current.y - centerY,
      lastMousePosition.current.x - centerX
    )
    const currentAngle = Math.atan2(y - centerY, x - centerX)
    let deltaAngle = currentAngle - lastAngle
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) => {
        const key = idx === 0 ? 'title1' : 'title2'
        if (selectedTexts.includes(key)) {
          setLastKnownRotations((r) => ({
            ...r,
            [key]: pos.rotation + deltaAngle,
          }))
          return rotateAroundPoint(pos, centerX, centerY, deltaAngle)
        }
        return pos
      })
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => {
        const newPos = rotateAroundPoint(prev, centerX, centerY, deltaAngle)
        setLastKnownRotations((r) => ({
          ...r,
          subtitle: newPos.rotation,
        }))
        return newPos
      })
    }

    setGroupRotation((prev) => {
      const newRot = prev + deltaAngle
      setLastKnownRotations((r) => ({
        ...r,
        group: newRot,
      }))
      return newRot
    })

    lastMousePosition.current = { x, y }
  }

  function rotateSingle(
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) {
    if (!lastMousePosition.current) return
    const currentPos = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const centerX = currentPos.x + currentPos.width / 2
    const centerY = currentPos.y + currentPos.height / 2

    const lastA = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currA = Math.atan2(y - centerY, x - centerX)
    let deltaA = currA - lastA
    if (deltaA > Math.PI) deltaA -= 2 * Math.PI
    if (deltaA < -Math.PI) deltaA += 2 * Math.PI

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2((prev) => ({
        ...prev,
        rotation: prev.rotation + deltaA,
      }))
    } else {
      setTitlePositionsFrame2((prev) => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = {
          ...copy[idx],
          rotation: copy[idx].rotation + deltaA,
        }
        return copy
      })
    }
    lastMousePosition.current = { x, y }
  }

  //
  // ─── MOUSE EVENTS ───────────────────────────────────────────────────────────────
  //
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    lastMousePosition.current = { x, y }

    // Text hit‐test in whichever frame is current
    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subtitlePos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    for (let i = 0; i < positions.length; i++) {
      const box = getRotatedBoundingBox(positions[i])
      if (isPointInRotatedBox(x, y, box)) {
        handleTextInteraction(positions[i], (`title${i + 1}` as 'title1' | 'title2'), x, y)
        return
      }
    }
    {
      const box = getRotatedBoundingBox(subtitlePos)
      if (isPointInRotatedBox(x, y, box)) {
        handleTextInteraction(subtitlePos, 'subtitle', x, y)
        return
      }
    }

    // If no text hit, handle line creation / editing
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    const clickedLineIndex = lines.findIndex(
      (ln) =>
        ln.frame === currentFrame &&
        (isPointNear({ x, y }, ln) ||
          isPointNear({ x, y }, ln.start) ||
          isPointNear({ x, y }, ln.end))
    )

    if (clickedLineIndex !== -1) {
      setEditingLineIndex(clickedLineIndex)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  function handleMouseUp() {
    if (isPlaying) return

    if (currentLine) {
      setLines((prev) => [...prev, currentLine])
      setCurrentLine(null)
    }
    setEditingLineIndex(null)
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)
    setResizeStartPosition(null)
    lastMousePosition.current = null
    drawCanvas()
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

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
    } else if (currentLine) {
      setCurrentLine((prev) => ({
        ...prev!,
        end: { x, y },
      }))
      drawCanvas()
    } else if (editingLineIndex !== null) {
      setLines((prev) => {
        const copy = [...prev]
        const ln = { ...copy[editingLineIndex] }
        if (isPointNear({ x, y }, ln.start)) {
          ln.start = { x, y }
        } else if (isPointNear({ x, y }, ln.end)) {
          ln.end = { x, y }
        }
        copy[editingLineIndex] = ln
        return copy
      })
      drawCanvas()
    }

    updateCursor(canvas, x, y)
  }

  function updateCursor(canvas: HTMLCanvasElement, x: number, y: number) {
    // Check for group box
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

    // Check each text element individually
    const currentPositions =
      currentFrame === 1
        ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
        : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]

    for (let i = 0; i < currentPositions.length; i++) {
      const pos = currentPositions[i]
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

    canvas.style.cursor = 'default'
  }

  //
  // ─── TEXT INTERACTION (SINGLE‐CLICK vs SHIFT‐CLICK vs DOUBLE‐CLICK) ─────────────
  //
  function handleTextInteraction(
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) {
    if (currentFrame !== 2) return

    lastMousePosition.current = { x, y }

    // If user is holding SHIFT, allow multi‐select
    if (isShiftPressed.current) {
      setSelectedTexts((prev) => {
        const newSel = prev.includes(textType) ? prev.filter((t) => t !== textType) : [...prev, textType]
        if (newSel.length > 1) {
          // multiple → maintain group rotation
          setGroupRotation(lastKnownRotations.group)
        } else if (newSel.length === 1) {
          // single → retrieve stored rotation
          setGroupRotation(lastKnownRotations[newSel[0]])
        }
        return newSel
      })
    }
    // If no SHIFT, single‐select
    else {
      setSelectedTexts([textType])
      setGroupRotation(lastKnownRotations[textType])
    }

    // After selection logic, figure out if we are about to rotate/resize/drag
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

    // Double‐click opens the popup (detected by looking at time delta)
    const now = performance.now()
    if (now - (lastClickTime.current || 0) < 300) {
      // Double‐click: open popup
      setEditingPosition({ ...position })
      setPositionModalOpen(true)
      lastClickTime.current = 0
      drawCanvas()
      return
    }
    lastClickTime.current = now

    // Otherwise, decide rotate vs resize vs drag
    if (isPointNearRotationArea(x, y, position)) {
      setIsRotating(true)
      const groupBox = calculateGroupBoundingBox()
      if (groupBox) setInitialGroupBox(groupBox)
    } else {
      const handle = getResizeHandle(x, y, position)
      if (handle) {
        if (handle === 'move') {
          setIsDragging(true)
        } else {
          setResizeHandle(handle)
          setIsResizing(true)
          setResizeStartPosition({ x, y })
        }
      } else {
        setIsDragging(true)
      }
    }

    drawCanvas()
  }

  //
  // ─── FRAME SWITCH / PLAY / LOOP / EXPORT HANDLERS ────────────────────────────────
  //
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const togglePlay = () => {
    setIsPlaying((p) => !p)
  }

  const toggleLoop = () => {
    setIsLooping((l) => !l)
  }

  const handleExport = () => {
    console.log('Export not implemented yet')
  }

  //
  // ─── POPUP: MANUALLY UPDATE POSITION RAWS ────────────────────────────────────────
  //
  const updatePosition = (newPos: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2((prev) => {
        const copy = [...prev]
        selectedTexts.forEach((sel) => {
          if (sel === 'title1') copy[0] = newPos
          if (sel === 'title2') copy[1] = newPos
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

  //
  // ─── SETTINGS PANEL HANDLER ─────────────────────────────────────────────────────
  //
  const handleSettingsChange = (name: string, value: number) => {
    switch (name) {
      case 'tremblingIntensity':
        setTremblingIntensity(value)
        drawCanvas()
        break

      case 'frameRate':
        // We will use this in the animate() loop:
        // frameRate is “fps” from 50 → 120. We convert that into a time‐scale factor:
        // (1 / fps) is ms per frame, divide by 16.67ms (≈60fps) to get a relative speed.
        // The user will see the animation jump in bigger steps if fps is lower.
        setFrameRate(value)
        break

      // … you can add more settings if you like …
    }
  }

  //
  // ─── ANIMATION LOOP ──────────────────────────────────────────────────────────────
  //
  // We use requestAnimationFrame. However, in order to “simulate” a variable frame rate,
  // we compare timestamps and only advance progress when enough time has passed. This
  // ensures that if “frameRate” = 60, we update ~every 16.67 ms; if “frameRate” = 50, ~every 20ms, etc.
  //
  const [frameRate, setFrameRate] = useState(60) // default fps
  const lastFrameTimeRef = useRef<number>(0)

  function animate(ts: number) {
    if (!startTimeRef.current) {
      startTimeRef.current = ts
      lastFrameTimeRef.current = ts
    }
    const elapsedTime = ts - startTimeRef.current

    // If we want a slower “frame rate,” we check if enough time has passed
    // relative to (1000 / frameRate). If not, skip this draw and wait for next rAF.
    const msPerFrame = 1000 / frameRate
    if (ts - lastFrameTimeRef.current < msPerFrame) {
      animationRef.current = requestAnimationFrame(animate)
      return
    }
    lastFrameTimeRef.current = ts

    // Now compute “progress” in our original [0, 1.4] scale:
    // We want the *duration* of a full cycle to remain the same (≈1.4 / baseSpeed).
    // So we just continue using “elapsedTime * baseSpeedFactor” (0.00025) to get progress.
    // The difference is that with a lower frameRate, we only call drawCanvas() on fewer frames.
    let progress = elapsedTime * animationSpeed

    // Cap or loop
    if (progress > 1.4) {
      if (isLooping) {
        startTimeRef.current = ts
        progress = 0
      } else {
        progress = 1.4
        setIsPlaying(false)
      }
    }
    drawCanvas(progress)
    if (isPlaying || isLooping) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      // Once we finish, draw final static frame:
      drawCanvas(0)
    }
  }

  //
  // ─── CONTRAST UTILITY ────────────────────────────────────────────────────────────
  //
  function getContrastColor(bg: string): string {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return l > 0.5 ? '#000000' : '#FFFFFF'
  }

  //
  // ─── RENDER ─────────────────────────────────────────────────────────────────────
  //
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ─── LEFT PANEL: INPUTS ─────────────────────────────────────────────────── */}
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
              {colorOptions.map((c) => (
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

        {/* ─── RIGHT PANEL: CANVAS + CONTROLS ─────────────────────────────────────── */}
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
            <Button onClick={togglePlay} className="w-[40px] h-[40px] p-0 rounded-full bg-black">
              {isPlaying ? <PauseIcon className="h-5 w-5 text-white" /> : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button
              onClick={toggleLoop}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${isLooping ? 'ring-2 ring-blue-500' : ''}`}
            >
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={handleExport} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── POPUP: Edit Position (Double‐click) ────────────────────────────────────── */}
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
                  onChange={(e) => setEditingPosition({ ...editingPosition, x: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="yPosition">Y Position</Label>
                <Input
                  id="yPosition"
                  type="number"
                  value={editingPosition.y}
                  onChange={(e) => setEditingPosition({ ...editingPosition, y: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (degrees)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={(e) =>
                    setEditingPosition({ ...editingPosition, rotation: (Number(e.target.value) * Math.PI) / 180 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="fontSize">Font Size</Label>
                <Input
                  id="fontSize"
                  type="number"
                  value={editingPosition.fontSize}
                  onChange={(e) =>
                    setEditingPosition({ ...editingPosition, fontSize: Number(e.target.value) })
                  }
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)}>Update</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SETTINGS MODAL ─────────────────────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="frameRate">Frame Rate (50–120 fps)</Label>
              <Slider
                id="frameRate"
                min={50}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={(v) => handleSettingsChange('frameRate', v[0])}
              />
            </div>
            <div>
              <Label htmlFor="lineThickness">Line Thickness</Label>
              <Slider
                id="lineThickness"
                min={1}
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={(v) => setLineThickness(v[0])}
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
                onValueChange={(v) => setAnimationSpeed(v[0])}
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
                onValueChange={(v) => setStaggerDelay(v[0])}
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
                onValueChange={(v) => handleSettingsChange('tremblingIntensity', v[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
