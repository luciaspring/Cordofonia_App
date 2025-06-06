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

interface RigidBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  centerX: number
  centerY: number
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────────

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

// Preset maximums
const MAX_LINE_THICKNESS = 10
const MIN_LINE_THICKNESS = 1
const MIN_FRAME_RATE = 10
const BASE_FPS = 60

// ─── COMPONENT ───────────────────────────────────────────────────────────────────

export default function InstagramPostCreator() {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

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

  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number | null>(null)

  // Preset values for animation controls
  const [lineThickness, setLineThickness] = useState<number>(MAX_LINE_THICKNESS)       // 10
  const [tremblingIntensity, setTremblingIntensity] = useState<number>(3)             // preset at 3
  const [frameRate, setFrameRate] = useState<number>(MIN_FRAME_RATE)                   // preset at 10
  const [baseFps, setBaseFps] = useState<number>(35)                                   // preset at 35
  const [easePower, setEasePower] = useState<number>(6)                                // default easing strength

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)

  const [initialGroupState, setInitialGroupState] = useState<{
    box: GroupBoundingBox
    centerX: number
    centerY: number
  } | null>(null)

  // Ref's for animation and mouse tracking
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastDisplayTimeRef = useRef<number>(0)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])

  // Ease In-Out easing with adjustable power
  const easeInOut = (t: number): number => {
    const p = easePower
    if (t < 0.5) {
      return Math.pow(2, p - 1) * Math.pow(t, p)
    } else {
      return 1 - Math.pow(-2 * t + 2, p) / 2
    }
  }

  // ─── EFFECT HOOKS ───────────────────────────────────────────────────────────────
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    updateTextDimensions(ctx)
    if (!isPlaying) drawCanvas()
  }, [
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    lines,
    lineThickness,
    tremblingIntensity,
    frameRate
  ])

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      lastDisplayTimeRef.current = 0
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas()
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, isLooping])

  // ─── TEXT DIMENSION UPDATER ──────────────────────────────────────────────────────
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }

    setTitlePositionsFrame1(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    const { width: sw, height: sh } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const subAR = sw / sh
    setSubtitlePositionFrame1(prev => ({ ...prev, width: sw, height: sh, aspectRatio: subAR }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: sw, height: sh, aspectRatio: subAR }))
  }

  // ─── DRAWING ROUTINES ────────────────────────────────────────────────────────────
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (isPlaying) {
      const frame1Lines = lines.filter((l) => l.frame === 1)
      const frame2Lines = lines.filter((l) => l.frame === 2)

      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {             // 0.6 → 0.7 (0.10 window)
        const t = (progress - 0.6) / 0.10
        drawAnimatedText(ctx, t, 1, 2)
      } else if (progress <= 1.0) {             // 0.7 → 1.0 (0.3 window)
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {             // 1.0 → 1.3 (0.3 window)
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {             // 1.3 → 1.4 (0.10 window)
        const t = (progress - 1.3) / 0.10
        drawAnimatedText(ctx, t, 2, 1)
      }
      return
    }

    const framelines = lines.filter(l => l.frame === currentFrame)
    drawLines(ctx, framelines)
    drawStaticText(ctx, currentFrame)

    if (currentFrame === 2 && selectedTexts.length > 0) {
      if (selectedTexts.length > 1) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        }
      } else {
        // Only one selected: draw its own bounding box
        const sel = selectedTexts[0]
        if (sel === 'subtitle') {
          drawBoundingBox(ctx, subtitlePositionFrame2)
        } else {
          const idx = sel === 'title1' ? 0 : 1
          drawBoundingBox(ctx, titlePositionsFrame2[idx])
        }
      }
    }
  }

  // ─── STATIC TEXT DRAW WITH TREMBLING ─────────────────────────────────────────────
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    // Draw titles with random tremble
    positions.forEach((pos, idx) => {
      const tremX = (Math.random() - 0.5) * tremblingIntensity
      const tremY = (Math.random() - 0.5) * tremblingIntensity
      ctx.save()
      ctx.translate(pos.x + pos.width / 2 + tremX, pos.y + pos.height / 2 + tremY)
      ctx.rotate(pos.rotation)
      ctx.font = `bold ${pos.fontSize}px Arial`
      ctx.fillStyle = getContrastColor(backgroundColor)
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(titles[idx], 0, 0)
      ctx.restore()
    })

    // Draw subtitle with random tremble
    const tremXsub = (Math.random() - 0.5) * tremblingIntensity
    const tremYsub = (Math.random() - 0.5) * tremblingIntensity
    ctx.save()
    ctx.translate(subPos.x + subPos.width / 2 + tremXsub, subPos.y + subPos.height / 2 + tremYsub)
    ctx.rotate(subPos.rotation)
    ctx.font = `bold ${subPos.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(subtitle, 0, 0)
    ctx.restore()
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) => {
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

  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'
    framelines.forEach(line => {
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

  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'

    const animationDuration = 0.3
    const maxStaggerDelay = 0.2

    const drawFrameLines = (linesArr: Line[], fgProgress: number) => {
      const adjustedStagger = linesArr.length > 1 ? maxStaggerDelay / (linesArr.length - 1) : 0
      linesArr.forEach((ln, idx) => {
        let t = Math.max(0, Math.min(1, (fgProgress - idx * adjustedStagger) / animationDuration))
        t = easeInOut(t)
        const { start, end } = ln
        const currentEnd = {
          x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t)
        }
        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity
        ctx.beginPath()
        ctx.moveTo(start.x + tremX, start.y + tremY)
        ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length) drawFrameLines(frame1Lines, progress)
    if (frame2Lines.length) drawFrameLines(frame2Lines, progress)
  }

  const drawAnimatedText = (ctx: CanvasRenderingContext2D, progress: number, fromFrame: number, toFrame: number) => {
    const interpolate = (a: number, b: number, t: number) => a + (b - a) * t
    const interpolatePos = (p1: TextPosition, p2: TextPosition, t: number): TextPosition => ({
      x: interpolate(p1.x, p2.x, t),
      y: interpolate(p1.y, p2.y, t),
      width: interpolate(p1.width, p2.width, t),
      height: interpolate(p1.height, p2.height, t),
      rotation: interpolate(p1.rotation, p2.rotation, t),
      fontSize: interpolate(p1.fontSize, p2.fontSize, t)
    })
    const t = easeInOut(progress)

    // Draw titles with trembling
    titles.forEach((text, idx) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const pos2 = toFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const midPos = interpolatePos(pos1, pos2, t)
      const tremX = (Math.random() - 0.5) * tremblingIntensity
      const tremY = (Math.random() - 0.5) * tremblingIntensity

      ctx.save()
      ctx.translate(midPos.x + midPos.width / 2 + tremX, midPos.y + midPos.height / 2 + tremY)
      ctx.rotate(midPos.rotation)
      ctx.font = `bold ${midPos.fontSize}px Arial`
      ctx.fillStyle = getContrastColor(backgroundColor)
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(text, 0, 0)
      ctx.restore()
    })

    // Draw subtitle with trembling
    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const midSub = interpolatePos(sub1, sub2, t)
    const tremXsub = (Math.random() - 0.5) * tremblingIntensity
    const tremYsub = (Math.random() - 0.5) * tremblingIntensity

    ctx.save()
    ctx.translate(midSub.x + midSub.width / 2 + tremXsub, midSub.y + midSub.height / 2 + tremYsub)
    ctx.rotate(midSub.rotation)
    ctx.font = `bold ${midSub.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(subtitle, 0, 0)
    ctx.restore()
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
    const handleSize = 10
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
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
    const handleSize = 10
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
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

  // ─── BOUNDING BOX CALCULATORS ───────────────────────────────────────────────────
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    const selectedPositions: TextPosition[] = titlePositionsFrame2
      .filter((_, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2'))
    if (selectedTexts.includes('subtitle')) {
      selectedPositions.push(subtitlePositionFrame2)
    }
    if (!selectedPositions.length) return null

    let minX = Math.min(...selectedPositions.map(p => p.x))
    let minY = Math.min(...selectedPositions.map(p => p.y))
    let maxX = Math.max(...selectedPositions.map(p => p.x + p.width))
    let maxY = Math.max(...selectedPositions.map(p => p.y + p.height))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation
    }
  }

  // ─── MOUSE & INTERACTION HANDLERS ──────────────────────────────────────────────
  const getResizeHandle = (
    x: number,
    y: number,
    position: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = 20
    const cx = position.x + position.width / 2
    const cy = position.y + position.height / 2
    const rot = position.rotation
    const dx = x - cx
    const dy = y - cy
    const ux = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const uy = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = position.width / 2
    const hh = position.height / 2

    if (Math.abs(ux + hw) <= handleSize / 2 && Math.abs(uy + hh) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(ux - hw) <= handleSize / 2 && Math.abs(uy + hh) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(ux - hw) <= handleSize / 2 && Math.abs(uy - hh) <= handleSize / 2) return 'se-resize'
    if (Math.abs(ux + hw) <= handleSize / 2 && Math.abs(uy - hh) <= handleSize / 2) return 'sw-resize'

    if (Math.abs(ux) < hw && Math.abs(uy) < hh) return 'move'
    return null
  }

  const isPointNearRotationArea = (
    x: number,
    y: number,
    position: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = 20
    const rotArea = 15
    const cx = position.x + position.width / 2
    const cy = position.y + position.height / 2
    const rot = position.rotation
    const dx = x - cx
    const dy = y - cy
    const ux = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const uy = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = position.width / 2
    const hh = position.height / 2
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ]
    for (const c of corners) {
      const dist = Math.hypot(ux - c.x, uy - c.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotArea) return true
    }
    return false
  }

  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x
      const yi = box[i].y
      const xj = box[j].x
      const yj = box[j].y
      const intersect = (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
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
      { x: -w / 2, y: h / 2 }
    ]
    return corners.map(c => {
      const rx = c.x * Math.cos(pos.rotation) - c.y * Math.sin(pos.rotation)
      const ry = c.x * Math.sin(pos.rotation) + c.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const w = box.width
    const h = box.height
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ]
    return corners.map(c => {
      const rx = c.x * Math.cos(box.rotation) - c.y * Math.sin(box.rotation)
      const ry = c.x * Math.sin(box.rotation) + c.y * Math.cos(box.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const isPointNear = (
    point: Point,
    target: Point | Line,
    threshold = 10
  ): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.hypot(dx, dy) < threshold
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold
    }
  }

  const pointToLineDistance = (pt: Point, a: Point, b: Point): number => {
    const A = pt.x - a.x
    const B = pt.y - a.y
    const C = b.x - a.x
    const D = b.y - a.y
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq
    let xx, yy
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
    return Math.hypot(dx, dy)
  }

  // ─── DRAGGING & RESIZING FUNCTIONS ─────────────────────────────────────────────
  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }))
    } else {
      setTitlePositionsFrame2(prev => {
        const newArr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        newArr[idx] = {
          ...newArr[idx],
          x: newArr[idx].x + dx,
          y: newArr[idx].y + dy
        }
        return newArr
      })
    }
    lastMousePosition.current = { x, y }
  }

  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
        ? { ...pos, x: pos.x + dx, y: pos.y + dy }
        : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    lastMousePosition.current = { x, y }
  }

  const resizeSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!resizeStartPosition) return
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const startVec = { x: resizeStartPosition.x - centerX, y: resizeStartPosition.y - centerY }
    const currentVec = { x: x - centerX, y: y - centerY }
    const resizeSpeedFactor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const currentDist = Math.abs(currentVec.x)
      scale = startDist !== 0 ? 1 + ((currentDist / startDist - 1) * resizeSpeedFactor) : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const startDist = Math.abs(startVec.y)
      const currentDist = Math.abs(currentVec.y)
      scale = startDist !== 0 ? 1 + ((currentDist / startDist - 1) * resizeSpeedFactor) : 1
    }
    scale = Math.max(0.1, scale)
    const newW = position.width * scale
    const newH = position.height * scale
    const newX = centerX - newW / 2
    const newY = centerY - newH / 2
    const newPos: TextPosition = {
      ...position,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: position.fontSize * scale
    }
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPos)
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = newPos
        return arr
      })
    }
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPosition) return
    const dx = x - resizeStartPosition.x
    const dy = y - resizeStartPosition.y
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
        x: cx + relX * (newW / 2) - pos.width * scale / 2,
        y: cy + relY * (newH / 2) - pos.height * scale / 2,
        width: pos.width * scale,
        height: pos.height * scale,
        fontSize: pos.fontSize * scale
      }
    }

    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) =>
        selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
          ? updatePos(pos)
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }
    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
  }

  const rotateSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosition.current) return
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currentAngle = Math.atan2(y - centerY, x - centerX)
    let delta = currentAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, rotation: prev.rotation + delta }))
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = { ...arr[idx], rotation: arr[idx].rotation + delta }
        return arr
      })
    }
    lastMousePosition.current = { x, y }
  }

  const rotateGroup = (x: number, y: number, box: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currentAngle = Math.atan2(y - cy, x - cx)
    let delta = currentAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) =>
        selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
          ? rotateAroundPoint(pos, cx, cy, delta)
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => rotateAroundPoint(prev, cx, cy, delta))
    }
    setGroupRotation(prev => prev + delta)
    lastMousePosition.current = { x, y }
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
    const currAngle = Math.atan2(dy, dx)
    const newAngle = currAngle + angle
    const newX = cx + dist * Math.cos(newAngle) - pos.width / 2
    const newY = cy + dist * Math.sin(newAngle) - pos.height / 2
    return { ...pos, x: newX, y: newY, rotation: pos.rotation + angle }
  }

  // ─── MOUSE EVENT HANDLERS ───────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    lastMousePosition.current = { x, y }

    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    for (let i = 0; i < positions.length; i++) {
      const rotatedBox = getRotatedBoundingBox(positions[i])
      if (isPointInRotatedBox(x, y, rotatedBox)) {
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    const subBox = getRotatedBoundingBox(subPos)
    if (isPointInRotatedBox(x, y, subBox)) {
      handleTextInteraction(subPos, 'subtitle', x, y)
      return
    }

    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    const clickedIdx = lines.findIndex(line =>
      line.frame === currentFrame &&
      (isPointNear({ x, y }, line) ||
        isPointNear({ x, y }, line.start) ||
        isPointNear({ x, y }, line.end))
    )
    if (clickedIdx !== -1) {
      setEditingLineIndex(clickedIdx)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
          const txt = selectedTexts[0]
          const pos = txt === 'subtitle'
            ? subtitlePositionFrame2
            : titlePositionsFrame2[txt === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, txt, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
    } else if (currentLine) {
      setCurrentLine(prev => prev ? { ...prev, end: { x, y } } : null)
      drawCanvas()
    } else if (editingLineIndex !== null) {
      setLines(prev => {
        const arr = [...prev]
        const ln = { ...arr[editingLineIndex] }
        if (isPointNear({ x, y }, ln.start)) {
          ln.start = { x, y }
        } else if (isPointNear({ x, y }, ln.end)) {
          ln.end = { x, y }
        }
        arr[editingLineIndex] = ln
        return arr
      })
      drawCanvas()
    }
    updateCursor(canvas, x, y)
  }

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
    setResizeStartPosition(null)
    lastMousePosition.current = null
    drawCanvas()
  }

  // Capture base font size when opening modal
  const handleTextDoubleClick = (pos: TextPosition) => {
    setEditingPosition(pos)
    setEditingBaseFontSize(pos.fontSize)
  }

  // Update handleTextInteraction to use new double click handler
  const handleTextInteraction = (
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    if (currentFrame !== 2) return
    const now = Date.now()
    const isDoubleClick = now - lastClickTime.current < 300
    lastClickTime.current = now

    lastMousePosition.current = { x, y }
    if (isShiftPressed.current) {
      setSelectedTexts(prev => {
        const newSel = prev.includes(textType)
          ? prev.filter(t => t !== textType)
          : [...prev, textType]
        if (newSel.length > 1) {
          setGroupRotation(groupRotation)
        }
        return newSel
      })
    } else {
      setSelectedTexts([textType])
    }

    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

    if (isPointNearRotationArea(x, y, position)) {
      setIsRotating(true)
      const grp = calculateGroupBoundingBox()
      if (grp) setInitialGroupBox(grp)
    } else {
      const handle = getResizeHandle(x, y, position)
      if (handle) {
        if (handle === 'move') {
          setIsDragging(true)
        } else {
          setResizeHandle(handle)
          setIsResizing(true)
          setResizeStartPosition({ x, y })
          const g = calculateGroupBoundingBox()
          if (g) setInitialGroupBox(g)
        }
      } else {
        setIsDragging(true)
      }
    }

    drawCanvas()
    if (isDoubleClick) {
      setPositionModalOpen(true)
      handleTextDoubleClick(position)
    }
  }

  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
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

    const positions = currentFrame === 1
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
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

  // ─── ANIMATION LOOP ─────────────────────────────────────────────────────────────
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current

    // Use baseFps for internal timing
    const msPerBaseFrame = 1000 / baseFps
    const normalized = elapsed / (msPerBaseFrame * 150) // same overall cycle length
    let progress = normalized
    if (progress > 1.4) {
      if (isLooping) {
        startTimeRef.current = timestamp
        progress = 0
      } else {
        progress = 1.4
        setIsPlaying(false)
      }
    }

    // Throttle visible updates to mimic stop-motion
    if (timestamp - lastDisplayTimeRef.current >= 1000 / frameRate) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const frame1Lines = lines.filter(l => l.frame === 1)
      const frame2Lines = lines.filter(l => l.frame === 2)

      // Frame 1: grow lines (0.0 → 0.3)
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')

      // Frame 1: shrink lines (0.3 → 0.6)
      } else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')

      // Text tween from Frame 1 → Frame 2 (0.6 → 0.7)
      } else if (progress <= 0.7) {             // 0.6 → 0.7 (0.10 window)
        const t = (progress - 0.6) / 0.10
        drawAnimatedText(ctx, t, 1, 2)
      } else if (progress <= 1.0) {             // 0.7 → 1.0 (0.3 window)
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {             // 1.0 → 1.3 (0.3 window)
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {             // 1.3 → 1.4 (0.10 window)
        const t = (progress - 1.3) / 0.10
        drawAnimatedText(ctx, t, 2, 1)
      }

      lastDisplayTimeRef.current = timestamp
    }

    if (isPlaying || isLooping) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawCanvas()
    }
  }

  // ─── FRAME CONTROLS ─────────────────────────────────────────────────────────────
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const togglePlay = () => setIsPlaying(prev => !prev)
  const toggleLoop = () => setIsLooping(prev => !prev)

  // ─── POSITION MODAL & SETTINGS HANDLERS ────────────────────────────────────────
  const updatePosition = (newPos: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        selectedTexts.forEach(st => {
          const idx = st === 'title1' ? 0 : 1
          arr[idx] = newPos
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

  const handleSettingsChange = (name: string, val: number) => {
    switch (name) {
      case 'lineThickness':
        setLineThickness(val)
        break
      case 'tremblingIntensity':
        setTremblingIntensity(val)
        break
      case 'frameRate':
        setFrameRate(val)
        // Throttling happening inside animate; no need to restart loop
        break
    }
    drawCanvas()
  }

  // ─── EXPORT VIDEO ────────────────────────────────────────────────────────────────
  const exportVideo = () => {
    if (!canvasRef.current) return

    const stream = (canvasRef.current as HTMLCanvasElement).captureStream(baseFps)
    recordedChunksRef.current = []

    const options: MediaRecorderOptions = { mimeType: 'video/webm; codecs=vp9' }
    const recorder = new MediaRecorder(stream, options)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'animation.webm'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setIsRecording(false)
    }

    // Start recording:
    recordedChunksRef.current = []
    setIsRecording(true)
    recorder.start()

    if (!isPlaying) {
      setIsPlaying(true)
    }

    // Compute one cycle's real-time length: (1000 / baseFps) * 150 ms
    const oneCycleMs = (1000 / baseFps) * 150
    // Record two cycles:
    const totalRecordingMs = oneCycleMs * 2

    setTimeout(() => {
      recorder.stop()
      setIsPlaying(false)
    }, totalRecordingMs)
  }

  // ─── UTILITY ────────────────────────────────────────────────────────────────────
  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ─── LEFT PANEL: Text Inputs & Color Picker */}
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

        {/* ─── RIGHT PANEL: Canvas & Controls */}
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
            <Button onClick={togglePlay} className="w-[40px] h-[40px] p-0 rounded-full bg-black">
              {isPlaying ? <PauseIcon className="h-5 w-5 text-white" /> : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button onClick={toggleLoop} className={`w-[40px] h-[40px] p-0 rounded bg-black ${isLooping ? 'ring-2 ring-blue-500' : ''}`}>
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={exportVideo}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
              disabled={isRecording}
            >
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── POSITION MODAL ───────────────────────────────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editingPosition && editingBaseFontSize !== null && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={e => setEditingPosition({ ...editingPosition, x: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={e => setEditingPosition({ ...editingPosition, y: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (degrees)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={e => setEditingPosition({ ...editingPosition, rotation: Number(e.target.value) * (Math.PI / 180) })}
                />
              </div>
              <div>
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  value={Math.round((editingPosition.fontSize / editingBaseFontSize) * 100)}
                  onChange={e => {
                    const scale = Number(e.target.value) / 100
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: editingBaseFontSize * scale
                    })
                  }}
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)}>Update</Button>
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
              <Label htmlFor="thicknessSlider">Line Thickness (max 10)</Label>
              <Slider
                id="thicknessSlider"
                min={1}
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={value => handleSettingsChange('lineThickness', value[0])}
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
                onValueChange={value => handleSettingsChange('tremblingIntensity', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="baseFpsSlider">Animation Speed (Base FPS: {baseFps})</Label>
              <Slider
                id="baseFpsSlider"
                min={10}
                max={120}
                step={1}
                value={[baseFps]}
                onValueChange={([v]) => {
                  const num = Number(v)
                  if (!isNaN(num)) setBaseFps(num)
                }}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate ({MIN_FRAME_RATE}–120)</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={([v]) => {
                  const num = Number(v)
                  if (!isNaN(num)) {
                    handleSettingsChange('frameRate', num)
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="easePowerSlider">Easing Strength</Label>
              <Slider
                id="easePowerSlider"
                min={1}
                max={10}
                step={1}
                value={[easePower]}
                onValueChange={([v]) => setEasePower(v)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
