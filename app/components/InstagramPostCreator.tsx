// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import BezierEasing from 'bezier-easing'

const ExportIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M11.47 1.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 0 1-1.06-1.06l3-3ZM11.25 7.5V15a.75.75 0 0 0 1.5 0V7.5h3.75a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h3.75Z" />
  </svg>
);

const SUL_SANS = 'SulSans-Bold'
const AFFAIRS = 'Affairs-Regular'

const HANDLE_ICON = 10    // visual square – stays the same size
const HANDLE_DETECT = 28  // invisible hit-area – much larger

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

const M = 16      // inner margin (px)

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
const lineEase = BezierEasing(0.83, 0, 0.17, 1)
const textEase = BezierEasing(0.95, 0, 0.05, 1)

// Progress value when the on-screen action is really done
const PROGRESS_END = 2.182             // = revMoveEnd in drawAnimatedContent

// 16 px inner margin → text block must be centred on (16 + blockWidth / 2)
const Wt = 600         // title block width (keeps both lines flush-left)
const Ws = 720         // subtitle block width

// Default positions for 1080 x 1350 layout
export const defaultTitlePositions: TextPosition[] = [
  { x: M, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
  { x: M, y: 610, width: 1000, height: 200, rotation: 0, fontSize: 180 }  // 400 + 200 + 10 gap
]

export const defaultSubtitlePosition: TextPosition = {
  x: M,
  y: 840,
  width: 1000,
  height: 60,
  rotation: 0,
  fontSize: 48
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────────

/* ─── Small wrapper to reuse identical spacing & label strip ─── */
const FieldGroup: React.FC<{ step: number; label: string; children: React.ReactNode }> = ({
  step,
  label,
  children,
}) => (
  <div className="space-y-2">
    <p className="mb-2 tracking-wide">
      <span className="text-[11px] font-semibold text-gray-500 mr-1">
        {step}.
      </span>
      <span className="text-[15px] font-semibold text-gray-700">
        {label}
      </span>
    </p>
    {children}
  </div>
);

export default function InstagramPostCreator() {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(true)
  const [playProgress, setPlayProgress] = useState(0)    // 0 ... 1
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
  const [isDraggingLine, setIsDraggingLine] = useState(false)
  const [editingEnd, setEditingEnd] = useState<'start' | 'end' | null>(null)
  const [initialPosition, setInitialPosition] = useState<TextPosition | null>(null)

  type PlayPhase = 'idle'     // nothing happening
                | 'merge'    // 0-300 ms, buttons animate
                | 'playing'  // progress bar ticking
                | 'paused'

  const [phase, setPhase] = useState<PlayPhase>('idle')
  const [originFrame, setOriginFrame] = useState<1 | 2>(1)

  // ─── FRAME 1 defaults ───────────────────────────────────────────────
  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: M, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 }, // John
    { x: M, y: 580, width: 1000, height: 200, rotation: 0, fontSize: 180 }  // Doe  (-30 px tighter)
  ])

  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = 
    useState<TextPosition>({ x: M, y: 840, width: 1000, height: 60, rotation: 0, fontSize: 48 })

  // ─── FRAME 2 defaults (identical) ───────────────────────────────────
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: M, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: M, y: 580, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])

  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = 
    useState<TextPosition>({ x: M, y: 840, width: 1000, height: 60, rotation: 0, fontSize: 48 })

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastDisplayTimeRef = useRef<number>(0)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)
  const frame1Ref = useRef<HTMLButtonElement>(null)
  const frame2Ref = useRef<HTMLButtonElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const totalBarWRef = useRef<number>(0)          // save once when play starts
  const [barW, setBarW] = useState<number>(0)

  /* ——— MediaRecorder support ——— */
  const recordingRef = useRef<MediaRecorder | null>(null)
  const recordedChunks = useRef<Blob[]>([])

  // Add this with other state declarations at the top
  const [pauseHold, setPauseHold] = useState(0)    // normalized pause (0–0.5)
  const [easingPower, setEasingPower] = useState(5)       // 2–10 range

  // Add these inside the Settings modal, with other sliders
  const [lineEasePower, setLineEasePower] = useState(5)
  const [textEasePower, setTextEasePower] = useState(5)

  /* timeline progress 0 → 1 for the merged bar */
  const [barProgress, setBarProgress] = useState(0)

  /* progress (0 → 1) for the merged bar */
  const [progressRatio, setProgressRatio] = useState(0)

  // Add these easing functions near the top, after state declarations
  const easeLines = useCallback((t: number) =>
    t < 0.5
      ? 0.5 * Math.pow(2 * t, lineEasePower)
      : 1 - 0.5 * Math.pow(2 * (1 - t), lineEasePower), [lineEasePower])

  const easeText = useCallback((t: number) =>
    t < 0.5
      ? 0.5 * Math.pow(2 * t, textEasePower)
      : 1 - 0.5 * Math.pow(2 * (1 - t), textEasePower), [textEasePower])

  const getContrastColor = useCallback((bgColor: string): string => {
    if (!bgColor) return '#000000'
    const hex = bgColor.startsWith('#') ? bgColor.substring(1) : bgColor
    if (hex.length !== 6) return '#000000'
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 128 ? '#000000' : '#FFFFFF'
  }, [])

  // Add this inside the Settings modal
  const [scaleAnchor, setScaleAnchor] = useState<'corner' | 'center'>('corner')

  /* height = the row height you already finalised  ─────────── */
  const ROW_H = 'h-16'            // 64 px  (change only here if needed)
  const ROUND_BTN_W = 'w-52'      // oval play-btn width 208 px
  const SQUARE_W   = 'w-20'       // 80 px square (settings/export)
  const FRAME_W    = 'w-1/2'      // each frame btn takes half of its flex box

  // ─── EFFECT HOOKS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressed.current = true
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedLineIndex !== null) {
        setLines(prev => prev.filter((_, i) => i !== selectedLineIndex))
        setSelectedLineIndex(null)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressed.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [selectedLineIndex])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const sul = new FontFace(SUL_SANS, 'url(/fonts/SulSans-Bold.otf)')
        const aff = new FontFace(AFFAIRS, 'url(/fonts/Affairs-Regular.otf)')
        await Promise.all([sul.load(), aff.load()])
        document.fonts.add(sul)
        document.fonts.add(aff)
        await document.fonts.ready
        if (!cancelled) setFontLoaded(true)
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Recalculate text dimensions only when the source text or fonts change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    updateTextDimensions(ctx);
  }, [titles, subtitle, fontLoaded]);

  useEffect(() => {
    if (isPlaying) {
      const gap = 8
      const w1 = frame1Ref.current?.offsetWidth || 0
      const w2 = frame2Ref.current?.offsetWidth || 0
      totalBarWRef.current = w1 + gap + w2          // remember full length
      setBarW(0)                                    // start empty
    } else {
      totalBarWRef.current = 0
      setBarW(0)
    }
  }, [isPlaying])

  // ─── TEXT DIMENSION UPDATER ──────────────────────────────────────────────────────
  const updateTextDimensions = useCallback((ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number, font: string) => {
      ctx.font = `bold ${fontSize}px "${font}", sans-serif`
      if (font === AFFAIRS) {
        ctx.font = `${fontSize}px "${font}", sans-serif`
      }
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }

    /* ── TITLES ─────────────────────────────────────────────── */
    setTitlePositionsFrame1(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize, SUL_SANS)
        return { ...pos, width, height }
      })
    )

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize, SUL_SANS)
        return { ...pos, width, height }
      })
    )

    // Remove title width updates to keep fixed widths
    const instrText = 'Instrumento:'
    const instrMetrics = measureText(instrText, subtitlePositionFrame2.fontSize, AFFAIRS)
    const subMetrics = measureText(subtitle, subtitlePositionFrame2.fontSize, AFFAIRS)

    const subW = Math.max(instrMetrics.width, subMetrics.width)
    const subH = instrMetrics.height + 8 + subMetrics.height

    setSubtitlePositionFrame1(prev => ({
      ...prev,
      width: subW,
      height: subH,
      aspectRatio: subW / subH
    }))
    setSubtitlePositionFrame2(prev => ({
      ...prev,
      width: subW,
      height: subH,
      aspectRatio: subW / subH
    }))
  }, [titles, subtitle, subtitlePositionFrame1.fontSize, titlePositionsFrame1, titlePositionsFrame2])

  // ─── DRAWING ROUTINES ────────────────────────────────────────────────────────────
  const drawLines = useCallback((ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = getContrastColor(backgroundColor)
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
    canvas.style.cursor = 'default'
  }, [lineThickness, backgroundColor, getContrastColor, currentLine])

  const drawAnimatedLines = useCallback((
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = getContrastColor(backgroundColor)

    const animationDuration = 0.3
    const maxStaggerDelay = 0.2

    const drawFrameLines = (linesArr: Line[], fgProgress: number) => {
      const adjustedStagger = linesArr.length > 1 ? maxStaggerDelay / (linesArr.length - 1) : 0
      linesArr.forEach((ln, idx) => {
        const t = easeLines(Math.max(0, Math.min(1, (fgProgress - idx * adjustedStagger) / animationDuration)))
        const { start, end } = ln
        let currentStart, currentEnd

        if (animationType === 'grow') {
          currentStart = start
          currentEnd = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          }
        } else {
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
      })
    }

    if (frame1Lines.length) drawFrameLines(frame1Lines, progress)
    if (frame2Lines.length) drawFrameLines(frame2Lines, progress)
  }, [lineThickness, backgroundColor, getContrastColor, easeLines, tremblingIntensity])

  const drawAnimatedText = useCallback((
    ctx: CanvasRenderingContext2D,
    moveT: number,
    scaleT: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const fromPositions = fromFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const toPositions   = toFrame  === 1 ? titlePositionsFrame1 : titlePositionsFrame2

    titles.forEach((text, i) => {
      const p1 = fromPositions[i]
      const p2 = toPositions[i]

      // 1) POSITION & ROTATION INTERPOLATION
      const x        = p1.x        + (p2.x        - p1.x)        * moveT
      const y        = p1.y        + (p2.y        - p1.y)        * moveT
      const rotation = p1.rotation + (p2.rotation - p1.rotation) * moveT

      // 2) SIZE INTERPOLATION
      const fontSize = p1.fontSize + (p2.fontSize - p1.fontSize) * scaleT
      const dynW = p1.width + (p2.width - p1.width) * scaleT
      const dynH = p1.height + (p2.height - p1.height) * scaleT

      // 3) RANDOM TREMBLE
      const tremX = (Math.random() - 0.5) * tremblingIntensity
      const tremY = (Math.random() - 0.5) * tremblingIntensity

      // 4) DRAW from left edge
      ctx.save()
      ctx.translate(x + dynW / 2 + tremX, y + dynH / 2 + tremY)    // centre pivot
      ctx.rotate(rotation)
      ctx.font         = `bold ${fontSize}px "${SUL_SANS}", sans-serif`
      ctx.fillStyle    = getContrastColor(backgroundColor)
      ctx.textBaseline = 'middle'
      ctx.textAlign    = 'left'
      ctx.fillText(text, -dynW / 2, 0)                             // draw from left edge
      ctx.restore()
    })

    // ——— Subtitle (same logic) ———
    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    const sx        = sub1.x + (sub2.x - sub1.x) * moveT
    const sy        = sub1.y + (sub2.y - sub1.y) * moveT
    const srot      = sub1.rotation + (sub2.rotation - sub1.rotation) * moveT
    const sFontSize = sub1.fontSize + (sub2.fontSize - sub1.fontSize) * scaleT
    const streX     = (Math.random() - 0.5) * tremblingIntensity
    const streY     = (Math.random() - 0.5) * tremblingIntensity
    const dynSW     = sub1.width + (sub2.width - sub1.width) * scaleT
    const dynSH     = sub1.height + (sub2.height - sub1.height) * scaleT

    ctx.save()
    ctx.translate(sx + dynSW / 2 + streX, sy + dynSH / 2 + streY)
    ctx.rotate(srot)
    ctx.font         = `${sFontSize}px "${AFFAIRS}", sans-serif`
    ctx.fillStyle    = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign    = 'left'
    const lx = -dynSW / 2
    const ty = -dynSH / 2
    ctx.fillText('Instrumento:', lx, ty)
    ctx.fillText(subtitle, lx, ty + sFontSize + 8)
    ctx.restore()
  }, [titles, subtitle, titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2, getContrastColor])

  const drawStaticText = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    titles.forEach((title, index) => {
      drawAnimatedText(ctx, 0, 0, frame, frame)
    })
    const subtitlePosition = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    drawAnimatedText(ctx, 0, 0, frame, frame)
  }, [titles, subtitlePositionFrame1, subtitlePositionFrame2, drawAnimatedText])

  const drawRotatedText = useCallback((ctx: CanvasRenderingContext2D, pos: TextPosition, text: string, font: string) => {
    ctx.save()
    ctx.translate(pos.x + pos.width/2, pos.y + pos.height/2)
    ctx.rotate(pos.rotation)
    ctx.font = font === SUL_SANS ? `bold ${pos.fontSize}px "${font}", sans-serif` : `${pos.fontSize}px "${font}", sans-serif`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    
    if (font === AFFAIRS) {
        const line1 = "Instrumento:"
        const line2 = text
        const lineHeight = pos.fontSize * 1.2
        ctx.fillText(line1, 0, -lineHeight/2)
        ctx.fillText(line2, 0, lineHeight/2)
    } else {
        ctx.fillText(text, 0, 0)
    }
    ctx.restore()
  }, [backgroundColor, getContrastColor])

  const drawAnimatedContent = useCallback((ctx: CanvasRenderingContext2D, p: number) => {
    const f1 = lines.filter(l => l.frame === 1)
    const f2 = lines.filter(l => l.frame === 2)
    const t = easeText(p)
    
    // This logic needs to be adapted based on the desired animation sequence
    const moveDur = 0.233
    const scaleDur = 0.233
    
    // frame-1 lines
    if (p <= 0.30) {
      drawStaticText(ctx, 1)
      drawAnimatedLines(ctx, p / 0.30, f1, [], 'grow')
      return
    }
    if (p <= 0.60) {
      drawStaticText(ctx, 1)
      drawAnimatedLines(ctx, (p - 0.30) / 0.30, f1, [], 'shrink')
      return
    }

    // text forward: move → scale
    const moveStart = 0.60
    const moveEnd = moveStart + moveDur
    const scaleEnd = moveEnd + scaleDur

    if (p <= moveEnd) {
      const t = easeText((p - moveStart) / moveDur)
      drawAnimatedText(ctx, t, 0, 1, 2)
      return
    }
    if (p <= scaleEnd) {
      const s = easeText((p - moveEnd) / scaleDur)
      drawAnimatedText(ctx, 1, s, 1, 2)
      return
    }

    // frame-2 lines
    const frame2LinesStart = scaleEnd
    if (p <= frame2LinesStart + 0.35) {
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (p - frame2LinesStart) / 0.35, [], f2, 'grow')
      return
    }
    if (p <= frame2LinesStart + 0.65) {
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (p - (frame2LinesStart + 0.35)) / 0.30, [], f2, 'shrink')
      return
    }

    /* REWIND: SCALE-BACK first, then MOVE-BACK */
    const revScaleStart = frame2LinesStart + 0.65
    const revScaleEnd   = revScaleStart + scaleDur
    const revMoveStart  = revScaleEnd
    const revMoveEnd    = revMoveStart + moveDur

    if (p <= revScaleEnd) {
      const s = easeText((p - revScaleStart) / scaleDur)
      drawAnimatedText(ctx, 0, 1-s, 2, 1)
      return
    }

    if (p <= revMoveEnd) {
      const t = easeText((p - revMoveStart) / moveDur)
      drawAnimatedText(ctx, 1-t, 0, 2, 1)
      return
    }

    drawStaticText(ctx, 1)
  }, [lines, easeText, drawStaticText, drawAnimatedLines, drawAnimatedText])

  const drawCanvas = useCallback((progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (isPlaying) {
      drawAnimatedContent(ctx, progress)
      return
    }

    const framelines = lines.filter(l => l.frame === currentFrame)
    drawLines(ctx, framelines)
    drawStaticText(ctx, currentFrame)

    // Bounding box logic would go here if needed for static frames
  }, [backgroundColor, isPlaying, lines, currentFrame, drawLines, drawStaticText, drawAnimatedContent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && fontLoaded) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        updateTextDimensions(ctx)
        drawCanvas()
      }
    }
  }, [titles, subtitle, backgroundColor, currentFrame, lines, lineThickness, tremblingIntensity, fontLoaded, updateTextDimensions, drawCanvas])

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now()
      
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp
        }
        
        const elapsed = (timestamp - startTimeRef.current) / 1000
        const totalDuration = PROGRESS_END * 1.5; // Adjust total duration as needed
        let progress = elapsed / totalDuration

        if (progress > 1) {
          if (isLooping) {
            progress = 0
            startTimeRef.current = timestamp
          } else {
            setIsPlaying(false)
            setProgressRatio(0)
            drawCanvas(0)
            return
          }
        }
        
        setProgressRatio(progress)
        drawCanvas(progress * PROGRESS_END)
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      setProgressRatio(0)
      drawCanvas(0) // Redraw canvas in static state
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, isLooping, drawCanvas])

  const handlePlayClick = () => {
    setIsPlaying(prev => !prev)
  }

  const handleFrameChange = (frame: number) => {
    if (!isPlaying) {
      setCurrentFrame(frame)
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    // Line drawing logic
    if (e.button === 0) { // Left-click
        const newLine: Line = { start: { x, y }, end: { x, y }, frame: currentFrame };
        setCurrentLine(newLine);
        setLines(prevLines => [...prevLines, newLine]);
        setEditingLineIndex(lines.length);
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying || !currentLine) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    if (editingLineIndex !== null) {
        const updatedLines = [...lines];
        updatedLines[editingLineIndex].end = { x, y };
        setLines(updatedLines);
    }
  }

  const handleMouseUp = () => {
    setCurrentLine(null)
    setEditingLineIndex(null)
  }

  const handleSettingsChange = (name: string, val: number) => {
    if (name === 'lineThickness') setLineThickness(val)
    if (name === 'tremblingIntensity') setTremblingIntensity(val)
    if (name === 'baseFps') setBaseFps(val)
    if (name === 'frameRate') setFrameRate(val)
    if (name === 'lineEasePower') setLineEasePower(val)
    if (name === 'textEasePower') setTextEasePower(val)
  }

  const exportVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    recordedChunks.current = []
    const stream = canvas.captureStream(frameRate)
    recordingRef.current = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })

    recordingRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data)
      }
    }

    recordingRef.current.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'instagram_post.webm'
      a.click()
      URL.revokeObjectURL(url)
    }

    recordingRef.current.start()
    setIsPlaying(true)

    // Let animation run for its full duration before stopping
    const animationDuration = (PROGRESS_END / (baseFps / 60)) * 1000
    setTimeout(() => {
        if(recordingRef.current?.state === 'recording') {
            recordingRef.current.stop()
        }
        setIsPlaying(false)
    }, animationDuration)
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* ─── LEFT PANEL: Controls ─────────────────────────────────────────── */}
      <div className="w-[320px] bg-white p-4 space-y-6 overflow-y-auto">
        <h1 className="text-xl font-bold tracking-tighter">Instagram Post Creator</h1>

        <FieldGroup step={1} label="Add your text">
          <Input
            placeholder="Title 1"
            value={titles[0]}
            onChange={e => setTitles([e.target.value, titles[1]])}
            className="h-9 text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
          />
          <Input
            placeholder="Title 2"
            value={titles[1]}
            onChange={e => setTitles([titles[0], e.target.value])}
            className="h-9 text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
          />
          <Input
            placeholder="Subtitle"
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            className="h-9 text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
          />
        </FieldGroup>

        <FieldGroup step={2} label="Pick a color">
          <div className="flex flex-nowrap gap-2 mt-2">
            {colorOptions.map(c => (
              <button
                key={c.value}
                onClick={() => setBackgroundColor(c.value)}
                aria-label={c.name}
                style={{ backgroundColor: c.value }}
                className={`w-8 h-8 rounded-none ${backgroundColor === c.value ? 'ring-2 ring-black' : 'ring-0'}`}
              />
            ))}
          </div>
        </FieldGroup>

      </div>

      {/* ─── RIGHT PANEL: Canvas & Controls ────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div
          className="w-[540px] h-[675px] bg-white rounded-none mb-2 relative overflow-hidden shadow-lg"
          style={{ backgroundColor: backgroundColor }}
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
        
        <div className="w-[540px] flex items-center space-x-2">
            <div className="flex-grow grid grid-cols-2 gap-px bg-gray-300 rounded-full overflow-hidden relative h-12">
                 <Button
                    onClick={() => handleFrameChange(1)}
                    className={`h-full rounded-none transition-colors duration-300 ${
                    currentFrame === 1 && phase !== 'playing'
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-black hover:bg-gray-300'
                    }`}
                    disabled={isPlaying}
                >
                    Frame 1
                </Button>
                <Button
                    onClick={() => handleFrameChange(2)}
                    className={`h-full rounded-none transition-colors duration-300 ${
                    currentFrame === 2 && phase !== 'playing'
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-black hover:bg-gray-300'
                    }`}
                    disabled={isPlaying}
                >
                    Frame 2
                </Button>
                <div
                  className="absolute top-0 left-0 h-full bg-blue-500"
                  style={{ 
                      width: `${progressRatio * 100}%`,
                      transition: progressRatio > 0 ? 'width 100ms linear' : 'none'
                  }}
                />
            </div>

            <Button
              onClick={handlePlayClick}
              className="h-12 w-24 rounded-full flex items-center justify-center transition-colors duration-300 bg-gray-200 text-black hover:bg-gray-300"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>

            <Button
                onClick={() => setSettingsOpen(true)}
                className="h-12 w-12 rounded-full bg-gray-200 p-2"
                aria-label="Settings"
            >
                ⚙️
            </Button>
            <Button
                onClick={exportVideo}
                className="h-12 w-12 rounded-full bg-gray-200 p-2"
                aria-label="Export"
            >
                <ExportIcon className="w-6 h-6" />
            </Button>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                id="loopToggle"
                type="checkbox"
                checked={isLooping}
                onChange={e => setIsLooping(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="loopToggle">
                Loop animation
              </Label>
            </div>

            <div>
              <Label htmlFor="thicknessSlider">Line Thickness ({lineThickness})</Label>
              <Slider
                id="thicknessSlider"
                min={MIN_LINE_THICKNESS}
                max={MAX_LINE_THICKNESS}
                step={1}
                value={[lineThickness]}
                onValueChange={value => handleSettingsChange('lineThickness', value[0])}
              />
            </div>
            <div>
              <Label htmlFor="trembleSlider">Trembling Intensity ({tremblingIntensity})</Label>
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
                onValueChange={([v]) => handleSettingsChange('baseFps', v)}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Export Frame Rate ({frameRate})</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE}
                max={120}
                step={1}
                value={[frameRate]}
                onValueChange={([v]) => handleSettingsChange('frameRate', v)}
              />
            </div>
             <div>
                <Label htmlFor="lineEaseSlider">Line Easing Power ({lineEasePower})</Label>
                <Slider
                    id="lineEaseSlider"
                    min={2} max={10} step={1}
                    value={[lineEasePower]}
                    onValueChange={([v]) => handleSettingsChange('lineEasePower', v)}
                />
            </div>
            <div>
                <Label htmlFor="textEaseSlider">Text Easing Power ({textEasePower})</Label>
                <Slider
                    id="textEaseSlider"
                    min={2} max={10} step={1}
                    value={[textEasePower]}
                    onValueChange={([v]) => handleSettingsChange('textEasePower', v)}
                />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}





