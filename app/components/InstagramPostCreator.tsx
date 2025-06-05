// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Stage, Layer, Line as KonvaLine, Text as KonvaText } from 'react-konva'
import Konva from 'konva'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────────

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
  aspectRatio?: number
}

interface GroupBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

interface RigidBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  centerX: number
  centerY: number
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────────

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

// Preset maximums
const MAX_LINE_THICKNESS = 10
const MIN_LINE_THICKNESS = 1
const MIN_FRAME_RATE = 10
const BASE_FPS = 60

// Ease In-Out Quint easing function (piecewise)
const easeInOutQuint = (t: number): number => {
  if (t < 0.5) {
    return 16 * Math.pow(t, 5)
  } else {
    return 1 - Math.pow(-2 * t + 2, 5) / 2
  }
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────────

export default function InstagramPostCreator() {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
  const [isDrawingLine, setIsDrawingLine] = useState(false)
  const [isDraggingLine, setIsDraggingLine] = useState(false)

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
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number | null>(null)

  // Preset values for animation controls
  const [lineThickness, setLineThickness] = useState<number>(MAX_LINE_THICKNESS)       // 10
  const [tremblingIntensity, setTremblingIntensity] = useState<number>(3)             // preset at 3
  const [frameRate, setFrameRate] = useState<number>(MIN_FRAME_RATE)                   // preset at 10
  const [baseFps, setBaseFps] = useState<number>(35)                                   // preset at 35

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)

  const [initialGroupState, setInitialGroupState] = useState<{
    box: GroupBoundingBox
    centerX: number
    centerY: number
  } | null>(null)

  // Ref's for animation and mouse tracking
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastDisplayTimeRef = useRef<number>(0)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)

  // ─── EFFECT HOOKS ───────────────────────────────────────────────────────────────
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
    if (!isPlaying) return
    startTimeRef.current = null
    lastDisplayTimeRef.current = 0
    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, isLooping])

  // ─── TEXT DIMENSION UPDATER ──────────────────────────────────────────────────────
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
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        const aspectRatio = width / height
        return { ...pos, width, height, aspectRatio }
      })
    )
    const { width: sw, height: sh } = measureText(subtitle, subtitlePositionFrame2.fontSize)
    const subAR = sw / sh
    setSubtitlePositionFrame1(prev => ({ ...prev, width: sw, height: sh, aspectRatio: subAR }))
    setSubtitlePositionFrame2(prev => ({ ...prev, width: sw, height: sh, aspectRatio: subAR }))
  }

  // ─── DRAWING ROUTINES ────────────────────────────────────────────────────────────
  const drawCanvas = (progress: number = 0) => {
    // We'll handle this differently with Konva
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    // Handled by KonvaText components now
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) => {
    // Handled by KonvaText components now
  }

  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    // Handled by KonvaLine components now
  }

  // ─── ANIMATION LOOP ─────────────────────────────────────────────────────────────
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current

    const msPerBaseFrame = 1000 / baseFps
    const normalized = elapsed / (msPerBaseFrame * 150)
    let progress = normalized

    if (progress > 1.4) {
      if (isLooping) {
        startTimeRef.current = timestamp
        progress = 0
      } else {
        progress = 1.4
        setIsPlaying(false)
      }
    }

    if (timestamp - lastDisplayTimeRef.current >= 1000 / frameRate) {
      lastDisplayTimeRef.current = timestamp
    }

    if (isPlaying || isLooping) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }

  // ─── FRAME CONTROLS ─────────────────────────────────────────────────────────────
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
  }

  const togglePlay = () => setIsPlaying(prev => !prev)
  const toggleLoop = () => setIsLooping(prev => !prev)

  // ─── POSITION MODAL & SETTINGS HANDLERS ────────────────────────────────────────
  const updatePosition = (newPos: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev]
        selectedTexts.forEach(st => {
          const idx = st === 'title1' ? 0 : 1
          arr[idx] = newPos
        })
        return arr
      })
    }
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(newPos)
    }
    setPositionModalOpen(false)
  }

  const handleSettingsChange = (name: string, val: number) => {
    switch (name) {
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

  // ─── UTILITY ────────────────────────────────────────────────────────────────────
  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

  // ─── KONVA LINE DRAWING HANDLERS ─────────────────────────────────────────────────
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPlaying) return
    // If click lands on empty area (no KonvaLine), start a new line:
    if (e.target === e.currentTarget) {
      const pointer = e.currentTarget.getStage()!.getPointerPosition()!
      const x = pointer.x
      const y = pointer.y
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame })
      setEditingLineIndex(null)
      setIsDrawingLine(true)
    }
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPlaying) return
    const stage = e.currentTarget.getStage()!
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const x = pointer.x
    const y = pointer.y

    // While drawing a new line, update its "end" in real‐time
    if (isDrawingLine && currentLine) {
      setCurrentLine(prev => prev && { ...prev, end: { x, y } })
    }
  }

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPlaying) return

    // Finish drawing a new line
    if (isDrawingLine && currentLine) {
      setLines(prev => [...prev, currentLine])
      setCurrentLine(null)
      setIsDrawingLine(false)
    }
    setIsDraggingLine(false)
    setEditingLineIndex(null)
  }

  // When user drags an existing KonvaLine, update its two endpoints
  const handleKonvaLineDrag = (
    e: Konva.KonvaEventObject<DragEvent>,
    idx: number
  ) => {
    const node = e.target as Konva.Line
    // KonvaLine has an x/y offset relative to its original points. We read the delta:
    const dx = node.x()
    const dy = node.y()
    // Read its original "points" array, then translate them back onto stage
    const originalPoints = (node as any).attrs.points as number[] // [x1,y1,x2,y2]
    // Apply the delta and write back to state:
    const newStart = { x: originalPoints[0] + dx, y: originalPoints[1] + dy }
    const newEnd = { x: originalPoints[2] + dx, y: originalPoints[3] + dy }

    // Reset the Konva node's internal x/y to zero (so future drags are relative again).
    node.position({ x: 0, y: 0 })

    setLines(prev => {
      const arr = [...prev]
      arr[idx] = { ...arr[idx], start: newStart, end: newEnd }
      return arr
    })
    setIsDraggingLine(true)
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
            <Stage
              width={1080}
              height={1350}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              style={{ cursor: isDraggingLine || editingLineIndex !== null ? 'move' : 'crosshair' }}
            >
              <Layer>
                {/* Render all existing lines for the current frame */}
                {lines
                  .filter(l => l.frame === currentFrame)
                  .map((line, idx) => (
                    <KonvaLine
                      key={idx}
                      points={[
                        line.start.x,
                        line.start.y,
                        line.end.x,
                        line.end.y,
                      ]}
                      stroke={editingLineIndex === idx ? '#FF0000' : '#0000FF'}
                      strokeWidth={lineThickness}
                      lineCap="butt"
                      lineJoin="round"
                      draggable
                      onClick={() => {
                        setEditingLineIndex(idx)
                        setCurrentLine(null)
                      }}
                      onDragMove={e => handleKonvaLineDrag(e, idx)}
                    />
                  ))
                }

                {/* If user is currently drawing a brand‐new line, show that "rubber‐band" in-progress line */}
                {currentLine && (
                  <KonvaLine
                    points={[
                      currentLine.start.x,
                      currentLine.start.y,
                      currentLine.end.x,
                      currentLine.end.y,
                    ]}
                    stroke="#000000"
                    strokeWidth={lineThickness}
                    lineCap="butt"
                    lineJoin="round"
                  />
                )}

                {/* Draw text layers at fixed positions using KonvaText */}
                {currentFrame === 1 && (
                  <>
                    {titlePositionsFrame1.map((pos, i) => (
                      <KonvaText
                        key={`t1-${i}`}
                        x={pos.x}
                        y={pos.y}
                        rotation={(pos.rotation * 180) / Math.PI}
                        text={titles[i]}
                        fontSize={pos.fontSize}
                        fontStyle="bold"
                        fill={getContrastColor(backgroundColor)}
                        width={pos.width}
                        height={pos.height}
                        align="center"
                      />
                    ))}
                    <KonvaText
                      x={subtitlePositionFrame1.x}
                      y={subtitlePositionFrame1.y}
                      rotation={(subtitlePositionFrame1.rotation * 180) / Math.PI}
                      text={subtitle}
                      fontSize={subtitlePositionFrame1.fontSize}
                      fontStyle="bold"
                      fill={getContrastColor(backgroundColor)}
                      width={subtitlePositionFrame1.width}
                      height={subtitlePositionFrame1.height}
                      align="center"
                    />
                  </>
                )}
                {currentFrame === 2 && (
                  <>
                    {titlePositionsFrame2.map((pos, i) => (
                      <KonvaText
                        key={`t2-${i}`}
                        x={pos.x}
                        y={pos.y}
                        rotation={(pos.rotation * 180) / Math.PI}
                        text={titles[i]}
                        fontSize={pos.fontSize}
                        fontStyle="bold"
                        fill={getContrastColor(backgroundColor)}
                        width={pos.width}
                        height={pos.height}
                        align="center"
                      />
                    ))}
                    <KonvaText
                      x={subtitlePositionFrame2.x}
                      y={subtitlePositionFrame2.y}
                      rotation={(subtitlePositionFrame2.rotation * 180) / Math.PI}
                      text={subtitle}
                      fontSize={subtitlePositionFrame2.fontSize}
                      fontStyle="bold"
                      fill={getContrastColor(backgroundColor)}
                      width={subtitlePositionFrame2.width}
                      height={subtitlePositionFrame2.height}
                      align="center"
                    />
                  </>
                )}
              </Layer>
            </Stage>
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
                      fontSize: editingBaseFontSize * scale
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
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={value => handleSettingsChange('lineThickness', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="trembleSlider">Trembling Intensity</Label>
              <Slider
                id="trembleSlider"
                min={0}
                max={10}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={value => handleSettingsChange('tremblingIntensity', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="baseFpsSlider">Animation Speed (Base FPS: {baseFps})</Label>
              <Slider
                id="baseFpsSlider"
                min={10}
                max={120}
                step={1}
                value={[baseFps]}
                onValueChange={([v]) => {
                  const num = Number(v)
                  if (!isNaN(num)) setBaseFps(num)
                }}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate ({MIN_FRAME_RATE}–120)</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={([v]) => {
                  const num = Number(v)
                  if (!isNaN(num)) {
                    handleSettingsChange('frameRate', num)
                  }
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
