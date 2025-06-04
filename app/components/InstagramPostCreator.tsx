'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

//
// ── TYPE DEFINITIONS ────────────────────────────────────────────────────────────
//
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

//
// ── EASING HELPER ────────────────────────────────────────────────────────────────
//
const ultraFastEaseInOutFunction = (t: number): number => {
  if (t < 0.5) {
    return Math.pow(2 * t, 16) / 2
  } else {
    return 1 - Math.pow(-2 * t + 2, 16) / 2
  }
}

//
// ── MAIN COMPONENT ───────────────────────────────────────────────────────────────
//
export default function InstagramPostCreator() {
  //
  // ── STATE HOOKS ────────────────────────────────────────────────────────────────
  //
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)

  // For freehand line drawing:
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // Text blocks for Frame 1 & Frame 2:
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

  // For selecting & manipulating text blocks in Frame 2:
  const [selectedTexts, setSelectedTexts] = useState<Array<'title1' | 'title2' | 'subtitle'>>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  // Popup dialog state (double‐click)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  // Settings controls (line thickness, animation, etc.)
  const [lineThickness, setLineThickness] = useState(2)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Store group‐level rotation when multiple are selected:
  const [groupRotation, setGroupRotation] = useState(0)
  // Store each text's last known rotation, so we can maintain it if re‐selected:
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0,
  })

  //
  // ── REFS ────────────────────────────────────────────────────────────────────────
  //
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  // For tracking double‐click timing:
  const lastClickTime = useRef<number>(0)

  //
  // ── SIDE EFFECTS ────────────────────────────────────────────────────────────────
  //
  useEffect(() => {
    // Track Shift key for multi‐select
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
    // Every time titles / subtitle / background / currentFrame / lines / styling changes,
    // re‐measure text dims and redraw immediately.
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    updateTextDimensions(ctx)
    drawCanvas()
  }, [titles, subtitle, backgroundColor, currentFrame, lines, lineThickness, tremblingIntensity])

  useEffect(() => {
    // When “Play” toggles, (re)start the animation loop
    if (isPlaying) {
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      drawCanvas()
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, isLooping])

  //
  // ── MEASURE TEXT DIMENSIONS ────────────────────────────────────────────────────
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
    setTitlePositionsFrame1(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    // Frame 2 titles
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    // Frame 1 subtitle
    const { width: sw1, height: sh1 } = measureText(subtitle, subtitlePositionFrame1.fontSize)
    setSubtitlePositionFrame1(prev => ({
      ...prev,
      width: sw1,
      height: sh1,
      aspectRatio: sw1 / sh1,
    }))
    // Frame 2 subtitle
    const { width: sw2, height: sh2 } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    setSubtitlePositionFrame2(prev => ({
      ...prev,
      width: sw2,
      height: sh2,
      aspectRatio: sw2 / sh2,
    }))
  }

  //
  // ── GROUP BOUNDING BOX CALCULATION ─────────────────────────────────────────────
  //
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    // Collect the positions of each selected block:
    const selectedPositions = titlePositionsFrame2
      .filter((_, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : [])

    const minX = Math.min(...selectedPositions.map(p => p.x))
    const minY = Math.min(...selectedPositions.map(p => p.y))
    const maxX = Math.max(...selectedPositions.map(p => p.x + p.width))
    const maxY = Math.max(...selectedPositions.map(p => p.y + p.height))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation,
    }
  }

  //
  // ── DRAWING HELPERS ────────────────────────────────────────────────────────────
  //

  // Draw a single line of text, rotated around its center:
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

  // Return either black or white depending on background luminance:
  const getContrastColor = (bg: string): string => {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  // Draw static (non‐animated) text blocks for a given frame (1 or 2):
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    positions.forEach((pos, idx) => {
      drawRotatedText(ctx, pos, titles[idx])
    })
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  // Draw all lines (when not animating) plus the “currentLine” if in-progress:
  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
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

  // Draw a bounding box (with handles) around a single text block:
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const hw = pos.width / 2
    const hh = pos.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(pos.rotation)
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, pos.width, pos.height)
    // Draw four corner handles
    const hs = 10
    const corners: Array<[number, number]> = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.rect(x - hs / 2, y - hs / 2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  // Draw a bounding box (with handles) around a group of selected text blocks:
  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const hw = box.width / 2
    const hh = box.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(box.rotation)
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, box.width, box.height)
    const hs = 10
    const corners: Array<[number, number]> = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.rect(x - hs / 2, y - hs / 2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  //
  // ── ANIMATED TEXT INTERPOLATION ─────────────────────────────────────────────────
  //
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

    titles.forEach((title, idx) => {
      const posA =
        fromFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const posB =
        toFrame === 1 ? titlePositionsFrame1[idx] : titlePositionsFrame2[idx]
      const ipos = interpolatePosition(posA, posB, t)
      drawRotatedText(ctx, ipos, title)
    })

    const subA =
      fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subB =
      toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const iSub = interpolatePosition(subA, subB, t)
    drawRotatedText(ctx, iSub, subtitle)
  }

  //
  // ── ANIMATED LINES (GROW / SHRINK) ──────────────────────────────────────────────
  //
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
    ctx.strokeStyle = '#000000'

    const animationDuration = 0.3
    const maxStaggerDelay = staggerDelay

    const drawFrameLines = (linesArr: Line[], frameProg: number) => {
      const adjustedStagger =
        linesArr.length > 1 ? maxStaggerDelay / (linesArr.length - 1) : 0

      linesArr.forEach((ln, idx) => {
        let t = Math.max(
          0,
          Math.min(1, (frameProg - idx * adjustedStagger) / animationDuration)
        )
        t = ultraFastEaseInOutFunction(t)

        const { start, end } = ln
        const currentEnd = {
          x:
            start.x +
            (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y:
            start.y +
            (end.y - start.y) * (animationType === 'grow' ? t : 1 - t),
        }

        // Tremble effect:
        const tremblingX = (Math.random() - 0.5) * tremblingIntensity
        const tremblingY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + tremblingX, start.y + tremblingY)
        ctx.lineTo(currentEnd.x + tremblingX, currentEnd.y + tremblingY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length > 0) {
      drawFrameLines(frame1Lines, progress)
    }
    if (frame2Lines.length > 0) {
      drawFrameLines(frame2Lines, progress)
    }
  }

  //
  // ── CORE DRAW FUNCTION ──────────────────────────────────────────────────────────
  //
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear / fill background:
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Separate lines by frame:
    const frame1Lines = lines.filter(l => l.frame === 1)
    const frame2Lines = lines.filter(l => l.frame === 2)

    if (isPlaying) {
      // Animated sequence: grow frame1 → shrink frame1 → text swap → grow frame2 → shrink frame2 → text swap back
      if (progress <= 0.3) {
        // Frame 1 growing
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        // Frame 1 shrinking
        drawStaticText(ctx, 1)
        drawAnimatedLines(
          ctx,
          (progress - 0.3) / 0.3,
          frame1Lines,
          [],
          'shrink'
        )
      } else if (progress <= 0.7) {
        // Text transition 1 → 2
        const t = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, t, 1, 2)
      } else if (progress <= 1.0) {
        // Frame 2 growing
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        // Frame 2 shrinking
        drawStaticText(ctx, 2)
        drawAnimatedLines(
          ctx,
          (progress - 1.0) / 0.3,
          [],
          frame2Lines,
          'shrink'
        )
      } else if (progress <= 1.4) {
        // Text transition 2 → 1
        const t = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, t, 2, 1)
      }
    } else {
      // Not playing: just draw whichever frame is active
      const toDraw = currentFrame === 1 ? frame1Lines : frame2Lines
      drawLines(ctx, toDraw)
      drawStaticText(ctx, currentFrame)

      // If in Frame 2 and some texts are selected, show bounding boxes
      if (currentFrame === 2 && selectedTexts.length > 0) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          // If multiple selected → group bounding box
          if (selectedTexts.length > 1) {
            drawGroupBoundingBox(ctx, groupBox)
          } else {
            // Single selected → draw only its bounding box
            const sel = selectedTexts[0]
            if (sel === 'title1' || sel === 'title2') {
              const idx = sel === 'title1' ? 0 : 1
              drawBoundingBox(ctx, titlePositionsFrame2[idx])
            } else {
              drawBoundingBox(ctx, subtitlePositionFrame2)
            }
          }
        }
      }
    }
  }

  //
  // ── ANIMATION LOOP ───────────────────────────────────────────────────────────────
  //
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
    }
    const elapsed = timestamp - startTimeRef.current
    const animSpeed = 0.0002
    let progress = elapsed * animSpeed

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
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawCanvas(0)
    }
  }

  //
  // ── MOUSE & INTERACTION HELPERS ────────────────────────────────────────────────
  //

  // Check if a point is near either endpoint of a line, or within a threshold of the line itself:
  const isPointNear = (
    pt: Point,
    target: Point | Line,
    thresh: number = 10
  ): boolean => {
    if ('x' in target && 'y' in target) {
      // target is a Point
      const dx = pt.x - target.x
      const dy = pt.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < thresh
    } else {
      // target is a Line: point‐to‐line distance
      return pointToLineDistance(pt, target.start, target.end) < thresh
    }
  }

  // Standard point‐to‐line‐segment distance formula:
  const pointToLineDistance = (
    pt: Point,
    A: Point,
    B: Point
  ): number => {
    const dx = pt.x - A.x
    const dy = pt.y - A.y
    const Cx = B.x - A.x
    const Cy = B.y - A.y
    const dot = dx * Cx + dy * Cy
    const lenSq = Cx * Cx + Cy * Cy
    let param = -1
    if (lenSq !== 0) param = dot / lenSq

    let xx: number, yy: number
    if (param < 0) {
      xx = A.x
      yy = A.y
    } else if (param > 1) {
      xx = B.x
      yy = B.y
    } else {
      xx = A.x + param * Cx
      yy = A.y + param * Cy
    }

    const ddx = pt.x - xx
    const ddy = pt.y - yy
    return Math.sqrt(ddx * ddx + ddy * ddy)
  }

  // Get a “rotated” polygon around the center of a text block
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
    return corners.map(corner => {
      const rx =
        corner.x * Math.cos(pos.rotation) - corner.y * Math.sin(pos.rotation)
      const ry =
        corner.x * Math.sin(pos.rotation) + corner.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  // Same as above, but for a group bounding box:
  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const w = box.width
    const h = box.height
    const corners = [
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

  // Determine which “handle” the mouse is over, for resizing or moving:
  const getResizeHandle = (
    x: number,
    y: number,
    pos: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = 20
    const cx =
      'width' in pos ? pos.x + pos.width / 2 : pos.x + pos.width / 2
    const cy =
      'height' in pos ? pos.y + pos.height / 2 : pos.y + pos.height / 2
    const rot =
      'rotation' in pos ? pos.rotation : (pos as GroupBoundingBox).rotation

    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const ry = dx * Math.sin(-rot) + dy * Math.cos(-rot)

    const hw = pos.width / 2
    const hh = pos.height / 2

    // Check four corners:
    if (Math.abs(rx + hw) <= handleSize / 2 && Math.abs(ry + hh) <= handleSize / 2)
      return 'nw-resize'
    if (Math.abs(rx - hw) <= handleSize / 2 && Math.abs(ry + hh) <= handleSize / 2)
      return 'ne-resize'
    if (Math.abs(rx - hw) <= handleSize / 2 && Math.abs(ry - hh) <= handleSize / 2)
      return 'se-resize'
    if (Math.abs(rx + hw) <= handleSize / 2 && Math.abs(ry - hh) <= handleSize / 2)
      return 'sw-resize'

    // If clicking inside box (but not on a corner), that means “move”:
    if (Math.abs(rx) < hw && Math.abs(ry) < hh) return 'move'

    return null
  }

  // Check if a click is near the rotation area (just outside the corner):
  const isPointNearRotationArea = (
    x: number,
    y: number,
    pos: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const cx =
      'width' in pos ? pos.x + pos.width / 2 : pos.x + pos.width / 2
    const cy =
      'height' in pos ? pos.y + pos.height / 2 : pos.y + pos.height / 2
    const rot =
      'rotation' in pos ? pos.rotation : (pos as GroupBoundingBox).rotation

    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const ry = dx * Math.sin(-rot) + dy * Math.cos(-rot)

    const hw = pos.width / 2
    const hh = pos.height / 2

    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]

    for (const corner of corners) {
      const dist = Math.hypot(rx - corner.x, ry - corner.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationAreaSize) {
        return true
      }
    }
    return false
  }

  // Rotate a single text block around a pivot:
  const rotateSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosition.current) return
    const cp = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const cx = cp.x + cp.width / 2
    const cy = cp.y + cp.height / 2

    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currentAngle = Math.atan2(y - cy, x - cx)
    let delta = currentAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        rotation: prev.rotation + delta,
      }))
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = {
          ...copy[idx],
          rotation: copy[idx].rotation + delta,
        }
        return copy
      })
    }

    lastMousePosition.current = { x, y }
  }

  // Rotate a group of selected text blocks around group center:
  const rotateGroup = (x: number, y: number, box: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currentAngle = Math.atan2(y - cy, x - cx)
    let delta = currentAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    // Rotate individually selected items & store last known rotations:
    setTitlePositionsFrame2(prev =>
      prev.map((p, idx) => {
        const txtKey = `title${idx + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(txtKey)) {
          const newRot = p.rotation + delta
          setLastKnownRotations(lk => ({ ...lk, [txtKey]: newRot }))
          return rotateAroundPoint(p, cx, cy, delta)
        }
        return p
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const newPos = rotateAroundPoint(prev, cx, cy, delta)
        setLastKnownRotations(lk => ({ ...lk, subtitle: newPos.rotation }))
        return newPos
      })
    }
    setGroupRotation(prev => {
      const nr = prev + delta
      setLastKnownRotations(lk => ({ ...lk, group: nr }))
      return nr
    })
    lastMousePosition.current = { x, y }
  }

  // Helper: rotate a rectangle around a pivot by “angle”:
  const rotateAroundPoint = (
    pos: TextPosition,
    cx: number,
    cy: number,
    angle: number
  ): TextPosition => {
    const dx = pos.x + pos.width / 2 - cx
    const dy = pos.y + pos.height / 2 - cy
    const dist = Math.hypot(dx, dy)
    const currA = Math.atan2(dy, dx)
    const newA = currA + angle
    const newX = cx + dist * Math.cos(newA) - pos.width / 2
    const newY = cy + dist * Math.sin(newA) - pos.height / 2
    return {
      ...pos,
      x: newX,
      y: newY,
      rotation: pos.rotation + angle,
    }
  }

  // Drag a single text block:
  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }))
    } else {
      setTitlePositionsFrame2(prev => {
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

  // Drag an entire group of selected text blocks:
  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    setTitlePositionsFrame2(prev =>
      prev.map((p, idx) => {
        const key = `title${idx + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(key)) {
          return { ...p, x: p.x + dx, y: p.y + dy }
        }
        return p
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }))
    }

    lastMousePosition.current = { x, y }
  }

  // Resize a single text block (corners) by dragging:
  const resizeSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!lastMousePosition.current) return

    // Determine “center” of current pos:
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2

    const startVec = {
      x: lastMousePosition.current.x - cx,
      y: lastMousePosition.current.y - cy,
    }
    const currVec = {
      x: x - cx,
      y: y - cy,
    }
    const resizeSpeedFactor = 0.1

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startD = Math.abs(startVec.x)
      const currD = Math.abs(currVec.x)
      scale = startD !== 0 ? 1 + ((currD / startD - 1) * resizeSpeedFactor) : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const startD = Math.abs(startVec.y)
      const currD = Math.abs(currVec.y)
      scale = startD !== 0 ? 1 + ((currD / startD - 1) * resizeSpeedFactor) : 1
    }
    scale = Math.max(0.1, scale)

    const newW = pos.width * scale
    const newH = pos.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const newPos = {
      ...pos,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: pos.fontSize * scale,
    }

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPos)
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = newPos
        return copy
      })
    }
    drawCanvas()
  }

  // Resize an entire group of selected text blocks:
  const resizeGroup = (x: number, y: number, handle: string) => {
    // If no initial group box or start pos, bail:
    if (!initialGroupBoxRef.current || !resizeStartPositionRef.current) return

    const igb = initialGroupBoxRef.current!
    const rsp = resizeStartPositionRef.current!

    const dx = x - rsp.x
    const dy = y - rsp.y
    const cx = igb.x + igb.width / 2
    const cy = igb.y + igb.height / 2

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / igb.width) * resizeSpeedRef.current
    } else if (handle.includes('n') || handle.includes('s')) {
      scale = 1 + (dy / igb.height) * resizeSpeedRef.current
    }
    scale = Math.max(0.1, scale)

    const newW = igb.width * scale
    const newH = igb.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (pos: TextPosition) => {
      const relX = (pos.x - cx) / (igb.width / 2)
      const relY = (pos.y - cy) / (igb.height / 2)
      return {
        ...pos,
        x: cx + relX * (newW / 2),
        y: cy + relY * (newH / 2),
        width: pos.width * scale,
        height: pos.height * scale,
        fontSize: pos.fontSize * scale,
      }
    }

    setTitlePositionsFrame2(prev =>
      prev.map((p, idx) => {
        const key = `title${idx + 1}` as 'title1' | 'title2'
        return selectedTexts.includes(key) ? updatePos(p) : p
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }

    initialGroupBoxRef.current = {
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      rotation: igpRef.current!.rotation,
    }
    drawCanvas()
  }

  //
  // ── REFS FOR RESIZE‐GROUP ───────────────────────────────────────────────────────
  //
  // Keep the *initial* group‐bounding box and starting mouse pos when the user begins resizing:
  const initialGroupBoxRef = useRef<GroupBoundingBox | null>(null)
  const resizeStartPositionRef = useRef<Point | null>(null)
  const resizeSpeedRef = useRef<number>(0.5)

  //
  // ── MOUSE EVENT HANDLERS ────────────────────────────────────────────────────────
  //

  // When mouse is pressed down on canvas:
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // 1) Check for text block double‐click (popup). If double‐click on a text block, open popup & return early:
    const now = Date.now()
    const dt = now - lastClickTime.current
    lastClickTime.current = now

    if (dt < 300) {
      // This is a double‐click. Did we hit a text block?
      // We only allow editing in Frame 2
      if (currentFrame === 2) {
        // Check each block individually:
        const checkTextHit = (pos: TextPosition, key: 'title1' | 'title2' | 'subtitle') => {
          const poly = getRotatedBoundingBox(pos)
          if (isPointInRotatedBox(x, y, poly)) {
            setEditingPosition(pos)
            setPositionModalOpen(true)
            return true
          }
          return false
        }
        // Title1
        if (
          checkTextHit(
            titlePositionsFrame2[0],
            'title1'
          )
        )
          return
        // Title2
        if (
          checkTextHit(
            titlePositionsFrame2[1],
            'title2'
          )
        )
          return
        // Subtitle
        if (checkTextHit(subtitlePositionFrame2, 'subtitle')) return
      }
    }

    // 2) Otherwise, it’s a “single click.” Proceed with normal selection / drawing logic:
    lastMousePosition.current = { x, y }

    // If Shift is not held, clear current selection:
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    // Determine if we clicked on a text block (Frame2 only). If so, start drag/resize/rotate:
    if (currentFrame === 2) {
      const positions = [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]
      const keys: Array<'title1' | 'title2' | 'subtitle'> = ['title1', 'title2', 'subtitle']

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i]
        const poly = getRotatedBoundingBox(pos)
        if (isPointInRotatedBox(x, y, poly)) {
          // Hit that text block
          const textKey = keys[i]

          // Multi-select if Shift is held:
          if (isShiftPressed.current) {
            setSelectedTexts(prev => {
              const copy = prev.includes(textKey)
                ? prev.filter(t => t !== textKey)
                : [...prev, textKey]
              // If exactly one selected, restore its last known rotation, else use group rotation
              if (copy.length === 1) {
                setGroupRotation(lastKnownRotations[copy[0]])
              } else if (copy.length > 1) {
                setGroupRotation(lastKnownRotations.group)
              }
              return copy
            })
          } else {
            setSelectedTexts([textKey])
            setGroupRotation(lastKnownRotations[textKey])
          }

          // Now decide whether we are rotating, resizing, or moving:
          const nearRot = isPointNearRotationArea(x, y, pos)
          if (nearRot) {
            setIsRotating(true)
            const gbox = calculateGroupBoundingBox()
            if (gbox) initialGroupBoxRef.current = gbox
          } else {
            const handle = getResizeHandle(x, y, pos)
            if (handle) {
              if (handle === 'move') {
                setIsDragging(true)
              } else {
                // Start resizing that single block
                setIsResizing(true)
                setResizeHandle(handle)
                resizeStartPositionRef.current = { x, y }
                if (selectedTexts.length > 1) {
                  // If group resizing, store initial group box
                  const gbox = calculateGroupBoundingBox()
                  if (gbox) initialGroupBoxRef.current = gbox
                } else {
                  // Single block resizing: no need to store group box ref
                }
              }
            } else {
              setIsDragging(true)
            }
          }
          drawCanvas()
          return
        }
      }
    }

    // 3) If no text block was hit, we either clicked on an existing line (start editing) or begin drawing a new line:
    const clickedLineIndex = lines.findIndex(
      ln =>
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

  // When mouse moves on canvas:
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If a text block is selected and we’re in Frame 2:
    if (selectedTexts.length > 0 && currentFrame === 2) {
      if (isRotating) {
        const gbox = calculateGroupBoundingBox()
        if (gbox) rotateGroup(x, y, gbox)
      } else if (isDragging) {
        if (selectedTexts.length === 1) {
          dragSingle(x, y, selectedTexts[0])
        } else {
          dragGroup(x, y)
        }
      } else if (isResizing && resizeHandle) {
        if (selectedTexts.length === 1) {
          const t0 = selectedTexts[0]
          const pos = t0 === 'subtitle'
            ? subtitlePositionFrame2
            : titlePositionsFrame2[t0 === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, t0, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
      return
    }

    // Otherwise, if in the middle of drawing a new line:
    if (currentLine) {
      setCurrentLine(prev => ({
        ...prev!,
        end: { x, y },
      }))
      drawCanvas()
      return
    }

    // Otherwise, if editing an existing line’s endpoints:
    if (editingLineIndex !== null) {
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
      drawCanvas()
      return
    }

    // If none of the above, just update cursor style:
    updateCursor(x, y)
  }

  // When mouse is released:
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
    lastMousePosition.current = null
    initialGroupBoxRef.current = null
    resizeStartPositionRef.current = null
    drawCanvas()
  }

  //
  // ── UPDATE CURSOR ICON BASED ON CONTEXT ──────────────────────────────────────────
  //
  const updateCursor = (mouseX: number, mouseY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // If in Frame 2 and group bounding box under cursor:
    const gbox = calculateGroupBoundingBox()
    if (
      gbox &&
      currentFrame === 2 &&
      isPointInRotatedBox(mouseX, mouseY, getRotatedGroupBoundingBox(gbox))
    ) {
      if (isPointNearRotationArea(mouseX, mouseY, gbox)) {
        canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
        return
      }
      const h = getResizeHandle(mouseX, mouseY, gbox)
      if (h) {
        canvas.style.cursor = h
        return
      }
      canvas.style.cursor = 'move'
      return
    }

    // Otherwise check each individual text block:
    if (currentFrame === 2) {
      const positions = [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i]
        const poly = getRotatedBoundingBox(pos)
        if (isPointInRotatedBox(mouseX, mouseY, poly)) {
          if (isPointNearRotationArea(mouseX, mouseY, pos)) {
            canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
            return
          }
          const h = getResizeHandle(mouseX, mouseY, pos)
          if (h) {
            canvas.style.cursor = h
            return
          }
          canvas.style.cursor = 'move'
          return
        }
      }
    }

    // Otherwise default back to pointer / crosshair for drawing:
    canvas.style.cursor = 'default'
  }

  //
  // ── HELPER: Check if a point is inside a rotated polygon ─────────────────────────
  //
  const isPointInRotatedBox = (px: number, py: number, poly: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x
      const yi = poly[i].y
      const xj = poly[j].x
      const yj = poly[j].y
      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  //
  // ── CLICK HANDLER: SAME AS MOUSE DOWN, BUT DISABLED WHEN OVER POPUP ─────────────────
  //
  const handleMouseLeave = () => {
    if (!positionModalOpen) handleMouseUp()
  }

  //
  // ── PUBLIC: Change Frame Button ──────────────────────────────────────────────────
  //
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    setGroupRotation(0)
    drawCanvas()
  }

  //
  // ── PUBLIC: Play / Pause / Loop Toggles ──────────────────────────────────────────
  //
  const togglePlay = () => {
    setIsPlaying(prev => !prev)
  }
  const toggleLoop = () => {
    setIsLooping(prev => !prev)
  }

  //
  // ── POPUP: Update Position / Rotation & Close ────────────────────────────────────
  //
  const updatePosition = (newPos: TextPosition) => {
    // Apply whatever double‐click “editingPosition” we changed back to state:
    if (!editingPosition) return

    selectedTexts.forEach(sel => {
      if (sel === 'title1' || sel === 'title2') {
        setTitlePositionsFrame2(prev => {
          const copy = [...prev]
          const idx = sel === 'title1' ? 0 : 1
          copy[idx] = newPos
          return copy
        })
      }
      if (sel === 'subtitle') {
        setSubtitlePositionFrame2(newPos)
      }
    })

    setPositionModalOpen(false)
    drawCanvas()
  }

  //
  // ── SETTINGS POPUP HANDLER ───────────────────────────────────────────────────────
  //
  const handleSettingsChange = (name: string, value: number) => {
    if (name === 'tremblingIntensity') {
      setTremblingIntensity(value)
      drawCanvas()
    }
  }

  //
  // ── RENDER / JSX ────────────────────────────────────────────────────────────────
  //
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        <div className="w-[300px] space-y-5">
          {/* Title 1 */}
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
          {/* Title 2 */}
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
          {/* Subtitle */}
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
          {/* Background color selection */}
          <div>
            <Label className="text-sm text-gray-600">Background Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { name: 'Light Pink', value: '#F6A69B' },
                { name: 'Light Blue', value: '#5894D0' },
                { name: 'Olive Green', value: '#5B6B4E' },
                { name: 'Orange', value: '#FF6700' },
                { name: 'Gray', value: '#6B6B6B' },
                { name: 'Purple', value: '#E0B0FF' },
                { name: 'Mint Green', value: '#D0EBDA' },
              ].map(color => (
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

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/*                             CANVAS & CONTROLS                         */}
        {/* ────────────────────────────────────────────────────────────────────── */}

        <div className="w-[600px] flex flex-col">
          {/* Canvas wrapper */}
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

          {/* Frame buttons & Play/Loop/Export/Settings */}
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
              onClick={() => console.log('export not implemented')}
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

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/*                              POSITION POPUP (Double‐Click)                    */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position / Rotation</DialogTitle>
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
                  value={(editingPosition.rotation * 180) / Math.PI}
                  onChange={e =>
                    setEditingPosition({
                      ...editingPosition,
                      rotation: (Number(e.target.value) * Math.PI) / 180,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  type="number"
                  value={editingPosition.width}
                  onChange={e =>
                    setEditingPosition({
                      ...editingPosition,
                      width: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="height">Height</Label>
                <Input
                  id="height"
                  type="number"
                  value={editingPosition.height}
                  onChange={e =>
                    setEditingPosition({
                      ...editingPosition,
                      height: Number(e.target.value),
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

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/*                              SETTINGS POPUP                                   */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
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
                onValueChange={value => setLineThickness(value[0])}
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
                onValueChange={value => setStaggerDelay(value[0])}
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
                onValueChange={value =>
                  handleSettingsChange('tremblingIntensity', value[0])
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
