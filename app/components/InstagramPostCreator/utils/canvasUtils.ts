'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

// Add this to track initial state
interface RigidBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  centerX: number;
  centerY: number;
}

const ultraFastEaseInOutFunction = (t: number): number => {
  // Extremely fast ease-in and ease-out
  if (t < 0.5) {
    // Even faster ease-in (first half)
    return Math.pow(2 * t, 16) / 2;
  } else {
    // Even faster ease-out (second half)
    return 1 - Math.pow(-2 * t + 2, 16) / 2;
  }
}

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
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [lineThickness, setLineThickness] = useState(2)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const tremblingIntensityRef = useRef(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)
  const [initialPosition, setInitialPosition] = useState<TextPosition | null>(null)
  const [lastResizePosition, setLastResizePosition] = useState<Point | null>(null)
  const [resizeOrigin, setResizeOrigin] = useState<Point | null>(null)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025); // ← state‐driven
  const [resizeSpeed, setResizeSpeed] = useState(0.5)
  const [resizeStartCenter, setResizeStartCenter] = useState<Point | null>(null)
  const [initialGroupState, setInitialGroupState] = useState<{
    box: GroupBoundingBox;
    centerX: number;
    centerY: number;
  } | null>(null);
  const [initialUnrotatedBox, setInitialUnrotatedBox] = useState<GroupBoundingBox | null>(null);
  const [initialBox, setInitialBox] = useState<GroupBoundingBox | null>(null);
  const [initialBoundingBox, setInitialBoundingBox] = useState<GroupBoundingBox | null>(null);
  const [rigidBox, setRigidBox] = useState<RigidBoundingBox | null>(null);
  const [paperRect, setPaperRect] = useState<GroupBoundingBox | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)

  // Track last known rotations
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number;
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0
  });

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
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas()
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, animationSpeed, isLooping])

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
      prev.map((pos, index) => {
        const { width, height } = measureText(titles[index], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    setTitlePositionsFrame2(prev =>
      prev.map((pos, index) => {
        const { width, height } = measureText(titles[index], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    const { width: subtitleWidth, height: subtitleHeight } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const subtitleAspectRatio = subtitleWidth / subtitleHeight
    setSubtitlePositionFrame1(prev => ({
      ...prev,
      width: subtitleWidth,
      height: subtitleHeight,
      aspectRatio: subtitleAspectRatio
    }))
    setSubtitlePositionFrame2(prev => ({
      ...prev,
      width: subtitleWidth,
      height: subtitleHeight,
      aspectRatio: subtitleAspectRatio
    }))
  }

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    const selectedPositions = titlePositionsFrame2
      .filter((_, i) => selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2'))
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
        // Frame 1 grow
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        // Frame 1 shrink
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {
        // Text 1 → 2
        const textProgress = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, textProgress, 1, 2)
      } else if (progress <= 1.0) {
        // Frame 2 grow
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        // Frame 2 shrink
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {
        // Text 2 → 1
        const textProgress = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, textProgress, 2, 1)
      }
    } else {
      // Static preview
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)
      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox)
        } else {
          const pos = titlePositionsFrame2
          selectedTexts.forEach(t => {
            if (t === 'title1' || t === 'title2') {
              const i = t === 'title1' ? 0 : 1
              drawBoundingBox(ctx, pos[i])
            } else {
              drawBoundingBox(ctx, subtitlePositionFrame2)
            }
          })
        }
      }
    }
  }

  const drawAnimatedText = (ctx: CanvasRenderingContext2D, progress: number, fromFrame: number, toFrame: number) => {
    const interpolate = (a: number, b: number, t: number) => a + (b - a) * t
    const interpolatePosition = (p1: TextPosition, p2: TextPosition, t: number): TextPosition => ({
      x: interpolate(p1.x, p2.x, t),
      y: interpolate(p1.y, p2.y, t),
      width: interpolate(p1.width, p2.width, t),
      height: interpolate(p1.height, p2.height, t),
      rotation: interpolate(p1.rotation, p2.rotation, t),
      fontSize: interpolate(p1.fontSize, p2.fontSize, t),
    })

    const t = ultraFastEaseInOutFunction(progress)
    titles.forEach((title, i) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const pos2 = toFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const ipos = interpolatePosition(pos1, pos2, t)
      drawRotatedText(ctx, ipos, title)
    })
    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const isub = interpolatePosition(sub1, sub2, t)
    drawRotatedText(ctx, isub, subtitle)
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const posArr = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    posArr.forEach((pos, i) => {
      drawRotatedText(ctx, pos, titles[i])
    })
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, txt: string) => {
    ctx.save()
    ctx.translate(pos.x + pos.width / 2, pos.y + pos.height / 2)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(txt, 0, 0)
    ctx.restore()
  }

  const getContrastColor = (bg: string): string => {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  const drawLines = (ctx: CanvasRenderingContext2D, fLines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'
    fLines.forEach(line => {
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

    const drawFrameLines = (linesArr: Line[], frameProgress: number) => {
      const adjustedStagger = linesArr.length > 1 ? maxStaggerDelay / (linesArr.length - 1) : 0
      linesArr.forEach((line, idx) => {
        let t = Math.max(0, Math.min(1, (frameProgress - idx * adjustedStagger) / animationDuration))
        t = ultraFastEaseInOutFunction(t)
        const { start, end } = line
        const currentEnd = {
          x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
          y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t)
        }
        const tremblingX = (Math.random() - 0.5) * tremblingIntensity
        const tremblingY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(start.x + tremblingX, start.y + tremblingY)
        ctx.lineTo(currentEnd.x + tremblingX, currentEnd.y + tremblingY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length > 0) drawFrameLines(frame1Lines, progress)
    if (frame2Lines.length > 0) drawFrameLines(frame2Lines, progress)
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
    const corners = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH]
    ]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

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
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH]
    ]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
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
    if (Math.abs(rotatedX + halfW) <= handleSize / 2 && Math.abs(rotatedY + halfH) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(rotatedX - halfW) <= handleSize / 2 && Math.abs(rotatedY + halfH) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(rotatedX - halfW) <= handleSize / 2 && Math.abs(rotatedY - halfH) <= handleSize / 2) return 'se-resize'
    if (Math.abs(rotatedX + halfW) <= handleSize / 2 && Math.abs(rotatedY - halfH) <= handleSize / 2) return 'sw-resize'
    if (Math.abs(rotatedX) < halfW && Math.abs(rotatedY) < halfH) return 'move'
    return null
  }

  const isPointNearRotationArea = (x: number, y: number, pos: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    const rotation = 'rotation' in pos ? pos.rotation : pos.rotation
    const halfW = pos.width / 2
    const halfH = pos.height / 2
    const dx = x - centerX
    const dy = y - centerY
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ]
    for (const corner of corners) {
      const dist = Math.sqrt(Math.pow(rotatedX - corner.x, 2) + Math.pow(rotatedY - corner.y, 2))
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationAreaSize) {
        return true
      }
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
    const minScale = 0.1
    scale = Math.max(scale, minScale)
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
      prev.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
          ? updatePos(pos)
          : pos
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
    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currentAngle = Math.atan2(y - centerY, x - centerX)
    let deltaAngle = currentAngle - lastAngle
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const textType = `title${i + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(textType)) {
          setLastKnownRotations(prev => ({ ...prev, [textType]: pos.rotation + deltaAngle }))
          return rotateAroundPoint(pos, centerX, centerY, deltaAngle)
        }
        return pos
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const np = rotateAroundPoint(prev, centerX, centerY, deltaAngle)
        setLastKnownRotations(prev => ({ ...prev, subtitle: np.rotation }))
        return np
      })
    }
    setGroupRotation(prev => {
      const nr = prev + deltaAngle
      setLastKnownRotations(prevR => ({ ...prevR, group: nr }))
      return nr
    })
    lastMousePosition.current = { x, y }
  }

  const rotateAroundPoint = (pos: TextPosition, centerX: number, centerY: number, angle: number): TextPosition => {
    const dx = pos.x + pos.width / 2 - centerX
    const dy = pos.y + pos.height / 2 - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const curAngle = Math.atan2(dy, dx)
    const newAngle = curAngle + angle
    const newX = centerX + dist * Math.cos(newAngle) - pos.width / 2
    const newY = centerY + dist * Math.sin(newAngle) - pos.height / 2
    return {
      ...pos,
      x: newX,
      y: newY,
      rotation: pos.rotation + angle
    }
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
    if (!isRotating) setPaperRect(null)
    drawCanvas()
  }

  const handleTextInteraction = (pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle', x: number, y: number) => {
    if (currentFrame !== 2) return
    lastMousePosition.current = { x, y }
    if (selectedTexts.length > 0) {
      setLastKnownRotations(prev => ({ ...prev, group: groupRotation }))
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
          setResizeStartPosition({ x, y })
        }
      } else {
        setIsDragging(true)
      }
    }
    drawCanvas()
  }

  const resizeSingle = (x: number, y: number, pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle', handle: string) => {
    if (!resizeStartPosition) return
    const currentPos = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const centerX = currentPos.x + currentPos.width / 2
    const centerY = currentPos.y + currentPos.height / 2
    const startVec = { x: resizeStartPosition.x - centerX, y: resizeStartPosition.y - centerY }
    const curVec = { x: x - centerX, y: y - centerY }
    const resizeSpeedFactor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVec.x)
      const curDist = Math.abs(curVec.x)
      scale = startDist !== 0 ? 1 + ((curDist / startDist - 1) * resizeSpeedFactor) : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const startDist = Math.abs(startVec.y)
      const curDist = Math.abs(curVec.y)
      scale = startDist !== 0 ? 1 + ((curDist / startDist - 1) * resizeSpeedFactor) : 1
    }
    scale = Math.max(0.1, scale)
    const newW = currentPos.width * scale
    const newH = currentPos.height * scale
    const newX = centerX - newW / 2
    const newY = centerY - newH / 2
    const newPos = { ...currentPos, x: newX, y: newY, width: newW, height: newH, fontSize: currentPos.fontSize * scale }
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
        const box = calculateGroupBoundingBox()
        if (box) rotateGroup(x, y, box)
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

    if (currentLine) {
      setCurrentLine(pl => ({
        ...pl!,
        end: { x, y }
      }))
      drawCanvas()
      return
    }

    if (editingLineIndex !== null) {
      setLines(prev => {
        const newArr = [...prev]
        const ln = { ...newArr[editingLineIndex] }
        if (isPointNear({ x, y }, ln.start)) {
          ln.start = { x, y }
        } else if (isPointNear({ x, y }, ln.end)) {
          ln.end = { x, y }
        }
        newArr[editingLineIndex] = ln
        return newArr
      })
      drawCanvas()
      return
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
    const posArr = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    for (let i = 0; i < posArr.length; i++) {
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(posArr[i]))) {
        handleTextInteraction(posArr[i], `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subPos))) {
      handleTextInteraction(subPos, 'subtitle', x, y)
      return
    }

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

    const currentPosArr = currentFrame === 1
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]

    for (let i = 0; i < currentPosArr.length; i++) {
      const pos = currentPosArr[i]
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
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    const width = pos.width
    const height = pos.height
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(pos.rotation) - corner.y * Math.sin(pos.rotation)
      const ry = corner.x * Math.sin(pos.rotation) + corner.y * Math.cos(pos.rotation)
      return { x: rx + centerX, y: ry + centerY }
    })
  }

  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const { x, y, width, height, rotation } = box
    const centerX = x + width / 2
    const centerY = y + height / 2
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation)
      const ry = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
      return { x: rx + centerX, y: ry + centerY }
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

  const isPointNear = (point: Point, target: Point | Line, threshold: number = 10): boolean => {
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

  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
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
    lastMousePosition.current = { x, y }
  }

  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')
          ? { ...pos, x: pos.x + dx, y: pos.y + dy }
          : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    lastMousePosition.current = { x, y }
  }

  const rotateSingle = (x: number, y: number, pos: TextPosition, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return
    const currentPos = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const centerX = currentPos.x + currentPos.width / 2
    const centerY = currentPos.y + currentPos.height / 2
    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currentAngle = Math.atan2(y - centerY, x - centerX)
    let deltaAngle = currentAngle - lastAngle
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({ ...prev, rotation: prev.rotation + deltaAngle }))
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = { ...arr[idx], rotation: arr[idx].rotation + deltaAngle }
        return arr
      })
    }
    lastMousePosition.current = { x, y }
  }

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsedTime = timestamp - startTimeRef.current

    // ← use the state variable instead of hard‐coding:
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

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleLoop = () => {
    setIsLooping(!isLooping)
  }

  const handleExport = () => {
    console.log("Export functionality not implemented yet")
  }

  const updatePosition = (newPosition: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        selectedTexts.forEach(sel => {
          if (sel === 'title1' || sel === 'title2') {
            const idx = sel === 'title1' ? 0 : 1
            arr[idx] = newPosition
          }
        })
        return arr
      })
    }
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(newPosition)
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
            <Button onClick={handleExport} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

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
                  onChange={e => setEditingPosition({ ...editingPosition, x: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="yPosition">Y Position</Label>
                <Input
                  id="yPosition"
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
                  onChange={e => setEditingPosition({ ...editingPosition, rotation: Number(e.target.value) * (Math.PI / 180) })}
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)}>Update</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="animationSpeed">Animation Speed</Label>
              <Slider
                id="animationSpeed"
                min={0.00005}
                max={0.0005}
                step={0.00001}
                value={[animationSpeed]}
                onValueChange={value => setAnimationSpeed(value[0])}
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
                onValueChange={value => handleSettingsChange('tremblingIntensity', value[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
