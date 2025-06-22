// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
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
// ↑ bump this number to raise all your regular text
const BASE_FONT_SIZE = 16
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
  baseline: number      // alphabetic baseline (instead of y)
  ascent: number        // text ascent for bounding box calculations
  descent: number       // text descent for bounding box calculations
  width: number
  height: number
  rotation: number
  fontSize: number
  boxW?: number         // Optional override for bounding box width
  boxH?: number         // Optional override for bounding box height
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

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const M = 32      // inner margin (px)
// 8-row layout helper
const ROWS        = 8
const ROW_HEIGHT  = (1350 - M * 2) / ROWS          // canvas.height is 1350
const rowY        = (r: number) => M + ROW_HEIGHT * r   // top-edge of row r

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
  { x: M, baseline: rowY(4), ascent: 162, descent: 18, width: 1000, height: 180, rotation: 0, fontSize: 180 },
  { x: M, baseline: rowY(5), ascent: 162, descent: 18, width: 1000, height: 180, rotation: 0, fontSize: 180 }
]

export const defaultSubtitlePosition: TextPosition = {
  x: M,
  baseline: rowY(6),
  ascent: 29,
  descent: 3,
  width: 1000,
  height: 32,
  rotation: 0,
  fontSize: 32
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────────

/* ─── Small wrapper to reuse identical spacing & label strip ─── */
const FieldGroup: React.FC<{
  step: number
  label: string
  children: React.ReactNode
}> = ({ step, label, children }) => (
  <div className="space-y-1">
    <p className="tracking-wide">
      <span className="text-[12px] font-semibold text-[#7F7F7F] mr-1">
        {step}.
      </span>
      <span className="text-[16px] font-semibold text-[#7F7F7F]">
        {label}
      </span>
    </p>
    {children}
  </div>
)

export default function InstagramPostCreator() {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['Mbye', 'Ebrima'])
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
    { x: M, baseline: rowY(4), ascent: 162, descent: 18, width: 1000, height: 180, rotation: 0, fontSize: 180 },
    { x: M, baseline: rowY(5), ascent: 162, descent: 18, width: 1000, height: 180, rotation: 0, fontSize: 180 }
  ])

  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = 
    useState<TextPosition>({ x: M, baseline: rowY(6), ascent: 29, descent: 3, width: 1000, height: 32, rotation: 0, fontSize: 32 })

  // ─── FRAME 2 defaults (identical) ───────────────────────────────────
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: M, baseline: rowY(4), ascent: 162, descent: 18, width: 1000, height: 180, rotation: 0, fontSize: 180 },
    { x: M, baseline: rowY(5), ascent: 162, descent: 18, width: 1000, height: 180, rotation: 0, fontSize: 180 }
  ])

  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = 
    useState<TextPosition>({ x: M, baseline: rowY(6), ascent: 29, descent: 3, width: 1000, height: 32, rotation: 0, fontSize: 32 })

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

  const [animationKey, setAnimationKey] = useState(0);

  const [showGuides, setShowGuides] = useState(false)

  // Add at the top of the component, under other useState hooks
  const [frame2Initialised, setFrame2Initialised] = useState(false);

  /*  put this near your other "const …" declarations  */
  const GOO_BG = 'bg-[#E5E5E5]'                   // colour that melts
  const isGooeyPhase = (p: PlayPhase) =>         // true while buttons touch
    p === 'merge' || p === 'playing'

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
  const barRef = useRef<HTMLDivElement>(null);
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

  /* refs & state for auto-positioning block #2 */
  const panelRef      = useRef<HTMLDivElement>(null)
  const titleRef      = useRef<HTMLDivElement>(null)
  const swatchRef     = useRef<HTMLDivElement>(null)
  const instrumentRef = useRef<HTMLDivElement>(null)
  /* dynamic top-offset for block #2 — start as null so it's hidden until we
     have real measurements */
  const [instrumentTop, setInstrumentTop] = useState<number | null>(null)

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

  useEffect(() => {
    if (!fontLoaded) return;

    /* helper — "baseline" = bottom ruling of row 5 (rows are 0-based) */
    const baselineRow5 = rowY(5);   // already includes the inner margin M

    /* run this once right after fonts have loaded */
    setTitlePositionsFrame1(p => {
      const next = [...p];
      const e = next[1];                    // index 1 = "Ebrima"
      next[1] = { ...e, baseline: baselineRow5 };   // snap baseline to row 5
      return next;
    });

    /* mirror the same for frame 2 if you initialise it from frame 1 */
    setTitlePositionsFrame2(p => {
      const next = [...p];
      const e = next[1];
      next[1] = { ...e, baseline: baselineRow5 };
      return next;
    });
  }, [fontLoaded]);

  // Recalculate text dimensions only when the source text or fonts change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    updateTextDimensions(ctx);
  }, [titles, subtitle, fontLoaded]);

  // Redraw the static canvas whenever its contents change (but only when not playing).
  useEffect(() => {
    if (!isPlaying) {
      drawCanvas();
    }
    // The animation loop handles drawing when isPlaying=true
  }, [
    backgroundColor,
    currentFrame,
    lines,
    lineThickness,
    tremblingIntensity,
    titlePositionsFrame1,
    titlePositionsFrame2,
    subtitlePositionFrame1,
    subtitlePositionFrame2,
    selectedTexts,
    groupRotation,
    titles,
    subtitle
  ]);

  useEffect(() => {
    setAnimationKey(k => k + 1);
    setIsPlaying(false);
    setPhase('idle');
    setBarProgress(0);
    if (barRef.current) barRef.current.style.width = '0%';
    startTimeRef.current = null;
    lastDisplayTimeRef.current = 0;
  }, [titles, subtitle]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null;
      lastDisplayTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      drawCanvas();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, animationKey]);

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

  /* keep the "instrument" block exactly halfway between title & swatches */
  useLayoutEffect(() => {
    const recalc = () => {
      if (
        !panelRef.current ||
        !titleRef.current ||
        !swatchRef.current ||
        !instrumentRef.current
      ) return

      const panelRect  = panelRef.current.getBoundingClientRect()
      const titleRect  = titleRef.current.getBoundingClientRect()
      const swatchRect = swatchRef.current.getBoundingClientRect()

      /* midway between the title block and the colour-picker row */
      const midpoint   = (titleRect.bottom + swatchRect.top) / 2
      const instHeight = instrumentRef.current.offsetHeight
      setInstrumentTop(midpoint - panelRect.top - instHeight / 2)
    }

    recalc()                            // initial paint
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [titles, subtitle, fontLoaded])    // re-check whenever the title changes

  // ─── TEXT DIMENSION UPDATER ──────────────────────────────────────────────────────
  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (txt: string, fs: number, ff = SUL_SANS, bold = true) => {
      ctx.font = `${bold ? 'bold ' : ''}${fs}px "${ff}", sans-serif`;
      const m = ctx.measureText(txt);

      /*  ▸ key numbers we need  */
      const ascent = m.actualBoundingBoxAscent ?? fs * 0.90;
      const descent = m.actualBoundingBoxDescent ?? fs * 0.10;

      return {
        width: m.width,
        height: ascent + descent,
        ascent,
        descent,
      };
    };

    // ── TITLES ───────────────────────────────────────────────
    setTitlePositionsFrame1(prev =>
      prev.map((pos, i) => {
        const { width, height, ascent, descent } = measureText(titles[i], pos.fontSize, SUL_SANS, true)
        return recalcSafeBox({ ...pos, width, height, ascent, descent })
      })
    )

    setTitlePositionsFrame2(prev =>
      prev.map((pos, i) => {
        const { width, height, ascent, descent } = measureText(titles[i], pos.fontSize, SUL_SANS, true)
        return recalcSafeBox({ ...pos, width, height, ascent, descent })
      })
    )

    // ── SUBTITLE ───────────────────────────────────────────────
    const instr  = 'Instrumento:';
    const aff    = AFFAIRS;

    const instrM = measureText(instr,    subtitlePositionFrame1.fontSize, aff, false);
    const valM   = measureText(subtitle, subtitlePositionFrame1.fontSize, aff, false);

    /* 1 ▸ measurements -------------------------------------------------- */
    const capAscent = instrM.ascent;                       // cap-height of "I"
    const subAscent = Math.max(instrM.ascent,  valM.ascent);
    const subDesc   = Math.max(instrM.descent, valM.descent);

    const subtitleWidth  = Math.max(instrM.width, valM.width);
    const lineGap        = 8;
    const subtitleHeight = subAscent + subDesc        // first line
                         + lineGap
                         + valM.ascent + valM.descent;

    /* 2 ▸ baseline = top of row-7 + cap-height (keeps "I" on the guide) */
    const row6Top     = rowY(6);                // top guide of the 7-th grid row
    const subBaseline = row6Top + capAscent;

    /* 3 ▸ update helper -------------------------------------------------- */
    const updSubtitle = (p: TextPosition): TextPosition => ({
      ...p,
      baseline : subBaseline,   // stays locked to the guide
      ascent   : subAscent,     // <- IMPORTANT: use the *tallest* ascent again
      descent  : subDesc,
      width    : subtitleWidth,
      height   : subtitleHeight,
    });

    /* 4 ▸ apply to both frames ------------------------------------------ */
    setSubtitlePositionFrame1(updSubtitle);
    setSubtitlePositionFrame2(updSubtitle);
  }

  // ─── DRAWING ROUTINES ────────────────────────────────────────────────────────────
  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (showGuides) drawGuides(ctx)        // ← overlay guides

    if (isPlaying) {
      drawAnimatedContent(ctx, progress)
      return
    }

    const framelines = lines.filter(l => l.frame === currentFrame)
    drawLines(ctx, framelines)
    // draw through your animated‐text routine, with zero movement/scale
    drawAnimatedText(ctx, 0, 0, currentFrame, currentFrame)

    if (currentFrame === 2 && selectedTexts.length > 0) {
      const groupBox = calculateGroupBoundingBox()
      if (groupBox) {
        drawGroupBoundingBox(ctx, groupBox)
      } else {
        titlePositionsFrame2.forEach((pos, idx) => {
          if (selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')) {
            drawBoundingBox(ctx, pos)
          }
        })
        if (selectedTexts.includes('subtitle')) {
          drawBoundingBox(ctx, subtitlePositionFrame2)
        }
      }
    }
  }

  // ─── STATIC TEXT DRAW WITH TREMBLING ─────────────────────────────────────────────
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2;
    const subPos = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2;

    positions.forEach((pos, idx) =>
      drawTextBlock(ctx, titles[idx], pos, SUL_SANS, true, true)
    );
    drawTextBlock(ctx, 'Instrumento:', subPos, AFFAIRS, false, false);
    drawTextBlock(ctx, subtitle,        subPos, AFFAIRS, false, false);
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, pos: TextPosition, text: string) => {
    ctx.save()
    // Draw at baseline coordinates
    ctx.translate(pos.x, pos.baseline)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px "${SUL_SANS}", sans-serif`
    ctx.fillStyle = getContrastColor()
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

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

  // ─── TEXT BLOCK DRAW HELPER ─────────────────────────────────────────────
  function drawTextBlock(
    ctx: CanvasRenderingContext2D,
    text: string,
    pos: TextPosition,
    fontFamily: string,
    bold: boolean,
    alignCenter: boolean
  ) {
    // compute the "safe" bounding-box
    const w = pos.boxW ?? pos.width;
    const h = pos.boxH ?? pos.height;
    // figure out the top-left of that box from baseline/ascent
    const topY = pos.baseline - pos.ascent;
    // center point
    const cx = pos.x + w/2;
    const cy = topY + h/2;
    // how much to move from center to the alphabetic baseline
    const baselineOffset = pos.ascent - h/2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pos.rotation);
    ctx.font = `${bold ? 'bold ' : ''}${pos.fontSize}px "${fontFamily}", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = alignCenter ? 'center' : 'left';
    ctx.fillText(text, alignCenter ? 0 : -w/2, baselineOffset);
    ctx.restore();
  }

  const drawAnimatedText = (
    ctx: CanvasRenderingContext2D,
    moveT: number,
    scaleT: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const titlesArr     = titles
    const fromPositions = fromFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
    const toPositions   = toFrame   === 1 ? titlePositionsFrame1 : titlePositionsFrame2

    titlesArr.forEach((text, i) => {
      const p1 = fromPositions[i]
      const p2 = toPositions[i]

      // 1) interpolate position & rotation
      const x0        = p1.x        + (p2.x        - p1.x)        * moveT
      const baseline0 = p1.baseline + (p2.baseline - p1.baseline) * moveT
      const rotation  = p1.rotation + (p2.rotation - p1.rotation) * moveT

      // 2) interpolate size metrics
      const fontSize   = p1.fontSize + (p2.fontSize - p1.fontSize) * scaleT
      const dynW       = p1.width    + (p2.width    - p1.width)    * scaleT
      const dynH       = p1.height   + (p2.height   - p1.height)   * scaleT
      const dynAscent  = p1.ascent   + (p2.ascent   - p1.ascent)   * scaleT
      const dynDescent = p1.descent  + (p2.descent  - p1.descent)  * scaleT

      // 3) pin the rotated top-left corner
      const dAsc = dynAscent - p1.ascent
      const sx   = x0        + dAsc * Math.sin(rotation)
      const bl   = baseline0 + dAsc * Math.cos(rotation)

      // trembling
      const tremX = (Math.random() - 0.5) * tremblingIntensity
      const tremY = (Math.random() - 0.5) * tremblingIntensity

      // build interpolated TextPosition
      const interpPos: TextPosition = {
        x: sx,
        baseline: bl,
        ascent: dynAscent,
        descent: dynDescent,
        width: dynW,
        height: dynH,
        rotation,
        fontSize,
        boxW: dynW,
        boxH: dynH,
      };
      // draw
      drawTextBlock(ctx, text, interpPos, SUL_SANS, true, true);
    })

    // Subtitle
    const sub1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const sub2 = toFrame   === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    {
      const xMove   = sub1.x        + (sub2.x        - sub1.x)        * moveT
      const baseMov = sub1.baseline + (sub2.baseline - sub1.baseline) * moveT
      const rot     = sub1.rotation + (sub2.rotation - sub1.rotation) * moveT
      const size = sub1.fontSize + (sub2.fontSize - sub1.fontSize) * scaleT
      const asc1 = sub1.ascent
      const asc2 = sub2.ascent
      const asc  = asc1 + (asc2 - asc1) * scaleT
      const desc = sub1.descent + (sub2.descent - sub1.descent) * scaleT
      const w    = sub1.width + (sub2.width - sub1.width) * scaleT
      const h    = sub1.height + (sub2.height - sub1.height) * scaleT
      const dAsc = asc - asc1
      const sx       = xMove   + dAsc * Math.sin(rot)
      const baseline = baseMov + dAsc * Math.cos(rot)
      const interpSub: TextPosition = {
        x: sx,
        baseline,
        ascent: asc,
        descent: desc,
        width: w,
        height: h,
        rotation: rot,
        fontSize: size,
        boxW: w,
        boxH: h,
      }
      drawTextBlock(ctx, 'Instrumento:', interpSub, AFFAIRS, false, false);
      drawTextBlock(ctx, subtitle,        interpSub, AFFAIRS, false, false);
    }
  }

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos: TextPosition) => {
    // Calculate top position from baseline and ascent
    const topY = pos.baseline - pos.ascent;
    const boxWidth = pos.boxW ?? pos.width;
    const boxHeight = pos.boxH ?? pos.height;
    const cx = pos.x + boxWidth / 2;
    const cy = topY + boxHeight / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pos.rotation);
    const hw = boxWidth / 2;
    const hh = boxHeight / 2;
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, boxWidth, boxHeight);
    const handleSize = HANDLE_ICON        // only the icon uses this size
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
    ];
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
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

  // ─── BOUNDING BOX CALCULATORS ───────────────────────────────────────────────────
  /** Return a bounding rectangle that truly encloses every rotated element.
    * The rectangle itself lives in the same rotation space as `groupRotation`
    * so resizing / rotating from the handles stays intuitive. */
  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (!selectedTexts.length) return null

    /* ── collect every selected element ─────────────────────────────── */
    const picked: TextPosition[] = titlePositionsFrame2
      .filter((_, i) => selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2'))
    if (selectedTexts.includes('subtitle')) picked.push(subtitlePositionFrame2)
    if (!picked.length) return null

    /* ── project every corner into the axis-pair defined by groupRotation ─ */
    const cosR = Math.cos(groupRotation)
    const sinR = Math.sin(groupRotation)
    const ux =  cosR,  uy = sinR          // unit vector along the box's X-axis
    const vx = -sinR,  vy = cosR          // unit vector along the box's Y-axis

    let minU =  Infinity
    let maxU = -Infinity
    let minV =  Infinity
    let maxV = -Infinity

    picked.forEach(pos => {
      getRotatedBoundingBox(pos).forEach(pt => {
        const u = pt.x * ux + pt.y * uy   // projection onto axis-u
        const v = pt.x * vx + pt.y * vy   // projection onto axis-v
        minU = Math.min(minU, u)
        maxU = Math.max(maxU, u)
        minV = Math.min(minV, v)
        maxV = Math.max(maxV, v)
      })
    })

    /* centre in the rotated space, then convert back to world coords */
    const cU = (minU + maxU) / 2
    const cV = (minV + maxV) / 2
    const worldCX = cU * ux + cV * vx
    const worldCY = cU * uy + cV * vy

    return {
      x: worldCX - (maxU - minU) / 2,
      y: worldCY - (maxV - minV) / 2,
      width:  maxU - minU,
      height: maxV - minV,
      rotation: groupRotation
    }
  }

  // ─── MOUSE & INTERACTION HANDLERS ──────────────────────────────────────────────
  const getResizeHandle = (
    x: number,
    y: number,
    position: TextPosition | GroupBoundingBox
  ): string | null => {
    const handleSize = HANDLE_DETECT      // much easier to hit
    
    // Calculate center based on type
    let cx: number, cy: number, rot: number, width: number, height: number;
    
    if ('baseline' in position) {
      // TextPosition - calculate center from baseline and ascent
      const topY = position.baseline - position.ascent;
      width = position.boxW ?? position.width;
      height = position.boxH ?? position.height;
      cx = position.x + width / 2;
      cy = topY + height / 2;
      rot = position.rotation;
    } else {
      // GroupBoundingBox - use y directly
      cx = position.x + position.width / 2;
      cy = position.y + position.height / 2;
      rot = position.rotation;
      width = position.width;
      height = position.height;
    }
    
    const dx = x - cx;
    const dy = y - cy;
    const ux = dx * Math.cos(-rot) - dy * Math.sin(-rot);
    const uy = dx * Math.sin(-rot) + dy * Math.cos(-rot);
    const hw = width / 2;
    const hh = height / 2;

    if (Math.abs(ux + hw) <= handleSize / 2 && Math.abs(uy + hh) <= handleSize / 2) return 'nw-resize';
    if (Math.abs(ux - hw) <= handleSize / 2 && Math.abs(uy + hh) <= handleSize / 2) return 'ne-resize';
    if (Math.abs(ux - hw) <= handleSize / 2 && Math.abs(uy - hh) <= handleSize / 2) return 'se-resize';
    if (Math.abs(ux + hw) <= handleSize / 2 && Math.abs(uy - hh) <= handleSize / 2) return 'sw-resize';

    if (Math.abs(ux) < hw && Math.abs(uy) < hh) return 'move';
    return null;
  }

  const isPointNearRotationArea = (
    x: number,
    y: number,
    position: TextPosition | GroupBoundingBox
  ): boolean => {
    const handleSize = HANDLE_DETECT;
    const rotArea = 20;                 // keep rotation ring generous
    
    // Calculate center based on type
    let cx: number, cy: number, rot: number, width: number, height: number;
    
    if ('baseline' in position) {
      // TextPosition - calculate center from baseline and ascent
      const topY = position.baseline - position.ascent;
      width = position.boxW ?? position.width;
      height = position.boxH ?? position.height;
      cx = position.x + width / 2;
      cy = topY + height / 2;
      rot = position.rotation;
    } else {
      // GroupBoundingBox - use y directly
      cx = position.x + position.width / 2;
      cy = position.y + position.height / 2;
      rot = position.rotation;
      width = position.width;
      height = position.height;
    }
    
    const dx = x - cx;
    const dy = y - cy;
    const ux = dx * Math.cos(-rot) - dy * Math.sin(-rot);
    const uy = dx * Math.sin(-rot) + dy * Math.cos(-rot);
    const hw = width / 2;
    const hh = height / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
    for (const c of corners) {
      const dist = Math.hypot(ux - c.x, uy - c.y);
      if (dist > handleSize / 2 && dist <= handleSize / 2 + rotArea) return true;
    }
    return false;
  }

  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    /* ── GROUP (when multiple items are selected) ── */
    const groupBox = calculateGroupBoundingBox()
    if (
      groupBox &&
      currentFrame === 2 &&
      isPointInRotatedBox(x, y, getRotatedGroupBoundingBox(groupBox))
    ) {
      /* rotation ring around the group */
      if (isPointNearRotationArea(x, y, groupBox)) {
        canvas.style.cursor =
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
        return
      }

      /* resize handles (corners / edges) */
      const handle = getResizeHandle(x, y, groupBox)
      if (handle) {
        canvas.style.cursor = handle
        return
      }

      /* body of the group → move */
      canvas.style.cursor = 'move'
      return
    }

    /* ── SINGLE ELEMENTS ─────────────────────────── */
    const positions = currentFrame === 1
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]

    for (const pos of positions) {
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(pos))) {
        if (currentFrame === 2) {
          if (isPointNearRotationArea(x, y, pos)) {
            canvas.style.cursor =
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto'
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

    /* ── otherwise ── */
    canvas.style.cursor = 'default'
  }

  // ─── ANIMATION LOOP ─────────────────────────────────────────────────────────────
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current
    const msPerBase = 1000 / baseFps
    let progress = (elapsed / (msPerBase * 150))
    console.log('ANIMATE', { timestamp, isPlaying, progress, barProgress, phase });

    /* ── loop handling ─────────────────────────── */
    if (progress >= PROGRESS_END) {
      if (isLooping) {
        // restart immediately
        startTimeRef.current = timestamp
        progress = 0                  // ← first frame of new cycle
        setBarProgress(0)             // ① instantly hide the black bar
      } else {
        setIsPlaying(false)
        setBarProgress(1)             // keep bar filled at the very end
        return
      }
    } else {
      /* normal progress update */
      setBarProgress(progress / PROGRESS_END)   // ② animate bar
    }

    /* Throttled canvas draw (unchanged) */
    if (timestamp - lastDisplayTimeRef.current >= 1000 / frameRate) {
      drawCanvas(progress)
      lastDisplayTimeRef.current = timestamp
    }

    const newProgress = Math.min(progress / PROGRESS_END, 1);
    if (barRef.current) {
      barRef.current.style.width = `${newProgress * 100}%`;
    }

    if (isPlaying) animationRef.current = requestAnimationFrame(animate)
  }

  const drawAnimatedContent = (ctx: CanvasRenderingContext2D, p: number) => {
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

  // ─── FRAME CONTROLS ─────────────────────────────────────────────────────────────
  const handleFrameChange = (frame: 1 | 2) => {
    setCurrentFrame(frame);

    /* When the user visits Frame 2 for the first time, copy positions
       so the left margin & row baselines match Frame 1.                  */
    if (frame === 2 && !frame2Initialised) {
      setTitlePositionsFrame2(titlePositionsFrame1);
      setSubtitlePositionFrame2(subtitlePositionFrame1);
      setFrame2Initialised(true);          // never run again
    }

    setSelectedTexts([]);
    drawCanvas();
  };

  const handlePlayClick = () => {
    if (barRef.current) barRef.current.style.width = '0%';
    if (isPlaying) {
      // Try to forcibly stop everything
      setIsPlaying(false);
      setPhase('paused');
      setTimeout(() => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        startTimeRef.current = null;
        lastDisplayTimeRef.current = 0;
        setBarProgress(0);
      }, 10);
    } else {
      // Try to forcibly reset and play
      setPhase('idle');
      setTimeout(() => {
        setBarProgress(0);
        startTimeRef.current = null;
        lastDisplayTimeRef.current = 0;
        setIsPlaying(true);
        setOriginFrame(currentFrame as 1 | 2);
        setPhase('merge');
        setTimeout(() => setPhase('playing'), 300);
      }, 10);
    }
  };

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
  const getContrastColor = () => '#000000'

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

  // ─── GUIDE DRAWER ───────────────────────────────────────────────────────────
  const drawGuides = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth   = 1

    // outer margin box
    ctx.strokeRect(M + 0.5, M + 0.5, ctx.canvas.width - M*2, ctx.canvas.height - M*2)

    // horizontal rows
    for (let i = 1; i < ROWS; i++) {
      const y = rowY(i) + 0.5
      ctx.beginPath()
      ctx.moveTo(M, y)
      ctx.lineTo(ctx.canvas.width - M, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // One-shot baseline snap for the "Instrumento:" block
  const subtitleInit = useRef(false);
  useEffect(() => {
    if (!fontLoaded || subtitleInit.current) return;

    // measure "Instrumento:" once to get its ascent (cap-height proxy)
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d')!;
    const fSize  = subtitlePositionFrame1.fontSize;          // e.g. 32
    ctx.font     = `${fSize}px "${AFFAIRS}", serif`;
    const m      = ctx.measureText('Instrumento:');
    const ascent = m.actualBoundingBoxAscent ?? fSize * 0.9; // fallback

    // we want the TOP of row 6 to kiss the capital-I cap-height
    const row6Top  = rowY(6);          // top guide of row 6
    const baseline = row6Top + ascent; // alphabetic baseline for line 1

    // set once for both frames – users can still move/rotate in Frame 2
    setSubtitlePositionFrame1(p => ({ ...p, baseline, ascent }));
    setSubtitlePositionFrame2(p => ({ ...p, baseline, ascent }));

    subtitleInit.current = true;       // never run again
  }, [fontLoaded]);

  const pointToLineDistance = (pt: Point, a: Point, b: Point): number => {
    const A = pt.x - a.x;
    const B = pt.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = a.x;
      yy = a.y;
    } else if (param > 1) {
      xx = b.x;
      yy = b.y;
    } else {
      xx = a.x + param * C;
      yy = a.y + param * D;
    }
    const dx = pt.x - xx;
    const dy = pt.y - yy;
    return Math.hypot(dx, dy);
  }

  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x;
      const yi = box[i].y;
      const xj = box[j].x;
      const yj = box[j].y;
      const intersect = (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const getRotatedBoundingBox = (pos: TextPosition): Point[] => {
    // Calculate top position from baseline and ascent
    const topY = pos.baseline - pos.ascent;
    const w = pos.boxW ?? pos.width;
    const h = pos.boxH ?? pos.height;
    const cx = pos.x + w / 2;
    const cy = topY + h / 2;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ];
    return corners.map(c => {
      const rx = c.x * Math.cos(pos.rotation) - c.y * Math.sin(pos.rotation);
      const ry = c.x * Math.sin(pos.rotation) + c.y * Math.cos(pos.rotation);
      return { x: rx + cx, y: ry + cy };
    });
  }

  const getRotatedGroupBoundingBox = (box: GroupBoundingBox): Point[] => {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const w = box.width;
    const h = box.height;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 }
    ];
    return corners.map(c => {
      const rx = c.x * Math.cos(box.rotation) - c.y * Math.sin(box.rotation);
      const ry = c.x * Math.sin(box.rotation) + c.y * Math.cos(box.rotation);
      return { x: rx + cx, y: ry + cy };
    });
  }

  const isPointNear = (
    point: Point,
    target: Point | Line,
    threshold = 10
  ): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      return Math.hypot(dx, dy) < threshold;
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold;
    }
  }

  // ─── DRAGGING & RESIZING FUNCTIONS ─────────────────────────────────────────────
  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return;
    const dx = x - lastMousePosition.current.x;
    const dy = y - lastMousePosition.current.y;
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx,
        baseline: prev.baseline + dy
      }));
    } else {
      setTitlePositionsFrame2(prev => {
        const newArr = [...prev];
        const idx = textType === 'title1' ? 0 : 1;
        newArr[idx] = {
          ...newArr[idx],
          x: newArr[idx].x + dx,
          baseline: newArr[idx].baseline + dy
        };
        return newArr;
      });
    }
    lastMousePosition.current = { x, y };
  }

  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return;
    const dx = x - lastMousePosition.current.x;
    const dy = y - lastMousePosition.current.y;
    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) => selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
        ? { ...pos, x: pos.x + dx, baseline: pos.baseline + dy }
        : pos
      )
    );
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({ ...prev, x: prev.x + dx, baseline: prev.baseline + dy }));
    }
    lastMousePosition.current = { x, y };
  }

  const resizeSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    handle: string
  ) => {
    if (!resizeStartPosition || !initialPosition) return;
    const ref = initialPosition;
    const refWidth = ref.boxW ?? ref.width;
    const refHeight = ref.boxH ?? ref.height;
    // Calculate center from baseline and ascent
    const topY = ref.baseline - ref.ascent;
    const cx = ref.x + refWidth / 2;
    const cy = topY + refHeight / 2;

    let scale: number;
    if (scaleAnchor === 'center') {
      // always scale relative to center
      const startDist = Math.hypot(resizeStartPosition.x - cx, resizeStartPosition.y - cy);
      const currDist  = Math.hypot(x - cx, y - cy);
      scale = startDist ? currDist / startDist : 1;
    } else {
      // original corner/edge logic
      const startVec = { x: resizeStartPosition.x - cx, y: resizeStartPosition.y - cy };
      const currVec  = { x: x - cx, y: y - cy };
      if (handle.includes('e') || handle.includes('w')) {
        scale = Math.abs(currVec.x) / Math.abs(startVec.x);
      } else if (handle.includes('n') || handle.includes('s')) {
        scale = Math.abs(currVec.y) / Math.abs(startVec.y);
      } else {
        scale = Math.hypot(currVec.x, currVec.y) / Math.hypot(startVec.x, startVec.y);
      }
    }
    scale = Math.max(0.1, scale);

    const newW = refWidth * scale;
    const newH = refHeight * scale;
    const newX = cx - newW/2;
    const newBaseline = ref.baseline; // Keep baseline at same position
    const newAscent = ref.ascent * scale;
    const newDescent = ref.descent * scale;
    
    let newPos: TextPosition = {
      ...position,
      x: newX,
      baseline: newBaseline,
      ascent: newAscent,
      descent: newDescent,
      width: ref.width * scale,     // scale the actual glyph width
      height: newH,
      boxW: newW,
      boxH: newH,
      fontSize: ref.fontSize * scale
    };

    /* one-step fix: update the "safe" square now, not later */
    newPos = recalcSafeBox(newPos);

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPos);
    } else {
      setTitlePositionsFrame2(arr => {
        const out = [...arr];
        out[textType === 'title1' ? 0 : 1] = newPos;
        return out;
      });
    }
  }

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPosition) return;

    const cx = initialGroupBox.x + initialGroupBox.width / 2;
    const cy = initialGroupBox.y + initialGroupBox.height / 2;

    const startVec = { x: resizeStartPosition.x - cx, y: resizeStartPosition.y - cy };
    const currVec = { x: x - cx, y: y - cy };

    let scale = 1;
    if (handle.includes('e') || handle.includes('w')) {
      scale = Math.abs(currVec.x) / Math.abs(startVec.x);
    } else if (handle.includes('n') || handle.includes('s')) {
      scale = Math.abs(currVec.y) / Math.abs(startVec.y);
    } else {
      scale = Math.hypot(currVec.x, currVec.y) / Math.hypot(startVec.x, startVec.y);
    }
    scale = Math.max(0.1, scale);

    const apply = (pos: TextPosition) => {
      // Calculate center from baseline and ascent
      const topY = pos.baseline - pos.ascent;
      const centerX = pos.x + pos.width / 2;
      const centerY = topY + pos.height / 2;
      const relCX = (centerX - cx) / initialGroupBox.width;
      const relCY = (centerY - cy) / initialGroupBox.height;
      const w = pos.width * scale;
      const h = pos.height * scale;
      const newCenterX = cx + relCX * initialGroupBox.width * scale;
      const newCenterY = cy + relCY * initialGroupBox.height * scale;
      return {
        ...pos,
        x: newCenterX - w / 2,
        baseline: newCenterY + pos.ascent * scale - h / 2,
        width: w,
        height: h,
        fontSize: pos.fontSize * scale
      };
    };

    setTitlePositionsFrame2(p =>
      p.map((pos, i) =>
        selectedTexts.includes(`title${i + 1}` as 'title1' | 'title2') ? apply(pos) : pos
      )
    );
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(apply);
    }
  }

  const rotateSingle = (
    x: number,
    y: number,
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle'
  ) => {
    if (!lastMousePosition.current) return;

    /* 1 ─ current centre of the text block */
    const boxW = position.boxW ?? position.width;
    const boxH = position.boxH ?? position.height;
    const topY = position.baseline - position.ascent;
    const cx   = position.x + boxW / 2;
    const cy   = topY        + boxH / 2;

    /* 2 ─ angle delta measured around that centre */
    const prevA = Math.atan2(
      lastMousePosition.current.y - cy,
      lastMousePosition.current.x - cx
    );
    const currA = Math.atan2(y - cy, x - cx);
    let delta = currA - prevA;
    if (delta >  Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    /* 3 ─ rotate baseline-left corner to keep the centre fixed */
    const offX = position.x - cx;             // centre → BL-corner
    const offY = position.baseline - cy;
    const cos  = Math.cos(delta);
    const sin  = Math.sin(delta);
    const newOffX = offX * cos - offY * sin;
    const newOffY = offX * sin + offY * cos;

    const apply = (p: TextPosition): TextPosition => ({
      ...p,
      x        : cx + newOffX,
      baseline : cy + newOffY,
      rotation : p.rotation + delta,
    });

    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(apply);
    } else {
      setTitlePositionsFrame2(prev => {
        const arr = [...prev];
        const idx = textType === 'title1' ? 0 : 1;
        arr[idx]  = apply(arr[idx]);
        return arr;
      });
    }

    lastMousePosition.current = { x, y };
  };

  const rotateGroup = (x: number, y: number, box: GroupBoundingBox) => {
    if (!lastMousePosition.current) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const lastAngle = Math.atan2(lastMousePosition.current.y - cy, lastMousePosition.current.x - cx);
    const currentAngle = Math.atan2(y - cy, x - cx);
    let delta = currentAngle - lastAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    setTitlePositionsFrame2(prev =>
      prev.map((pos, idx) =>
        selectedTexts.includes(`title${idx + 1}` as 'title1' | 'title2')
          ? rotateAroundPoint(pos, cx, cy, delta)
          : pos
      )
    );
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => rotateAroundPoint(prev, cx, cy, delta));
    }
    setGroupRotation(prev => prev + delta);
    lastMousePosition.current = { x, y };
  }

  const rotateAroundPoint = (
    pos: TextPosition,
    cx: number,
    cy: number,
    angle: number
  ): TextPosition => {
    // Calculate center from baseline and ascent
    const topY = pos.baseline - pos.ascent;
    const centerX = pos.x + pos.width / 2;
    const centerY = topY + pos.height / 2;
    const dx = centerX - cx;
    const dy = centerY - cy;
    const dist = Math.hypot(dx, dy);
    const currAngle = Math.atan2(dy, dx);
    const newAngle = currAngle + angle;
    const newCenterX = cx + dist * Math.cos(newAngle);
    const newCenterY = cy + dist * Math.sin(newAngle);
    const newX = newCenterX - pos.width / 2;
    // Calculate new baseline from new center and ascent
    const newBaseline = newCenterY + pos.ascent - pos.height / 2;
    return { ...pos, x: newX, baseline: newBaseline, rotation: pos.rotation + angle };
  }

  // ─── MOUSE EVENT HANDLERS ───────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    lastMousePosition.current = { x, y };

    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2;
    const subPos = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2;

    for (let i = 0; i < positions.length; i++) {
      const rotatedBox = getRotatedBoundingBox(positions[i]);
      if (isPointInRotatedBox(x, y, rotatedBox)) {
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y);
        return;
      }
    }
    const subBox = getRotatedBoundingBox(subPos);
    if (isPointInRotatedBox(x, y, subBox)) {
      handleTextInteraction(subPos, 'subtitle', x, y);
      return;
    }

    if (!isShiftPressed.current) {
      setSelectedTexts([]);
      setGroupRotation(0);
    }

    const clickedIdx = lines.findIndex(line =>
      line.frame === currentFrame &&
      (isPointNear({ x, y }, line) ||
        isPointNear({ x, y }, line.start) ||
        isPointNear({ x, y }, line.end))
    );

    if (clickedIdx !== -1) {
      setSelectedLineIndex(clickedIdx);
      const ln = lines[clickedIdx];
      const nearStart = isPointNear({ x, y }, ln.start);
      const nearEnd = isPointNear({ x, y }, ln.end);

      if (nearStart || nearEnd) {
        setEditingLineIndex(clickedIdx);
        setEditingEnd(nearStart ? 'start' : 'end');   // remember which point we grabbed
      } else {
        setIsDraggingLine(true);
      }
      return;
    }

    setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame });
    drawCanvas();
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (isDraggingLine && selectedLineIndex !== null && lastMousePosition.current) {
      const dx = x - lastMousePosition.current.x;
      const dy = y - lastMousePosition.current.y;
      setLines(prev =>
        prev.map((ln, i) =>
          i === selectedLineIndex
            ? { ...ln,
                start: { x: ln.start.x + dx, y: ln.start.y + dy },
                end: { x: ln.end.x + dx, y: ln.end.y + dy } }
            : ln
        )
      );
      lastMousePosition.current = { x, y };
      drawCanvas();
      return;
    } else if (editingLineIndex !== null && editingEnd !== null) {
      setLines(prev => {
        const arr = [...prev];
        const ln = { ...arr[editingLineIndex] };
        if (editingEnd === 'start') ln.start = { x, y };
        else ln.end = { x, y };
        arr[editingLineIndex] = ln;
        return arr;
      });
      drawCanvas();
      return;
    }

    if (selectedTexts.length > 0 && currentFrame === 2) {
      if (isRotating) {
        const groupBox = calculateGroupBoundingBox();
        if (groupBox) rotateGroup(x, y, groupBox);
      } else if (isDragging) {
        if (selectedTexts.length === 1) {
          dragSingle(x, y, selectedTexts[0]);
        } else {
          dragGroup(x, y);
        }
      } else if (isResizing && resizeHandle) {
        if (selectedTexts.length === 1) {
          const txt = selectedTexts[0];
          const pos = txt === 'subtitle'
            ? subtitlePositionFrame2
            : titlePositionsFrame2[txt === 'title1' ? 0 : 1];
          resizeSingle(x, y, pos, txt, resizeHandle);
        } else {
          resizeGroup(x, y, resizeHandle);
        }
      }
      drawCanvas();
    } else if (currentLine) {
      setCurrentLine(prev => prev ? { ...prev, end: { x, y } } : null);
      drawCanvas();
    }
    updateCursor(canvas, x, y);
  }

  const handleMouseUp = () => {
    if (isPlaying) return;
    if (currentLine) {
      setLines(prev => [...prev, currentLine]);
      setCurrentLine(null);
    }
    setEditingLineIndex(null);
    setIsResizing(false);
    setIsDragging(false);
    setIsRotating(false);
    setResizeHandle(null);
    setResizeStartPosition(null);
    setIsDraggingLine(false);
    setEditingEnd(null);
    lastMousePosition.current = null;
    drawCanvas();
  }

  // Capture base font size when opening modal
  const handleTextDoubleClick = (pos: TextPosition) => {
    setEditingPosition(pos);
    setEditingBaseFontSize(pos.fontSize);
  }

  // Update handleTextInteraction to use new double click handler
  const handleTextInteraction = (
    position: TextPosition,
    textType: 'title1' | 'title2' | 'subtitle',
    x: number,
    y: number
  ) => {
    if (currentFrame !== 2) return;
    const now = Date.now();
    const isDoubleClick = now - lastClickTime.current < 300;
    lastClickTime.current = now;

    lastMousePosition.current = { x, y };
    if (isShiftPressed.current) {
      setSelectedTexts(prev => {
        const newSel = prev.includes(textType)
          ? prev.filter(t => t !== textType)
          : [...prev, textType];

        if (newSel.length > 1) {
          // take the rotation of the element we just clicked
          setGroupRotation(position.rotation);
        }
        return newSel;
      });
    } else {
      setSelectedTexts([textType]);
      setGroupRotation(position.rotation);
    }

    setIsResizing(false);
    setIsDragging(false);
    setIsRotating(false);
    setResizeHandle(null);

    if (isPointNearRotationArea(x, y, position)) {
      setIsRotating(true);
      const grp = calculateGroupBoundingBox();
      if (grp) setInitialGroupBox(grp);
    } else {
      const handle = getResizeHandle(x, y, position);
      if (handle) {
        if (handle === 'move') {
          setIsDragging(true);
        } else {
          setResizeHandle(handle);
          setIsResizing(true);
          setResizeStartPosition({ x, y });
          setInitialPosition(position);
        }
      } else {
        setIsDragging(true);
      }
    }

    drawCanvas();
    if (isDoubleClick) {
      setPositionModalOpen(true);
      handleTextDoubleClick(position);
    }
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  console.log('RENDER', { phase, isPlaying, titles, subtitle });
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      {/* set a 17px base font-size here; the "1. 2. 3." spans still override to 11px */}
      <div className="bg-white border-2 border-gray-200 p-4 rounded-2xl font-ui text-[17px]">
        {/* now: 8px gap */}
        <div className="flex space-x-2">
          {/* left panel: add panelRef so we can measure top/bottom */}
          <div ref={panelRef} className="w-[540px] h-[747px] relative pt-0 pr-6">
            {/*  A. header (stays at the very top) */}
            <h1 className="text-[17px] font-bold leading-tight mb-4">
              Cordofonia Instagram<br />Posts Creator Tool
            </h1>

            {/* 1 ─ TITLE (already perfect) */}
            <div
              ref={titleRef}
              className="absolute left-0 top-1/2"
            >
              <div className="w-[266px] space-y-0.5">
                <FieldGroup step={1} label="Write a title">
                  <Input
                    value={titles[0]}
                    onChange={e => setTitles([e.target.value, titles[1]])}
                    className="
                      h-9 w-full
                      bg-[#E5E5E5] text-[17px]
                      rounded-none
                      border border-transparent
                      focus:bg-[#9E9E9E]
                      focus:border-transparent
                      focus:ring-0 focus:outline-none
                      focus-visible:ring-0 focus-visible:outline-none
                    "
                  />
                  <Input
                    value={titles[1]}
                    onChange={e => setTitles([titles[0], e.target.value])}
                    className="
                      h-9 w-full
                      bg-[#E5E5E5] text-[17px]
                      rounded-none
                      border border-transparent
                      focus:bg-[#9E9E9E]
                      focus:border-transparent
                      focus:ring-0 focus:outline-none
                      focus-visible:ring-0 focus-visible:outline-none
                    "
                  />
                </FieldGroup>
              </div>
            </div>

            {/* 2 ─ Instrument (auto-midpoint between #1 & #3) */}
            <div
              ref={instrumentRef}
              className="absolute left-0"
              style={{ top: instrumentTop ?? '50%' }}
            >
              <div className="w-[266px] space-y-2">
                <FieldGroup step={2} label="Write the instrument">
                  <Input
                    value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    className="
                      h-9 w-full
                      bg-[#E5E5E5] text-[17px]
                      rounded-none
                      border border-transparent
                      focus:bg-[#9E9E9E]
                      focus:border-transparent
                      focus:ring-0 focus:outline-none
                      focus-visible:ring-0 focus-visible:outline-none
                    "
                  />
                </FieldGroup>
              </div>
            </div>

            {/* 3 ─ COLOUR PICKER (already perfect) */}
            <div ref={swatchRef} className="absolute left-0 w-full bottom-0">
              <FieldGroup step={3} label="Pick a color">
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
                          ? 'ring-4 ring-inset ring-black'   /* thicker inner ring */
                          : 'ring-0'}
                      `}
                    />
                  ))}
                </div>
              </FieldGroup>
            </div>
          </div>

          {/* right panel */}
          <div className="w-[540px] flex flex-col">
            <div
              className="w-[540px] h-[675px] bg-white rounded-none mb-2 relative overflow-hidden"
              style={{ backgroundColor }}
            >
              <canvas
                key={animationKey}
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
                  col-span-2 relative flex items-stretch
                  transition-[gap] duration-300 ease-in-out
                  ${phase === 'merge' || phase === 'playing' ? 'gap-0' : 'gap-2'}
                `}
              >
                {/* ——— Frame 1 ——— */}
                <div className="relative flex-1 overflow-visible">
                  <Button
                    ref={frame1Ref}
                    onClick={() => handleFrameChange(1)}
                    disabled={phase !== 'idle' && phase !== 'paused'}
                    className={`
                      w-full h-full flex-1 overflow-hidden rounded-none relative z-10
                      transition-colors duration-300
                      text-[17px]
                      ${phase === 'merge' || phase === 'playing'
                        ? 'bg-[#E5E5E5] text-transparent'
                        : currentFrame === 1
                          ? 'bg-black text-white hover:bg-[#9E9E9E] hover:text-black'
                          : 'bg-[#E5E5E5] text-black hover:bg-[#9E9E9E] hover:text-black'
                        }
                    `}
                  >
                    Frame&nbsp;1
                  </Button>
                </div>

                {/* ——— Frame 2 (mirror) ——— */}
                <div className="relative flex-1 overflow-visible">
                  <Button
                    ref={frame2Ref}
                    onClick={() => handleFrameChange(2)}
                    disabled={phase !== 'idle' && phase !== 'paused'}
                    className={`
                      w-full h-full flex-1 overflow-hidden rounded-none relative z-10
                      transition-colors duration-300
                      text-[17px]
                      ${phase === 'merge' || phase === 'playing'
                        ? 'bg-[#E5E5E5] text-transparent'
                        : currentFrame === 2
                          ? 'bg-black text-white hover:bg-[#9E9E9E] hover:text-black'
                          : 'bg-[#E5E5E5] text-black hover:bg-[#9E9E9E] hover:text-black'
                        }
                    `}
                  >
                    Frame&nbsp;2
                  </Button>
                </div>
                
                {/* --- BLACK PROGRESS BAR (on top of the grey track) --- */}
                <div
                  ref={barRef}
                  className="absolute inset-0 bg-black pointer-events-none z-10 transition-opacity duration-150"
                  style={{
                    opacity: phase === 'playing' || phase === 'merge' ? 1 : 0,
                    width: 0
                  }}
                />
              </div>

              {/* --- PLAY / PAUSE OVAL (1/4 width) --- */}
              <Button
                onClick={handlePlayClick}
                className="w-full h-full rounded-full flex items-center justify-center bg-[#E5E5E5] text-black hover:bg-[#CACACA]"
              >
                {phase==='playing'
                  ? <span className="sf-icon text-xl">􀊅</span>
                  : <span className="sf-icon text-xl">􀊄</span>}
              </Button>

              {/* --- SETTINGS & EXPORT (1/4 width) --- */}
              <div className="flex gap-2 w-full items-center">
                <Button
                  onClick={() => setSettingsOpen(true)}
                  className="flex-1 aspect-square bg-[#E5E5E5] text-black hover:bg-[#CACACA] rounded-none flex items-center justify-center text-inherit"
                >
                  <span className="sf-icon text-xl">􀌆</span>
                </Button>

                <Button
                  onClick={exportVideo}
                  className="flex-1 aspect-square bg-[#E5E5E5] text-black hover:bg-[#CACACA] rounded-none flex items-center justify-center text-inherit"
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
                  value={editingPosition.baseline}
                  onChange={e => setEditingPosition({ ...editingPosition, baseline: Number(e.target.value) })}
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
                    const scale = Number(e.target.value) / 100;
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: editingBaseFontSize * scale
                    });
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
                  const num = Number(v);
                  if (!isNaN(num)) setBaseFps(num);
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
                  const num = Number(v);
                  if (!isNaN(num)) {
                    handleSettingsChange('frameRate', num);
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
            {/* show / hide guides */}
            <div className="flex items-center space-x-2">
              <input
                id="guideToggle"
                type="checkbox"
                checked={showGuides}
                onChange={e => setShowGuides(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <Label htmlFor="guideToggle" className="text-sm text-gray-600">
                Show 8-row guide
              </Label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
const recalcSafeBox = (p: TextPosition): TextPosition => {
  const θ  = p.rotation ?? 0
  const sW = Math.abs(p.width  * Math.cos(θ)) + Math.abs(p.height * Math.sin(θ))
  const sH = Math.abs(p.width  * Math.sin(θ)) + Math.abs(p.height * Math.cos(θ))
  return { ...p, boxW: sW, boxH: sH }
}

const withSafeBox = (p: TextPosition) => recalcSafeBox(p)

// Utility: get geometric center and baseline offset for a TextPosition
const centerOf = (p: TextPosition) => {
  const w = p.boxW ?? p.width
  const h = p.boxH ?? p.height
  const topY = p.baseline - p.ascent
  return {
    cx: p.x + w / 2,
    cy: topY + h / 2,
    // baseline (cap-height of line 1) relative to the centre of the block
    baselineOffset: p.ascent - h / 2
  }
} 