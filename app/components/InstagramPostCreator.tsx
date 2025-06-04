'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings as SettingsIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Point { x: number; y: number }
interface Line { start: Point; end: Point; frame: number }
interface TextPosition { x: number; y: number; width: number; height: number; rotation: number; fontSize: number; aspectRatio?: number }
interface GroupBoundingBox { x: number; y: number; width: number; height: number; rotation: number }

// Extremely fast ease-in / ease-out
const ultraFastEaseInOutFunction = (t: number): number => {
  if (t < 0.5) {
    return Math.pow(2 * t, 16) / 2
  } else {
    return 1 - Math.pow(-2 * t + 2, 16) / 2
  }
}

export default function InstagramPostCreator() {
  // --- State variables ---
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')

  const [currentFrame, setCurrentFrame] = useState<1 | 2>(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)

  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36 })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36 })

  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)

  // Settings pane
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lineThickness, setLineThickness] = useState(2)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025) // controls overall animation duration
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [frameRate, setFrameRate] = useState(24) // new stop-motion frame rate slider

  // User input & timing refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

  // Track last known rotations for individual text elements
  const [lastKnownRotations, setLastKnownRotations] = useState<{ [key: string]: number }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0,
  })

  // --- Keyboard listeners for Shift (multi-select) ---
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

  // Whenever titles, subtitle, backgroundColor, etc. change, recalc text dimensions and redraw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    updateTextDimensions(ctx)
    drawCanvas()
  }, [titles, subtitle, backgroundColor, currentFrame, lines, lineThickness, tremblingIntensity])

  // Play/Pause effect: start or cancel requestAnimationFrame
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      drawCanvas()
    }
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, frameRate, animationSpeed, isLooping])

  // --- Utility: Measure text for width/height & maintain aspect ratio ---
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      const width = metrics.width
      const height = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || fontSize * 0.8
      return { width, height }
    }

    // Update titles frame1
    setTitlePositionsFrame1(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )
    // Update titles frame2
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        return { ...pos, width, height, aspectRatio: width / height }
      })
    )
    // Update subtitle frame1 & frame2
    const { width: sw, height: sh } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    setSubtitlePositionFrame1(prev => ({ ...prev, width: sw, height: sh, aspectRatio: sw / sh }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: sw, height: sh, aspectRatio: sw / sh }))
  }

  // --- Compute the group bounding box around all selected text elements ---
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    const positions: TextPosition[] = []
    if (selectedTexts.includes('title1')) positions.push(titlePositionsFrame2[0])
    if (selectedTexts.includes('title2')) positions.push(titlePositionsFrame2[1])
    if (selectedTexts.includes('subtitle')) positions.push(subtitlePositionFrame2)

    if (positions.length === 0) return null
    let minX = Math.min(...positions.map(p => p.x))
    let minY = Math.min(...positions.map(p => p.y))
    let maxX = Math.max(...positions.map(p => p.x + p.width))
    let maxY = Math.max(...positions.map(p => p.y + p.height))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: groupRotation }
  }

  // --- MAIN DRAW FUNCTION: Renders static or animated frames, lines, and text ---
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear & fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Separate lines by frame
    const frame1Lines = lines.filter(l => l.frame === 1)
    const frame2Lines = lines.filter(l => l.frame === 2)

    if (isPlaying) {
      // We divide our total animation space (1.4 units) into segments:
      // 0–0.3: grow lines on Frame 1
      // 0.3–0.6: shrink lines on Frame 1
      // 0.6–0.7: text transition 1 → 2
      // 0.7–1.0: grow lines Frame 2
      // 1.0–1.3: shrink lines Frame 2
      // 1.3–1.4: text transition 2 → 1
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
      // Static draw: show whichever frame is currently selected
      const activeLines = currentFrame === 1 ? frame1Lines : frame2Lines
      drawLines(ctx, activeLines)
      drawStaticText(ctx, currentFrame)

      // If any texts are selected and we’re on Frame 2, draw bounding box(es)
      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          // Draw each individually
          selectedTexts.forEach(sel => {
            if (sel === 'title1') drawBoundingBox(ctx, titlePositionsFrame2[0])
            if (sel === 'title2') drawBoundingBox(ctx, titlePositionsFrame2[1])
            if (sel === 'subtitle') drawBoundingBox(ctx, subtitlePositionFrame2)
          })
        }
      }
    }
  }

  // --- Draw static text for a given frame (excluding animations) ---
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: 1 | 2) => {
    const tpos = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    tpos.forEach((pos, idx) => drawRotatedText(ctx, pos, titles[idx]))
    const spos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, spos, subtitle)
  }

  // --- Draw animated text transition between two frames given t ∈ [0..1] ---
  const drawAnimatedText = (ctx: CanvasRenderingContext2D, tRaw: number, fromFrame: 1 | 2, toFrame: 1 | 2) => {
    const interpolate = (a: number, b: number, t: number) => a + (b - a) * t
    const easeT = ultraFastEaseInOutFunction(tRaw)

    const fromTitles = fromFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const toTitles = toFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2

    titles.forEach((title, idx) => {
      const p1 = fromTitles[idx]
      const p2 = toTitles[idx]
      const interpPos: TextPosition = {
        x: interpolate(p1.x, p2.x, easeT),
        y: interpolate(p1.y, p2.y, easeT),
        width: interpolate(p1.width, p2.width, easeT),
        height: interpolate(p1.height, p2.height, easeT),
        rotation: interpolate(p1.rotation, p2.rotation, easeT),
        fontSize: interpolate(p1.fontSize, p2.fontSize, easeT),
      }
      drawRotatedText(ctx, interpPos, title)
    })

    const sp1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sp2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const interpSub: TextPosition = {
      x: interpolate(sp1.x, sp2.x, easeT),
      y: interpolate(sp1.y, sp2.y, easeT),
      width: interpolate(sp1.width, sp2.width, easeT),
      height: interpolate(sp1.height, sp2.height, easeT),
      rotation: interpolate(sp1.rotation, sp2.rotation, easeT),
      fontSize: interpolate(sp1.fontSize, sp2.fontSize, easeT),
    }
    drawRotatedText(ctx, interpSub, subtitle)
  }

  // --- Draw a single line or a set of lines statically ---
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

  // --- Draw animated lines: grow or shrink depending on t ∈ [0..1] ---
  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    tRaw: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'

    const animationDuration = 0.3
    const maxStagger = staggerDelay

    const drawSet = (lines: Line[], localT: number) => {
      const stagger = lines.length > 1 ? maxStagger / (lines.length - 1) : 0
      lines.forEach((line, idx) => {
        let t = (localT - idx * stagger) / animationDuration
        t = Math.max(0, Math.min(1, t))
        t = ultraFastEaseInOutFunction(t)

        const { start, end } = line
        const factor = animationType === 'grow' ? t : 1 - t
        const currentEnd: Point = {
          x: start.x + (end.x - start.x) * factor,
          y: start.y + (end.y - start.y) * factor,
        }

        const rx = (Math.random() - 0.5) * tremblingIntensity
        const ry = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + rx, start.y + ry)
        ctx.lineTo(currentEnd.x + rx, currentEnd.y + ry)
        ctx.stroke()
      })
    }

    if (frame1Lines.length) drawSet(frame1Lines, tRaw)
    if (frame2Lines.length) drawSet(frame2Lines, tRaw)
  }

  // --- Draw rotated text at a position with rotation, font, contrast color ---
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

  // --- Compute contrasting text color (black/white) against bg ---
  const getContrastColor = (bg: string): string => {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  // --- Draw a bounding box around a single TextPosition (with handles) ---
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
    const corners: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
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

  // --- Draw bounding box around a group of selected TextPositions ---
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
    const corners: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
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

  // --- Determine if (x,y) is inside a rotated box defined by its 4 corner Points ---
  const isPointInRotatedBox = (x: number, y: number, corners: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const xi = corners[i].x
      const yi = corners[i].y
      const xj = corners[j].x
      const yj = corners[j].y
      const intersect = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  // --- Get the four corners of a rotated TextPosition box for hit-testing ---
  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const hw = pos.width / 2
    const hh = pos.height / 2
    const corners: Point[] = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(pos.rotation) - corner.y * Math.sin(pos.rotation)
      const ry = corner.x * Math.sin(pos.rotation) + corner.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  // --- Get corners of a rotated GroupBoundingBox for hit-testing ---
  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const hw = box.width / 2
    const hh = box.height / 2
    const corners: Point[] = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(box.rotation) - corner.y * Math.sin(box.rotation)
      const ry = corner.x * Math.sin(box.rotation) + corner.y * Math.cos(box.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  // --- Determine which resize handle (or 'move') the mouse is over (in rotated space) ---
  const getResizeHandle = (x: number, y: number, pos: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 20
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const rot = pos.rotation

    // Un-rotate point into local box coordinates
    const dx = x - cx
    const dy = y - cy
    const localX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const localY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = pos.width / 2
    const hh = pos.height / 2

    // Check each corner region
    if (Math.abs(localX + hw) <= handleSize / 2 && Math.abs(localY + hh) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(localX - hw) <= handleSize / 2 && Math.abs(localY + hh) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(localX - hw) <= handleSize / 2 && Math.abs(localY - hh) <= handleSize / 2) return 'se-resize'
    if (Math.abs(localX + hw) <= handleSize / 2 && Math.abs(localY - hh) <= handleSize / 2) return 'sw-resize'

    // If inside the rotated rectangle but not on a handle, return 'move'
    if (Math.abs(localX) < hw && Math.abs(localY) < hh) return 'move'
    return null
  }

  // --- Determine if the point is near a rotation “ring” outside each corner ---
  const isPointNearRotationArea = (x: number, y: number, pos: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20
    const rotationArea = 15
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const rot = pos.rotation
    const dx = x - cx
    const dy = y - cy
    const localX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const localY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = pos.width / 2
    const hh = pos.height / 2

    // Check each corner’s surrounding ring
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]
    for (let c of corners) {
      const dist = Math.hypot(localX - c.x, localY - c.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationArea) return true
    }
    return false
  }

  // --- Rotate a single TextPosition around a center by angle θ ---
  const rotateAroundPoint = (pos: TextPosition, cx: number, cy: number, angle: number): TextPosition => {
    const dx = pos.x + pos.width / 2 - cx
    const dy = pos.y + pos.height / 2 - cy
    const dist = Math.hypot(dx, dy)
    const currentAngle = Math.atan2(dy, dx)
    const newAngle = currentAngle + angle
    const newX = cx + dist * Math.cos(newAngle) - pos.width / 2
    const newY = cy + dist * Math.sin(newAngle) - pos.height / 2
    return { ...pos, x: newX, y: newY, rotation: pos.rotation + angle }
  }

  // --- Handle mouseup: finalize drawing or drop interactions ---
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

  // --- Handle mouse interactions for translating/rotating/resizing text, or drawing lines ---
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If text group/individual is selected on Frame 2:
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
          const ttype = selectedTexts[0]
          const pos = ttype === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[ttype === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, ttype, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
      updateCursor(canvas, x, y)
      return
    }

    // If we’re editing a line’s endpoints:
    if (currentLine) {
      setCurrentLine(prev => prev ? { ...prev, end: { x, y } } : null)
      drawCanvas()
      return
    } else if (editingLineIndex !== null) {
      setLines(prev => {
        const newLines = [...prev]
        const ln = { ...newLines[editingLineIndex]! }
        if (isPointNear({ x, y }, ln.start)) ln.start = { x, y }
        else if (isPointNear({ x, y }, ln.end)) ln.end = { x, y }
        newLines[editingLineIndex] = ln
        return newLines
      })
      drawCanvas()
      return
    }

    // Otherwise, just update cursor (no active interaction)
    updateCursor(canvas, x, y)
  }

  // --- Handle mousedown: decide if clicking text or background for line drawing ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    lastMousePosition.current = { x, y }

    // Check if clicking on a text object in the current frame
    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    for (let i = 0; i < positions.length; i++) {
      const corners = getRotatedBoundingBox(positions[i])
      if (isPointInRotatedBox(x, y, corners) && currentFrame === 2) {
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    // Subtitle
    const subPos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subPos)) && currentFrame === 2) {
      handleTextInteraction(subPos, 'subtitle', x, y)
      return
    }

    // Otherwise, user is drawing a new line or editing existing
    if (!isShiftPressed.current) {
      // Clear text selection if Shift is not held
      setSelectedTexts([])
    }
    setGroupRotation(0) // reset group rotation if no text selected

    // Check if clicking near an existing line endpoint or line itself
    const clickedLineIndex = lines.findIndex(ln => 
      ln.frame === currentFrame && 
      (isPointNear({ x, y }, ln) || isPointNear({ x, y }, ln.start) || isPointNear({ x, y }, ln.end))
    )
    if (clickedLineIndex !== -1) {
      setEditingLineIndex(clickedLineIndex)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  // --- Handle double-click on text: open modal for precise X/Y/rotation editing ---
  const handleTextInteraction = (pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle', x: number, y: number) => {
    lastMousePosition.current = { x, y }
    // Store current rotations
    if (selectedTexts.length > 0) {
      setLastKnownRotations(r => ({ ...r, group: groupRotation }))
    }
    if (isShiftPressed.current) {
      setSelectedTexts(prev => {
        const newSel = prev.includes(textType) ? prev.filter(t => t !== textType) : [...prev, textType]
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

    // Decide if user is about to rotate, resize, or move
    if (isPointNearRotationArea(x, y, pos)) {
      setIsRotating(true)
      const gb = calculateGroupBoundingBox()
      if (gb) setInitialGroupBox(gb)
    } else {
      const handle = getResizeHandle(x, y, pos)
      if (handle) {
        if (handle === 'move') {
          setIsDragging(true)
        } else {
          setIsResizing(true)
          setResizeHandle(handle)
          setResizeStartPosition({ x, y })
        }
      } else {
        setIsDragging(true)
      }
    }
    drawCanvas()
  }

  // --- Helper: determine if a point is near a line segment or point (threshold=10px) ---
  const isPointNear = (pt: Point, target: Point | Line, threshold = 10): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = pt.x - target.x
      const dy = pt.y - target.y
      return Math.hypot(dx, dy) < threshold
    } else {
      return pointToLineDistance(pt, target.start, target.end) < threshold
    }
  }

  // --- Compute minimum distance from a point to a line segment ---
  const pointToLineDistance = (pt: Point, a: Point, b: Point): number => {
    const A = pt.x - a.x
    const B = pt.y - a.y
    const C = b.x - a.x
    const D = b.y - a.y
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = lenSq !== 0 ? dot / lenSq : -1

    let xx: number, yy: number
    if (param < 0) {
      xx = a.x; yy = a.y
    } else if (param > 1) {
      xx = b.x; yy = b.y
    } else {
      xx = a.x + param * C
      yy = a.y + param * D
    }
    const dx = pt.x - xx
    const dy = pt.y - yy
    return Math.hypot(dx, dy)
  }

  // --- Drag a single selected text element ---
  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = { ...copy[idx], x: copy[idx].x + dx, y: copy[idx].y + dy }
        return copy
      })
    }
    lastMousePosition.current = { x, y }
  }

  // --- Drag entire group (if multiple texts selected) ---
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

  // --- Resize a single selected text element using the indicated handle ---
  const resizeSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!resizeStartPosition) return
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    const startVec = { x: resizeStartPosition.x - centerX, y: resizeStartPosition.y - centerY }
    const currVec = { x: x - centerX, y: y - centerY }
    const speed = 0.1

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const currDist = Math.abs(currVec.x)
      scale = startDist !== 0 ? 1 + ((currDist / startDist - 1) * speed) : 1
    } else {
      const startDist = Math.abs(startVec.y)
      const currDist = Math.abs(currVec.y)
      scale = startDist !== 0 ? 1 + ((currDist / startDist - 1) * speed) : 1
    }
    scale = Math.max(0.1, scale)

    const newW = pos.width * scale
    const newH = pos.height * scale
    const newX = centerX - newW / 2
    const newY = centerY - newH / 2

    const newPos: TextPosition = {
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

  // --- Resize entire group (when multiple selected) ---
  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPosition) return
    const dx = x - resizeStartPosition.x
    const dy = y - resizeStartPosition.y
    const cx = initialGroupBox.x + initialGroupBox.width / 2
    const cy = initialGroupBox.y + initialGroupBox.height / 2

    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / initialGroupBox.width) * 0.5
    } else {
      scale = 1 + (dy / initialGroupBox.height) * 0.5
    }
    scale = Math.max(0.1, scale)

    const newW = initialGroupBox.width * scale
    const newH = initialGroupBox.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (pos: TextPosition): TextPosition => {
      const relX = (pos.x - cx) / (initialGroupBox.width / 2)
      const relY = (pos.y - cy) / (initialGroupBox.height / 2)
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
      prev.map((pos, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2') ? updatePos(pos) : pos)
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }

    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
    drawCanvas()
  }

  // --- Rotate a single text element (unused if group rotation is active) ---
  const rotateSingle = (x: number, y: number, pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2

    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currAngle = Math.atan2(y - centerY, x - centerX)
    let delta = currAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, rotation: prev.rotation + delta }))
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        copy[idx] = { ...copy[idx], rotation: copy[idx].rotation + delta }
        return copy
      })
    }
    lastMousePosition.current = { x, y }
  }

  // --- Rotate entire group when multiple selected ---
  const [groupRotation, setGroupRotation] = useState(0)
  const rotateGroup = (x: number, y: number, gb: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = gb.x + gb.width / 2
    const cy = gb.y + gb.height / 2

    const lastAng = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currAng = Math.atan2(y - cy, x - cx)
    let delta = currAng - lastAng
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    // Rotate each selected text individually
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => {
        const type = `title${idx + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(type)) {
          setLastKnownRotations(r => ({ ...r, [type]: pos.rotation + delta }))
          return rotateAroundPoint(pos, cx, cy, delta)
        }
        return pos
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const updated = rotateAroundPoint(prev, cx, cy, delta)
        setLastKnownRotations(r => ({ ...r, subtitle: updated.rotation }))
        return updated
      })
    }
    setGroupRotation(prev => {
      const nr = prev + delta
      setLastKnownRotations(r => ({ ...r, group: nr }))
      return nr
    })
    lastMousePosition.current = { x, y }
  }

  // --- Update cursor icon depending on hover position ---
  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    // If group box is present on Frame 2
    const groupBox = calculateGroupBoundingBox()
    if (groupBox && currentFrame === 2 && isPointInRotatedBox(x, y, getRotatedGroupBoundingBox(groupBox))) {
      if (isPointNearRotationArea(x, y, groupBox)) {
        canvas.style.cursor =
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
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

    // Check individual text elements
    const curPositions = currentFrame === 1
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]
    for (let i = 0; i < curPositions.length; i++) {
      const pos = curPositions[i]
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos)) && currentFrame === 2) {
        if (isPointNearRotationArea(x, y, pos)) {
          canvas.style.cursor =
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
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

    // Default: pointer for lines or default
    canvas.style.cursor = currentLine || editingLineIndex !== null ? 'crosshair' : 'default'
  }

  // --- Compute rotated corners of a TextPosition or GroupBoundingBox and test if a point is inside ---
  // (Implemented above as getRotatedBoundingBox, getRotatedGroupBoundingBox, isPointInRotatedBox)

  // --- ANIMATION LOOP: called via requestAnimationFrame ---
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
    }
    // Continuous progress based on elapsedTime and animationSpeed
    const elapsed = timestamp - startTimeRef.current
    let continuousProgress = elapsed * animationSpeed

    // Quantize progress by frameRate to simulate stop-motion
    const totalFrames = Math.floor(continuousProgress * frameRate)
    const quantizedProgress = totalFrames / frameRate

    // Cap total animation length at 1.4 units
    let progress = quantizedProgress
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

  // --- Handle changing between Frame 1 & Frame 2 via buttons ---
  const handleFrameChange = (frame: 1 | 2) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    // Keep group rotation restored if any single text rotation was stored
    drawCanvas()
  }

  // --- Toggle play/pause & looping ---
  const togglePlay = () => setIsPlaying(prev => !prev)
  const toggleLoop = () => setIsLooping(prev => !prev)

  // --- Placeholder for export functionality (not implemented) ---
  const handleExport = () => {
    console.log("Export not implemented")
  }

  // --- Handle changes in the Settings dialog (sliders) ---
  const handleSettingsChange = (name: string, value: number) => {
    switch (name) {
      case 'lineThickness':
        setLineThickness(value)
        drawCanvas()
        break
      case 'animationSpeed':
        setAnimationSpeed(value)
        drawCanvas()
        break
      case 'staggerDelay':
        setStaggerDelay(value)
        drawCanvas()
        break
      case 'tremblingIntensity':
        setTremblingIntensity(value)
        drawCanvas()
        break
      case 'frameRate':
        setFrameRate(value)
        drawCanvas()
        break
      default:
        break
    }
  }

  // --- JSX RENDER ---
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* Sidebar: Text inputs + color picker */}
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

        {/* Canvas + Controls */}
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
              onClick={togglePlay}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black"
            >
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
              <SettingsIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* SETTINGS DIALOG */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="lineThickness">Line Thickness</Label>
              <Slider
                id="lineThickness"
                min={1}
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={val => handleSettingsChange('lineThickness', val[0])}
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
                onValueChange={val => handleSettingsChange('animationSpeed', val[0])}
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
                onValueChange={val => handleSettingsChange('staggerDelay', val[0])}
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
                onValueChange={val => handleSettingsChange('tremblingIntensity', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRate">Frame Rate (Stop‐Motion)</Label>
              <Slider
                id="frameRate"
                min={50}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={val => handleSettingsChange('frameRate', val[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
