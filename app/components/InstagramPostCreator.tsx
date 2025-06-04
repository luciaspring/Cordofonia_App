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
interface TextPosition { x: number, y: number, width: number, height: number, rotation: number, fontSize: number, aspectRatio?: number }
interface GroupBoundingBox { x: number, y: number, width: number, height: number, rotation: number }

// Used to track which object the modal is currently editing:
type EditTarget = 'title1' | 'title2' | 'subtitle' | null

export default function InstagramPostCreator() {
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
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

  // “selectedTexts” holds which items are currently selected (can be 0, 1, or more if Shift is held)
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // ─── NEW STATE for “Edit Position” modal ─────────────────────────────────────────────
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  // We store a copy of the chosen object’s TextPosition in editingPosition so inputs can bind to it:
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  // And we track a “Size (%)” slider value:
  const [editingSize, setEditingSize] = useState<number>(100)

  const [lineThickness, setLineThickness] = useState(2)
  const [easingSpeed, setEasingSpeed] = useState(10)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const tremblingIntensityRef = useRef(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)

  const [animationSpeed, setAnimationSpeed] = useState(0.00025)
  const [resizeSpeed, setResizeSpeed] = useState(0.5)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)

  // Track each item’s last known rotation so group‐vs‐individual rotation logic can revert properly:
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number;
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0
  })

  // ─── HELPER: detect double‐click if ≤ 300ms between clicks ─────────────────────────────
  const wasDoubleClick = (): boolean => {
    const now = Date.now()
    const diff = now - lastClickTime.current
    lastClickTime.current = now
    return diff <= 300
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = true
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = false
      }
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
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        updateTextDimensions(ctx)
        drawCanvas()
      }
    }
  }, [titles, subtitle, backgroundColor, currentFrame, lines, lineThickness, tremblingIntensity])

  useEffect(() => {
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying])

  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }

    // Frame 1 titles
    setTitlePositionsFrame1(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    // Frame 2 titles
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    // Subtitle
    const { width: subW, height: subH } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const subAspect = subW / subH
    setSubtitlePositionFrame1(prev => ({ ...prev, width: subW, height: subH, aspectRatio: subAspect }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: subW, height: subH, aspectRatio: subAspect }))
  }

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    const selectedPositions = titlePositionsFrame2
      .filter((_, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : [])
    let minX = Math.min(...selectedPositions.map(p => p.x))
    let minY = Math.min(...selectedPositions.map(p => p.y))
    let maxX = Math.max(...selectedPositions.map(p => p.x + p.width))
    let maxY = Math.max(...selectedPositions.map(p => p.y + p.height))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: groupRotation }
  }

  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const frame1Lines = lines.filter(l => l.frame === 1)
    const frame2Lines = lines.filter(l => l.frame === 2)

    if (isPlaying) {
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {
        const tp = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, tp, 1, 2)
      } else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {
        const tp = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, tp, 2, 1)
      }
    } else {
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          const positions = titlePositionsFrame2
          selectedTexts.forEach(sel => {
            if (sel === 'title1' || sel === 'title2') {
              const idx = sel === 'title1' ? 0 : 1
              drawBoundingBox(ctx, positions[idx])
            } else {
              drawBoundingBox(ctx, subtitlePositionFrame2)
            }
          })
        }
      }
    }
  }

  const drawAnimatedText = (ctx: CanvasRenderingContext2D, progress: number, fromFrame: number, toFrame: number) => {
    const interp = (a: number, b: number, t: number) => a + (b - a) * t
    const interpPos = (p1: TextPosition, p2: TextPosition, t: number): TextPosition => ({
      x: interp(p1.x, p2.x, t),
      y: interp(p1.y, p2.y, t),
      width: interp(p1.width, p2.width, t),
      height: interp(p1.height, p2.height, t),
      rotation: interp(p1.rotation, p2.rotation, t),
      fontSize: interp(p1.fontSize, p2.fontSize, t),
    })
    // “ultraFast” easing
    const u = (t: number) => {
      if (t < 0.5) return Math.pow(2 * t, 16) / 2
      return 1 - Math.pow(-2 * t + 2, 16) / 2
    }
    const t = u(progress)

    titles.forEach((title, i) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const pos2 = toFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const ip = interpPos(pos1, pos2, t)
      drawRotatedText(ctx, ip, title)
    })
    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subIP = interpPos(sub1, sub2, t)
    drawRotatedText(ctx, subIP, subtitle)
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((t, i) => {
      drawRotatedText(ctx, positions[i], t)
    })
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, position: TextPosition, text: string) => {
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

  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

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
    const maxStaggerDelay = 0.2

    const drawFrameLines = (lines: Line[], frameProgress: number) => {
      const adjustedStagger = lines.length > 1 ? maxStaggerDelay / (lines.length - 1) : 0
      // same ultra‐fast easing:
      const u = (t: number) => {
        if (t < 0.5) return Math.pow(2 * t, 16) / 2
        return 1 - Math.pow(-2 * t + 2, 16) / 2
      }
      lines.forEach((line, idx) => {
        let t = Math.max(0, Math.min(1, (frameProgress - idx * adjustedStagger) / animationDuration))
        t = u(t)
        const { start, end } = line
        const currentEnd = {
          x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t)
        }
        const trembleX = (Math.random() - 0.5) * tremblingIntensity
        const trembleY = (Math.random() - 0.5) * tremblingIntensity
        ctx.beginPath()
        ctx.moveTo(start.x + trembleX, start.y + trembleY)
        ctx.lineTo(currentEnd.x + trembleX, currentEnd.y + trembleY)
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
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [ halfW, -halfH],
      [ halfW,  halfH],
      [-halfW,  halfH]
    ]
    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const { x, y, width, height, rotation } = box
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    const halfW = width / 2
    const halfH = height / 2
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfW, -halfH, width, height)
    const handleSize = 10
    const corners: [number, number][] = [
      [-halfW, -halfH],
      [ halfW, -halfH],
      [ halfW,  halfH],
      [-halfW,  halfH]
    ]
    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const getResizeHandle = (x: number, y: number, pos: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 20
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    const rotation = 'rotation' in pos ? pos.rotation : pos.rotation
    const dx = x - centerX
    const dy = y - centerY
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)
    const halfW = pos.width / 2
    const halfH = pos.height / 2
    if (Math.abs(rotatedX + halfW) <= handleSize/2 && Math.abs(rotatedY + halfH) <= handleSize/2) return 'nw-resize'
    if (Math.abs(rotatedX - halfW) <= handleSize/2 && Math.abs(rotatedY + halfH) <= handleSize/2) return 'ne-resize'
    if (Math.abs(rotatedX - halfW) <= handleSize/2 && Math.abs(rotatedY - halfH) <= handleSize/2) return 'se-resize'
    if (Math.abs(rotatedX + halfW) <= handleSize/2 && Math.abs(rotatedY - halfH) <= handleSize/2) return 'sw-resize'
    if (Math.abs(rotatedX) < halfW && Math.abs(rotatedY) < halfH) return 'move'
    return null
  }

  const isPointNearRotationArea = (x: number, y: number, pos: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    const rotation = 'rotation' in pos ? pos.rotation : pos.rotation
    const dx = x - centerX
    const dy = y - centerY
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)
    const halfW = pos.width / 2
    const halfH = pos.height / 2
    const corners = [
      { x: -halfW, y: -halfH },
      { x:  halfW, y: -halfH },
      { x:  halfW, y:  halfH },
      { x: -halfW, y:  halfH },
    ]
    for (const corner of corners) {
      const dist = Math.sqrt((rotatedX - corner.x)**2 + (rotatedY - corner.y)**2)
      if (dist > handleSize/2 && dist <= handleSize/2 + rotationAreaSize) return true
    }
    return false
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
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
    const updatePos = (p: TextPosition) => {
      const relX = (p.x - centerX) / (initialGroupBox.width / 2)
      const relY = (p.y - centerY) / (initialGroupBox.height / 2)
      return {
        ...p,
        x: centerX + relX * (newW / 2),
        y: centerY + relY * (newH / 2),
        width: p.width * scale,
        height: p.height * scale,
        fontSize: p.fontSize * scale
      }
    }
    setTitlePositionsFrame2(prev =>
      prev.map((p, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2') ? updatePos(p) : p
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }
    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
    drawCanvas()
  }

  const rotateGroup = (x: number, y: number, groupBox: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const centerX = groupBox.x + groupBox.width / 2
    const centerY = groupBox.y + groupBox.height / 2
    const lastA = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currentA = Math.atan2(y - centerY, x - centerX)
    let δ = currentA - lastA
    if (δ > Math.PI) δ -= 2 * Math.PI
    if (δ < -Math.PI) δ += 2 * Math.PI

    setTitlePositionsFrame2(prev =>
      prev.map((p, i) => {
        const type = `title${i+1}` as 'title1' | 'title2'
        if (selectedTexts.includes(type)) {
          setLastKnownRotations(l => ({ ...l, [type]: p.rotation + δ }))
          return rotateAroundPoint(p, centerX, centerY, δ)
        }
        return p
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const np = rotateAroundPoint(prev, centerX, centerY, δ)
        setLastKnownRotations(l => ({ ...l, subtitle: np.rotation }))
        return np
      })
    }
    setGroupRotation(g => {
      const nr = g + δ
      setLastKnownRotations(l => ({ ...l, group: nr }))
      return nr
    })
    lastMousePosition.current = { x, y }
  }

  const rotateAroundPoint = (pos: TextPosition, cx: number, cy: number, angle: number): TextPosition => {
    const dx = pos.x + pos.width/2 - cx
    const dy = pos.y + pos.height/2 - cy
    const dist = Math.sqrt(dx*dx + dy*dy)
    const currentA = Math.atan2(dy, dx)
    const newA = currentA + angle
    const newX = cx + dist * Math.cos(newA) - pos.width/2
    const newY = cy + dist * Math.sin(newA) - pos.height/2
    return { ...pos, x: newX, y: newY, rotation: pos.rotation + angle }
  }

  const handleMouseUp = () => {
    if (isPlaying) return
    if (currentLine) {
      setLines(pl => [...pl, currentLine])
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

  const handleTextInteraction = (pos: TextPosition, type: 'title1' | 'title2' | 'subtitle', x: number, y: number) => {
    if (currentFrame !== 2) return
    lastMousePosition.current = { x, y }
    if (selectedTexts.length > 0) {
      setLastKnownRotations(l => ({ ...l, group: groupRotation }))
    }
    if (isShiftPressed.current) {
      setSelectedTexts(prev => {
        const newSel = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        if (newSel.length > 1) {
          setGroupRotation(lastKnownRotations.group)
        } else if (newSel.length === 1) {
          setGroupRotation(lastKnownRotations[newSel[0]])
        }
        return newSel
      })
    } else {
      setSelectedTexts([type])
      setGroupRotation(lastKnownRotations[type])
    }

    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

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

  const resizeSingle = (x: number, y: number, pos: TextPosition, type: 'title1' | 'title2' | 'subtitle', handle: string) => {
    if (!resizeStartPosition) return
    const currentPos = type === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[type === 'title1' ? 0 : 1]
    const cx = currentPos.x + currentPos.width/2
    const cy = currentPos.y + currentPos.height/2
    const startV = { x: resizeStartPosition.x - cx, y: resizeStartPosition.y - cy }
    const currV = { x: x - cx, y: y - cy }
    const factor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const sd = Math.abs(startV.x)
      const cd = Math.abs(currV.x)
      scale = sd !== 0 ? 1 + ((cd / sd - 1) * factor) : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const sd = Math.abs(startV.y)
      const cd = Math.abs(currV.y)
      scale = sd !== 0 ? 1 + ((cd / sd - 1) * factor) : 1
    }
    scale = Math.max(0.1, scale)
    const newW = currentPos.width * scale
    const newH = currentPos.height * scale
    const newX = cx - newW/2
    const newY = cy - newH/2
    const newFont = currentPos.fontSize * scale
    const newPos: TextPosition = {
      ...currentPos,
      x: newX, y: newY,
      width: newW, height: newH,
      fontSize: newFont
    }
    if (type === 'subtitle') {
      setSubtitlePositionFrame2(newPos)
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = type === 'title1' ? 0 : 1
        copy[idx] = newPos
        return copy
      })
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
        const gb = calculateGroupBoundingBox()
        if (gb) rotateGroup(x, y, gb)
      } else if (isDragging) {
        if (selectedTexts.length === 1) {
          dragSingle(x, y, selectedTexts[0])
        } else {
          dragGroup(x, y)
        }
      } else if (isResizing && resizeHandle) {
        if (selectedTexts.length === 1) {
          const t = selectedTexts[0]
          const pos = t === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[t === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, t, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
    }
    else if (currentLine) {
      setCurrentLine(prev => ({
        ...prev!,
        end: { x, y }
      }))
      drawCanvas()
    }
    else if (editingLineIndex !== null) {
      setLines(prev => {
        const copy = [...prev]
        const edit = { ...copy[editingLineIndex] }
        if (isPointNear({ x, y }, edit.start)) {
          edit.start = { x, y }
        } else if (isPointNear({ x, y }, edit.end)) {
          edit.end = { x, y }
        }
        copy[editingLineIndex] = edit
        return copy
      })
      drawCanvas()
    }

    updateCursor(canvas, x, y)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    lastMousePosition.current = { x, y }

    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subtitlePos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    // ─── DOUBLE‐CLICK: still run the normal selection logic, then open modal ─────────────
    if (currentFrame === 2 && wasDoubleClick()) {
      // Check titles
      for (let i = 0; i < positions.length; i++) {
        if (isPointInRotatedBox(x, y, getRotatedBoundingBox(positions[i]))) {
          // First, select exactly that item (so rotation/drag still work)
          handleTextInteraction(positions[i], `title${i+1}` as 'title1' | 'title2', x, y)
          // Then open the modal for editing that item:
          setEditTarget(i === 0 ? 'title1' : 'title2')
          // Copy its current “TextPosition” into editingPosition:
          setEditingPosition({ ...positions[i] })
          setEditingSize(100) // reset Size (%) to 100%
          setPositionModalOpen(true)
          return
        }
      }
      // Check subtitle
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePos))) {
        handleTextInteraction(subtitlePos, 'subtitle', x, y)
        setEditTarget('subtitle')
        setEditingPosition({ ...subtitlePos })
        setEditingSize(100)
        setPositionModalOpen(true)
        return
      }
    }

    // Otherwise (not a double‐click), run normal line/selection logic:
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    const clickedLineIndex = lines.findIndex(l =>
      l.frame === currentFrame &&
      (isPointNear({ x, y }, l) || isPointNear({ x, y }, l.start) || isPointNear({ x, y }, l.end))
    )
    if (clickedLineIndex !== -1) {
      setEditingLineIndex(clickedLineIndex)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
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

    const currentPositions = currentFrame === 1
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

  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    const cx = pos.x + pos.width/2
    const cy = pos.y + pos.height/2
    const w = pos.width
    const h = pos.height
    const corners = [
      { x: -w/2, y: -h/2 },
      { x:  w/2, y: -h/2 },
      { x:  w/2, y:  h/2 },
      { x: -w/2, y:  h/2 }
    ]
    return corners.map(c => {
      const rx = c.x * Math.cos(pos.rotation) - c.y * Math.sin(pos.rotation)
      const ry = c.x * Math.sin(pos.rotation) + c.y * Math.cos(pos.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const { x, y, width, height, rotation } = box
    const cx = x + width/2
    const cy = y + height/2
    const corners = [
      { x: -width/2, y: -height/2 },
      { x:  width/2, y: -height/2 },
      { x:  width/2, y:  height/2 },
      { x: -width/2, y:  height/2 }
    ]
    return corners.map(c => {
      const rx = c.x * Math.cos(rotation) - c.y * Math.sin(rotation)
      const ry = c.x * Math.sin(rotation) + c.y * Math.cos(rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x, yi = box[i].y
      const xj = box[j].x, yj = box[j].y
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const isPointNear = (p: Point, t: Point | Line, threshold: number = 10): boolean => {
    if ('x' in t && 'y' in t) {
      const dx = p.x - t.x
      const dy = p.y - t.y
      return Math.sqrt(dx*dx + dy*dy) < threshold
    }
    return pointToLineDistance(p, t.start, t.end) < threshold
  }

  const pointToLineDistance = (p: Point, a: Point, b: Point): number => {
    const A = p.x - a.x
    const B = p.y - a.y
    const C = b.x - a.x
    const D = b.y - a.y
    const dot = A*C + B*D
    const lenSq = C*C + D*D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq
    let xx, yy
    if (param < 0) {
      xx = a.x; yy = a.y
    } else if (param > 1) {
      xx = b.x; yy = b.y
    } else {
      xx = a.x + param*C
      yy = a.y + param*D
    }
    const dx = p.x - xx
    const dy = p.y - yy
    return Math.sqrt(dx*dx + dy*dy)
  }

  const dragSingle = (x: number, y: number, type: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    if (type === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = type === 'title1' ? 0 : 1
        copy[idx] = { ...copy[idx], x: copy[idx].x + dx, y: copy[idx].y + dy }
        return copy
      })
    }
    lastMousePosition.current = { x, y }
  }

  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    setTitlePositionsFrame2(prev =>
      prev.map((p, i) =>
        selectedTexts.includes(`title${i+1}` as 'title1' | 'title2')
          ? { ...p, x: p.x + dx, y: p.y + dy }
          : p
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    lastMousePosition.current = { x, y }
  }

  const rotateSingle = (x: number, y: number, pos: TextPosition, type: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const currentPos = type === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[type === 'title1' ? 0 : 1]
    const centerX = currentPos.x + currentPos.width/2
    const centerY = currentPos.y + currentPos.height/2
    const lastA = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currA = Math.atan2(y - centerY, x - centerX)
    let δ = currA - lastA
    if (δ > Math.PI) δ -= 2 * Math.PI
    if (δ < -Math.PI) δ += 2 * Math.PI
    if (type === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, rotation: prev.rotation + δ }))
    } else {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        const idx = type === 'title1' ? 0 : 1
        copy[idx] = { ...copy[idx], rotation: copy[idx].rotation + δ }
        return copy
      })
    }
    lastMousePosition.current = { x, y }
  }

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current
    const speed = 0.0002
    let progress = elapsed * speed
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

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const togglePlay = () => {
    setIsPlaying(p => !p)
  }

  const toggleLoop = () => {
    setIsLooping(l => !l)
  }

  const handleExport = () => {
    console.log("Export not implemented")
  }

  // ─── THIS is where the “Update” button in the modal writes back into the correct state:
  const updatePosition = (newPos: TextPosition) => {
    if (!editTarget || !editingPosition) return
    // We also scale “Size (%)” now:
    const scaleFactor = editingSize / 100
    const scaled: TextPosition = {
      ...newPos,
      width: newPos.width * scaleFactor,
      height: newPos.height * scaleFactor,
      fontSize: newPos.fontSize * scaleFactor,
    }

    if (editTarget === 'title1') {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        copy[0] = scaled
        return copy
      })
    }
    if (editTarget === 'title2') {
      setTitlePositionsFrame2(prev => {
        const copy = [...prev]
        copy[1] = scaled
        return copy
      })
    }
    if (editTarget === 'subtitle') {
      setSubtitlePositionFrame2(scaled)
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
    }
  }

  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
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
            <Button onClick={handleExport} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── EDIT POSITION MODAL ───────────────────────────────────────────────────────────── */}
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
                  onChange={e => setEditingPosition({...editingPosition, x: Number(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="yPosition">Y Position</Label>
                <Input
                  id="yPosition"
                  type="number"
                  value={editingPosition.y}
                  onChange={e => setEditingPosition({...editingPosition, y: Number(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (degrees)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180/Math.PI)}
                  onChange={e => setEditingPosition({...editingPosition, rotation: Number(e.target.value) * (Math.PI/180)})}
                />
              </div>
              <div>
                <Label htmlFor="sizePercent">Size (%)</Label>
                <Input
                  id="sizePercent"
                  type="number"
                  value={editingSize}
                  onChange={e => setEditingSize(Number(e.target.value))}
                  min={1}
                  max={1000}
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)}>Update</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SETTINGS MODAL ─────────────────────────────────────────────────────────────────── */}
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
              <Label htmlFor="staggerDelay">Line Stagger Delay</Label>
              <Slider
                id="staggerDelay"
                min={0}
                max={0.5}
                step={0.01}
                value={[staggerDelay]}
                onValueChange={val => setStaggerDelay(val[0])}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
