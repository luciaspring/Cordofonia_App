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
  const [easingSpeed, setEasingSpeed] = useState(10)
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
  const [animationSpeed, setAnimationSpeed] = useState(0.00025); // State for animation speed
  const [resizeSpeed, setResizeSpeed] = useState(0.5); // Add resize speed state
  const [resizeStartCenter, setResizeStartCenter] = useState<Point | null>(null); // State for storing the center point
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

  // Add this state to track last known rotations for each text element
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number;
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0
  });

  //
  // ——— drawAnimatedText MUST be declared BEFORE drawCanvas ———
  //
  const drawAnimatedText = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const interpolate = (start: number, end: number, t: number) => start + (end - start) * t

    const interpolatePosition = (pos1: TextPosition, pos2: TextPosition, t: number): TextPosition => ({
      x: interpolate(pos1.x, pos2.x, t),
      y: interpolate(pos1.y, pos2.y, t),
      width: interpolate(pos1.width, pos2.width, t),
      height: interpolate(pos1.height, pos2.height, t),
      rotation: interpolate(pos1.rotation, pos2.rotation, t),
      fontSize: interpolate(pos1.fontSize, pos2.fontSize, t),
    })

    const t = ultraFastEaseInOutFunction(progress)

    // Interpolate titles
    titles.forEach((title, index) => {
      const posFrom = fromFrame === 1 ? titlePositionsFrame1[index] : titlePositionsFrame2[index]
      const posTo   = toFrame   === 1 ? titlePositionsFrame1[index] : titlePositionsFrame2[index]
      const ipos = interpolatePosition(posFrom, posTo, t)
      drawRotatedText(ctx, ipos, title)
    })

    // Interpolate subtitle
    const subFrom = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subTo   = toFrame   === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const iSub = interpolatePosition(subFrom, subTo, t)
    drawRotatedText(ctx, iSub, subtitle)
  }

  //
  // ——— drawCanvas can safely call drawAnimatedText now ———
  //
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
        // Frame 1 “grow”
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
      } else if (progress <= 0.6) {
        // Frame 1 “shrink”
        drawStaticText(ctx, 1)
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
      } else if (progress <= 0.7) {
        // Text transition 1 → 2
        const textProgress = (progress - 0.6) / 0.1
        drawAnimatedText(ctx, textProgress, 1, 2)
      } else if (progress <= 1.0) {
        // Frame 2 “grow”
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
      } else if (progress <= 1.3) {
        // Frame 2 “shrink”
        drawStaticText(ctx, 2)
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
      } else if (progress <= 1.4) {
        // Text transition 2 → 1
        const textProgress = (progress - 1.3) / 0.1
        drawAnimatedText(ctx, textProgress, 2, 1)
      }
    } else {
      // Static‐preview mode:
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines)
      drawStaticText(ctx, currentFrame)

      if (selectedTexts.length > 0 && currentFrame === 2) {
        const box = calculateGroupBoundingBox()
        if (box) {
          drawGroupBoundingBox(ctx, box)
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

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((title, index) => {
      drawRotatedText(ctx, positions[index], title)
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
      const adjustedStaggerDelay = lines.length > 1 ? maxStaggerDelay / (lines.length - 1) : 0

      lines.forEach((line, index) => {
        let t = Math.max(0, Math.min(1, (frameProgress - index * adjustedStaggerDelay) / animationDuration))
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

    if (frame1Lines.length > 0) {
      drawFrameLines(frame1Lines, progress)
    }
    if (frame2Lines.length > 0) {
      drawFrameLines(frame2Lines, progress)
    }
  }

  // Draw bounding box for individual text position
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, position: TextPosition) => {
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(position.rotation)

    const halfWidth = position.width / 2
    const halfHeight = position.height / 2

    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfWidth, -halfHeight, position.width, position.height)

    const handleSize = 10
    const corners = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight]
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

  // Draw group bounding box
  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(box.rotation)

    const halfWidth = box.width / 2
    const halfHeight = box.height / 2

    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-halfWidth, -halfHeight, box.width, box.height)

    const handleSize = 10
    const corners = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight]
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

  // Calculate bounding box of a group of selected texts
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null

    const selectedPositions = titlePositionsFrame2
      .filter((_, idx) => selectedTexts.includes(idx === 0 ? 'title1' : 'title2'))
    if (selectedTexts.includes('subtitle')) {
      selectedPositions.push(subtitlePositionFrame2)
    }

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

  // Get rotated corners of a single TextPosition
  const getRotatedBoundingBox = (position: TextPosition): Point[] => {
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const width = position.width
    const height = position.height

    const corners = [
      { x: -width / 2, y: -height / 2 },  // top-left
      { x: width / 2, y: -height / 2 },   // top-right
      { x: width / 2, y: height / 2 },    // bottom-right
      { x: -width / 2, y: height / 2 }    // bottom-left
    ]

    return corners.map(corner => {
      const rx = corner.x * Math.cos(position.rotation) - corner.y * Math.sin(position.rotation)
      const ry = corner.x * Math.sin(position.rotation) + corner.y * Math.cos(position.rotation)
      return { x: rx + centerX, y: ry + centerY }
    })
  }

  // Get rotated corners of a group bounding box
  const getRotatedGroupBoundingBox = (groupBox: GroupBoundingBox): Point[] => {
    const { x, y, width, height, rotation } = groupBox
    const centerX = x + width / 2
    const centerY = y + height / 2
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 }
    ]

    return corners.map(corner => {
      const rx = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation)
      const ry = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
      return { x: rx + centerX, y: ry + centerY }
    })
  }

  // Check if point is inside a rotated polygon
  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x, yi = box[i].y
      const xj = box[j].x, yj = box[j].y
      const intersect = ((yi > y) !== (yj > y)) &&
                        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  // Check distance from point to line segment or endpoint
  const isPointNear = (point: Point, target: Point | Line, threshold: number = 10): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold
    }
  }

  // Distance from a point to a line segment
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

  // Drag a single text element
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
        const newPositions = [...prev]
        const index = textType === 'title1' ? 0 : 1
        newPositions[index] = {
          ...newPositions[index],
          x: newPositions[index].x + dx,
          y: newPositions[index].y + dy
        }
        return newPositions
      })
    }

    lastMousePosition.current = { x, y }
  }

  // Drag a group of selected texts
  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return

    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y

    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) =>
        (selectedTexts.includes(idx === 0 ? 'title1' : 'title2'))
          ? { ...pos, x: pos.x + dx, y: pos.y + dy }
          : pos
      )
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }))
    }

    lastMousePosition.current = { x, y }
  }

  // Rotate a single text element around its center
  const rotateSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosition.current) return

    const currentPosition = textType === 'subtitle'
      ? subtitlePositionFrame2
      : titlePositionsFrame2[textType === 'title1' ? 0 : 1]

    const centerX = currentPosition.x + currentPosition.width / 2
    const centerY = currentPosition.y + currentPosition.height / 2

    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX)
    const currentAngle = Math.atan2(y - centerY, x - centerX)
    let deltaAngle = currentAngle - lastAngle

    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        rotation: prev.rotation + deltaAngle
      }))
    } else {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]
        const index = textType === 'title1' ? 0 : 1
        newPositions[index] = {
          ...newPositions[index],
          rotation: newPositions[index].rotation + deltaAngle
        }
        return newPositions
      })
    }

    lastMousePosition.current = { x, y }
  }

  // Resize a single text element from one handle
  const resizeSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!resizeStartPosition) return

    const currentPosition = textType === 'subtitle'
      ? subtitlePositionFrame2
      : titlePositionsFrame2[textType === 'title1' ? 0 : 1]

    const centerX = currentPosition.x + currentPosition.width / 2
    const centerY = currentPosition.y + currentPosition.height / 2

    const startVector = {
      x: resizeStartPosition.x - centerX,
      y: resizeStartPosition.y - centerY
    }
    const currentVector = {
      x: x - centerX,
      y: y - centerY
    }

    const resizeSpeedFactor = 0.1
    let scale = 1

    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVector.x)
      const currentDist = Math.abs(currentVector.x)
      scale = startDist !== 0
        ? 1 + ((currentDist / startDist - 1) * resizeSpeedFactor)
        : 1
    } else if (handle.includes('n') || handle.includes('s')) {
      const startDist = Math.abs(startVector.y)
      const currentDist = Math.abs(currentVector.y)
      scale = startDist !== 0
        ? 1 + ((currentDist / startDist - 1) * resizeSpeedFactor)
        : 1
    }

    scale = Math.max(0.1, scale)

    const newWidth = currentPosition.width * scale
    const newHeight = currentPosition.height * scale
    const newX = centerX - newWidth / 2
    const newY = centerY - newHeight / 2

    const newPosition = {
      ...currentPosition,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      fontSize: currentPosition.fontSize * scale
    }

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPosition)
    } else {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]
        const index = textType === 'title1' ? 0 : 1
        newPositions[index] = newPosition
        return newPositions
      })
    }

    drawCanvas()
  }

  // Resize a group of selected texts uniformly
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

    const newWidth = initialGroupBox.width * scale
    const newHeight = initialGroupBox.height * scale
    const newX = centerX - newWidth / 2
    const newY = centerY - newHeight / 2

    const updatePosition = (position: TextPosition) => {
      const relX = (position.x - centerX) / (initialGroupBox.width / 2)
      const relY = (position.y - centerY) / (initialGroupBox.height / 2)
      return {
        ...position,
        x: centerX + relX * (newWidth / 2),
        y: centerY + relY * (newHeight / 2),
        width: position.width * scale,
        height: position.height * scale,
        fontSize: position.fontSize * scale
      }
    }

    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) =>
        selectedTexts.includes(idx === 0 ? 'title1' : 'title2')
          ? updatePosition(pos)
          : pos
      )
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePosition(prev))
    }

    setInitialGroupBox({ x: newX, y: newY, width: newWidth, height: newHeight, rotation: initialGroupBox.rotation })
    drawCanvas()
  }

  // Rotate a group of selected texts around the group’s center
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
      prev.map((pos, idx) => {
        const key = idx === 0 ? 'title1' : 'title2'
        if (selectedTexts.includes(key)) {
          setLastKnownRotations(r => ({ ...r, [key]: pos.rotation + deltaAngle }))
          return rotateAroundPoint(pos, centerX, centerY, deltaAngle)
        }
        return pos
      })
    )

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const newPos = rotateAroundPoint(prev, centerX, centerY, deltaAngle)
        setLastKnownRotations(r => ({ ...r, subtitle: newPos.rotation }))
        return newPos
      })
    }

    setGroupRotation(prev => {
      const newR = prev + deltaAngle
      setLastKnownRotations(r => ({ ...r, group: newR }))
      return newR
    })

    lastMousePosition.current = { x, y }
  }

  // Rotate a single position around a given center
  const rotateAroundPoint = (position: TextPosition, centerX: number, centerY: number, angle: number): TextPosition => {
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
      rotation: position.rotation + angle
    }
  }

  // Mouse up: finalize any drawing/drag/resize/rotate
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
    if (!isRotating) {
      setPaperRect(null)
    }
    drawCanvas()
  }

  // Handle click/drag on canvas for text or lines
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

    // Check if clicking any text box first
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))) {
        handleTextInteraction(pos, `title${i + 1}` as 'title1' | 'title2', x, y)
        return
      }
    }
    if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePos))) {
      handleTextInteraction(subtitlePos, 'subtitle', x, y)
      return
    }

    // If no text interaction, begin drawing or editing lines
    if (!isShiftPressed.current) {
      setSelectedTexts([])
      setGroupRotation(0)
    }

    const clickedLineIndex = lines.findIndex(line =>
      line.frame === currentFrame &&
      (isPointNear({ x, y }, line) || isPointNear({ x, y }, line.start) || isPointNear({ x, y }, line.end))
    )

    if (clickedLineIndex !== -1) {
      setEditingLineIndex(clickedLineIndex)
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
    }
    drawCanvas()
  }

  // Update cursor shape and handle dragging / resizing / rotating
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // If text(s) selected and frame 2, handle transforms
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
          const textType = selectedTexts[0]
          const pos = textType === 'subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[textType === 'title1' ? 0 : 1]
          resizeSingle(x, y, pos, textType, resizeHandle)
        } else {
          resizeGroup(x, y, resizeHandle)
        }
      }
      drawCanvas()
    }
    // Else if drawing a new line
    else if (currentLine) {
      setCurrentLine(prev => ({
        ...prev!,
        end: { x, y }
      }))
      drawCanvas()
    }
    // Else if editing an existing line
    else if (editingLineIndex !== null) {
      setLines(prev => {
        const newLines = [...prev]
        const editedLine = { ...newLines[editingLineIndex] }
        if (isPointNear({ x, y }, editedLine.start)) {
          editedLine.start = { x, y }
        } else if (isPointNear({ x, y }, editedLine.end)) {
          editedLine.end = { x, y }
        }
        newLines[editingLineIndex] = editedLine
        return newLines
      })
      drawCanvas()
    }

    updateCursor(canvas, x, y)
  }

  // Helper to decide which cursor icon to show
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

  // Check if a point is near the rotation area of a TextPosition or GroupBoundingBox
  const isPointNearRotationArea = (x: number, y: number, position: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20
    const rotationAreaSize = 15
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const rotation = position.rotation
    const halfWidth = position.width / 2
    const halfHeight = position.height / 2

    const dx = x - centerX
    const dy = y - centerY
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)

    const corners = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth,  y: -halfHeight },
      { x: halfWidth,  y: halfHeight },
      { x: -halfWidth, y: halfHeight }
    ]

    for (const corner of corners) {
      const dist = Math.sqrt(
        Math.pow(rotatedX - corner.x, 2) +
        Math.pow(rotatedY - corner.y, 2)
      )
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotationAreaSize) {
        return true
      }
    }
    return false
  }

  // Determine which resize handle (if any) is under point (x,y)
  const getResizeHandle = (x: number, y: number, position: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 20
    const centerX = position.x + position.width / 2
    const centerY = position.y + position.height / 2
    const rotation = position.rotation
    const dx = x - centerX
    const dy = y - centerY
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation)

    const halfWidth = position.width / 2
    const halfHeight = position.height / 2

    if (Math.abs(rotatedX + halfWidth) <= handleSize / 2 && Math.abs(rotatedY + halfHeight) <= handleSize / 2) return 'nw-resize'
    if (Math.abs(rotatedX - halfWidth) <= handleSize / 2 && Math.abs(rotatedY + halfHeight) <= handleSize / 2) return 'ne-resize'
    if (Math.abs(rotatedX - halfWidth) <= handleSize / 2 && Math.abs(rotatedY - halfHeight) <= handleSize / 2) return 'se-resize'
    if (Math.abs(rotatedX + halfWidth) <= handleSize / 2 && Math.abs(rotatedY - halfHeight) <= handleSize / 2) return 'sw-resize'

    if (Math.abs(rotatedX) < halfWidth && Math.abs(rotatedY) < halfHeight) return 'move'
    return null
  }

  // Check if a point is inside a rotated polygon
  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x, yi = box[i].y
      const xj = box[j].x, yj = box[j].y
      const intersect = ((yi > y) !== (yj > y)) &&
                        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  // Main animation loop
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
    }

    const elapsedTime = timestamp - startTimeRef.current
    const localSpeed = animationSpeed
    let progress = elapsedTime * localSpeed

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

  // Handle frame switch (Frame 1 / Frame 2)
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(prev => !prev)
  }

  // Toggle looping
  const toggleLoop = () => {
    setIsLooping(prev => !prev)
  }

  // Export functionality stub
  const handleExport = () => {
    console.log("Export functionality not implemented yet")
  }

  // Update an object's position/rotation from the popup modal
  const updatePosition = (newPosition: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]
        selectedTexts.forEach(selectedText => {
          if (selectedText === 'title1' || selectedText === 'title2') {
            const idx = selectedText === 'title1' ? 0 : 1
            newPositions[idx] = newPosition
          }
        })
        return newPositions
      })
    }
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(newPosition)
    }
    setPositionModalOpen(false)
    drawCanvas()
  }

  // Handle slider changes in the Settings dialog
  const handleSettingsChange = (name: string, value: number) => {
    switch (name) {
      case 'tremblingIntensity':
        setTremblingIntensity(value)
        drawCanvas()
        break
      // You can add more settings here
    }
  }

  // Initial setup: handle Shift key tracking
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

  // Redraw canvas whenever certain state changes occur
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

  // Start/stop animation loop when isPlaying changes
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
  }, [isPlaying, animationSpeed, isLooping])

  // Measure text widths/heights for bounding boxes
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
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => {
        const { width, height } = measureText(titles[idx], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )

    const { width: sW, height: sH } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const sAspect = sW / sH
    setSubtitlePositionFrame1(prev => ({
      ...prev,
      width: sW,
      height: sH,
      aspectRatio: sAspect
    }))
    setSubtitlePositionFrame2(prev => ({
      ...prev,
      width: sW,
      height: sH,
      aspectRatio: sAspect
    }))
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
              {colorOptions.map((color) => (
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

      {/* Position / Rotation Popup */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position & Rotation</DialogTitle>
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
                  onChange={(e) => setEditingPosition({ ...editingPosition, rotation: Number(e.target.value) * (Math.PI / 180) })}
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)}>Update</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Popup */}
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
                onValueChange={(value) => setLineThickness(value[0])}
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
                onValueChange={(value) => setAnimationSpeed(value[0])}
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
                onValueChange={(value) => setStaggerDelay(value[0])}
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
                onValueChange={(value) => handleSettingsChange('tremblingIntensity', value[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
