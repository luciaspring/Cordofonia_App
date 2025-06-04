// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

//
// ── CONSTANTS & TYPES ─────────────────────────────────────────────────────────
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
// Extremely fast ease-in/out function (for text interpolation)
//
const ultraFastEaseInOutFunction = (t: number): number => {
  if (t < 0.5) {
    return Math.pow(2 * t, 16) / 2
  } else {
    return 1 - Math.pow(-2 * t + 2, 16) / 2
  }
}

//
// ── COMPONENT ──────────────────────────────────────────────────────────────────
//

export default function InstagramPostCreator() {
  //
  // ── STATE HOOKS ───────────────────────────────────────────────────────────────
  //
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // Title/subtitle positions for Frame 1 & Frame 2
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

  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  const [lineThickness, setLineThickness] = useState(2)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)

  // Track last known rotation for each text (for proper “double-click edit” behavior)
  const [lastKnownRotations, setLastKnownRotations] = useState<{ [key: string]: number }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0,
  })

  // Canvas + animation refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  // Animation speed state
  const [animationSpeed, setAnimationSpeed] = useState(0.00025)

  //
  // ── EFFECTS ─────────────────────────────────────────────────────────────────
  //

  // Track Shift key down/up
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

  // Whenever text, positions, frames, lines, etc. change, recalc text metrics and redraw
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
  ])

  // Start/stop animation loop when isPlaying toggles
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas() // redraw static
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying])

  //
  // ── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────
  //

  // Measure text dimensions (width + actual ascent/descent for height)
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height:
          (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) ||
          fontSize * 0.8,
      }
    }

    // Update Frame 1 title dims
    setTitlePositionsFrame1((prev) =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Update Frame 2 title dims
    setTitlePositionsFrame2((prev) =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Subtitle dims (both frames)
    const { width: subW, height: subH } = measureText(subtitle, subtitlePositionFrame2.fontSize)
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

  // Calculate a bounding box around any selected texts (Frame 2)
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    // Gather selected positions from Frame2
    const selectedPositions = titlePositionsFrame2
      .filter((_, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : [])

    if (selectedPositions.length === 0) return null
    const minX = Math.min(...selectedPositions.map((p) => p.x))
    const minY = Math.min(...selectedPositions.map((p) => p.y))
    const maxX = Math.max(...selectedPositions.map((p) => p.x + p.width))
    const maxY = Math.max(...selectedPositions.map((p) => p.y + p.height))
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation,
    }
  }

  // ── DRAWING HELPERS ────────────────────────────────────────────────────────────

  // Draw a rotated string of text given its position object
  const drawRotatedText = (
    ctx: CanvasRenderingContext2D,
    position: TextPosition,
    text: string
  ) => {
    ctx.save()
    ctx.translate(position.x + position.width / 2, position.y + position.height / 2)
    ctx.rotate(position.rotation)
    ctx.font = `bold ${position.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  // Compute either black/white contrasting color against a given hex background
  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

  // The crucial drawAnimatedText helper (MUST be above drawCanvas to avoid the ReferenceError)
  const drawAnimatedText = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const interpolate = (start: number, end: number, t: number) => start + (end - start) * t

    const interpolatePosition = (
      pos1: TextPosition,
      pos2: TextPosition,
      t: number
    ): TextPosition => ({
      x: interpolate(pos1.x, pos2.x, t),
      y: interpolate(pos1.y, pos2.y, t),
      width: interpolate(pos1.width, pos2.width, t),
      height: interpolate(pos1.height, pos2.height, t),
      rotation: interpolate(pos1.rotation, pos2.rotation, t),
      fontSize: interpolate(pos1.fontSize, pos2.fontSize, t),
    })

    const t = ultraFastEaseInOutFunction(progress)

    // Interpolate each title
    titles.forEach((title, idx) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const pos2 = toFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const ipos = interpolatePosition(pos1, pos2, t)
      drawRotatedText(ctx, ipos, title)
    })

    // Interpolate subtitle positions
    const sub1 =
      fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 =
      toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const iSub = interpolatePosition(sub1, sub2, t)
    drawRotatedText(ctx, iSub, subtitle)
  }

  // Draw all static text for a given frame (1 or 2)
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const titlesPos = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((title, idx) => {
      drawRotatedText(ctx, titlesPos[idx], title)
    })
    const subPos =
      frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  // Draw all fully-formed lines (no animation) for the current frame
  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'
    framelines.forEach((line) => {
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

  // Draw the group bounding box (when multiple texts are selected)
  const drawGroupBoundingBox = (
    ctx: CanvasRenderingContext2D,
    box: GroupBoundingBox
  ) => {
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
    // Draw corner handles
    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    })
    ctx.restore()
  }

  // Draw a single text bounding box (for a single text object)
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, position: TextPosition) => {
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(position.rotation)
    const halfW = position.width / 2
    const halfH = position.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, position.width, position.height)
    // Corner handles
    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    })
    ctx.restore()
  }

  // Draw animated lines (grow + shrink phases) for whichever frame is active
  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = isPlaying ? '#000000' : '#0000FF'

    const animationDuration = 0.3
    const maxStagger = 0.2

    const drawFrame = (linesArr: Line[], frameProg: number) => {
      const stagger = linesArr.length > 1 ? maxStagger / (linesArr.length - 1) : 0
      linesArr.forEach((line, idx) => {
        let t = Math.max(
          0,
          Math.min(1, (frameProg - idx * stagger) / animationDuration)
        )
        t = ultraFastEaseInOutFunction(t)
        const { start, end } = line
        const currentEnd = {
          x:
            start.x +
            (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y:
            start.y +
            (end.y - start.y) * (animationType === 'grow' ? t : 1 - t),
        }
        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity
        ctx.beginPath()
        ctx.moveTo(start.x + tremX, start.y + tremY)
        ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length > 0) drawFrame(frame1Lines, progress)
    if (frame2Lines.length > 0) drawFrame(frame2Lines, progress)
  }

  //
  // ── CORE DRAW LOOP ────────────────────────────────────────────────────────────
  //

  /**
   * drawCanvas(progress?)
   *
   * If `isPlaying` is true, `progress` is a number from 0→1.4 that indicates
   * the current animation fraction. 0→0.3 = Frame1 grow, 0.3→0.6 = Frame1 shrink,
   * 0.6→0.7 = Text transition→Frame2, 0.7→1.0 = Frame2 grow, 1.0→1.3 = Frame2 shrink,
   * 1.3→1.4 = Text transition back to Frame1.
   *
   * If `isPlaying` is false, we simply draw whichever frame is active (1 or 2)
   * along with its static lines + bounding boxes if selected.
   */
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear & fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Separate lines by frame
    const frame1Lines = lines.filter((l) => l.frame === 1)
    const frame2Lines = lines.filter((l) => l.frame === 2)

    if (isPlaying) {
      // Frame 1 grow (0→0.3)
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      }
      // Frame 1 shrink (0.3→0.6)
      else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      }
      // Text transition from Frame1→Frame2 (0.6→0.7)
      else if (progress <= 0.7) {
        const textProg = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, textProg, 1, 2)
      }
      // Frame 2 grow (0.7→1.0)
      else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(
          ctx,
          (progress - 0.7) / 0.3,
          [],
          frame2Lines,
          'grow'
        )
      }
      // Frame 2 shrink (1.0→1.3)
      else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(
          ctx,
          (progress - 1.0) / 0.3,
          [],
          frame2Lines,
          'shrink'
        )
      }
      // Text transition Frame2→Frame1 (1.3→1.4)
      else if (progress <= 1.4) {
        const textProg = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, textProg, 2, 1)
      }
    } else {
      // Not playing: draw the current frame statically
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      // If in Frame2 and something is selected, draw bounding boxes
      if (currentFrame === 2 && selectedTexts.length > 0) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          // If only one text selected, draw its individual box
          selectedTexts.forEach((t) => {
            if (t === 'title1') drawBoundingBox(ctx, titlePositionsFrame2[0])
            if (t === 'title2') drawBoundingBox(ctx, titlePositionsFrame2[1])
            if (t === 'subtitle') drawBoundingBox(ctx, subtitlePositionFrame2)
          })
        }
      }
    }
  }

  // Animate loop (calls drawCanvas repeatedly)
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - (startTimeRef.current || 0)
    const speed = animationSpeed // e.g. 0.00025
    let progress = elapsed * speed

    // If progress exceeds 1.4, either loop or stop
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

  //
  // ── MOUSE / INTERACTION HANDLERS ─────────────────────────────────────────────
  //

  // Helper: Distance from a point to a target (either a point or a line segment)
  const pointToLineDistance = (
    point: Point,
    lineStart: Point,
    lineEnd: Point
  ): number => {
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

  // Are we close to a point or to a segment?
  const isPointNear = (
    point: Point,
    target: Point | Line,
    threshold: number = 10
  ): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold
    }
  }

  // Rotate a single TextPosition around a center
  const rotateAroundPoint = (
    position: TextPosition,
    centerX: number,
    centerY: number,
    angle: number
  ): TextPosition => {
    const dx = position.x + position.width / 2 - centerX
    const dy = position.y + position.height / 2 - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const currentAngle = Math.atan2(dy, dx)
    const newAngle = currentAngle + angle
    const newX = centerX + dist * Math.cos(newAngle) - position.width / 2
    const newY = centerY + dist * Math.sin(newAngle) - position.height / 2
    return {
      ...position,
      x: newX,
      y: newY,
      rotation: position.rotation + angle,
    }
  }

  // Get the rotated bounding‐box corners for a TextPosition
  const getRotatedBoundingBox = (position: TextPosition): Point[] => {
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const w = position.width
    const h = position.height
    const corners: Point[] = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]
    return corners.map((corner) => {
      const rx = corner.x * Math.cos(position.rotation) - corner.y * Math.sin(position.rotation)
      const ry = corner.x * Math.sin(position.rotation) + corner.y * Math.cos(position.rotation)
      return { x: rx + centerX, y: ry + centerY }
    })
  }

  // Get rotated corners for a GroupBoundingBox
  const getRotatedGroupBoundingBox = (groupBox: GroupBoundingBox): Point[] => {
    const cx = groupBox.x + groupBox.width / 2
    const cy = groupBox.y + groupBox.height / 2
    const w = groupBox.width
    const h = groupBox.height
    const corners: Point[] = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ]
    return corners.map((corner) => {
      const rx = corner.x * Math.cos(groupBox.rotation) - corner.y * Math.sin(groupBox.rotation)
      const ry = corner.x * Math.sin(groupBox.rotation) + corner.y * Math.cos(groupBox.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  // Check if a point lies inside a (rotated) polygon
  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x,
        yi = box[i].y
      const xj = box[j].x,
        yj = box[j].y
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  // Check if a (x,y) is near that corner’s “rotation‐hotspot” (just outside each corner)
  const isPointNearRotationArea = (
    x: number,
    y: number,
    position: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const cx =
      'width' in position
        ? position.x + position.width / 2
        : position.x + position.width / 2
    const cy =
      'height' in position
        ? position.y + position.height / 2
        : position.y + position.height / 2
    const rot = position.rotation
    const halfW = position.width / 2
    const halfH = position.height / 2
    // Transform x,y into the object’s un‐rotated space
    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const ry = dx * Math.sin(-rot) + dy * Math.cos(-rot)

    // The four corners in unrotated space:
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ]
    for (const corner of corners) {
      const dist = Math.hypot(rx - corner.x, ry - corner.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationAreaSize) {
        return true
      }
    }
    return false
  }

  // Determine which “resize handle” we’re hovering (nw-resize, ne-resize, etc.)
  const getResizeHandle = (
    x: number,
    y: number,
    position: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = 20
    const cx =
      'width' in position
        ? position.x + position.width / 2
        : position.x + position.width / 2
    const cy =
      'height' in position
        ? position.y + position.height / 2
        : position.y + position.height / 2
    const rot = position.rotation
    const halfW = position.width / 2
    const halfH = position.height / 2

    // Unrotate the point
    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const ry = dx * Math.sin(-rot) + dy * Math.cos(-rot)

    // Check each corner region
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

    // If inside the bounding‐box (but not on a corner handle), return “move”
    if (Math.abs(rx) < halfW && Math.abs(ry) < halfH) {
      return 'move'
    }
    return null
  }

  //
  // ── MOUSE EVENT HANDLERS ───────────────────────────────────────────────────────
  //

  // Called when the user lets go of the mouse (either finishing a line draw or ending a move/resize/rotate)
  const handleMouseUp = () => {
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

  // When the user clicks down on the canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    lastMousePosition.current = { x, y }

    // First, check if we clicked inside any text (rotated) bounding‐box
    const positions =
      currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos =
      currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    // Loop through each title
    for (let i = 0; i < positions.length; i++) {
      const boxPts = getRotatedBoundingBox(positions[i])
      if (isPointInRotatedBox(x, y, boxPts)) {
        // We clicked on title i
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    // Check subtitle
    const subPts = getRotatedBoundingBox(subPos)
    if (isPointInRotatedBox(x, y, subPts)) {
      handleTextInteraction(subPos, 'subtitle', x, y)
      return
    }

    // If shift is not pressed, clear any text selection
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    // Otherwise, check if we clicked on any existing line (for editing)
    const clickedIndex = lines.findIndex(
      (line) =>
        line.frame === currentFrame &&
        (isPointNear({ x, y }, line) ||
          isPointNear({ x, y }, line.start) ||
          isPointNear({ x, y }, line.end))
    )
    if (clickedIndex !== -1) {
      setEditingLineIndex(clickedIndex)
    } else {
      // Start drawing a brand new line
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  // When the user moves the mouse (dragging, resizing, rotating, or drawing a line)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If some text is selected in Frame2, handle dragging/resizing/rotating
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
          const groupBox = calculateGroupBoundingBox()
          if (groupBox && resizeHandle) resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
    }
    // Otherwise, if we're in “creating or editing a line” mode:
    else if (currentLine) {
      setCurrentLine((prev) =>
        prev
          ? { ...prev, end: { x, y } }
          : null
      )
      drawCanvas()
    } else if (editingLineIndex !== null) {
      setLines((prev) => {
        const arr = [...prev]
        const edited = { ...arr[editingLineIndex] }
        if (isPointNear({ x, y }, edited.start)) {
          edited.start = { x, y }
        } else if (isPointNear({ x, y }, edited.end)) {
          edited.end = { x, y }
        }
        arr[editingLineIndex] = edited
        return arr
      })
      drawCanvas()
    }

    updateCursor(canvas, x, y)
  }

  // Update mouse cursor style based on hover state (move, resize, rotate, default)
  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    // If in Frame2 & group box exists & we hover inside it:
    const groupBox = calculateGroupBoundingBox()
    if (
      groupBox &&
      currentFrame === 2 &&
      isPointInRotatedBox(x, y, getRotatedGroupBoundingBox(groupBox))
    ) {
      // If near rotation area, show rotation cursor
      if (isPointNearRotationArea(x, y, groupBox)) {
        canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
        return
      }
      // If near any resize handle, show that handle
      const handle = getResizeHandle(x, y, groupBox)
      if (handle) {
        canvas.style.cursor = handle
        return
      }
      // Otherwise, show “move” cursor
      canvas.style.cursor = 'move'
      return
    }

    // Check individual text elements in either frame
    const currPositions =
      currentFrame === 1
        ? [...titlePositionsFrame1, subtitlePositionFrame1]
        : [...titlePositionsFrame2, subtitlePositionFrame2]

    for (let i = 0; i < currPositions.length; i++) {
      const pos = currPositions[i]
      const rectPts = getRotatedBoundingBox(pos)
      if (isPointInRotatedBox(x, y, rectPts)) {
        // If in Frame2, show rotate or resize or move
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
        // If on Frame1 (non-editable), no special cursor
      }
    }

    canvas.style.cursor = 'default'
  }

  // When user clicks a text object (Frame2) – selects / starts drag/resize/rotate
  const handleTextInteraction = (
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    if (currentFrame !== 2) return

    lastMousePosition.current = { x, y }

    // If Shift is held, toggle selection
    if (isShiftPressed.current) {
      setSelectedTexts((prev) => {
        const newSel = prev.includes(textType)
          ? prev.filter((t) => t !== textType)
          : [...prev, textType]
        // If selecting multiple: keep groupRotation
        if (newSel.length > 1) {
          setGroupRotation(lastKnownRotations.group)
        }
        // If selecting exactly one: restore that text’s own rotation
        else if (newSel.length === 1) {
          setGroupRotation(lastKnownRotations[newSel[0]])
        }
        return newSel
      })
    } else {
      // If no Shift, select only this single object
      setSelectedTexts([textType])
      setGroupRotation(lastKnownRotations[textType])
    }

    // Reset any previous interaction state
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

    // If clicked near a rotation‐hotspot, begin rotating
    if (isPointNearRotationArea(x, y, position)) {
      setIsRotating(true)
      const groupBox = calculateGroupBoundingBox()
      if (groupBox) setInitialGroupBox(groupBox)
    } else {
      // Otherwise, check if clicked a resize handle
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
        // If not on a handle, treat as a drag
        setIsDragging(true)
      }
    }

    drawCanvas()
  }

  // Drag a single text object in Frame2
  const dragSingle = (
    x: number,
    y: number,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
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
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = {
          ...arr[idx],
          x: arr[idx].x + dx,
          y: arr[idx].y + dy,
        }
        return arr
      })
    }
    lastMousePosition.current = { x, y }
  }

  // Drag an entire group of selected texts (Frame2)
  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) =>
        selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
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

  // Rotate the selected group (Frame2) around its group‐center
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

    // Rotate each selected text individually
    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) => {
        const textKey = `title${idx + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(textKey)) {
          const newPos = rotateAroundPoint(pos, cx, cy, delta)
          setLastKnownRotations((old) => ({
            ...old,
            [textKey]: newPos.rotation,
          }))
          return newPos
        }
        return pos
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => {
        const newSub = rotateAroundPoint(prev, cx, cy, delta)
        setLastKnownRotations((old) => ({
          ...old,
          subtitle: newSub.rotation,
        }))
        return newSub
      })
    }

    setGroupRotation((prev) => {
      const newRot = prev + delta
      setLastKnownRotations((old) => ({
        ...old,
        group: newRot,
      }))
      return newRot
    })
    lastMousePosition.current = { x, y }
  }

  // Resize a single text (Frame2) via a corner‐handle
  const resizeSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!resizeStartPosition) return
    const curr = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const cx = curr.x + curr.width / 2
    const cy = curr.y + curr.height / 2
    const startVec = { x: resizeStartPosition.x - cx, y: resizeStartPosition.y - cy }
    const currVec = { x: x - cx, y: y - cy }
    const sensitivity = 0.1

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const currDist = Math.abs(currVec.x)
      if (startDist !== 0) scale = 1 + ((currDist / startDist - 1) * sensitivity)
    } else {
      const startDist = Math.abs(startVec.y)
      const currDist = Math.abs(currVec.y)
      if (startDist !== 0) scale = 1 + ((currDist / startDist - 1) * sensitivity)
    }
    scale = Math.max(0.1, scale)
    const newW = curr.width * scale
    const newH = curr.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2
    const newFont = curr.fontSize * scale

    const newPos: TextPosition = {
      ...curr,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: newFont,
    }

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPos)
    } else {
      setTitlePositionsFrame2((prev) => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = newPos
        return arr
      })
    }
    drawCanvas()
  }

  // Resize the entire group (Frame2)
  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPosition) return
    const { x: boxX, y: boxY, width: boxW, height: boxH, rotation: boxR } = initialGroupBox
    const cx = boxX + boxW / 2
    const cy = boxY + boxH / 2
    const dx = x - resizeStartPosition.x
    const dy = y - resizeStartPosition.y
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / boxW) * 0.5
    } else {
      scale = 1 + (dy / boxH) * 0.5
    }
    scale = Math.max(0.1, scale)
    const newW = boxW * scale
    const newH = boxH * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (pos: TextPosition): TextPosition => {
      const relX = (pos.x - cx) / (boxW / 2)
      const relY = (pos.y - cy) / (boxH / 2)
      return {
        ...pos,
        x: cx + relX * (newW / 2),
        y: cy + relY * (newH / 2),
        width: pos.width * scale,
        height: pos.height * scale,
        fontSize: pos.fontSize * scale,
      }
    }

    setTitlePositionsFrame2((prev) =>
      prev.map((pos, idx) =>
        selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
          ? updatePos(pos)
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => updatePos(prev))
    }

    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: boxR })
    drawCanvas()
  }

  //
  // ── FRAME / PLAY / LOOP / EXPORT BUTTONS ───────────────────────────────────────
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
  // ── POSITION POPUP “Update Position” HANDLER ───────────────────────────────────
  //

  const updatePosition = (newPos: TextPosition) => {
    if (!editingPosition) return
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2((prev) => {
        const arr = [...prev]
        selectedTexts.forEach((t) => {
          if (t === 'title1') arr[0] = newPos
          if (t === 'title2') arr[1] = newPos
        })
        return arr
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
      case 'tremblingIntensity':
        setTremblingIntensity(value)
        drawCanvas()
        break
      // you can add more settings here if needed
    }
  }

  //
  // ── RENDER ─────────────────────────────────────────────────────────────────────
  //

  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ── LEFT PANEL ───────────────────────────────────────────────────────────── */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">Title 1</Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={(e) => setTitles([e.target.value, titles[1]])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">Title 2</Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={(e) => setTitles([titles[0], e.target.value])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">Subtitle</Label>
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

        {/* ── RIGHT CANVAS + CONTROLS ───────────────────────────────────────────────── */}
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

      {/* ── POSITION POPUP ──────────────────────────────────────────────────────────── */}
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
                  value={(editingPosition.rotation * 180) / Math.PI}
                  onChange={(e) =>
                    setEditingPosition({
                      ...editingPosition,
                      rotation: (Number(e.target.value) * Math.PI) / 180,
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

      {/* ── SETTINGS POPUP ──────────────────────────────────────────────────────────── */}
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
                onValueChange={(val) => setLineThickness(val[0])}
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
                onValueChange={(val) => setAnimationSpeed(val[0])}
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
                onValueChange={(val) => setStaggerDelay(val[0])}
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
                onValueChange={(val) =>
                  handleSettingsChange('tremblingIntensity', val[0])
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
