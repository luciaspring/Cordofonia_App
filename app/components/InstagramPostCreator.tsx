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

// Ease In-Out Quint
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
    { x: 40, y: 400,  width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550,  width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400,  width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550,  width: 1000, height: 200, rotation: 0, fontSize: 180 },
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>(
    { x: 40, y: 1000, width:1000, height:30, rotation:0, fontSize:36 }
  )
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>(
    { x: 40, y: 1000, width:1000, height:30, rotation:0, fontSize:36 }
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
  const [lineDisappearEffect, setLineDisappearEffect] = useState<boolean>(false)
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
    const down = (e: KeyboardEvent) => { if (e.key==='Shift') isShiftPressed.current = true }
    const up   = (e: KeyboardEvent) => { if (e.key==='Shift') isShiftPressed.current = false }
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
    tremblingAffectsText,
    lineDisappearEffect
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

    // background fill
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, c.width, c.height)

    if (isPlaying) {
      // your existing split‐progress logic for animated draw:
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

    // static mode
    const frameLines = lines.filter(l => l.frame===currentFrame)
    drawLines(ctx, frameLines)
    drawStaticText(ctx, currentFrame)

    // bounding boxes on frame2
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

  // ─── DRAW STATIC TEXT ────────────────────────────────────────────────────────────
  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame===1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos    = frame===1 ? subtitlePositionFrame1  : subtitlePositionFrame2

    // titles
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

    // subtitle
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

  // ─── DRAW LINES ─────────────────────────────────────────────────────────────────
  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap   = 'butt'
    ctx.lineJoin  = 'round'
    ctx.strokeStyle = '#0000FF'
    framelines.forEach(line => {
      const tremX = (Math.random()-0.5)*tremblingIntensity
      const tremY = (Math.random()-0.5)*tremblingIntensity
      ctx.beginPath()
      ctx.moveTo(line.start.x+tremX, line.start.y+tremY)
      ctx.lineTo(line.end.x+tremX,   line.end.y+tremY)
      ctx.stroke()
    })
    if (currentLine) {
      const tremX = (Math.random()-0.5)*tremblingIntensity
      const tremY = (Math.random()-0.5)*tremblingIntensity
      ctx.beginPath()
      ctx.moveTo(currentLine.start.x+tremX, currentLine.start.y+tremY)
      ctx.lineTo(currentLine.end.x+tremX,   currentLine.end.y+tremY)
      ctx.stroke()
    }
  }

  // ─── DRAW ANIMATED LINES ────────────────────────────────────────────────────────
  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow'|'shrink'
  ) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap   = 'butt'
    ctx.lineJoin  = 'round'
    ctx.strokeStyle = '#000000'

    const duration = 0.3
    const maxDelay = 0.2

    const drawFrame = (arr: Line[], fgProg: number) => {
      const delay = arr.length>1 ? maxDelay/(arr.length-1) : 0
      arr.forEach((ln,idx) => {
        let t = Math.max(0, Math.min(1, (fgProg - idx*delay)/duration))
        t = easeInOutQuint(t)
        const { start, end } = ln
        
        let currentStart: Point, currentEnd: Point
        
        if (animationType === 'grow') {
          // Growing: line extends from start to end
          currentStart = start
          currentEnd = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t,
          }
        } else {
          // Shrinking: depends on lineDisappearEffect
          if (lineDisappearEffect) {
            // New effect: start point moves toward end point
            currentStart = {
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t,
            }
            currentEnd = end
          } else {
            // Original effect: end point moves toward start point
            currentStart = start
            currentEnd = {
              x: start.x + (end.x - start.x) * (1 - t),
              y: start.y + (end.y - start.y) * (1 - t),
            }
          }
        }
        
        const tremX = (Math.random()-0.5)*tremblingIntensity
        const tremY = (Math.random()-0.5)*tremblingIntensity
        ctx.beginPath()
        ctx.moveTo(currentStart.x+tremX, currentStart.y+tremY)
        ctx.lineTo(currentEnd.x+tremX, currentEnd.y+tremY)
        ctx.stroke()
      })
    }

    if (frame1Lines.length) drawFrame(frame1Lines, progress)
    if (frame2Lines.length) drawFrame(frame2Lines, progress)
  }

  // ─── DRAW ANIMATED TEXT ─────────────────────────────────────────────────────────
  const drawAnimatedText = (
    ctx: CanvasRenderingContext2D,
    prog: number,
    fromFrame: number,
    toFrame: number
  ) => {
    const lerp = (a:number,b:number,t:number) => a + (b-a)*t
    const interp = (p1:TextPosition,p2:TextPosition,t:number):TextPosition => ({
      x: lerp(p1.x,p2.x,t),
      y: lerp(p1.y,p2.y,t),
      width: lerp(p1.width,p2.width,t),
      height: lerp(p1.height,p2.height,t),
      rotation: lerp(p1.rotation,p2.rotation,t),
      fontSize: lerp(p1.fontSize,p2.fontSize,t),
    })
    const t = easeInOutQuint(prog)

    // titles
    titles.forEach((txt,idx) => {
      const pos1 = (fromFrame===1?titlePositionsFrame1: titlePositionsFrame2)[idx]
      const pos2 = (toFrame  ===1?titlePositionsFrame1: titlePositionsFrame2)[idx]
      const mid  = interp(pos1,pos2,t)
      const tremX = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity:0
      const tremY = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity:0
      ctx.save()
      ctx.translate(mid.x+mid.width/2+tremX, mid.y+mid.height/2+tremY)
      ctx.rotate(mid.rotation)
      ctx.font = `bold ${mid.fontSize}px Arial`
      ctx.fillStyle = getContrastColor(backgroundColor)
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(txt,0,0)
      ctx.restore()
    })

    // subtitle
    const sub1 = fromFrame===1?subtitlePositionFrame1:subtitlePositionFrame2
    const sub2 = toFrame  ===1?subtitlePositionFrame1:subtitlePositionFrame2
    const midSub = interp(sub1,sub2,t)
    const tremX = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity:0
    const tremY = tremblingAffectsText ? (Math.random()-0.5)*tremblingIntensity:0
    ctx.save()
    ctx.translate(midSub.x+midSub.width/2+tremX, midSub.y+midSub.height/2+tremY)
    ctx.rotate(midSub.rotation)
    ctx.font = `bold ${midSub.fontSize}px Arial`
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(subtitle,0,0)
    ctx.restore()
  }

  // ─── BOUNDING BOXES ─────────────────────────────────────────────────────────────
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, pos:TextPosition) => {
    const cx = pos.x+pos.width/2, cy = pos.y+pos.height/2
    ctx.save()
    ctx.translate(cx,cy)
    ctx.rotate(pos.rotation)
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-pos.width/2, -pos.height/2, pos.width, pos.height)
    const hs = 10
    const corners = [
      [-pos.width/2, -pos.height/2],
      [ pos.width/2, -pos.height/2],
      [ pos.width/2,  pos.height/2],
      [-pos.width/2,  pos.height/2],
    ]
    corners.forEach(([x,y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.rect(x-hs/2, y-hs/2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box:GroupBoundingBox) => {
    const cx = box.x+box.width/2, cy = box.y+box.height/2
    ctx.save()
    ctx.translate(cx,cy)
    ctx.rotate(box.rotation)
    ctx.strokeStyle = 'rgba(0,120,255,0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(-box.width/2, -box.height/2, box.width, box.height)
    const hs = 10
    const corners = [
      [-box.width/2, -box.height/2],
      [ box.width/2, -box.height/2],
      [ box.width/2,  box.height/2],
      [-box.width/2,  box.height/2],
    ]
    corners.forEach(([x,y]) => {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'rgba(0,120,255,0.8)'
      ctx.lineWidth = 2
      ctx.rect(x-hs/2, y-hs/2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  // ─── UTILITIES ──────────────────────────────────────────────────────────────────
  const getContrastColor = (bg: string): string => {
    const r = parseInt(bg.slice(1,3),16)
    const g = parseInt(bg.slice(3,5),16)
    const b = parseInt(bg.slice(5,7),16)
    const lum = (0.299*r+0.587*g+0.114*b)/255
    return lum>0.5 ? '#000000' : '#FFFFFF'
  }

  // ─── MATH / HIT TEST ────────────────────────────────────────────────────────────
  const isPointInRotatedBox = (x:number,y:number,poly:Point[]):boolean => {
    let inside = false
    for (let i=0,j=poly.length-1; i<poly.length; j=i++){
      const xi = poly[i].x, yi = poly[i].y
      const xj = poly[j].x, yj = poly[j].y
      const intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const getRotatedBoundingBox = (pos:TextPosition):Point[] => {
    const cx = pos.x+pos.width/2, cy = pos.y+pos.height/2
    const w = pos.width, h = pos.height
    const corners = [
      {x:-w/2,y:-h/2},{x:w/2,y:-h/2},
      {x:w/2,y:h/2},  {x:-w/2,y:h/2}
    ]
    return corners.map(c => ({
      x: c.x*Math.cos(pos.rotation) - c.y*Math.sin(pos.rotation) + cx,
      y: c.x*Math.sin(pos.rotation) + c.y*Math.cos(pos.rotation) + cy
    }))
  }

  const calculateGroupBoundingBox = ():GroupBoundingBox|null => {
    if (selectedTexts.length===0) return null
    let sel:TextPosition[] = []
    titlePositionsFrame2.forEach((p,i) => {
      if (selectedTexts.includes(`title${i+1}` as any)) sel.push(p)
    })
    if (selectedTexts.includes('subtitle')) sel.push(subtitlePositionFrame2)
    if (sel.length===0) return null
    let minX = Math.min(...sel.map(p=>p.x))
    let minY = Math.min(...sel.map(p=>p.y))
    let maxX = Math.max(...sel.map(p=>p.x+p.width))
    let maxY = Math.max(...sel.map(p=>p.y+p.height))
    return { x:minX, y:minY, width: maxX-minX, height: maxY-minY, rotation: groupRotation }
  }

  // ─── DRAG / RESIZE / ROTATE LOGIC ────────────────────────────────────────────────
  const handleTextInteraction = (
    position:TextPosition,
    textType:'title1'|'title2'|'subtitle',
    x:number, y:number
  ) => {
    if (currentFrame!==2) return
    const now = Date.now()
    const isDouble = now - lastClickTime.current < 300
    lastClickTime.current = now
    lastMousePosition.current = {x,y}

    // SHIFT group toggling
    if (isShiftPressed.current) {
      setSelectedTexts(prev => {
        const has = prev.includes(textType)
        const next = has ? prev.filter(v=>v!==textType) : [...prev, textType]
        return next
      })
    } else {
      setSelectedTexts([textType])
    }

    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeHandle(null)

    if (isPointNearRotationArea(x,y,position)) {
      setIsRotating(true)
      const grp = calculateGroupBoundingBox()
      if (grp) setInitialGroupBox(grp)
    } else {
      const handle = getResizeHandle(x,y,position)
      if (handle) {
        if (handle==='move') {
          setIsDragging(true)
        } else {
          setResizeHandle(handle)
          setIsResizing(true)
          setResizeStartPosition({x,y})
          const grp = calculateGroupBoundingBox()
          if (grp) setInitialGroupBox(grp)
        }
      } else {
        setIsDragging(true)
      }
    }

    drawCanvas()
    if (isDouble) {
      setPositionModalOpen(true)
      setEditingPosition(position)
      setEditingBaseFontSize(position.fontSize)
    }
  }

  // get which resize handle (or move) under point
  const getResizeHandle = (
    x:number,y:number,
    pos:TextPosition|GroupBoundingBox
  ):string|null => {
    const hs = 20
    const cx = pos.x + pos.width/2, cy = pos.y + pos.height/2
    const dx = x - cx, dy = y - cy
    const ux = dx*Math.cos(-pos.rotation) - dy*Math.sin(-pos.rotation)
    const uy = dx*Math.sin(-pos.rotation) + dy*Math.cos(-pos.rotation)
    const hw = pos.width/2, hh = pos.height/2
    // corner tests
    if (Math.abs(ux+hw)<=hs/2 && Math.abs(uy+hh)<=hs/2) return 'nw-resize'
    if (Math.abs(ux-hw)<=hs/2 && Math.abs(uy+hh)<=hs/2) return 'ne-resize'
    if (Math.abs(ux-hw)<=hs/2 && Math.abs(uy-hh)<=hs/2) return 'se-resize'
    if (Math.abs(ux+hw)<=hs/2 && Math.abs(uy-hh)<=hs/2) return 'sw-resize'
    // interior = move
    if (Math.abs(ux)<hw && Math.abs(uy)<hh) return 'move'
    return null
  }

  // rotation area = just outside corners
  const isPointNearRotationArea = (
    x:number,y:number,
    pos:TextPosition|GroupBoundingBox
  ):boolean => {
    const hs = 20, area = 15
    const cx = pos.x + pos.width/2, cy = pos.y + pos.height/2
    const dx = x - cx, dy = y - cy
    const ux = dx*Math.cos(-pos.rotation) - dy*Math.sin(-pos.rotation)
    const uy = dx*Math.sin(-pos.rotation) + dy*Math.cos(-pos.rotation)
    const hw = pos.width/2, hh = pos.height/2
    const corners = [
      {x:-hw,y:-hh},{x:hw,y:-hh},
      {x:hw,y:hh},  {x:-hw,y:hh}
    ]
    return corners.some(c => {
      const dist = Math.hypot(ux-c.x, uy-c.y)
      return dist>hs/2 && dist<=hs/2+area
    })
  }

  // handle dragging & resizing & rotating on mouse move
  const handleMouseMove = (e:React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const x = (e.clientX-rect.left)*(c.width/rect.width)
    const y = (e.clientY-rect.top)*(c.height/rect.height)

    if (selectedTexts.length>0 && currentFrame===2) {
      if (isRotating && initialGroupBox) {
        rotateGroup(x,y, initialGroupBox)
      } else if (isDragging) {
        if (selectedTexts.length===1) {
          dragSingle(x,y, selectedTexts[0])
        } else {
          dragGroup(x,y)
        }
      } else if (isResizing && resizeHandle && initialGroupBox && resizeStartPosition) {
        if (selectedTexts.length===1) {
          const txt = selectedTexts[0]
          const pos = txt==='subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[ txt==='title1'?0:1 ]
          resizeSingle(x,y,pos,txt, resizeHandle)
        } else {
          resizeGroup(x,y, resizeHandle)
        }
      }
      drawCanvas()
    } else if (currentLine) {
      setCurrentLine(cl => cl?{...cl, end:{x,y}}:null)
      drawCanvas()
    } else if (editingLineIndex!==null) {
      setLines(ls => {
        const a = [...ls]
        const ln = {...a[editingLineIndex]!}
        if (isPointNear({x,y},ln.start)) ln.start={x,y}
        else if (isPointNear({x,y},ln.end))   ln.end  ={x,y}
        a[editingLineIndex] = ln
        return a
      })
      drawCanvas()
    }
  }

  // helper for line editing hit test
  const isPointNear = (p:Point, t:Point|Line, th=10):boolean => {
    if ('x' in t && 'y' in t) {
      return Math.hypot(p.x-t.x, p.y-t.y) < th
    } else {
      return pointToLineDistance(p,t.start,t.end) < th
    }
  }

  const pointToLineDistance = (pt:Point, a:Point, b:Point):number => {
    const A = pt.x - a.x, B = pt.y - a.y
    const C = b.x - a.x, D = b.y - a.y
    const dot = A*C + B*D
    const lenSq = C*C + D*D
    let param = lenSq!==0 ? dot/lenSq : -1
    let xx,yy
    if (param<0) { xx=a.x; yy=a.y }
    else if (param>1){ xx=b.x; yy=b.y }
    else { xx = a.x+ param*C; yy = a.y + param*D }
    return Math.hypot(pt.x-xx, pt.y-yy)
  }

  // handle mouse down
  const handleMouseDown = (e:React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const x = (e.clientX-rect.left)*(c.width/rect.width)
    const y = (e.clientY-rect.top)*(c.height/rect.height)
    lastMousePosition.current = {x,y}

    // hit text boxes first
    const positions = currentFrame===1 ? titlePositionsFrame1 : titlePositionsFrame2
    for (let i=0;i<positions.length;i++){
      const poly = getRotatedBoundingBox(positions[i])
      if (isPointInRotatedBox(x,y,poly)){
        handleTextInteraction(positions[i], `title${i+1}` as any, x,y)
        return
      }
    }
    // subtitle
    const subPos = currentFrame===1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const subPoly = getRotatedBoundingBox(subPos)
    if (isPointInRotatedBox(x,y, subPoly)){
      handleTextInteraction(subPos,'subtitle', x,y)
      return
    }

    // if SHIFT not held, clear selection
    if (!isShiftPressed.current){
      setSelectedTexts([])
      setGroupRotation(0)
    }

    // next, hit existing lines
    const idx = lines.findIndex(ln =>
      ln.frame===currentFrame &&
      (isPointNear({x,y},ln.start)||isPointNear({x,y},ln.end)||isPointNear({x,y},ln))
    )
    if (idx!==-1){
      setEditingLineIndex(idx)
    } else {
      // start new line
      setCurrentLine({ start:{x,y}, end:{x,y}, frame:currentFrame })
    }
    drawCanvas()
  }

  // handle mouse up
  const handleMouseUp = () => {
    if (isPlaying) return
    if (currentLine){
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

  // ─── DRAG / RESIZE / ROTATE IMPLEMENTATIONS ──────────────────────────────────────
  const dragSingle = (x:number,y:number, textType:'title1'|'title2'|'subtitle') => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    if (textType==='subtitle'){
      setSubtitlePositionFrame2(p=>({ ...p, x:p.x+dx, y:p.y+dy }))
    } else {
      setTitlePositionsFrame2(prev => {
        const a=[...prev]
        const idx = textType==='title1'?0:1
        a[idx] = {...a[idx], x:a[idx].x+dx, y:a[idx].y+dy}
        return a
      })
    }
    lastMousePosition.current = {x,y}
  }

  const dragGroup = (x:number,y:number) => {
    if (!lastMousePosition.current) return
    const dx = x - lastMousePosition.current.x
    const dy = y - lastMousePosition.current.y
    setTitlePositionsFrame2(prev =>
      prev.map((p,i)=> selectedTexts.includes(`title${i+1}` as any)
        ? {...p,x:p.x+dx,y:p.y+dy} : p
      )
    )
    if (selectedTexts.includes('subtitle')){
      setSubtitlePositionFrame2(p=>({...p,x:p.x+dx,y:p.y+dy}))
    }
    lastMousePosition.current={x,y}
  }

  const resizeSingle = (
    x:number,y:number,
    pos:TextPosition,
    textType:'title1'|'title2'|'subtitle',
    handle:string
  ) => {
    if (!resizeStartPosition) return
    const cx = pos.x + pos.width/2
    const cy = pos.y + pos.height/2
    const sv = { x: resizeStartPosition.x-cx, y: resizeStartPosition.y-cy }
    const cv = { x: x-cx, y: y-cy }
    const factor = 0.1
    let scale=1
    if (handle.includes('e')|| handle.includes('w')){
      const sd = Math.abs(sv.x), cd = Math.abs(cv.x)
      scale = sd?1+((cd/sd-1)*factor):1
    } else {
      const sd = Math.abs(sv.y), cd = Math.abs(cv.y)
      scale = sd?1+((cd/sd-1)*factor):1
    }
    scale = Math.max(0.1, scale)
    const newW = pos.width*scale, newH = pos.height*scale
    const newX = cx - newW/2, newY = cy - newH/2
    const newPos:TextPosition = {
      ...pos, x:newX,y:newY,
      width:newW, height:newH,
      fontSize: pos.fontSize*scale
    }
    if (textType==='subtitle') setSubtitlePositionFrame2(newPos)
    else setTitlePositionsFrame2(prev=> {
      const a=[...prev]
      const idx = textType==='title1'?0:1
      a[idx] = newPos
      return a
    })
  }

  const resizeGroup = (x:number,y:number, handle:string) => {
    if (!initialGroupBox || !resizeStartPosition) return
    const dx = x - resizeStartPosition.x
    const dy = y - resizeStartPosition.y
    const cx = initialGroupBox.x + initialGroupBox.width/2
    const cy = initialGroupBox.y + initialGroupBox.height/2
    let scale=1
    if (handle.includes('e')||handle.includes('w')){
      scale = 1 + (dx/initialGroupBox.width)*0.5
    } else {
      scale = 1 + (dy/initialGroupBox.height)*0.5
    }
    scale = Math.max(0.1, scale)
    const newW = initialGroupBox.width*scale
    const newH = initialGroupBox.height*scale
    const newX = cx - newW/2
    const newY = cy - newH/2
    const update = (p:TextPosition):TextPosition => {
      const relX = (p.x+p.width/2 - cx)/(initialGroupBox.width/2)
      const relY = (p.y+p.height/2 - cy)/(initialGroupBox.height/2)
      return {
        ...p,
        x: cx + relX*(newW/2) - p.width*scale/2,
        y: cy + relY*(newH/2) - p.height*scale/2,
        width: p.width*scale,
        height:p.height*scale,
        fontSize:p.fontSize*scale
      }
    }
    setTitlePositionsFrame2(prev=>
      prev.map((p,i)=> selectedTexts.includes(`title${i+1}` as any)?update(p):p))
    if (selectedTexts.includes('subtitle'))
      setSubtitlePositionFrame2(p=>update(p))
    setInitialGroupBox({ x:newX,y:newY,width:newW,height:newH,rotation:initialGroupBox.rotation })
  }

  const rotateSingle = (
    x:number,y:number,
    pos:TextPosition,
    textType:'title1'|'title2'|'subtitle'
  ) => {
    if (!lastMousePosition.current) return
    const cx = pos.x+pos.width/2, cy = pos.y+pos.height/2
    const la = Math.atan2(lastMousePosition.current.y-cy, lastMousePosition.current.x-cx)
    const ca = Math.atan2(y-cy, x-cx)
    let delta = ca - la
    if (delta>Math.PI) delta -= 2*Math.PI
    if (delta<-Math.PI) delta += 2*Math.PI
    if (textType==='subtitle')
      setSubtitlePositionFrame2(p=>({...p,rotation:p.rotation+delta}))
    else
      setTitlePositionsFrame2(prev=>{
        const a=[...prev]
        const idx = textType==='title1'?0:1
        a[idx] = {...a[idx], rotation:a[idx].rotation+delta}
        return a
      })
    lastMousePosition.current={x,y}
  }

  const rotateGroup = (x:number,y:number, box:GroupBoundingBox) => {
    if (!lastMousePosition.current) return
    const cx = box.x+box.width/2, cy = box.y+box.height/2
    const la = Math.atan2(lastMousePosition.current.y-cy, lastMousePosition.current.x-cx)
    const ca = Math.atan2(y-cy, x-cx)
    let delta = ca - la
    if (delta>Math.PI) delta -= 2*Math.PI
    if (delta<-Math.PI) delta += 2*Math.PI
    setTitlePositionsFrame2(prev=>
      prev.map((p,i)=> selectedTexts.includes(`title${i+1}` as any)
        ? rotateAroundPoint(p,cx,cy,delta) : p
      )
    )
    if (selectedTexts.includes('subtitle'))
      setSubtitlePositionFrame2(p=>rotateAroundPoint(p,cx,cy,delta))
    setGroupRotation(g=>g+delta)
    lastMousePosition.current={x,y}
  }

  const rotateAroundPoint = (
    pos:TextPosition,
    cx:number,cy:number,
    angle:number
  ):TextPosition=>{
    const dx = pos.x+pos.width/2-cx
    const dy = pos.y+pos.height/2-cy
    const dist = Math.hypot(dx,dy)
    const ca = Math.atan2(dy,dx)
    const na = ca + angle
    const nx = cx + dist*Math.cos(na) - pos.width/2
    const ny = cy + dist*Math.sin(na) - pos.height/2
    return {...pos,x:nx,y:ny,rotation:pos.rotation+angle}
  }

  // ─── ANIMATE LOOP ───────────────────────────────────────────────────────────────
  const animate = (ts:number) => {
    if (!startTimeRef.current) startTimeRef.current = ts
    const elapsed = ts - startTimeRef.current
    const msPerBase = 1000/baseFps
    let prog = elapsed/(msPerBase*150)
    if (prog>1.4) {
      if (isLooping) { startTimeRef.current = ts; prog=0 }
      else { prog=1.4; setIsPlaying(false) }
    }
    if (ts - lastDisplayTimeRef.current >= 1000/frameRate) {
      drawCanvas(prog)
      lastDisplayTimeRef.current = ts
    }
    if (isPlaying||isLooping) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawCanvas()
    }
  }

  // ─── FRAME CONTROLS ─────────────────────────────────────────────────────────────
  const handleFrameChange = (f:number) => {
    setCurrentFrame(f)
    setSelectedTexts([])
    drawCanvas()
  }
  const togglePlay = () => setIsPlaying(p=>!p)
  const toggleLoop = () => setIsLooping(p=>!p)

  const handleSettingsChange = (name:string, val:number) => {
    if (name==='lineThickness') setLineThickness(val)
    if (name==='tremblingIntensity') setTremblingIntensity(val)
    if (name==='frameRate') setFrameRate(val)
    drawCanvas()
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow-lg flex w-full h-[90vh] overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-1/3 border-r border-gray-200 px-8 py-6 space-y-8 overflow-auto">
        <h2 className="text-xl font-semibold mb-4">
          Cordofonia Instagram<br/>Posts Creator Tool
        </h2>

        <div className="space-y-4">
          <p className="text-gray-600">1. Write a title</p>
          <Input
            value={titles[0]}
            onChange={e=>setTitles([e.target.value, titles[1]])}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
          <Input
            value={titles[1]}
            onChange={e=>setTitles([titles[0], e.target.value])}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">2. Write the instrument</p>
          <Input
            value={subtitle.replace('Instrumento: ', '')}
            onChange={e=>setSubtitle(`Instrumento: ${e.target.value}`)}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
        </div>

        <div className="space-y-2">
          <p className="text-gray-600">3. Pick a Color</p>
          <div className="flex items-center space-x-2">
            {colorOptions.map(c=>(
              <button
                key={c.value}
                onClick={()=>setBackgroundColor(c.value)}
                className={`w-8 h-8 rounded ${backgroundColor===c.value?'ring-2 ring-black':'border border-gray-300'}`}
                style={{backgroundColor:c.value}}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-2/3 flex flex-col items-center">
        {/* FIXED CARD */}
        <div
          className="w-[540px] h-[675px] bg-white rounded-lg shadow-lg relative overflow-hidden mb-4"
          style={{backgroundColor}}
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
          <Button
            variant={currentFrame===1?"default":"outline"}
            onClick={()=>handleFrameChange(1)}
            className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Frame 1
          </Button>
          <Button
            variant={currentFrame===2?"default":"outline"}
            onClick={()=>handleFrameChange(2)}
            className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Frame 2
          </Button>

          <div className="flex space-x-3">
            <Button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              {isPlaying
                ? <PauseIcon className="w-6 h-6 text-black"/>
                : <PlayIcon  className="w-6 h-6 text-black"/>}
            </Button>

            <Button
              onClick={toggleLoop}
              className={`w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center ${isLooping?'ring-2 ring-black':''}`}
            >
              <RotateCcwIcon className="w-6 h-6 text-black"/>
            </Button>

            <Button
              onClick={()=>setSettingsOpen(true)}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              <Settings className="w-6 h-6 text-black"/>
            </Button>

            <Button
              onClick={()=>console.log("Export not implemented")}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              <ShareIcon className="w-6 h-6 text-black"/>
            </Button>
          </div>
        </div>
      </div>

      {/* POSITION MODAL */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Position</DialogTitle></DialogHeader>
          {editingPosition && editingBaseFontSize!==null && (
            <div className="space-y-4 p-4">
              <div>
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={e=>setEditingPosition({...editingPosition, x:Number(e.target.value)})}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={e=>setEditingPosition({...editingPosition, y:Number(e.target.value)})}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (deg)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation*(180/Math.PI)}
                  onChange={e=>setEditingPosition({...editingPosition, rotation:Number(e.target.value)*(Math.PI/180)})}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  value={Math.round((editingPosition.fontSize/editingBaseFontSize)*100)}
                  onChange={e=>{
                    const scale = Number(e.target.value)/100
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: editingBaseFontSize! * scale
                    })
                  }}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <Button
                onClick={()=>{
                  // apply to all selected
                  if (editingPosition){
                    if (selectedTexts.includes('title1')||selectedTexts.includes('title2')){
                      setTitlePositionsFrame2(prev=>{
                        const a=[...prev]
                        selectedTexts.forEach(st=>{
                          const i=st==='title1'?0:1
                          a[i]=editingPosition
                        })
                        return a
                      })
                    }
                    if (selectedTexts.includes('subtitle')){
                      setSubtitlePositionFrame2(editingPosition)
                    }
                  }
                  setPositionModalOpen(false)
                  drawCanvas()
                }}
                className="mt-4 w-full bg-black text-white"
              >
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SETTINGS MODAL */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 p-4">
            <div>
              <Label htmlFor="thicknessSlider">Line Thickness (max 10)</Label>
              <Slider
                id="thicknessSlider"
                min={1} max={10} step={1}
                value={[lineThickness]}
                onValueChange={val=>handleSettingsChange('lineThickness', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="trembleSlider">Trembling Intensity</Label>
              <Slider
                id="trembleSlider"
                min={0} max={10} step={1}
                value={[tremblingIntensity]}
                onValueChange={val=>handleSettingsChange('tremblingIntensity', val[0])}
              />
            </div>
            <div>
              <Label htmlFor="baseFpsSlider">Animation Speed (Base FPS: {baseFps})</Label>
              <Slider
                id="baseFpsSlider"
                min={10} max={120} step={1}
                value={[baseFps]}
                onValueChange={([v])=>{
                  const n=Number(v)
                  if (!isNaN(n)) setBaseFps(n)
                }}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate ({MIN_FRAME_RATE}–120)</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE} max={120} step={1}
                value={[frameRate]}
                onValueChange={([v])=>{
                  const n=Number(v)
                  if (!isNaN(n)) handleSettingsChange('frameRate', n)
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="tremblingTarget"
                checked={tremblingAffectsText}
                onCheckedChange={setTremblingAffectsText}
              />
              <Label htmlFor="tremblingTarget">Trembling affects text (OFF = lines only)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="lineDisappearEffect"
                checked={lineDisappearEffect}
                onCheckedChange={setLineDisappearEffect}
              />
              <Label htmlFor="lineDisappearEffect">Lines disappear from start to end</Label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}