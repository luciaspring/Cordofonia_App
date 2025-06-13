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
  const easeLines = (t: number) =>
    t < 0.5
      ? 0.5 * Math.pow(2 * t, lineEasePower)
      : 1 - 0.5 * Math.pow(2 * (1 - t), lineEasePower)

  const easeText = (t: number) =>
    t < 0.5
      ? 0.5 * Math.pow(2 * t, textEasePower)
      : 1 - 0.5 * Math.pow(2 * (1 - t), textEasePower)

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
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px "${SUL_SANS}", sans-serif`
      const metrics = ctx.measureText(text)
      return {
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8
      }
    }

    /* ── TITLES ─────────────────────────────────────────────── */
    setTitlePositionsFrame1(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        return { ...pos, width, height }
      })
    )

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height } = measureText(titles[i], pos.fontSize)
        return { ...pos, width, height }
      })
    )

    // Remove title width updates to keep fixed widths
    const instrText = 'Instrumento:'
    const instrMetrics = measureText(instrText, subtitlePositionFrame2.fontSize)
    const subMetrics = measureText(subtitle, subtitlePositionFrame2.fontSize)

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
  }

  // ─── DRAWING ROUTINES ────────────────────────────────────────────────────────────
  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
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
    canvas.style.cursor = 'default'
  }

  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'

    const animationDuration = 0.3
    const maxStaggerDelay = 0.2

    const drawFrameLines = (linesArr: Line[], fgProgress: number) => {
      const adjustedStagger = linesArr.length > 1 ? maxStaggerDelay / (linesArr.length - 1) : 0
      linesArr.forEach((ln, idx) => {
        const t = lineEase(Math.max(0, Math.min(1, (fgProgress - idx * adjustedStagger) / animationDuration)))
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
  }

  const drawAnimatedText = (
    ctx: CanvasRenderingContext2D,
    moveT: number,
    scaleT: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const titlesArr = titles
    const fromPositions = fromFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const toPositions   = toFrame  === 1 ? titlePositionsFrame1 : titlePositionsFrame2

    titlesArr.forEach((text, i) => {
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
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const {
      titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2,
      tremblingIntensity, backgroundColor, titles, subtitle
    } = animationState.current

    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    positions.forEach((pos, idx) => {
      const tremX = (Math.random() - 0.5) * tremblingIntensity
      const tremY = (Math.random() - 0.5) * tremblingIntensity
      ctx.save()
      const cx = pos.x + pos.width / 2
      const cy = pos.y + pos.height / 2
      ctx.translate(cx + tremX, cy + tremY)                         // centre pivot
      ctx.rotate(pos.rotation)
      ctx.font         = `bold ${pos.fontSize}px "${SUL_SANS}", sans-serif`
      ctx.fillStyle    = getContrastColor(backgroundColor)
      ctx.textBaseline = 'middle'
      ctx.textAlign    = 'left'
      ctx.fillText(titles[idx], -pos.width / 2, 0)                  // shift left by ½ W
      ctx.restore()
    })

    const tremXsub = (Math.random() - 0.5) * tremblingIntensity
    const tremYsub = (Math.random() - 0.5) * tremblingIntensity

    ctx.save()
    const scx = subPos.x + subPos.width / 2
    const scy = subPos.y + subPos.height / 2
    ctx.translate(scx + tremXsub, scy + tremYsub)
    ctx.rotate(subPos.rotation)
    ctx.font         = `${subPos.fontSize}px "${AFFAIRS}", sans-serif`
    ctx.fillStyle    = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign    = 'left'
    const lx = -subPos.width / 2
    const ty = -subPos.height / 2
    ctx.fillText('Instrumento:', lx, ty)
    ctx.fillText(subtitle, lx, ty + subPos.fontSize + 8)
    ctx.restore()
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) => {
    ctx.save()
    ctx.translate(pos.x + pos.width/2, pos.y + pos.height/2)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px "${SUL_SANS}", sans-serif`
    ctx.fillStyle = getContrastColor(animationState.current.backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  const drawAnimatedContent = (ctx: CanvasRenderingContext2D, p: number) => {
    const { lines, textEase } = animationState.current
    const f1 = lines.filter(l => l.frame === 1)
    const f2 = lines.filter(l => l.frame === 2)
    const ease = textEase  // or easeInOutQuint, whichever you're using

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
    const moveDur   = 0.233
    const scaleDur  = 0.233
    const moveEnd   = moveStart + moveDur    // ≈0.833
    const scaleEnd  = moveEnd   + scaleDur    // ≈1.066

    if (p <= moveEnd) {
      const t = ease((p - moveStart) / moveDur)
      drawAnimatedText(ctx, t, 0, 1, 2)
      return
    }
    if (p <= scaleEnd) {
      const s = ease((p - moveEnd) / scaleDur)
      drawAnimatedText(ctx, 1, s, 1, 2)
      return
    }

    // frame-2 lines
    if (p <= scaleEnd + 0.35) {
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (p - scaleEnd) / 0.35, [], f2, 'grow')
      return
    }
    if (p <= scaleEnd + 0.65) {
      drawStaticText(ctx, 2)
      drawAnimatedLines(ctx, (p - (scaleEnd + 0.35)) / 0.30, [], f2, 'shrink')
      return
    }

    /* REWIND: SCALE-BACK first, then MOVE-BACK */
    const revScaleStart = scaleEnd + 0.65
    const revScaleEnd   = revScaleStart + scaleDur
    const revMoveStart  = revScaleEnd
    const revMoveEnd    = revMoveStart + moveDur

    // 1) un-scale (hold frame-2 position)
    if (p <= revScaleEnd) {
      const s = ease((p - revScaleStart) / scaleDur)
      drawAnimatedText(ctx, 0, s, 2, 1)        // ✅ stays big, then shrinks
      return
    }

    // 2) then un-move (hold frame-1 scale)
    if (p <= revMoveEnd) {
      const t = ease((p - revMoveStart) / moveDur)
      drawAnimatedText(ctx, t, 1, 2, 1)        // ✅ size already small, just slide back
      return
    }

    // fallback
    drawStaticText(ctx, 1)
  }

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(pos.rotation)
    const hw = pos.width / 2
    const hh = pos.height / 2
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw, -hh, pos.width, pos.height)
    const handleSize = HANDLE_ICON        // only the icon uses this size
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
    const handleSize = HANDLE_ICON        // only the icon uses this size
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

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (animationState.current.selectedTexts.length === 0) return null
    const selectedPositions: TextPosition[] = animationState.current.titlePositionsFrame2
      .filter((_, idx) => animationState.current.selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2'))
    if (animationState.current.selectedTexts.includes('subtitle')) {
      selectedPositions.push(animationState.current.subtitlePositionFrame2)
    }
    if (!selectedPositions.length) return null

    let minX = Math.min(...selectedPositions.map(p => p.x))
    let minY = Math.min(...selectedPositions.map(p => p.y))
    let maxX = Math.max(...selectedPositions.map(p => p.x + p.width))
    let maxY = Math.max(...selectedPositions.map(p => p.y + p.height))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: animationState.current.groupRotation
    }
  }

  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = animationState.current.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (isPlaying) {
      drawAnimatedContent(ctx, progress)
      return
    }

    const framelines = animationState.current.lines.filter(l => l.frame === animationState.current.currentFrame)
    drawLines(ctx, framelines)
    drawStaticText(ctx, animationState.current.currentFrame)

    if (animationState.current.currentFrame === 2 && animationState.current.selectedTexts.length > 0) {
      const groupBox = calculateGroupBoundingBox()
      if (groupBox) {
        drawGroupBoundingBox(ctx, groupBox)
      } else {
        animationState.current.titlePositionsFrame2.forEach((pos, idx) => {
          if (animationState.current.selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')) {
            drawBoundingBox(ctx, pos)
          }
        })
        if (animationState.current.selectedTexts.includes('subtitle')) {
          drawBoundingBox(ctx, animationState.current.subtitlePositionFrame2)
        }
      }
    }
  }

  // Effect to handle the animation loop
  useEffect(() => {
    if (!isPlaying) {
      drawCanvas()
      return
    }

    let frameId: number | null = null
    startTimeRef.current = null
    lastDisplayTimeRef.current = 0

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }
      const elapsed = timestamp - startTimeRef.current
      const msPerBase = 1000 / baseFps
      let progress = elapsed / (msPerBase * 150)

      if (progress >= PROGRESS_END) {
        if (isLooping) {
          startTimeRef.current = timestamp
          progress = 0
          setBarProgress(0)
        } else {
          setIsPlaying(false)
          setBarProgress(1)
          drawCanvas(PROGRESS_END)
          return
        }
      } else {
        setBarProgress(progress / PROGRESS_END)
      }

      if (timestamp - lastDisplayTimeRef.current >= 1000 / frameRate) {
        drawCanvas(progress)
        lastDisplayTimeRef.current = timestamp
      }
      
      setProgressRatio(Math.min(progress / PROGRESS_END, 1));

      // Continue animation if still playing
      if (isPlaying) {
         frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  // All state and props that animate() depends on must be in the dependency array
  }, [isPlaying, isLooping, baseFps, frameRate, titles, subtitle, lines, backgroundColor, titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2, tremblingIntensity, lineThickness, textEase, setBarProgress, setIsPlaying, setProgressRatio, drawCanvas])

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) => {
    ctx.save()
    ctx.translate(pos.x + pos.width/2, pos.y + pos.height/2)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px "${SUL_SANS}", sans-serif`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  // ─── FRAME CONTROLS ─────────────────────────────────────────────────────────────
  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    drawCanvas()
  }

  const handlePlayClick = () => {
    if (phase === 'idle' || phase === 'paused') {
      setIsPlaying(true); // This was missing! Starts the animation loop.
      setOriginFrame(currentFrame as 1 | 2)
      setPhase('merge')
      setTimeout(() => setPhase('playing'), 300)
    } else { // 'playing' or 'merge'
      setIsPlaying(false); // This stops the animation loop.
      setPhase('paused')
    }
  }

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
    drawCanvas()
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
    drawCanvas()
  }

  // ─── UTILITY ────────────────────────────────────────────────────────────────────
  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

  const exportVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas || isPlaying) return      // avoid double-start while playing

    /* 1. capture the canvas stream */
    const stream = canvas.captureStream(frameRate)   // use current FPS slider
    recordingRef.current = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    })
    recordedChunks.current = []
    recordingRef.current.ondataavailable = e => {
      if (e.data.size) recordedChunks.current.push(e.data)
    }
    recordingRef.current.onstop = () => {
      const blob   = new Blob(recordedChunks.current, { type: 'video/webm' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href       = url
      a.download   = 'instagram_post.webm'
      a.click()
      URL.revokeObjectURL(url)
    }

    /* 2. start animation & recording */
    const fullCycleMs = (PROGRESS_END * 150 * 1000) / baseFps
    recordingRef.current.start()
    setIsLooping(false)        // play one cycle only
    setIsPlaying(true)

    /* 3. stop everything after one cycle */
    setTimeout(() => {
      setIsPlaying(false)
      recordingRef.current?.stop()
    }, fullCycleMs + 200)      // +200 ms safety margin
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="bg-white border border-gray-200 p-4 rounded-lg font-ui">
        {/* widen gap so the new, wider left column sits clear of the frame */}
        <div className="flex space-x-8">
          {/* ─── LEFT PANEL ───────────────────────────────────────── */}
          {/* 312 px = 8 squares × 32 px  + 7 gaps × 8 px  → allow a little breathing room */}
          <div className="w-[336px] pt-0 pr-6 space-y-4">
            <h1 className="text-[15px] font-semibold tracking-wide text-black leading-tight mb-4">
              Cordofonia Instagram<br />Posts Creator Tool
            </h1>

            {/* Title fields */}
            <FieldGroup step={1} label="Write a title">
              <Input
                value={titles[0]}
                onChange={e => setTitles([e.target.value, titles[1]])}
                className="h-9 text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
              />
              <Input
                value={titles[1]}
                onChange={e => setTitles([titles[0], e.target.value])}
                className="h-9 text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
              />
            </FieldGroup>

            {/* Instrument */}
            <FieldGroup step={2} label="Write the instrument">
              <Input
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                className="h-9 text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
              />
            </FieldGroup>

            {/* Colors */}
            <FieldGroup step={3} label="Pick a color">
              {/* keep all squares on one line */}
              <div className="flex flex-nowrap gap-2 mt-2">
                {colorOptions.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setBackgroundColor(c.value)}
                    aria-label={c.name}
                    style={{ backgroundColor: c.value }}
                    className={`
                      w-8 h-8 rounded-none
                      ${backgroundColor === c.value
                        ? 'ring-2 ring-black'
                        : 'ring-0'}
                    `}
                  />
                ))}
              </div>
            </FieldGroup>

          </div>

          {/* ─── RIGHT PANEL: Canvas & Controls */}
          {/* push frame to the right by exactly the width of the colour-picker row */}
          <div className="w-[540px] flex flex-col ml-[336px]">
            <div
              className="w-[540px] h-[675px] bg-white rounded-none mb-2 relative overflow-hidden"
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

            {/* ─── CONTROLS ROW (exactly 540 px wide) ─────────────────────────────── */}
            <div className={`grid grid-cols-4 w-full gap-2 mx-auto ${ROW_H}`}>
              {/* --- FRAME PAIR (2/4 width) --- */}
              <div
                className={`
                  col-span-2
                  relative flex items-stretch
                  transition-[gap] duration-300 ease-in-out
                  ${phase === 'merge' || phase === 'playing' ? 'gap-0' : 'gap-2'}
                `}
              >
                {/* --- Frame 1 button (forms left half of grey track) --- */}
                <Button
                  ref={frame1Ref}
                  onClick={() => handleFrameChange(1)}
                  disabled={phase !== 'idle' && phase !== 'paused'}
                  className={`
                    flex-1 rounded-none overflow-hidden h-full
                    transition-colors duration-300
                    ${phase === 'merge' || phase === 'playing'
                      ? 'bg-gray-200 text-transparent' // Fade to grey, hide text via color
                      : currentFrame === 1
                        ? 'bg-black text-white hover:bg-[#9E9E9E] hover:text-black'
                        : 'bg-gray-200 text-black hover:bg-[#9E9E9E] hover:text-black'
                    }
                  `}
                >
                  Frame 1
                </Button>

                {/* --- Frame 2 button (forms right half of grey track) --- */}
                <Button
                  ref={frame2Ref}
                  onClick={() => handleFrameChange(2)}
                  disabled={phase !== 'idle' && phase !== 'paused'}
                  className={`
                    flex-1 rounded-none overflow-hidden h-full
                    transition-colors duration-300
                    ${phase === 'merge' || phase === 'playing'
                      ? 'bg-gray-200 text-transparent'
                      : currentFrame === 2
                        ? 'bg-black text-white hover:bg-[#9E9E9E] hover:text-black'
                        : 'bg-gray-200 text-black hover:bg-[#9E9E9E] hover:text-black'
                    }
                  `}
                >
                  Frame 2
                </Button>
                
                {/* --- BLACK PROGRESS BAR (on top of the grey track) --- */}
                <div
                  className="absolute inset-0 bg-black pointer-events-none z-10"
                  style={{
                    width: phase === 'playing' ? `${progressRatio * 100}%` : '0%',
                    opacity: phase === 'playing' ? 1 : 0,
                    transition: 'width 80ms linear, opacity 100ms ease-in-out'
                  }}
                />
              </div>

              {/* --- PLAY / PAUSE OVAL (1/4 width) --- */}
              <Button
                onClick={handlePlayClick}
                className={`
                  h-full
                  rounded-full flex items-center justify-center
                  transition-colors duration-300
                  ${phase==='playing'
                    ? 'bg-black text-white hover:bg-[#9E9E9E] hover:text-black'
                    : 'bg-gray-200 text-black hover:bg-[#9E9E9E] hover:text-black'}
                `}
              >
                {phase==='playing'
                  ? <span className="sf-icon text-xl">􀊅</span>
                  : <span className="sf-icon text-xl">􀊄</span>}
              </Button>

              {/* --- SETTINGS & EXPORT (1/4 width) --- */}
              <div className="flex gap-2">
                  <Button
                    onClick={() => setSettingsOpen(true)}
                    className={`flex-1 h-full aspect-square bg-gray-200 text-black hover:bg-[#9E9E9E] rounded-none flex items-center justify-center`}
                  >
                    <span className="sf-icon text-xl">􀌆</span>
                  </Button>

                  <Button
                    onClick={exportVideo}
                    className={`flex-1 h-full aspect-square bg-gray-200 text-black hover:bg-[#9E9E9E] rounded-none flex items-center justify-center`}
                  >
                    <span className="sf-icon text-xl">􀈂</span>
                  </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Gooey filter, once per app ─── */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 20 -10"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* ─── MODALS ─────────────────────────────────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editingPosition && editingBaseFontSize !== null && (
            <div className="space-y-2">
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                id="loopToggle"
                type="checkbox"
                checked={isLooping}
                onChange={e => setIsLooping(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <Label htmlFor="loopToggle" className="text-sm text-gray-600">
                Loop animation
              </Label>
            </div>

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
            <div>
              <Label htmlFor="pauseSlider">Pause Hold (norm)</Label>
              <Slider
                id="pauseSlider"
                min={0}
                max={0.5}
                step={0.01}
                value={[pauseHold]}
                onValueChange={([v]) => setPauseHold(v)}
              />
            </div>
            <div>
              <Label htmlFor="easingSlider">Easing Power</Label>
              <Slider
                id="easingSlider"
                min={2}
                max={10}
                step={1}
                value={[easingPower]}
                onValueChange={([v]) => setEasingPower(v)}
              />
            </div>
            <div>
              <Label htmlFor="lineEaseSlider">Line Easing Power</Label>
              <Slider
                id="lineEaseSlider"
                min={2}
                max={10}
                step={1}
                value={[lineEasePower]}
                onValueChange={([v]) => setLineEasePower(v)}
              />
            </div>
            <div>
              <Label htmlFor="textEaseSlider">Text Easing Power</Label>
              <Slider
                id="textEaseSlider"
                min={2}
                max={10}
                step={1}
                value={[textEasePower]}
                onValueChange={([v]) => setTextEasePower(v)}
              />
            </div>
            <div>
              <Label htmlFor="scaleAnchor">Scale Anchor</Label>
              <Select value={scaleAnchor} onValueChange={setScaleAnchor}>
                <SelectTrigger id="scaleAnchor" className="w-full">
                  <SelectValue placeholder="corner/center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corner">Corner</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}





