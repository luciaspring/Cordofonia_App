'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

interface Point { x: number, y: number }
interface Line { start: Point, end: Point, frame: number }
interface TextPosition {
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  fontSize: number,
  aspectRatio?: number
}
interface GroupBoundingBox {
  x: number,
  y: number,
  width: number,
  height: number,
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
  // -- Text & Background State --
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')

  // -- Frame & Playback State --
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)

  // -- Lines State --
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // -- Text Positions for Frame 1 & Frame 2 --
  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 48 },
    { x: 40, y: 500, width: 1000, height: 200, rotation: 0, fontSize: 48 }
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 48 },
    { x: 40, y: 500, width: 1000, height: 200, rotation: 0, fontSize: 48 }
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>(
    { x: 40, y: 600, width: 1000, height: 100, rotation: 0, fontSize: 24 }
  )
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>(
    { x: 40, y: 600, width: 1000, height: 100, rotation: 0, fontSize: 24 }
  )

  // -- Selected Text & Interaction State (Frame 2) --
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // -- Popup State for Editing Position/Rotation/FontSize --
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  // -- Settings State (Sliders) --
  const [lineThickness, setLineThickness] = useState(2)
  const [animationSpeed, setAnimationSpeed] = useState(0.0002)      // default playback speed
  const [staggerDelay, setStaggerDelay] = useState(0.2)            // between-line delay
  const [tremblingIntensity, setTremblingIntensity] = useState(5)  // jitter
  const [frameRate, setFrameRate] = useState(60)                   // 50–120 FPS

  // -- Temp Refs --
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  // -- Track Last Known Rotation for Each Text, to Restore if Re-selected --
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0
  })

  // ─── Effects ─────────────────────────────────────────────
  // Listen for Shift key to enable multi-select in Frame 2
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

  // Redraw canvas whenever dependencies change
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        updateTextDimensions(ctx)
        drawCanvas(0)
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
    titlePositionsFrame2,
    subtitlePositionFrame2
  ])

  // Start/Stop animation on play toggle
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas(0)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, animationSpeed, isLooping, frameRate])

  // ─── Text Measurement ─────────────────────────────────────────────
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }

    // Update Frame 1 title dims
    setTitlePositionsFrame1(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Update Frame 2 title dims
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )

    // Update subtitle dims
    const { width: sw, height: sh } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    setSubtitlePositionFrame1(prev => ({ ...prev, width: sw, height: sh, aspectRatio: sw / sh }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: sw, height: sh, aspectRatio: sw / sh }))
  }

  // ─── Canvas Drawing ─────────────────────────────────────────────
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const frame1Lines = lines.filter(l => l.frame === 1)
    const frame2Lines = lines.filter(l => l.frame === 2)

    if (isPlaying) {
      // Map progress to timeline: 0→0.3 grow F1, 0.3→0.6 shrink F1, 0.6→0.7 text transition to F2,
      // 0.7→1.0 grow F2, 1.0→1.3 shrink F2, 1.3→1.4 text transition back to F1
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress / 0.3), frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, ((progress - 0.3) / 0.3), frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {
        const t = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, t, 1, 2)
      } else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, ((progress - 0.7) / 0.3), [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, ((progress - 1.0) / 0.3), [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {
        const t = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, t, 2, 1)
      }
    } else {
      // Not playing: show current frame
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      // If frame 2 and texts are selected, draw bounding boxes
      if (currentFrame === 2 && selectedTexts.length) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          selectedTexts.forEach(sel => {
            if (sel === 'title1' || sel === 'title2') {
              const idx = sel === 'title1' ? 0 : 1
              drawBoundingBox(ctx, titlePositionsFrame2[idx])
            } else {
              drawBoundingBox(ctx, subtitlePositionFrame2)
            }
          })
        }
      }
    }
  }

  // Draw static titles/subtitle
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const tps = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    tps.forEach((pos, idx) => drawRotatedText(ctx, pos, titles[idx]))
    const sp = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, sp, subtitle)
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

  const getContrastColor = (bg: string) => {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  // Draw lines for a given frame (static)
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

  // Draw animated lines (grow/shrink) with optional trembling
  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    f1Lines: Line[],
    f2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = isPlaying ? '#000000' : '#0000FF'

    const duration = 0.3
    const maxStagger = staggerDelay

    const renderFrame = (linesArr: Line[], p: number) => {
      const stagger = linesArr.length > 1 ? maxStagger / (linesArr.length - 1) : 0
      linesArr.forEach((ln, idx) => {
        let t = Math.max(0, Math.min(1, (p - idx * stagger) / duration))
        t = ultraFastEaseInOutFunction(t)
        const { start, end } = ln
        const currentEnd = {
          x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t)
        }
        // Tremble both endpoints
        const jitterX = (Math.random() - 0.5) * tremblingIntensity
        const jitterY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + jitterX, start.y + jitterY)
        ctx.lineTo(currentEnd.x + jitterX, currentEnd.y + jitterY)
        ctx.stroke()
      })
    }

    if (f1Lines.length) renderFrame(f1Lines, progress)
    if (f2Lines.length) renderFrame(f2Lines, progress)
  }

  // Animate title/subtitle fromFrame→toFrame (with trembling)
  const drawAnimatedText = (ctx: CanvasRenderingContext2D, progress: number, fromFrame: number, toFrame: number) => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const lerpPos = (p1: TextPosition, p2: TextPosition, t: number) => ({
      x: lerp(p1.x, p2.x, t),
      y: lerp(p1.y, p2.y, t),
      width: lerp(p1.width, p2.width, t),
      height: lerp(p1.height, p2.height, t),
      rotation: lerp(p1.rotation, p2.rotation, t),
      fontSize: lerp(p1.fontSize, p2.fontSize, t)
    })

    const t = ultraFastEaseInOutFunction(progress)
    const fromTitles = fromFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const toTitles = toFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2

    fromTitles.forEach((pos1, i) => {
      const pos2 = toTitles[i]
      const interp = lerpPos(pos1, pos2, t)
      // Tremble each text
      const jitterX = (Math.random() - 0.5) * tremblingIntensity
      const jitterY = (Math.random() - 0.5) * tremblingIntensity
      drawRotatedText(ctx, { ...interp, x: interp.x + jitterX, y: interp.y + jitterY }, titles[i])
    })

    const sp1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sp2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const interpSub = lerpPos(sp1, sp2, t)
    const jx = (Math.random() - 0.5) * tremblingIntensity
    const jy = (Math.random() - 0.5) * tremblingIntensity
    drawRotatedText(ctx, { ...interpSub, x: interpSub.x + jx, y: interpSub.y + jy }, subtitle)
  }

  // ─── Bounding Boxes & Selection (Frame 2) ────────────────────
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const halfW = pos.width / 2
    const halfH = pos.height / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(pos.rotation)
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, pos.width, pos.height)

    // Draw corner handles
    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH]
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.rect(x - handleSize/2, y - handleSize/2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const halfW = box.width / 2
    const halfH = box.height / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(box.rotation)
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, box.width, box.height)

    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH]
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.rect(x - handleSize/2, y - handleSize/2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (!selectedTexts.length) return null
    const positions = titlePositionsFrame2
      .filter((_, i) => selectedTexts.includes(`title${i+1}` as 'title1'|'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : [])

    let minX = Math.min(...positions.map(p => p.x))
    let minY = Math.min(...positions.map(p => p.y))
    let maxX = Math.max(...positions.map(p => p.x + p.width))
    let maxY = Math.max(...positions.map(p => p.y + p.height))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: groupRotation }
  }

  // ─── Hit‐Testing Helpers ───────────────────────────────────────
  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    const cx = pos.x + pos.width/2
    const cy = pos.y + pos.height/2
    const w = pos.width
    const h = pos.height
    const corners: { x: number, y: number }[] = [
      { x: -w/2, y: -h/2 },
      { x:  w/2, y: -h/2 },
      { x:  w/2, y:  h/2 },
      { x: -w/2, y:  h/2 }
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(pos.rotation) - corner.y * Math.sin(pos.rotation)
      const ry = corner.x * Math.sin(pos.rotation) + corner.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width/2
    const cy = box.y + box.height/2
    const corners: { x: number, y: number }[] = [
      { x: -box.width/2, y: -box.height/2 },
      { x:  box.width/2, y: -box.height/2 },
      { x:  box.width/2, y:  box.height/2 },
      { x: -box.width/2, y:  box.height/2 }
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(box.rotation) - corner.y * Math.sin(box.rotation)
      const ry = corner.x * Math.sin(box.rotation) + corner.y * Math.cos(box.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const isPointInRotatedBox = (x: number, y: number, boxPts: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = boxPts.length - 1; i < boxPts.length; j = i++) {
      const xi = boxPts[i].x, yi = boxPts[i].y
      const xj = boxPts[j].x, yj = boxPts[j].y
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi)*(y - yi)/(yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const isPointNear = (pt: Point, tgt: Point | Line, thresh = 10): boolean => {
    if ('x' in tgt && 'y' in tgt) {
      const dx = pt.x - tgt.x
      const dy = pt.y - tgt.y
      return Math.sqrt(dx*dx + dy*dy) < thresh
    } else {
      return pointToLineDistance(pt, tgt.start, tgt.end) < thresh
    }
  }

  const pointToLineDistance = (pt: Point, s: Point, e: Point): number => {
    const A = pt.x - s.x
    const B = pt.y - s.y
    const C = e.x - s.x
    const D = e.y - s.y
    const dot = A*C + B*D
    const lenSq = C*C + D*D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq
    let xx, yy
    if (param < 0) {
      xx = s.x; yy = s.y
    } else if (param > 1) {
      xx = e.x; yy = e.y
    } else {
      xx = s.x + param*C
      yy = s.y + param*D
    }
    const dx = pt.x - xx
    const dy = pt.y - yy
    return Math.sqrt(dx*dx + dy*dy)
  }

  // ─── Interaction Helpers (Frame 2) ───────────────────────────
  const getResizeHandle = (x: number, y: number, pos: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 20
    const cx = pos.x + pos.width/2
    const cy = pos.y + pos.height/2
    const rot = pos.rotation
    const dx = x - cx
    const dy = y - cy
    const unrotX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const unrotY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const halfW = pos.width / 2
    const halfH = pos.height / 2

    if (Math.abs(unrotX + halfW) <= handleSize/2 && Math.abs(unrotY + halfH) <= handleSize/2) return 'nw-resize'
    if (Math.abs(unrotX - halfW) <= handleSize/2 && Math.abs(unrotY + halfH) <= handleSize/2) return 'ne-resize'
    if (Math.abs(unrotX - halfW) <= handleSize/2 && Math.abs(unrotY - halfH) <= handleSize/2) return 'se-resize'
    if (Math.abs(unrotX + halfW) <= handleSize/2 && Math.abs(unrotY - halfH) <= handleSize/2) return 'sw-resize'

    if (Math.abs(unrotX) < halfW && Math.abs(unrotY) < halfH) return 'move'
    return null
  }

  const isPointNearRotationArea = (x: number, y: number, pos: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const cx = pos.x + pos.width/2
    const cy = pos.y + pos.height/2
    const rot = pos.rotation
    const dx = x - cx
    const dy = y - cy
    const unrotX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const unrotY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const halfW = pos.width / 2
    const halfH = pos.height / 2

    const corners: { x: number, y: number }[] = [
      { x: -halfW, y: -halfH },
      { x:  halfW, y: -halfH },
      { x:  halfW, y:  halfH },
      { x: -halfW, y:  halfH }
    ]

    for (const corner of corners) {
      const dist = Math.sqrt(Math.pow(unrotX - corner.x, 2) + Math.pow(unrotY - corner.y, 2))
      if (dist > handleSize/2 && dist <= handleSize/2 + rotationAreaSize) {
        return true
      }
    }
    return false
  }

  const resizeSingle = (
    x: number, y: number, pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle', handle: string
  ) => {
    if (!resizeStartPosRef.current) return
    const currentPos = textType === 'subtitle'
      ? subtitlePositionFrame2
      : titlePositionsFrame2[textType === 'title1' ? 0 : 1]

    const cx = currentPos.x + currentPos.width/2
    const cy = currentPos.y + currentPos.height/2
    const startX = resizeStartPosRef.current.x
    const startY = resizeStartPosRef.current.y
    const startVec = { x: startX - cx, y: startY - cy }
    const currVec = { x: x - cx, y: y - cy }

    const speedFactor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const currDist = Math.abs(currVec.x)
      scale = startDist !== 0 ? 1 + ((currDist / startDist - 1) * speedFactor) : 1
    } else {
      const startDist = Math.abs(startVec.y)
      const currDist = Math.abs(currVec.y)
      scale = startDist !== 0 ? 1 + ((currDist / startDist - 1) * speedFactor) : 1
    }
    scale = Math.max(0.1, scale)

    const newW = currentPos.width * scale
    const newH = currentPos.height * scale
    const newX = cx - newW/2
    const newY = cy - newH/2

    const updatedPos = {
      ...currentPos,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: currentPos.fontSize * scale
    }

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(updatedPos)
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = updatedPos
        return copy
      })
    }
    drawCanvas(0)
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBoxRef.current || !resizeStartPosRef.current) return
    const box = initialGroupBoxRef.current
    const start = resizeStartPosRef.current
    const cx = box.x + box.width/2
    const cy = box.y + box.height/2

    const dx = x - start.x
    const dy = y - start.y
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / box.width) * resizeSpeedRef.current
    } else {
      scale = 1 + (dy / box.height) * resizeSpeedRef.current
    }
    scale = Math.max(0.1, scale)

    const newW = box.width * scale
    const newH = box.height * scale
    const newX = cx - newW/2
    const newY = cy - newH/2

    const updatePos = (p: TextPosition) => {
      const relX = (p.x - cx) / (box.width/2)
      const relY = (p.y - cy) / (box.height/2)
      return {
        ...p,
        x: cx + relX*(newW/2),
        y: cy + relY*(newH/2),
        width: p.width * scale,
        height: p.height * scale,
        fontSize: p.fontSize * scale
      }
    }

    setTitlePositionsFrame2(prev =>
      prev.map((p, idx) =>
        selectedTexts.includes(`title${idx+1}` as 'title1'|'title2') ? updatePos(p) : p
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }
    initialGroupBoxRef.current = { x: newX, y: newY, width: newW, height: newH, rotation: box.rotation }
    drawCanvas(0)
  }

  const rotateSingle = (
    x: number, y: number, pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosRef.current) return
    const cp = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const cx = cp.x + cp.width/2
    const cy = cp.y + cp.height/2
    const lastAngle = Math.atan2(lastMousePosRef.current.y - cy, lastMousePosRef.current.x - cx)
    const currAngle = Math.atan2(y - cy, x - cx)
    let delta = currAngle - lastAngle
    if (delta > Math.PI) delta -= 2*Math.PI
    if (delta < -Math.PI) delta += 2*Math.PI

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, rotation: prev.rotation + delta }))
      setLastKnownRotations(prev => ({ ...prev, subtitle: prev.subtitle + delta }))
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = { ...arr[idx], rotation: arr[idx].rotation + delta }
        return arr
      })
      setLastKnownRotations(prev => ({
        ...prev,
        [textType]: prev[textType] + delta
      }))
    }
    lastMousePosRef.current = { x, y }
  }

  const rotateGroup = (x: number, y: number, box: GroupBoundingBox) => {
    if (!lastMousePosRef.current) return
    const cx = box.x + box.width/2
    const cy = box.y + box.height/2
    const lastAng = Math.atan2(lastMousePosRef.current.y - cy, lastMousePosRef.current.x - cx)
    const currAng = Math.atan2(y - cy, x - cx)
    let delta = currAng - lastAng
    if (delta > Math.PI) delta -= 2*Math.PI
    if (delta < -Math.PI) delta += 2*Math.PI

    setTitlePositionsFrame2(prev =>
      prev.map((p, idx) => {
        const t = `title${idx+1}` as 'title1'|'title2'
        if (selectedTexts.includes(t)) {
          setLastKnownRotations(prevR => ({ ...prevR, [t]: p.rotation + delta }))
          return rotateAroundPoint(p, cx, cy, delta)
        }
        return p
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const rotated = rotateAroundPoint(prev, cx, cy, delta)
        setLastKnownRotations(prevR => ({ ...prevR, subtitle: rotated.rotation }))
        return rotated
      })
    }
    setGroupRotation(prev => {
      const nr = prev + delta
      setLastKnownRotations(prevR => ({ ...prevR, group: nr }))
      return nr
    })
    lastMousePosRef.current = { x, y }
  }

  const rotateAroundPoint = (pos: TextPosition, cx: number, cy: number, angle: number): TextPosition => {
    const dx = pos.x + pos.width/2 - cx
    const dy = pos.y + pos.height/2 - cy
    const dist = Math.sqrt(dx*dx + dy*dy)
    const currAng = Math.atan2(dy, dx)
    const newAng = currAng + angle
    const newX = cx + dist * Math.cos(newAng) - pos.width/2
    const newY = cy + dist * Math.sin(newAng) - pos.height/2
    return { ...pos, x: newX, y: newY, rotation: pos.rotation + angle }
  }

  // ─── Mouse Event Handlers ─────────────────────────────────────
  const initialGroupBoxRef = useRef<GroupBoundingBox | null>(null)
  const resizeStartPosRef = useRef<Point | null>(null)
  const lastMousePosRef = useRef<Point | null>(null)

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    lastMousePosRef.current = { x, y }

    // Check text interaction on Frame 2 first
    if (currentFrame === 2) {
      // Titles
      for (let i = 0; i < titlePositionsFrame2.length; i++) {
        const pos = titlePositionsFrame2[i]
        if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))) {
          handleTextInteraction(pos, `title${i+1}` as 'title1'|'title2', x, y)
          return
        }
      }
      // Subtitle
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePositionFrame2))) {
        handleTextInteraction(subtitlePositionFrame2, 'subtitle', x, y)
        return
      }
    }

    // If no text interaction (or frame 1), handle line editing/creation
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }
    const clickedIdx = lines.findIndex(l =>
      l.frame === currentFrame &&
      (isPointNear({ x, y }, l) || isPointNear({ x, y }, l.start) || isPointNear({ x, y }, l.end))
    )
    if (clickedIdx !== -1) {
      setEditingLineIndex(clickedIdx)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas(0)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If frame 2 and some text is selected, manage drag/resize/rotate
    if (currentFrame === 2 && selectedTexts.length) {
      if (isRotating && initialGroupBoxRef.current) {
        rotateGroup(x, y, initialGroupBoxRef.current)
      } else if (isDragging) {
        if (selectedTexts.length === 1) {
          dragSingle(x, y, selectedTexts[0])
        } else {
          dragGroup(x, y)
        }
      } else if (resizeHandle) {
        if (selectedTexts.length === 1) {
          const textType = selectedTexts[0]
          const pos = textType === 'subtitle'
            ? subtitlePositionFrame2
            : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, textType, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas(0)
      updateCursor(canvas, x, y)
      return
    }

    // Else if currently drawing a new line
    if (currentLine) {
      setCurrentLine(prev => prev ? { ...prev, end: { x, y } } : null)
      drawCanvas(0)
    }
    // Else if editing existing line
    else if (editingLineIndex !== null) {
      setLines(prev => {
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
      drawCanvas(0)
    } else {
      updateCursor(canvas, x, y)
    }
  }

  const handleMouseUp = () => {
    if (isPlaying) return
    if (currentLine) {
      setLines(prev => [...prev, currentLine])
      setCurrentLine(null)
    }
    setEditingLineIndex(null)
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeHandle(null)
    lastMousePosRef.current = null
    initialGroupBoxRef.current = null
    drawCanvas(0)
  }

  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosRef.current) return
    const dx = x - lastMousePosRef.current.x
    const dy = y - lastMousePosRef.current.y
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = { ...arr[idx], x: arr[idx].x + dx, y: arr[idx].y + dy }
        return arr
      })
    }
    lastMousePosRef.current = { x, y }
  }

  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosRef.current) return
    const dx = x - lastMousePosRef.current.x
    const dy = y - lastMousePosRef.current.y
    setTitlePositionsFrame2(prev =>
      prev.map((p, idx) =>
        selectedTexts.includes(`title${idx+1}` as 'title1'|'title2')
          ? { ...p, x: p.x + dx, y: p.y + dy }
          : p
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    lastMousePosRef.current = { x, y }
  }

  const handleTextInteraction = (
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    // Single‐click selects; shift + click multi‐select
    if (isShiftPressed.current) {
      setSelectedTexts(prev => {
        const has = prev.includes(textType)
        let newSel = has ? prev.filter(t => t !== textType) : [...prev, textType]
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

    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

    // Check if near rotation area
    if (isPointNearRotationArea(x, y, pos)) {
      setIsRotating(true)
      const groupBox = calculateGroupBoundingBox()
      if (groupBox) initialGroupBoxRef.current = groupBox
    } else {
      const handle = getResizeHandle(x, y, pos)
      if (handle) {
        if (handle === 'move') {
          setIsDragging(true)
        } else {
          setResizeHandle(handle)
          setIsResizing(true)
          resizeStartPosRef.current = { x, y }
          if (selectedTexts.length > 1) {
            initialGroupBoxRef.current = calculateGroupBoundingBox()
          }
        }
      } else {
        setIsDragging(true)
      }
    }

    drawCanvas(0)
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

  // ─── Animation Loop ───────────────────────────────────────────
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current
    // Respect frameRate: convert to real "progress" at chosen FPS
    const msPerFrame = 1000 / frameRate
    const framesPassed = Math.floor(elapsed / msPerFrame)
    let progress = framesPassed * animationSpeed
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

  // ─── Frame Change & Play/Loop Toggles ───────────────────────
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas(0)
  }
  const togglePlay = () => setIsPlaying(prev => !prev)
  const toggleLoop = () => setIsLooping(prev => !prev)

  // ─── Position Popup Handling ─────────────────────────────────
  const handleDoubleClick = (
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    setEditingPosition(pos)
    setPositionModalOpen(true)
  }

  const updatePositionFromPopup = (newPos: TextPosition) => {
    if (!editingPosition) return
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        selectedTexts.forEach(sel => {
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
    drawCanvas(0)
  }

  // ─── Text Interaction Entry Point (double-click vs single-click) ─
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    // Check double-click on text in Frame 2
    if (currentFrame === 2) {
      for (let i = 0; i < titlePositionsFrame2.length; i++) {
        const pos = titlePositionsFrame2[i]
        if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))) {
          handleDoubleClick(pos, `title${i+1}` as 'title1'|'title2')
          return
        }
      }
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePositionFrame2))) {
        handleDoubleClick(subtitlePositionFrame2, 'subtitle')
        return
      }
    }
  }

  // ─── Settings Change Handler ─────────────────────────────────
  const handleSettingsChange = (name: string, value: number) => {
    switch(name) {
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
    drawCanvas(0)
  }

  // ─── JSX ───────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ─── Left Panel ─── */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">Title 1</Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={e => setTitles([e.target.value, titles[1]])}
              className="mt-1 bg-white rounded text-lg h-10 px-2"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">Title 2</Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={e => setTitles([titles[0], e.target.value])}
              className="mt-1 bg-white rounded text-lg h-10 px-2"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">Subtitle</Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              className="mt-1 bg-white rounded text-lg h-10 px-2"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-600">Background Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {colorOptions.map(color => (
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

        {/* ─── Right Panel ─── */}
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
              onDoubleClick={handleCanvasDoubleClick}
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
              {isPlaying
                ? <PauseIcon className="h-5 w-5 text-white" />
                : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button
              onClick={toggleLoop}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${isLooping ? 'ring-2 ring-blue-500' : ''}`}
            >
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => console.log('Export not implemented')} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Position Popup ───────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position / Rotation / Size</DialogTitle>
          </DialogHeader>
          {editingPosition && (
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
              <div>
                <Label htmlFor="fontSize">Font Size</Label>
                <Input
                  id="fontSize"
                  type="number"
                  value={editingPosition.fontSize}
                  onChange={e => setEditingPosition({
                    ...editingPosition,
                    fontSize: Number(e.target.value)
                  })}
                />
              </div>
              <Button onClick={() => {
                if (editingPosition) updatePositionFromPopup(editingPosition)
              }}>
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Settings Popup ───────────────────────────────────── */}
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
                onValueChange={v => handleSettingsChange('lineThickness', v[0])}
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
                onValueChange={v => handleSettingsChange('animationSpeed', v[0])}
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
                onValueChange={v => handleSettingsChange('staggerDelay', v[0])}
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
                onValueChange={v => handleSettingsChange('tremblingIntensity', v[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRate">Frame Rate (Stop-Motion)</Label>
              <Slider
                id="frameRate"
                min={50}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={v => handleSettingsChange('frameRate', v[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
