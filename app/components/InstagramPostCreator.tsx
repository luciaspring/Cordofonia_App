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

const ultraFastEaseInOutFunction = (t: number): number => {
  if (t < 0.5) {
    return Math.pow(2 * t, 16) / 2
  } else {
    return 1 - Math.pow(-2 * t + 2, 16) / 2
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
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 48 },
    { x: 40, y: 500, width: 1000, height: 200, rotation: 0, fontSize: 48 }
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 48 },
    { x: 40, y: 500, width: 1000, height: 200, rotation: 0, fontSize: 48 }
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({ x: 40, y: 600, width: 1000, height: 100, rotation: 0, fontSize: 24 })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({ x: 40, y: 600, width: 1000, height: 100, rotation: 0, fontSize: 24 })
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [lineThickness, setLineThickness] = useState(2)
  const [animationSpeed, setAnimationSpeed] = useState(0.0002)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [frameRate, setFrameRate] = useState(60)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

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
      lastFrameTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      drawCanvas(0)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, frameRate, animationSpeed, isLooping])

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
    const { width: sw, height: sh } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const sAspect = sw / sh
    setSubtitlePositionFrame1(prev => ({ ...prev, width: sw, height: sh, aspectRatio: sAspect }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: sw, height: sh, aspectRatio: sAspect }))
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
    titles.forEach((title, i) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const pos2 = toFrame === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const ip = lerpPos(pos1, pos2, t)
      drawRotatedText(ctx, ip, title)
    })
    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const isub = lerpPos(sub1, sub2, t)
    drawRotatedText(ctx, isub, subtitle)
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((title, i) => drawRotatedText(ctx, positions[i], title))
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, position: TextPosition, text: string) => {
    const tremX = (Math.random() - 0.5) * tremblingIntensity
    const tremY = (Math.random() - 0.5) * tremblingIntensity
    ctx.save()
    ctx.translate(position.x + position.width / 2 + tremX, position.y + position.height / 2 + tremY)
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
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
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
    ctx.strokeStyle = '#000000'
    const duration = 0.3
    const maxDelay = staggerDelay
    const drawFrameSet = (linesSet: Line[], frameProg: number) => {
      const adjustedDelay = linesSet.length > 1 ? maxDelay / (linesSet.length - 1) : 0
      linesSet.forEach((ln, i) => {
        let t = (frameProg - i * adjustedDelay) / duration
        t = Math.max(0, Math.min(1, t))
        t = ultraFastEaseInOutFunction(t)
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
    if (frame1Lines.length > 0) {
      drawFrameSet(frame1Lines, progress)
    }
    if (frame2Lines.length > 0) {
      drawFrameSet(frame2Lines, progress)
    }
  }

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, position: TextPosition) => {
    const cx = position.x + position.width / 2
    const cy = position.y + position.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(position.rotation)
    const hw = position.width / 2
    const hh = position.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, position.width, position.height)
    const handleSize = 8
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
    const handleSize = 8
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

  const getResizeHandle = (x: number, y: number, position: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 12
    const cx = position.x + position.width / 2
    const cy = position.y + position.height / 2
    const rot = position.rotation
    const dx = x - cx
    const dy = y - cy
    const unrotX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const unrotY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = position.width / 2
    const hh = position.height / 2
    if (Math.abs(unrotX + hw) <= handleSize / 2 && Math.abs(unrotY + hh) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(unrotX - hw) <= handleSize / 2 && Math.abs(unrotY + hh) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(unrotX - hw) <= handleSize / 2 && Math.abs(unrotY - hh) <= handleSize / 2) return 'se-resize'
    if (Math.abs(unrotX + hw) <= handleSize / 2 && Math.abs(unrotY - hh) <= handleSize / 2) return 'sw-resize'
    if (Math.abs(unrotX) < hw && Math.abs(unrotY) < hh) return 'move'
    return null
  }

  const isPointNearRotationArea = (x: number, y: number, position: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 12
    const rotArea = 16
    const cx = position.x + position.width / 2
    const cy = position.y + position.height / 2
    const rot = position.rotation
    const dx = x - cx
    const dy = y - cy
    const unrotX = dx * Math.cos(-rot) - dy * Math.sin(-rot)
    const unrotY = dx * Math.sin(-rot) + dy * Math.cos(-rot)
    const hw = position.width / 2
    const hh = position.height / 2
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ]
    for (const corner of corners) {
      const dist = Math.hypot(unrotX - corner.x, unrotY - corner.y)
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotArea) {
        return true
      }
    }
    return false
  }

  const isPointInRotatedBox = (x: number, y: number, corners: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const xi = corners[i].x, yi = corners[i].y
      const xj = corners[j].x, yj = corners[j].y
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const getRotatedBoundingBox = (position: TextPosition): Point[] => {
    const cx = position.x + position.width / 2
    const cy = position.y + position.height / 2
    const w = position.width
    const h = position.height
    const rot = position.rotation
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(rot) - corner.y * Math.sin(rot)
      const ry = corner.x * Math.sin(rot) + corner.y * Math.cos(rot)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const getRotatedGroupBoundingBox = (groupBox: GroupBoundingBox): Point[] => {
    const { x, y, width, height, rotation } = groupBox
    const cx = x + width / 2
    const cy = y + height / 2
    const w = width
    const h = height
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ]
    return corners.map(corner => {
      const rx = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation)
      const ry = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
      return { x: rx + cx, y: ry + cy }
    })
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

  const pointToLineDistance = (point: Point, start: Point, end: Point): number => {
    const A = point.x - start.x
    const B = point.y - start.y
    const C = end.x - start.x
    const D = end.y - start.y
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq
    let xx, yy
    if (param < 0) {
      xx = start.x
      yy = start.y
    } else if (param > 1) {
      xx = end.x
      yy = end.y
    } else {
      xx = start.x + param * C
      yy = start.y + param * D
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
        const newArr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        newArr[idx] = { ...newArr[idx], x: newArr[idx].x + dx, y: newArr[idx].y + dy }
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

  const rotateGroup = (x: number, y: number, groupBox: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = groupBox.x + groupBox.width / 2
    const cy = groupBox.y + groupBox.height / 2
    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currentAngle = Math.atan2(y - cy, x - cx)
    let delta = currentAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const key = `title${i + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(key)) {
          return rotateAroundPoint(pos, cx, cy, delta)
        }
        return pos
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => rotateAroundPoint(prev, cx, cy, delta))
    }
    setGroupRotation(prev => prev + delta)
    lastMousePosition.current = { x, y }
  }

  const rotateAroundPoint = (position: TextPosition, cx: number, cy: number, angle: number): TextPosition => {
    const dx = position.x + position.width / 2 - cx
    const dy = position.y + position.height / 2 - cy
    const dist = Math.hypot(dx, dy)
    const currentAngle = Math.atan2(dy, dx)
    const newAngle = currentAngle + angle
    const newX = cx + dist * Math.cos(newAngle) - position.width / 2
    const newY = cy + dist * Math.sin(newAngle) - position.height / 2
    return { ...position, x: newX, y: newY, rotation: position.rotation + angle }
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPosition) return
    const dx = x - resizeStartPosition.x
    const dy = y - resizeStartPosition.y
    const cx = initialGroupBox.x + initialGroupBox.width / 2
    const cy = initialGroupBox.y + initialGroupBox.height / 2
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + dx / initialGroupBox.width
    } else {
      scale = 1 + dy / initialGroupBox.height
    }
    scale = Math.max(scale, 0.1)
    const newW = initialGroupBox.width * scale
    const newH = initialGroupBox.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2
    const updatePos = (pos: TextPosition) => {
      const relX = (pos.x + pos.width / 2 - cx) / (initialGroupBox.width / 2)
      const relY = (pos.y + pos.height / 2 - cy) / (initialGroupBox.height / 2)
      const nw = pos.width * scale
      const nh = pos.height * scale
      return {
        ...pos,
        width: nw,
        height: nh,
        x: cx + relX * (newW / 2) - nw / 2,
        y: cy + relY * (newH / 2) - nh / 2,
        fontSize: pos.fontSize * scale
      }
    }
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2') ? updatePos(pos) : pos
      )
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePos(prev))
    }
    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
    drawCanvas()
  }

  const resizeSingle = (x: number, y: number, position: TextPosition, textType: 'title1' | 'title2' | 'subtitle', handle: string) => {
    if (!resizeStartPosition) return
    const currentPos = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
    const cx = currentPos.x + currentPos.width / 2
    const cy = currentPos.y + currentPos.height / 2
    const startVector = { x: resizeStartPosition.x - cx, y: resizeStartPosition.y - cy }
    const currVector = { x: x - cx, y: y - cy }
    let scale = 1
    const speedFactor = 0.1
    if (handle.includes('e') || handle.includes('w')) {
      const sDist = Math.abs(startVector.x)
      const cDist = Math.abs(currVector.x)
      scale = sDist !== 0 ? 1 + ((cDist / sDist - 1) * speedFactor) : 1
    } else {
      const sDist = Math.abs(startVector.y)
      const cDist = Math.abs(currVector.y)
      scale = sDist !== 0 ? 1 + ((cDist / sDist - 1) * speedFactor) : 1
    }
    scale = Math.max(scale, 0.1)
    const newW = currentPos.width * scale
    const newH = currentPos.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2
    const newPos: TextPosition = {
      ...currentPos,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      fontSize: currentPos.fontSize * scale
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
    drawCanvas()
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

    for (let i = 0; i < positions.length; i++) {
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(positions[i]))) {
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePos))) {
      handleTextInteraction(subtitlePos, 'subtitle', x, y)
      return
    }

    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }
    const clickedIndex = lines.findIndex(line =>
      line.frame === currentFrame &&
      (isPointNear({ x, y }, line) || isPointNear({ x, y }, line.start) || isPointNear({ x, y }, line.end))
    )
    if (clickedIndex !== -1) {
      setEditingLineIndex(clickedIndex)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  const handleTextInteraction = (position: TextPosition, textType: 'title1' | 'title2' | 'subtitle', x: number, y: number) => {
    if (currentFrame === 2) {
      lastMousePosition.current = { x, y }
      if (isShiftPressed.current) {
        setSelectedTexts(prev => {
          const newSel = prev.includes(textType) ? prev.filter(p => p !== textType) : [...prev, textType]
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
        const box = calculateGroupBoundingBox()
        if (box) setInitialGroupBox(box)
      } else {
        const handle = getResizeHandle(x, y, position)
        if (handle) {
          if (handle === 'move') {
            setIsDragging(true)
          } else {
            setResizeHandle(handle)
            setIsResizing(true)
            setResizeStartPosition({ x, y })
            setInitialGroupBox(null)
          }
        } else {
          setIsDragging(true)
        }
      }
      drawCanvas()
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    if (selectedTexts.length > 0 && currentFrame === 2) {
      if (isRotating && initialGroupBox) {
        rotateGroup(x, y, initialGroupBox)
      } else if (isDragging) {
        if (selectedTexts.length === 1) {
          dragSingle(x, y, selectedTexts[0])
        } else {
          dragGroup(x, y)
        }
      } else if (isResizing && resizeHandle) {
        if (selectedTexts.length === 1) {
          const textType = selectedTexts[0]
          const pos = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, textType, resizeHandle)
        } else if (initialGroupBox && resizeHandle) {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
    } else if (currentLine) {
      setCurrentLine(prev => prev && { ...prev, end: { x, y } })
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

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
      lastFrameTimeRef.current = timestamp
    }
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
    if (!lastFrameTimeRef.current || timestamp - lastFrameTimeRef.current >= 1000 / frameRate) {
      drawCanvas(progress)
      lastFrameTimeRef.current = timestamp
    }
    if (isLooping || isPlaying) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const togglePlay = () => {
    setIsPlaying(prev => !prev)
  }

  const toggleLoop = () => {
    setIsLooping(prev => !prev)
  }

  const handleExport = () => {
    console.log("Export functionality not implemented yet")
  }

  const updatePosition = (newPos: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        selectedTexts.forEach(sel => {
          if (sel === 'title1') arr[0] = newPos
          if (sel === 'title2') arr[1] = newPos
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
      default:
        break
    }
    drawCanvas()
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
                <Label htmlFor="rotation">Rotation (degrees)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={e => setEditingPosition({ ...editingPosition, rotation: Number(e.target.value) * (Math.PI / 180) })}
                />
              </div>
              <Button onClick={() => editingPosition && updatePosition(editingPosition)}>Update</Button>
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
                onValueChange={value => handleSettingsChange('lineThickness', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="animationSpeed">Animation Speed</Label>
              <Slider
                id="animationSpeed"
                min={0.00005}
                max={0.001}
                step={0.00001}
                value={[animationSpeed]}
                onValueChange={value => handleSettingsChange('animationSpeed', value[0])}
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
                onValueChange={value => handleSettingsChange('staggerDelay', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="tremblingIntensity">Trembling Intensity</Label>
              <Slider
                id="tremblingIntensity"
                min={0}
                max={20}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={value => handleSettingsChange('tremblingIntensity', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRate">Frame Rate (fps)</Label>
              <Slider
                id="frameRate"
                min={50}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={value => handleSettingsChange('frameRate', value[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
