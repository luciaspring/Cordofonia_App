'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const [isResizing, setIsResizing] = useState(false)

  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  const [lineThickness, setLineThickness] = useState(2)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025)
  const [frameRate, setFrameRate] = useState(30)

  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)

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
    drawCanvas()
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
  }, [isPlaying, frameRate])

  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }
    setTitlePositionsFrame1((prev) =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    setTitlePositionsFrame2((prev) =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    const { width: sw, height: sh } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const sAR = sw / sh
    setSubtitlePositionFrame1((prev) => ({ ...prev, width: sw, height: sh, aspectRatio: sAR }))
    setSubtitlePositionFrame2((prev) => ({ ...prev, width: sw, height: sh, aspectRatio: sAR }))
  }

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null
    const selectedPositions = titlePositionsFrame2
      .filter((_, i) => selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : [])
    let minX = Math.min(...selectedPositions.map((p) => p.x))
    let minY = Math.min(...selectedPositions.map((p) => p.y))
    let maxX = Math.max(...selectedPositions.map((p) => p.x + p.width))
    let maxY = Math.max(...selectedPositions.map((p) => p.y + p.height))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: groupRotation }
  }

  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const frame1Lines = lines.filter((l) => l.frame === 1)
    const frame2Lines = lines.filter((l) => l.frame === 2)

    if (isPlaying) {
      if (progress <= 0.3) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {
        const t = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, ultraFastEaseInOutFunction(t), 1, 2)
      } else if (progress <= 1.0) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else {
        const t = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, ultraFastEaseInOutFunction(t), 2, 1)
      }
    } else {
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)
      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox()
        if (groupBox) drawGroupBoundingBox(ctx, groupBox)
        else {
          titlePositionsFrame2.forEach((pos, i) => {
            if (selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')) {
              drawBoundingBox(ctx, pos)
            }
          })
          if (selectedTexts.includes('subtitle')) drawBoundingBox(ctx, subtitlePositionFrame2)
        }
      }
    }
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    positions.forEach((pos, i) => drawRotatedText(ctx, pos, titles[i]))
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawRotatedText(ctx, subPos, subtitle)
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

  const drawLines = (ctx: CanvasRenderingContext2D, frameLines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'
    frameLines.forEach((l) => {
      ctx.beginPath()
      ctx.moveTo(l.start.x, l.start.y)
      ctx.lineTo(l.end.x, l.end.y)
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
    const animationDuration = 0.3
    const maxStagger = staggerDelay

    const drawFrame = (array: Line[], prog: number) => {
      const stagger = array.length > 1 ? maxStagger / (array.length - 1) : 0
      array.forEach((l, i) => {
        let t = Math.max(0, Math.min(1, (prog - i * stagger) / animationDuration))
        t = ultraFastEaseInOutFunction(t)
        const { start, end } = l
        const cx = start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t)
        const cy = start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t)
        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity
        ctx.beginPath()
        ctx.moveTo(start.x + tremX, start.y + tremY)
        ctx.lineTo(cx + tremX, cy + tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length > 0) drawFrame(frame1Lines, progress)
    if (frame2Lines.length > 0) drawFrame(frame2Lines, progress)
  }

  const drawAnimatedText = (ctx: CanvasRenderingContext2D, t: number, from: number, to: number) => {
    const interp = (a: number, b: number, u: number) => a + (b - a) * u
    const interpPos = (p1: TextPosition, p2: TextPosition, u: number): TextPosition => ({
      x: interp(p1.x, p2.x, u),
      y: interp(p1.y, p2.y, u),
      width: interp(p1.width, p2.width, u),
      height: interp(p1.height, p2.height, u),
      rotation: interp(p1.rotation, p2.rotation, u),
      fontSize: interp(p1.fontSize, p2.fontSize, u)
    })
    titles.forEach((txt, i) => {
      const A = from === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const B = to === 1 ? titlePositionsFrame1[i] : titlePositionsFrame2[i]
      const P = interpPos(A, B, t)
      drawRotatedText(ctx, P, txt)
    })
    const subA = from === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subB = to === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subP = interpPos(subA, subB, t)
    drawRotatedText(ctx, subP, subtitle)
  }

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(pos.rotation)
    const hw = pos.width / 2
    const hh = pos.height / 2
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, pos.width, pos.height)
    const hSize = 10
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
    ]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x - hSize / 2, y - hSize / 2, hSize, hSize)
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
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, box.width, box.height)
    const hSize = 10
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
    ]
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x - hSize / 2, y - hSize / 2, hSize, hSize)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const getContrastColor = (bg: string): string => {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.5 ? '#000000' : '#FFFFFF'
  }

  // ─── DRAGGING HELPERS ─────────────────────────────────────────────────────────────

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
        y: prev.y + dy
      }))
    } else {
      setTitlePositionsFrame2((prev) => {
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

    setTitlePositionsFrame2((prev) =>
      prev.map((pos, i) => {
        if (selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2')) {
          return {
            ...pos,
            x: pos.x + dx,
            y: pos.y + dy
          }
        }
        return pos
      })
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }))
    }

    lastMousePosition.current = { x, y }
  }

  // ─── RESIZING HELPERS ────────────────────────────────────────────────────────────

  const resizeSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!lastMousePosition.current) return
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    const startVector = {
      x: lastMousePosition.current.x - centerX,
      y: lastMousePosition.current.y - centerY
    }
    const currentVector = { x: x - centerX, y: y - centerY }
    const speedFactor = 0.1
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      const sDist = Math.abs(startVector.x)
      const cDist = Math.abs(currentVector.x)
      scale = sDist !== 0 ? 1 + ((cDist / sDist - 1) * speedFactor) : 1
    } else {
      const sDist = Math.abs(startVector.y)
      const cDist = Math.abs(currentVector.y)
      scale = sDist !== 0 ? 1 + ((cDist / sDist - 1) * speedFactor) : 1
    }
    scale = Math.max(0.1, scale)
    const newW = pos.width * scale
    const newH = pos.height * scale
    const newX = centerX - newW / 2
    const newY = centerY - newH / 2
    const newPos = { ...pos, x: newX, y: newY, width: newW, height: newH, fontSize: pos.fontSize * scale }
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
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    const cx = initialGroupBox.x + initialGroupBox.width / 2
    const cy = initialGroupBox.y + initialGroupBox.height / 2
    let scale = 1
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / initialGroupBox.width)
    } else {
      scale = 1 + (dy / initialGroupBox.height)
    }
    scale = Math.max(0.1, scale)
    const newW = initialGroupBox.width * scale
    const newH = initialGroupBox.height * scale
    const newX = cx - newW / 2
    const newY = cy - newH / 2

    const updatePos = (pos: TextPosition) => {
      const relX = (pos.x + pos.width / 2 - cx) / (initialGroupBox.width / 2)
      const relY = (pos.y + pos.height / 2 - cy) / (initialGroupBox.height / 2)
      const finalX = cx + relX * (newW / 2) - pos.width * scale / 2
      const finalY = cy + relY * (newH / 2) - pos.height * scale / 2
      return { ...pos, x: finalX, y: finalY, width: pos.width * scale, height: pos.height * scale, fontSize: pos.fontSize * scale }
    }

    setTitlePositionsFrame2((prev) =>
      prev.map((p, i) => (selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2') ? updatePos(p) : p))
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => updatePos(prev))
    }
    setInitialGroupBox({ x: newX, y: newY, width: newW, height: newH, rotation: initialGroupBox.rotation })
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  // ─── ROTATION HELPERS ────────────────────────────────────────────────────────────

  const rotateSingle = (
    x: number,
    y: number,
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosition.current) return
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currAngle = Math.atan2(y - cy, x - cx)
    let delta = currAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2((prev) => ({ ...prev, rotation: prev.rotation + delta }))
    } else {
      setTitlePositionsFrame2((prev) => {
        const arr = [...prev]
        const idx = textType === 'title1' ? 0 : 1
        arr[idx] = { ...arr[idx], rotation: arr[idx].rotation + delta }
        return arr
      })
    }
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  const rotateGroup = (x: number, y: number, box: GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx)
    const currAngle = Math.atan2(y - cy, x - cx)
    let delta = currAngle - lastAngle
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI

    setTitlePositionsFrame2((prev) =>
      prev.map((p, i) => {
        const key = `title${i + 1}` as 'title1' | 'title2'
        if (selectedTexts.includes(key)) {
          const newP = rotateAroundPoint(p, cx, cy, delta)
          return newP
        }
        return p
      })
    )
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2((prev) => rotateAroundPoint(prev, cx, cy, delta))
    }
    setGroupRotation((gr) => gr + delta)
    lastMousePosition.current = { x, y }
    drawCanvas()
  }

  const rotateAroundPoint = (pos: TextPosition, cx: number, cy: number, angle: number): TextPosition => {
    const dx = pos.x + pos.width / 2 - cx
    const dy = pos.y + pos.height / 2 - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const orig = Math.atan2(dy, dx)
    const nAng = orig + angle
    const nx = cx + dist * Math.cos(nAng) - pos.width / 2
    const ny = cy + dist * Math.sin(nAng) - pos.height / 2
    return { ...pos, x: nx, y: ny, rotation: pos.rotation + angle }
  }

  // ─── MOUSE EVENTS ────────────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    lastMousePosition.current = { x, y }

    // First check if clicked on any rotated text box:
    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    for (let i = 0; i < positions.length; i++) {
      const box = getRotatedBoundingBox(positions[i])
      if (isPointInPolygon(x, y, box)) {
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    // Check subtitle:
    const subBox = getRotatedBoundingBox(currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2)
    if (isPointInPolygon(x, y, subBox)) {
      handleTextInteraction(subtitlePositionFrame2, 'subtitle', x, y)
      return
    }

    // Otherwise, start/edit a line:
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }
    const clickedIdx = lines.findIndex(
      (l) =>
        l.frame === currentFrame &&
        (isPointNear({ x, y }, l.start) || isPointNear({ x, y }, l.end) || isPointNear({ x, y }, l))
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
          const t = selectedTexts[0]
          const pos = t === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[t === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, t, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      return
    }

    if (currentLine) {
      setCurrentLine((prev) => ({ ...prev!, end: { x, y } }))
      drawCanvas()
    } else if (editingLineIndex !== null) {
      setLines((prev) => {
        const arr = [...prev]
        const ln = { ...arr[editingLineIndex] }
        if (isPointNear({ x, y }, ln.start)) ln.start = { x, y }
        else if (isPointNear({ x, y }, ln.end)) ln.end = { x, y }
        arr[editingLineIndex] = ln
        return arr
      })
      drawCanvas()
    } else {
      updateCursor(canvas, x, y)
    }
  }

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
    lastMousePosition.current = null
    drawCanvas()
  }

  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    const box = calculateGroupBoundingBox()
    if (box && currentFrame === 2 && isPointInPolygon(x, y, getRotatedGroupBoundingBox(box))) {
      if (isNearRotationHandle(x, y, box)) {
        canvas.style.cursor = 'crosshair'
        return
      }
      const handle = getResizeHandle(x, y, box)
      if (handle) {
        canvas.style.cursor = handle
        return
      }
      canvas.style.cursor = 'move'
      return
    }
    const currentPositions =
      currentFrame === 1
        ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
        : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]
    for (let i = 0; i < currentPositions.length; i++) {
      const pos = currentPositions[i]
      if (isPointInPolygon(x, y, getRotatedBoundingBox(pos))) {
        if (currentFrame === 2) {
          if (isNearRotationHandle(x, y, pos)) {
            canvas.style.cursor = 'crosshair'
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

  const handleTextInteraction = (
    pos: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    if (currentFrame !== 2) return
    lastMousePosition.current = { x, y }
    if (isShiftPressed.current) {
      setSelectedTexts((prev) => {
        const newSel = prev.includes(textType) ? prev.filter((t) => t !== textType) : [...prev, textType]
        if (newSel.length > 1) {
          setGroupRotation(groupRotation)
        } else if (newSel.length === 1) {
          // single selection uses its own rotation
          setGroupRotation(pos.rotation)
        }
        return newSel
      })
    } else {
      setSelectedTexts([textType])
      setGroupRotation(pos.rotation)
    }
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)

    if (isNearRotationHandle(x, y, pos)) {
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
          setInitialGroupBox(calculateGroupBoundingBox())
        }
      } else {
        setIsDragging(true)
      }
    }
    drawCanvas()
  }

  const handleFrameChange = (f: number) => {
    setCurrentFrame(f)
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
    console.log('Export not implemented')
  }

  const updatePosition = (newPos: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2((prev) => {
        const arr = [...prev]
        selectedTexts.forEach((t) => {
          if (t === 'title1' || t === 'title2') {
            const idx = t === 'title1' ? 0 : 1
            arr[idx] = newPos
          }
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
      case 'frameRate':
        setFrameRate(value)
        break
      default:
        break
    }
  }

  const isPointInPolygon = (px: number, py: number, poly: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y
      const xj = poly[j].x,
        yj = poly[j].y
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  const isPointNear = (pt: Point, target: Point | Line, threshold = 10): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = pt.x - target.x
      const dy = pt.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(pt, target.start, target.end) < threshold
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
    return Math.sqrt(dx * dx + dy * dy)
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
    return corners.map((c) => {
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
    return corners.map((c) => {
      const rx = c.x * Math.cos(box.rotation) - c.y * Math.sin(box.rotation)
      const ry = c.x * Math.sin(box.rotation) + c.y * Math.cos(box.rotation)
      return { x: rx + cx, y: ry + cy }
    })
  }

  const isNearRotationHandle = (x: number, y: number, pos: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20
    const rotationArea = 15
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const halfW = pos.width / 2
    const halfH = pos.height / 2
    const dx = x - cx
    const dy = y - cy
    const rotatedX = dx * Math.cos(-pos.rotation) - dy * Math.sin(-pos.rotation)
    const rotatedY = dx * Math.sin(-pos.rotation) + dy * Math.cos(-pos.rotation)
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH }
    ]
    return corners.some((corner) => {
      const dist = Math.hypot(rotatedX - corner.x, rotatedY - corner.y)
      return dist > handleSize / 2 && dist <= handleSize / 2 + rotationArea
    })
  }

  const getResizeHandle = (x: number, y: number, pos: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 20
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    const halfW = pos.width / 2
    const halfH = pos.height / 2
    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(-pos.rotation) - dy * Math.sin(-pos.rotation)
    const ry = dx * Math.sin(-pos.rotation) + dy * Math.cos(-pos.rotation)

    if (Math.abs(rx + halfW) <= handleSize / 2 && Math.abs(ry + halfH) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(rx - halfW) <= handleSize / 2 && Math.abs(ry + halfH) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(rx - halfW) <= handleSize / 2 && Math.abs(ry - halfH) <= handleSize / 2) return 'se-resize'
    if (Math.abs(rx + halfW) <= handleSize / 2 && Math.abs(ry - halfH) <= handleSize / 2) return 'sw-resize'
    if (Math.abs(rx) < halfW && Math.abs(ry) < halfH) return 'move'
    return null
  }

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current
    const frameInterval = 1000 / frameRate
    const stepped = frameInterval > 0 ? Math.floor(elapsed / frameInterval) * frameInterval : elapsed
    let prog = stepped * animationSpeed
    if (prog > 1.4) {
      if (isLooping) {
        startTimeRef.current = timestamp
        prog = 0
      } else {
        prog = 1.4
        setIsPlaying(false)
      }
    }
    drawCanvas(prog)
    if (isLooping || isPlaying) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawCanvas(0)
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
              {[
                { name: 'Light Pink', value: '#F6A69B' },
                { name: 'Light Blue', value: '#5894D0' },
                { name: 'Olive Green', value: '#5B6B4E' },
                { name: 'Orange', value: '#FF6700' },
                { name: 'Gray', value: '#6B6B6B' },
                { name: 'Purple', value: '#E0B0FF' },
                { name: 'Mint Green', value: '#D0EBDA' }
              ].map((color) => (
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
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={(e) =>
                    setEditingPosition({ ...editingPosition, x: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={(e) =>
                    setEditingPosition({ ...editingPosition, y: Number(e.target.value) })
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
                      rotation: (Number(e.target.value) * Math.PI) / 180
                    })
                  }
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
                onValueChange={(val) => setLineThickness(val[0])}
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
                onValueChange={(val) => handleSettingsChange('tremblingIntensity', val[0])}
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
              <Label htmlFor="frameRate">Frame Rate (FPS)</Label>
              <Slider
                id="frameRate"
                min={1}
                max={60}
                step={1}
                value={[frameRate]}
                onValueChange={(val) => handleSettingsChange('frameRate', val[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
