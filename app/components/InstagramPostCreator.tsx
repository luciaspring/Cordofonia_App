'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ─── TYPES ──────────────────────────────────────────────────────────────────────────
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
}

interface GroupBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────────────
const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

const MAX_LINE_THICKNESS = 10
const MIN_FRAME_RATE = 10

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────────────
function getContrastColor(bgColor: string): string {
  const r = parseInt(bgColor.slice(1, 3), 16)
  const g = parseInt(bgColor.slice(3, 5), 16)
  const b = parseInt(bgColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

function isPointInRotatedBox(x: number, y: number, box: Point[]): boolean {
  let inside = false
  for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
    const xi = box[i].x, yi = box[i].y
    const xj = box[j].x, yj = box[j].y
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function getRotatedBoundingBox(position: TextPosition): Point[] {
  const { x, y, width, height, rotation } = position
  const centerX = x + width / 2
  const centerY = y + height / 2
  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ]

  return corners.map(corner => {
    const rotatedX = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation)
    const rotatedY = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
    return { x: rotatedX + centerX, y: rotatedY + centerY }
  })
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────────
export default function InstagramPostCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Basic states
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [debug, setDebug] = useState('')

  // Text positions for both frames
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
  const [groupRotation, setGroupRotation] = useState(0)

  // Modal states
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number | null>(null)

  // Preset values for animation controls
  const [lineThickness, setLineThickness] = useState<number>(MAX_LINE_THICKNESS)       // 10
  const [tremblingIntensity, setTremblingIntensity] = useState<number>(3)             // preset at 3
  const [frameRate, setFrameRate] = useState<number>(MIN_FRAME_RATE)                   // preset at 10
  const [baseFps, setBaseFps] = useState<number>(35)                                   // preset at 35

  const [settingsOpen, setSettingsOpen] = useState(false)

  // Mouse interaction states
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)
  const currentLine = useRef<Line | null>(null)
  const editingLineIndex = useRef<number | null>(null)
  const isResizing = useRef(false)
  const isDragging = useRef(false)
  const isRotating = useRef(false)
  const resizeHandle = useRef<string | null>(null)
  const resizeStartPosition = useRef<Point | null>(null)
  const initialPosition = useRef<TextPosition | null>(null)
  const initialGroupBox = useRef<GroupBoundingBox | null>(null)

  // ─── EFFECTS ────────────────────────────────────────────────────────────────────────
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
    drawCanvas()
  }, [
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    lines,
    titlePositionsFrame1,
    titlePositionsFrame2,
    subtitlePositionFrame1,
    subtitlePositionFrame2,
    selectedTexts,
    groupRotation,
    lineThickness,
    tremblingIntensity,
    frameRate
  ])

  // ─── CANVAS DRAWING FUNCTIONS ──────────────────────────────────────────────────────
  const drawCanvas = useCallback((progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw based on current state
    if (isPlaying) {
      drawAnimatedSequence(ctx, progress)
    } else {
      drawStaticFrame(ctx)
    }

    setDebug(`Canvas rendered. Progress: ${progress.toFixed(2)}, Frame: ${currentFrame}, BG: ${backgroundColor}`)
  }, [backgroundColor, currentFrame, isPlaying, titles, subtitle, titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2, lines, selectedTexts, groupRotation, lineThickness, tremblingIntensity])

  const drawStaticFrame = (ctx: CanvasRenderingContext2D) => {
    drawStaticText(ctx, currentFrame)
    drawStaticLines(ctx)
    if (currentFrame === 2) {
      drawSelectionIndicators(ctx)
    }
  }

  const drawAnimatedSequence = (ctx: CanvasRenderingContext2D, progress: number) => {
    const frame1Lines = lines.filter(line => line.frame === 1)
    const frame2Lines = lines.filter(line => line.frame === 2)

    // Animation sequence with proper timing
    if (progress <= 0.3) {
      // Phase 1: Frame 1 text + lines growing
      drawStaticText(ctx, 1)
      drawAnimatedLines(ctx, progress / 0.3, frame1Lines, 'grow')
    } else if (progress <= 0.6) {
      // Phase 2: Frame 1 text + lines shrinking
      drawStaticText(ctx, 1)
      drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, 'shrink')
    } else if (progress <= 0.7) {
      // Phase 3: Text transition
      const t = (progress - 0.6) / 0.1
      drawTransitionText(ctx, t)
    } else if (progress <= 1.0) {
      // Phase 4: Frame 2 text + lines growing
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (progress - 0.7) / 0.3, frame2Lines, 'grow')
    } else if (progress <= 1.3) {
      // Phase 5: Frame 2 text + lines shrinking
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (progress - 1.0) / 0.3, frame2Lines, 'shrink')
    } else if (progress <= 1.4) {
      // Phase 6: Text transition back
      const t = (progress - 1.3) / 0.1
      drawTransitionText(ctx, 1 - t)
    }
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'top'

    const titlePositions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subtitlePosition = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    // Draw titles
    titles.forEach((title, index) => {
      if (titlePositions[index]) {
        const pos = titlePositions[index]
        ctx.save()
        ctx.translate(pos.x + pos.width / 2, pos.y + pos.height / 2)
        ctx.rotate(pos.rotation)
        ctx.font = `${pos.fontSize}px sans-serif`
        ctx.fillText(title, -pos.width / 2, -pos.height / 2)
        ctx.restore()
      }
    })

    // Draw subtitle
    ctx.save()
    ctx.translate(subtitlePosition.x + subtitlePosition.width / 2, subtitlePosition.y + subtitlePosition.height / 2)
    ctx.rotate(subtitlePosition.rotation)
    ctx.font = `${subtitlePosition.fontSize}px sans-serif`
    ctx.fillText(subtitle, -subtitlePosition.width / 2, -subtitlePosition.height / 2)
    ctx.restore()
  }

  const drawTransitionText = (ctx: CanvasRenderingContext2D, t: number) => {
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'top'

    // Interpolate between frame positions
    titles.forEach((title, index) => {
      const pos1 = titlePositionsFrame1[index]
      const pos2 = titlePositionsFrame2[index]
      if (pos1 && pos2) {
        const x = pos1.x + (pos2.x - pos1.x) * t
        const y = pos1.y + (pos2.y - pos1.y) * t
        const rotation = pos1.rotation + (pos2.rotation - pos1.rotation) * t
        const fontSize = pos1.fontSize + (pos2.fontSize - pos1.fontSize) * t

        ctx.save()
        ctx.translate(x + pos1.width / 2, y + pos1.height / 2)
        ctx.rotate(rotation)
        ctx.font = `${fontSize}px sans-serif`
        ctx.fillText(title, -pos1.width / 2, -pos1.height / 2)
        ctx.restore()
      }
    })

    // Interpolate subtitle
    const subPos1 = subtitlePositionFrame1
    const subPos2 = subtitlePositionFrame2
    const subX = subPos1.x + (subPos2.x - subPos1.x) * t
    const subY = subPos1.y + (subPos2.y - subPos1.y) * t
    const subRotation = subPos1.rotation + (subPos2.rotation - subPos1.rotation) * t
    const subFontSize = subPos1.fontSize + (subPos2.fontSize - subPos1.fontSize) * t

    ctx.save()
    ctx.translate(subX + subPos1.width / 2, subY + subPos1.height / 2)
    ctx.rotate(subRotation)
    ctx.font = `${subFontSize}px sans-serif`
    ctx.fillText(subtitle, -subPos1.width / 2, -subPos1.height / 2)
    ctx.restore()
  }

  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    t: number,
    linesToDraw: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.strokeStyle = getContrastColor(backgroundColor)

    const easeInOutQuint = (t: number): number => {
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
    }

    linesToDraw.forEach(line => {
      const easedT = easeInOutQuint(Math.max(0, Math.min(1, t)))
      const { start, end } = line
      
      let currentStart: Point
      let currentEnd: Point
      
      if (animationType === 'grow') {
        // Line grows from start to end
        currentStart = start
        currentEnd = {
          x: start.x + (end.x - start.x) * easedT,
          y: start.y + (end.y - start.y) * easedT
        }
      } else { // shrink
        // Line disappears from A to B (start moves toward end)
        currentStart = {
          x: start.x + (end.x - start.x) * easedT,
          y: start.y + (end.y - start.y) * easedT
        }
        currentEnd = end
      }
      
      // Apply trembling effect
      const tremX = (Math.random() - 0.5) * tremblingIntensity
      const tremY = (Math.random() - 0.5) * tremblingIntensity
      
      ctx.beginPath()
      ctx.moveTo(currentStart.x + tremX, currentStart.y + tremY)
      ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
      ctx.stroke()
    })
  }

  const drawStaticLines = (ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = lineThickness
    ctx.strokeStyle = getContrastColor(backgroundColor)

    lines.forEach(line => {
      if (line.frame === currentFrame) {
        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity
        ctx.beginPath()
        ctx.moveTo(line.start.x + tremX, line.start.y + tremY)
        ctx.lineTo(line.end.x + tremX, line.end.y + tremY)
        ctx.stroke()
      }
    })
  }

  const drawSelectionIndicators = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#0066ff'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])

    selectedTexts.forEach(selectedText => {
      let position: TextPosition
      if (selectedText === 'subtitle') {
        position = subtitlePositionFrame2
      } else {
        const index = selectedText === 'title1' ? 0 : 1
        position = titlePositionsFrame2[index]
      }

      const box = getRotatedBoundingBox(position)
      ctx.beginPath()
      ctx.moveTo(box[0].x, box[0].y)
      for (let i = 1; i < box.length; i++) {
        ctx.lineTo(box[i].x, box[i].y)
      }
      ctx.closePath()
      ctx.stroke()
    })

    ctx.setLineDash([])
  }

  // ─── MOUSE INTERACTION FUNCTIONS ───────────────────────────────────────────────────
  const isPointInText = useCallback((x: number, y: number): ('title1' | 'title2' | 'subtitle') | null => {
    if (currentFrame !== 2) return null

    const canvas = canvasRef.current
    if (!canvas) return null
    
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    const scaledX = x * scaleX
    const scaledY = y * scaleY

    // Check titles first
    for (let i = 0; i < titlePositionsFrame2.length; i++) {
      const box = getRotatedBoundingBox(titlePositionsFrame2[i])
      if (isPointInRotatedBox(scaledX, scaledY, box)) {
        return i === 0 ? 'title1' : 'title2'
      }
    }

    // Check subtitle
    const subtitleBox = getRotatedBoundingBox(subtitlePositionFrame2)
    if (isPointInRotatedBox(scaledX, scaledY, subtitleBox)) {
      return 'subtitle'
    }

    return null
  }, [currentFrame, titlePositionsFrame2, subtitlePositionFrame2])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const currentTime = Date.now()
    const isDoubleClick = currentTime - lastClickTime.current <= 300

    if (currentFrame === 1) {
      // Frame 1: Line drawing mode
      const scaleX = canvas.width / canvas.offsetWidth
      const scaleY = canvas.height / canvas.offsetHeight
      const scaledX = x * scaleX
      const scaledY = y * scaleY

      if (isShiftPressed.current) {
        // Edit existing line
        const clickedLineIndex = lines.findIndex((line, index) => {
          if (line.frame !== 1) return false
          const distToStart = Math.sqrt(Math.pow(line.start.x - scaledX, 2) + Math.pow(line.start.y - scaledY, 2))
          const distToEnd = Math.sqrt(Math.pow(line.end.x - scaledX, 2) + Math.pow(line.end.y - scaledY, 2))
          return distToStart < 20 || distToEnd < 20
        })

        if (clickedLineIndex !== -1) {
          editingLineIndex.current = clickedLineIndex
          const line = lines[clickedLineIndex]
          const distToStart = Math.sqrt(Math.pow(line.start.x - scaledX, 2) + Math.pow(line.start.y - scaledY, 2))
          const distToEnd = Math.sqrt(Math.pow(line.end.x - scaledX, 2) + Math.pow(line.end.y - scaledY, 2))
          
          currentLine.current = {
            start: distToStart < distToEnd ? line.end : line.start,
            end: { x: scaledX, y: scaledY },
            frame: 1
          }
        }
      } else {
        // Start new line
        currentLine.current = {
          start: { x: scaledX, y: scaledY },
          end: { x: scaledX, y: scaledY },
          frame: 1
        }
      }
    } else if (currentFrame === 2) {
      // Frame 2: Text manipulation mode
      const clickedText = isPointInText(x, y)

      if (isDoubleClick && clickedText) {
        setSelectedTexts([clickedText])
        
        let position: TextPosition
        let baseFontSize: number
        if (clickedText === 'subtitle') {
          position = subtitlePositionFrame2
          baseFontSize = subtitlePositionFrame1.fontSize
        } else {
          const index = clickedText === 'title1' ? 0 : 1
          position = titlePositionsFrame2[index]
          baseFontSize = titlePositionsFrame1[index].fontSize
        }
        
        setEditingPosition(position)
        setEditingBaseFontSize(baseFontSize)
        setPositionModalOpen(true)
        lastClickTime.current = 0
        return
      }

      lastClickTime.current = currentTime

      if (clickedText) {
        setSelectedTexts([clickedText])
        isDragging.current = true
      } else {
        setSelectedTexts([])
      }
    }

    lastMousePosition.current = { x, y }
  }, [currentFrame, isPointInText, lines, titlePositionsFrame2, subtitlePositionFrame2, titlePositionsFrame1, subtitlePositionFrame1])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !lastMousePosition.current) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (currentFrame === 1 && currentLine.current) {
      // Update line drawing
      const scaleX = canvas.width / canvas.offsetWidth
      const scaleY = canvas.height / canvas.offsetHeight
      const scaledX = x * scaleX
      const scaledY = y * scaleY

      currentLine.current.end = { x: scaledX, y: scaledY }
      drawCanvas()
    } else if (currentFrame === 2 && isDragging.current && selectedTexts.length > 0) {
      // Drag selected text
      const scaleX = canvas.width / canvas.offsetWidth
      const scaleY = canvas.height / canvas.offsetHeight
      const dx = (x - lastMousePosition.current.x) * scaleX
      const dy = (y - lastMousePosition.current.y) * scaleY

      selectedTexts.forEach(selectedText => {
        if (selectedText === 'subtitle') {
          setSubtitlePositionFrame2(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
          }))
        } else {
          const index = selectedText === 'title1' ? 0 : 1
          setTitlePositionsFrame2(prev => {
            const newPositions = [...prev]
            newPositions[index] = {
              ...newPositions[index],
              x: newPositions[index].x + dx,
              y: newPositions[index].y + dy
            }
            return newPositions
          })
        }
      })

      drawCanvas()
    }

    lastMousePosition.current = { x, y }
  }, [currentFrame, selectedTexts, drawCanvas])

  const handleMouseUp = useCallback(() => {
    if (currentFrame === 1 && currentLine.current) {
      if (editingLineIndex.current !== null) {
        // Update existing line
        setLines(prev => {
          const newLines = [...prev]
          newLines[editingLineIndex.current!] = currentLine.current!
          return newLines
        })
        editingLineIndex.current = null
      } else {
        // Add new line
        setLines(prev => [...prev, currentLine.current!])
      }
      currentLine.current = null
    }

    lastMousePosition.current = null
    isResizing.current = false
    isDragging.current = false
    isRotating.current = false
    resizeHandle.current = null
    resizeStartPosition.current = null
    initialPosition.current = null
    initialGroupBox.current = null
  }, [currentFrame])

  // ─── ANIMATION FUNCTIONS ───────────────────────────────────────────────────────────
  const startAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      
      // Use baseFps for internal timing
      const msPerBaseFrame = 1000 / baseFps
      const normalized = elapsed / (msPerBaseFrame * 150) // same cycle length as before
      let progress = normalized
      if (progress > 1.4) {
        if (isLooping) {
          // Restart animation
          startAnimation()
          return
        } else {
          // Stop animation
          setIsPlaying(false)
          drawCanvas()
          return
        }
      }

      // Apply frame rate throttling
      const frameInterval = 1000 / frameRate
      const shouldRender = elapsed % frameInterval < 16 // roughly 60fps check

      if (shouldRender) {
        drawCanvas(progress)
      }

      // Always continue bouncing the loop, even if not currently drawing
      if (isPlaying || isLooping) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // Ensure final static frame draws once
        drawCanvas()
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [baseFps, frameRate, isLooping, isPlaying, drawCanvas])

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => {
      const newPlaying = !prev
      if (newPlaying) {
        startAnimation()
      } else if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return newPlaying
    })
  }, [startAnimation])

  const toggleLoop = useCallback(() => {
    setIsLooping(prev => !prev)
  }, [])

  // ─── UI EVENT HANDLERS ─────────────────────────────────────────────────────────────
  const handleFrameChange = useCallback((frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
  }, [])

  const updatePosition = useCallback((newPosition: TextPosition) => {
    if (!editingBaseFontSize) return

    const scaleFactor = newPosition.fontSize / editingBaseFontSize
    const scaledPosition = {
      ...newPosition,
      width: newPosition.width * scaleFactor,
      height: newPosition.height * scaleFactor
    }

    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]
        selectedTexts.forEach(selectedText => {
          if (selectedText === 'title1' || selectedText === 'title2') {
            const index = selectedText === 'title1' ? 0 : 1
            newPositions[index] = scaledPosition
          }
        })
        return newPositions
      })
    }
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(scaledPosition)
    }
    setPositionModalOpen(false)
    drawCanvas()
  }, [selectedTexts, editingBaseFontSize, drawCanvas])

  const handleSliderChange = useCallback((type: string, val: number) => {
    switch (type) {
      case 'lineThickness':
        setLineThickness(val)
        break
      case 'tremblingIntensity':
        setTremblingIntensity(val)
        break
      case 'baseFps':
        setBaseFps(val)
        break
      case 'frameRate':
        setFrameRate(val)
        // Throttling happening inside animate; no need to restart loop
        break
    }
  }, [])

  // ─── CLEANUP ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // ─── JSX ────────────────────────────────────────────────────────────────────────────
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
            <Button onClick={() => console.log("Export functionality not implemented")} className="w-[40px] h-[40px] p-0 rounded bg-black">
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
                <Label htmlFor="fontSize">Font Size</Label>
                <Input
                  id="fontSize"
                  type="number"
                  value={editingPosition.fontSize}
                  onChange={e => {
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: Number(e.target.value)
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
                max={MAX_LINE_THICKNESS}
                step={1}
                value={[lineThickness]}
                onValueChange={val => handleSliderChange('lineThickness', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="tremblingSlider">Trembling Intensity</Label>
              <Slider
                id="tremblingSlider"
                min={0}
                max={10}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={val => handleSliderChange('tremblingIntensity', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="baseFpsSlider">Animation Speed (Base FPS: {baseFps})</Label>
              <Slider
                id="baseFpsSlider"
                min={10}
                max={60}
                step={5}
                value={[baseFps]}
                onValueChange={val => handleSliderChange('baseFps', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate Throttle ({frameRate} FPS)</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE}
                max={60}
                step={5}
                value={[frameRate]}
                onValueChange={val => handleSliderChange('frameRate', val[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}