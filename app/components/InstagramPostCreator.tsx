// app/components/InstagramPostCreator.tsx
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

const MIN_FRAME_RATE = 10
const MAX_FRAME_RATE = 60
const MIN_LINE_THICKNESS = 1
const MAX_LINE_THICKNESS = 10
const MIN_TREMBLING = 0
const MAX_TREMBLING = 10
const MIN_BASE_FPS = 10
const MAX_BASE_FPS = 60

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────────
export default function InstagramPostCreator() {
  // ─── CANVAS REF ─────────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // ─── BASIC STATE ────────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [debug, setDebug] = useState('')

  // ─── LINES STATE ────────────────────────────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>([])

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

  // ─── ANIMATION CONTROLS ─────────────────────────────────────────────────────────────

  // Preset values for animation controls
  const [lineThickness, setLineThickness] = useState<number>(MAX_LINE_THICKNESS)       // 10
  const [tremblingIntensity, setTremblingIntensity] = useState<number>(3)             // preset at 3
  const [frameRate, setFrameRate] = useState<number>(MIN_FRAME_RATE)                   // preset at 10
  const [baseFps, setBaseFps] = useState<number>(35)                                   // preset at 35

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number | null>(null)

  // ─── MOUSE INTERACTION STATE ───────────────────────────────────────────────────────
  const [lastMousePosition, setLastMousePosition] = useState<Point | null>(null)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)
  const [initialPosition, setInitialPosition] = useState<TextPosition | null>(null)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)

  // ─── FONT LOADING ───────────────────────────────────────────────────────────────────
  const [fontLoaded, setFontLoaded] = useState(false)

  useEffect(() => {
    const loadFont = async () => {
      try {
        const sulSansFont = new FontFace('SulSans-Bold', 'url(/fonts/SulSans-Bold.otf)')
        const font = await sulSansFont.load()
        document.fonts.add(font)
        setFontLoaded(true)
        console.log('SulSans-Bold font loaded successfully')
      } catch (error) {
        console.error('Error loading SulSans-Bold font:', error)
      }
    }
    loadFont()
  }, [])

  // ─── REDRAW CANVAS WHEN STATE CHANGES ──────────────────────────────────────────────
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

  // ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────────
  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
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

  const getRotatedBoundingBox = (position: TextPosition): Point[] => {
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

  const getRotatedGroupBoundingBox = (groupBox: GroupBoundingBox): Point[] => {
    const { x, y, width, height, rotation } = groupBox
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

  // ─── DRAWING FUNCTIONS ─────────────────────────────────────────────────────────────
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

    // Draw animated content if playing
    if (isPlaying && progress > 0) {
      drawAnimatedContent(ctx, progress)
    } else {
      // Draw static content
      drawStaticContent(ctx)
    }

    setDebug(`Canvas rendered. Progress: ${progress.toFixed(2)}, Frame: ${currentFrame}, BG: ${backgroundColor}`)
  }, [backgroundColor, currentFrame, isPlaying, titles, subtitle, titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2, lines, lineThickness, tremblingIntensity, fontLoaded])

  const drawAnimatedContent = (ctx: CanvasRenderingContext2D, progress: number) => {
    const frame1Lines = lines.filter(line => line.frame === 1)
    const frame2Lines = lines.filter(line => line.frame === 2)

    // Animation sequence with 2-step text transition
    if (progress <= 0.3) {
      drawStaticText(ctx, 1)
      drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
    } else if (progress <= 0.6) {
      drawStaticText(ctx, 1)
      drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
    } else if (progress <= 0.8) {
      // Step 1: Animate location only (0.6 to 0.8)
      const locationProgress = (progress - 0.6) / 0.2
      drawAnimatedText(ctx, locationProgress, 0) // 0 scale progress = no scale change
    } else if (progress <= 1.0) {
      // Step 2: Animate scale only (0.8 to 1.0)
      const scaleProgress = (progress - 0.8) / 0.2
      drawAnimatedText(ctx, 1, scaleProgress) // 1 location progress = full location change
    } else if (progress <= 1.3) {
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'grow')
    } else if (progress <= 1.6) {
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (progress - 1.3) / 0.3, [], frame2Lines, 'shrink')
    } else if (progress <= 1.8) {
      // Step 1: Animate location back (1.6 to 1.8)
      const locationProgress = (progress - 1.6) / 0.2
      drawAnimatedText(ctx, 1 - locationProgress, 1) // Reverse location, keep scale
    } else if (progress <= 2.0) {
      // Step 2: Animate scale back (1.8 to 2.0)
      const scaleProgress = (progress - 1.8) / 0.2
      drawAnimatedText(ctx, 0, 1 - scaleProgress) // No location change, reverse scale
    }
  }

  const drawStaticContent = (ctx: CanvasRenderingContext2D) => {
    drawStaticText(ctx, currentFrame)
    drawStaticLines(ctx)
    drawSelectionBoxes(ctx)
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'top'

    const titlePositions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subtitlePosition = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    // Draw titles
    titles.forEach((title, index) => {
      if (title && titlePositions[index]) {
        const pos = titlePositions[index]
        ctx.save()
        ctx.translate(pos.x + pos.width / 2, pos.y + pos.height / 2)
        ctx.rotate(pos.rotation)
        ctx.font = `${pos.fontSize}px ${fontLoaded ? 'SulSans-Bold' : 'sans-serif'}`
        ctx.fillText(title, -pos.width / 2, -pos.height / 2)
        ctx.restore()
      }
    })

    // Draw subtitle
    if (subtitle && subtitlePosition) {
      ctx.save()
      ctx.translate(subtitlePosition.x + subtitlePosition.width / 2, subtitlePosition.y + subtitlePosition.height / 2)
      ctx.rotate(subtitlePosition.rotation)
      ctx.font = `${subtitlePosition.fontSize}px ${fontLoaded ? 'SulSans-Bold' : 'sans-serif'}`
      ctx.fillText(subtitle, -subtitlePosition.width / 2, -subtitlePosition.height / 2)
      ctx.restore()
    }
  }

  const drawAnimatedText = (ctx: CanvasRenderingContext2D, locationProgress: number, scaleProgress: number) => {
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'top'

    // Easing function
    const easeInOutQuint = (t: number): number => {
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
    }

    const easedLocationProgress = easeInOutQuint(locationProgress)
    const easedScaleProgress = easeInOutQuint(scaleProgress)

    // Draw titles
    titles.forEach((title, index) => {
      if (title && titlePositionsFrame1[index] && titlePositionsFrame2[index]) {
        const pos1 = titlePositionsFrame1[index]
        const pos2 = titlePositionsFrame2[index]
        
        // Interpolate position
        const x = pos1.x + (pos2.x - pos1.x) * easedLocationProgress
        const y = pos1.y + (pos2.y - pos1.y) * easedLocationProgress
        const rotation = pos1.rotation + (pos2.rotation - pos1.rotation) * easedLocationProgress
        
        // Interpolate scale
        const fontSize = pos1.fontSize + (pos2.fontSize - pos1.fontSize) * easedScaleProgress
        const width = pos1.width + (pos2.width - pos1.width) * easedScaleProgress
        const height = pos1.height + (pos2.height - pos1.height) * easedScaleProgress
        
        ctx.save()
        ctx.translate(x + width / 2, y + height / 2)
        ctx.rotate(rotation)
        ctx.font = `${fontSize}px ${fontLoaded ? 'SulSans-Bold' : 'sans-serif'}`
        ctx.fillText(title, -width / 2, -height / 2)
        ctx.restore()
      }
    })

    // Draw subtitle
    if (subtitle && subtitlePositionFrame1 && subtitlePositionFrame2) {
      const pos1 = subtitlePositionFrame1
      const pos2 = subtitlePositionFrame2
      
      // Interpolate position
      const x = pos1.x + (pos2.x - pos1.x) * easedLocationProgress
      const y = pos1.y + (pos2.y - pos1.y) * easedLocationProgress
      const rotation = pos1.rotation + (pos2.rotation - pos1.rotation) * easedLocationProgress
      
      // Interpolate scale
      const fontSize = pos1.fontSize + (pos2.fontSize - pos1.fontSize) * easedScaleProgress
      const width = pos1.width + (pos2.width - pos1.width) * easedScaleProgress
      const height = pos1.height + (pos2.height - pos1.height) * easedScaleProgress
      
      ctx.save()
      ctx.translate(x + width / 2, y + height / 2)
      ctx.rotate(rotation)
      ctx.font = `${fontSize}px ${fontLoaded ? 'SulSans-Bold' : 'sans-serif'}`
      ctx.fillText(subtitle, -width / 2, -height / 2)
      ctx.restore()
    }
  }

  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    t: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.strokeStyle = getContrastColor(backgroundColor)

    const easeInOutQuint = (t: number): number => {
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
    }

    const linesToDraw = frame1Lines.length > 0 ? frame1Lines : frame2Lines

    linesToDraw.forEach((ln, index) => {
      const staggeredDelay = index * 0.1
      const adjustedT = Math.max(0, Math.min(1, (t - staggeredDelay) / (1 - staggeredDelay)))
      
      if (adjustedT > 0) {
        t = easeInOutQuint(adjustedT)
        const { start, end } = ln
        let currentStart, currentEnd

        if (animationType === 'grow') { // grow - point A is fixed, point B moves
          currentStart = start
          currentEnd = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          }
        } else { // shrink - point A moves toward point B
          currentStart = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          }
          currentEnd = end
        }

        const tremX = (Math.random() - 0.5) * tremblingIntensity
        const tremY = (Math.random() - 0.5) * tremblingIntensity

        ctx.beginPath()
        ctx.moveTo(currentStart.x + tremX, currentStart.y + tremY)
        ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
        ctx.stroke()
      }
    })
  }

  const drawStaticLines = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = getContrastColor(backgroundColor)
    ctx.lineWidth = lineThickness

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

  const drawSelectionBoxes = (ctx: CanvasRenderingContext2D) => {
    if (currentFrame !== 2 || selectedTexts.length === 0) return

    ctx.strokeStyle = '#007bff'
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

      if (position) {
        const box = getRotatedBoundingBox(position)
        ctx.beginPath()
        ctx.moveTo(box[0].x, box[0].y)
        for (let i = 1; i < box.length; i++) {
          ctx.lineTo(box[i].x, box[i].y)
        }
        ctx.closePath()
        ctx.stroke()
      }
    })

    ctx.setLineDash([])
  }

  // ─── MOUSE INTERACTION FUNCTIONS ───────────────────────────────────────────────────
  const isPointInText = (x: number, y: number): ('title1' | 'title2' | 'subtitle') | null => {
    if (currentFrame !== 2) return null

    const canvas = canvasRef.current
    if (!canvas) return null
    
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    const scaledX = x * scaleX
    const scaledY = y * scaleY

    for (let i = 0; i < titlePositionsFrame2.length; i++) {
      const box = getRotatedBoundingBox(titlePositionsFrame2[i])
      if (isPointInRotatedBox(scaledX, scaledY, box)) {
        return i === 0 ? 'title1' : 'title2'
      }
    }

    const subtitleBox = getRotatedBoundingBox(subtitlePositionFrame2)
    if (isPointInRotatedBox(scaledX, scaledY, subtitleBox)) {
      return 'subtitle'
    }

    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const currentTime = Date.now()
    const isDoubleClick = currentTime - lastClickTime <= 300

    const clickedText = isPointInText(x, y)

    if (isDoubleClick && clickedText) {
      setSelectedTexts([clickedText])
      setPositionModalOpen(true)
      setLastClickTime(0)
      return
    }

    setLastClickTime(currentTime)
    setLastMousePosition({ x, y })

    if (clickedText) {
      setSelectedTexts([clickedText])
      setIsDragging(true)
    } else {
      setSelectedTexts([])
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !lastMousePosition || currentFrame !== 2) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isDragging && selectedTexts.length > 0) {
      const scaleX = canvas.width / canvas.offsetWidth
      const scaleY = canvas.height / canvas.offsetHeight
      const dx = (x - lastMousePosition.x) * scaleX
      const dy = (y - lastMousePosition.y) * scaleY

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

    setLastMousePosition({ x, y })
  }

  const handleMouseUp = () => {
    setLastMousePosition(null)
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)
    setResizeStartPosition(null)
    setInitialPosition(null)
    setInitialGroupBox(null)
  }

  // ─── ANIMATION CONTROL FUNCTIONS ───────────────────────────────────────────────────
  const togglePlay = () => {
    setIsPlaying(!isPlaying)
    if (!isPlaying) {
      startAnimation()
    } else {
      stopAnimation()
    }
  }

  const toggleLoop = () => {
    setIsLooping(!isLooping)
  }

  const startAnimation = () => {
    if (animationRef.current) return

    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      
      // Throttle based on frameRate
      const msPerFrame = 1000 / frameRate
      if (elapsed % msPerFrame > msPerFrame / 2) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Use baseFps for internal timing
      const msPerBaseFrame = 1000 / baseFps
      const normalized = elapsed / (msPerBaseFrame * 150) // Extended cycle length for 2-step animation
      let progress = normalized
      if (progress > 2.0) { // Extended to 2.0 for longer cycle
        if (isLooping) {
          startAnimation()
          return
        } else {
          setIsPlaying(false)
          drawCanvas()
          return
        }
      }

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

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  useEffect(() => {
    if (isPlaying) {
      startAnimation()
    } else {
      stopAnimation()
    }
    return () => stopAnimation()
  }, [isPlaying, isLooping, frameRate, baseFps])

  // ─── FRAME CONTROL FUNCTIONS ───────────────────────────────────────────────────────
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
  }

  // ─── SETTINGS CONTROL FUNCTIONS ────────────────────────────────────────────────────
  const handleSliderChange = (type: string, val: number) => {
    switch (type) {
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
  }

  // ─── POSITION MODAL FUNCTIONS ──────────────────────────────────────────────────────
  const updatePosition = (newPosition: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]
        selectedTexts.forEach(selectedText => {
          if (selectedText === 'title1' || selectedText === 'title2') {
            const index = selectedText === 'title1' ? 0 : 1
            newPositions[index] = newPosition
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
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  value={Math.round((editingPosition.fontSize / editingBaseFontSize) * 100)}
                  onChange={e => {
                    const scale = Number(e.target.value) / 100
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: editingBaseFontSize * scale,
                      width: (editingPosition.width / (editingPosition.fontSize / editingBaseFontSize)) * scale,
                      height: (editingPosition.height / (editingPosition.fontSize / editingBaseFontSize)) * scale
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
                min={MIN_LINE_THICKNESS}
                max={MAX_LINE_THICKNESS}
                step={1}
                value={[lineThickness]}
                onValueChange={val => handleSliderChange('lineThickness', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="tremblingSlider">Trembling Intensity (max 10)</Label>
              <Slider
                id="tremblingSlider"
                min={MIN_TREMBLING}
                max={MAX_TREMBLING}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={val => handleSliderChange('tremblingIntensity', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="baseFpsSlider">Animation Speed (Base FPS: {baseFps})</Label>
              <Slider
                id="baseFpsSlider"
                min={MIN_BASE_FPS}
                max={MAX_BASE_FPS}
                step={1}
                value={[baseFps]}
                onValueChange={val => setBaseFps(val[0])}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate (FPS {frameRate})</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE}
                max={MAX_FRAME_RATE}
                step={1}
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