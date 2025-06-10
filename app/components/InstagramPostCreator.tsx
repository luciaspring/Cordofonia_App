// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────────

interface Point { x: number; y: number }
interface Line { start: Point; end: Point; frame: number }
interface TextPosition {
  x: number; y: number; width: number; height: number;
  rotation: number; fontSize: number; aspectRatio?: number
}
interface GroupBoundingBox {
  x: number; y: number; width: number; height: number; rotation: number
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────────

const colorOptions = [
  { name: 'Light Pink',   value: '#F6A69B' },
  { name: 'Light Blue',   value: '#5894D0' },
  { name: 'Olive Green',  value: '#5B6B4E' },
  { name: 'Orange',       value: '#FF6700' },
  { name: 'Gray',         value: '#6B6B6B' },
  { name: 'Purple',       value: '#E0B0FF' },
  { name: 'Mint Green',   value: '#D0EBDA' },
]

const MAX_LINE_THICKNESS = 10
const MIN_FRAME_RATE      = 10

const easeInOutQuint = (t: number): number =>
  t < 0.5
    ? 16 * Math.pow(t, 5)
    : 1 - Math.pow(-2 * t + 2, 5) / 2

// ─── COMPONENT ───────────────────────────────────────────────────────────────────

export default function InstagramPostCreator() {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [isLooping, setIsLooping]   = useState(false)
  const [lines, setLines]           = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line|null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number|null>(null)

  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width:1000, height:200, rotation:0, fontSize:180 },
    { x: 40, y: 550, width:1000, height:200, rotation:0, fontSize:180 },
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width:1000, height:200, rotation:0, fontSize:180 },
    { x: 40, y: 550, width:1000, height:200, rotation:0, fontSize:180 },
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>(
    { x: 40, y:1000, width:1000, height:30, rotation:0, fontSize:36 }
  )
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>(
    { x: 40, y:1000, width:1000, height:30, rotation:0, fontSize:36 }
  )

  const [selectedTexts, setSelectedTexts] = useState<('title1'|'title2'|'subtitle')[]>([])
  const [isResizing, setIsResizing]   = useState(false)
  const [isDragging, setIsDragging]   = useState(false)
  const [isRotating, setIsRotating]   = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string|null>(null)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point|null>(null)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox|null>(null)
  const [groupRotation, setGroupRotation]     = useState(0)

  // animation controls
  const [lineThickness, setLineThickness]           = useState<number>(MAX_LINE_THICKNESS)
  const [tremblingIntensity, setTremblingIntensity] = useState<number>(3)
  const [frameRate, setFrameRate]                   = useState<number>(MIN_FRAME_RATE)
  const [tremblingAffectsText, setTremblingAffectsText] = useState<boolean>(true)
  const [baseFps, setBaseFps]                       = useState<number>(35)

  // modals
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition]     = useState<TextPosition|null>(null)
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number|null>(null)
  const [settingsOpen, setSettingsOpen]           = useState(false)

  // refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number|null>(null)
  const startTimeRef = useRef<number|null>(null)
  const lastDisplayTimeRef = useRef<number>(0)
  const lastMousePosition = useRef<Point|null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)

  // ─── KEYBOARD ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftPressed.current = true }
    const up   = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftPressed.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup',   up)
    }
  }, [])

  // ─── REDRAW ON STATE CHANGE ──────────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    updateTextDimensions(ctx)
    if (!isPlaying) drawCanvas()
  }, [
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    lines,
    lineThickness,
    tremblingIntensity,
    frameRate,
    tremblingAffectsText
  ])

  // ─── START / STOP ANIMATION ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      lastDisplayTimeRef.current = 0
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas()
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, isLooping])

  // ─── TEXT DIMENSIONS ─────────────────────────────────────────────────────────────
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measure = (txt: string, size: number) => {
      ctx.font = `bold ${size}px Arial`
      const m = ctx.measureText(txt)
      return {
        width: m.width,
        height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || size * 0.8
      }
    }

    setTitlePositionsFrame1(prev =>
      prev.map((p,i) => {
        const { width, height } = measure(titles[i], p.fontSize)
        return { ...p, width, height, aspectRatio: width/height }
      })
    )
    setTitlePositionsFrame2(prev =>
      prev.map((p,i) => {
        const { width, height } = measure(titles[i], p.fontSize)
        return { ...p, width, height, aspectRatio: width/height }
      })
    )
    const { width: sw, height: sh } = measure(subtitle, subtitlePositionFrame2.fontSize)
    setSubtitlePositionFrame1(p => ({ ...p, width: sw, height: sh, aspectRatio: sw/sh }))
    setSubtitlePositionFrame2(p => ({ ...p, width: sw, height: sh, aspectRatio: sw/sh }))
  }

  // ─── DRAW CANVAS ─────────────────────────────────────────────────────────────────
  const drawCanvas = (progress = 0) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, c.width, c.height)

    if (isPlaying) {
      const frame1Lines = lines.filter(l => l.frame===1)
      const frame2Lines = lines.filter(l => l.frame===2)

      if (progress<=0.3) {
        drawStaticText(ctx,1)
        drawAnimatedLines(ctx,progress/0.3,frame1Lines,[], 'grow')
      } else if (progress<=0.6) {
        drawStaticText(ctx,1)
        drawAnimatedLines(ctx,(progress-0.3)/0.3,frame1Lines,[], 'shrink')
      } else if (progress<=0.7) {
        drawAnimatedText(ctx,(progress-0.6)/0.1,1,2)
      } else if (progress<=1.0) {
        drawStaticText(ctx,2)
        drawAnimatedLines(ctx,(progress-0.7)/0.3,[],frame2Lines,'grow')
      } else if (progress<=1.3) {
        drawStaticText(ctx,2)
        drawAnimatedLines(ctx,(progress-1.0)/0.3,[],frame2Lines,'shrink')
      } else if (progress<=1.4) {
        drawAnimatedText(ctx,(progress-1.3)/0.1,2,1)
      }
      return
    }

    const frameLines = lines.filter(l => l.frame===currentFrame)
    drawLines(ctx, frameLines)
    drawStaticText(ctx, currentFrame)

    if (currentFrame===2 && selectedTexts.length>0) {
      const groupBox = calculateGroupBoundingBox()
      if (groupBox) drawGroupBoundingBox(ctx, groupBox)
      else {
        titlePositionsFrame2.forEach((pos,i) => {
          if (selectedTexts.includes(`title${i+1}` as any))
            drawBoundingBox(ctx,pos)
        })
        if (selectedTexts.includes('subtitle'))
          drawBoundingBox(ctx, subtitlePositionFrame2)
      }
    }
  }

  // ─── STATIC TEXT DRAW ────────────────────────────────────────────────────────────
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame===1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos    = frame===1 ? subtitlePositionFrame1  : subtitlePositionFrame2

    positions.forEach((pos,idx) => {
      const tremX = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity : 0
      const tremY = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity : 0
      ctx.save()
      ctx.translate(pos.x+pos.width/2+tremX, pos.y+pos.height/2+tremY)
      ctx.rotate(pos.rotation)
      ctx.font = `bold ${pos.fontSize}px Arial`
      ctx.fillStyle = getContrastColor(backgroundColor)
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(titles[idx],0,0)
      ctx.restore()
    })

    const tremX = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity : 0
    const tremY = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity : 0
    ctx.save()
    ctx.translate(subPos.x+subPos.width/2+tremX, subPos.y+subPos.height/2+tremY)
    ctx.rotate(subPos.rotation)
    ctx.font = `bold ${subPos.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(subtitle,0,0)
    ctx.restore()
  }

  // (rest of all drawing / hit‐test / interaction functions unchanged…)

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow-lg flex w-full h-[90vh] overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-1/3 border-r border-gray-200 px-8 py-6 space-y-8 overflow-auto">
        {/* … your left inputs & color picker … */}
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[600px] flex flex-col items-center">
        {/* fixed-size 540×675 card */}
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

        {/* CONTROLS BAR */}
        <div className="flex items-center justify-between w-[540px] px-4 py-2 bg-gray-50 border-t border-gray-200">
          {/* ←– old grey “Frame” buttons */}
          <Button
            onClick={() => setCurrentFrame(1)}
            className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Frame 1
          </Button>
          <Button
            onClick={() => setCurrentFrame(2)}
            className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Frame 2
          </Button>

          <div className="flex space-x-4 items-center">
            <Button
              onClick={() => setIsPlaying(p => !p)}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              {isPlaying
                ? <PauseIcon className="w-6 h-6 text-black"/>
                : <PlayIcon  className="w-6 h-6 text-black"/>}
            </Button>
            <Button
              onClick={() => setIsLooping(l => !l)}
              className={`w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center ${isLooping?'ring-2 ring-black':''}`}
            >
              <RotateCcwIcon className="w-6 h-6 text-black"/>
            </Button>
            <Button
              onClick={() => setSettingsOpen(true)}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              <Settings className="w-6 h-6 text-black"/>
            </Button>
            <Button
              onClick={() => console.log("Export not implemented")}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              <ShareIcon className="w-6 h-6 text-black"/>
            </Button>
          </div>
        </div>
      </div>

      {/* … position & settings modals unchanged … */}

    </div>
  )
}
