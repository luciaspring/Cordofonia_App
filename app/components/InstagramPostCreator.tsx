// app/components/InstagramPostCreator.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  ShareIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─── TYPES & INTERFACES ─────────────────────────────────────────────────────────

interface Point { x: number; y: number }
interface Line { start: Point; end: Point; frame: number }
interface TextPosition {
  x: number; y: number
  width: number; height: number
  rotation: number; fontSize: number
  aspectRatio?: number
}
interface GroupBoundingBox {
  x: number; y: number
  width: number; height: number
  rotation: number
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

const MAX_LINE_THICKNESS = 10
const MIN_FRAME_RATE     = 10

const easeInOutQuint = (t: number): number =>
  t < 0.5
    ? 16 * Math.pow(t, 5)
    : 1 - Math.pow(-2 * t + 2, 5) / 2

// ─── COMPONENT ───────────────────────────────────────────────────────────────────

export default function InstagramPostCreator() {
  // ─── STATE ────────────────────────────────────────────────────────────────────
  const [titles              , setTitles              ] = useState(['John','Doe'])
  const [subtitle            , setSubtitle            ] = useState('Instrumento: Kora')
  const [backgroundColor     , setBackgroundColor     ] = useState('#E0B0FF')
  const [currentFrame        , setCurrentFrame        ] = useState(1)
  const [isPlaying           , setIsPlaying           ] = useState(false)
  const [isLooping           , setIsLooping           ] = useState(false)
  const [lines               , setLines               ] = useState<Line[]>([])
  const [currentLine         , setCurrentLine         ] = useState<Line|null>(null)
  const [editingLineIndex    , setEditingLineIndex    ] = useState<number|null>(null)

  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x:40, y:400, width:1000, height:200, rotation:0, fontSize:180 },
    { x:40, y:550, width:1000, height:200, rotation:0, fontSize:180 },
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x:40, y:400, width:1000, height:200, rotation:0, fontSize:180 },
    { x:40, y:550, width:1000, height:200, rotation:0, fontSize:180 },
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({
    x:40, y:1000, width:1000, height:30, rotation:0, fontSize:36
  })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({
    x:40, y:1000, width:1000, height:30, rotation:0, fontSize:36
  })

  const [selectedTexts       , setSelectedTexts       ] = useState<('title1'|'title2'|'subtitle')[]>([])
  const [resizeHandle        , setResizeHandle        ] = useState<string|null>(null)
  const [isRotating          , setIsRotating          ] = useState(false)
  const [isDragging          , setIsDragging          ] = useState(false)
  const [isResizing          , setIsResizing          ] = useState(false)
  const [initialGroupBox     , setInitialGroupBox     ] = useState<GroupBoundingBox|null>(null)
  const [resizeStartPosition , setResizeStartPosition ] = useState<Point|null>(null)

  const [positionModalOpen   , setPositionModalOpen   ] = useState(false)
  const [editingPosition     , setEditingPosition     ] = useState<TextPosition|null>(null)
  const [editingBaseFontSize , setEditingBaseFontSize ] = useState<number|null>(null)

  // settings
  const [lineThickness       , setLineThickness       ] = useState(MAX_LINE_THICKNESS)
  const [tremblingIntensity  , setTremblingIntensity  ] = useState(3)
  const [frameRate           , setFrameRate           ] = useState(MIN_FRAME_RATE)
  const [baseFps             , setBaseFps             ] = useState(35)
  const [tremblingAffectsText, setTremblingAffectsText] = useState(true)
  const [settingsOpen        , setSettingsOpen        ] = useState(false)

  // refs
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const animationRef   = useRef<number|null>(null)
  const startTimeRef   = useRef<number|null>(null)
  const lastDisplayRef = useRef<number>(0)
  const lastMousePos   = useRef<Point|null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime  = useRef(0)

  // ─── EFFECTS ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e:KeyboardEvent)=>{ if(e.key==='Shift') isShiftPressed.current=true }
    const up   = (e:KeyboardEvent)=>{ if(e.key==='Shift') isShiftPressed.current=false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup'  , up  )
    return ()=>{
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup'  , up  )
    }
  },[])

  useEffect(() => {
    const c = canvasRef.current; if(!c) return
    const ctx = c.getContext('2d'); if(!ctx) return
    updateTextDimensions(ctx)
    if(!isPlaying) drawCanvas()
  },[
    titles, subtitle, backgroundColor,
    currentFrame, lines,
    lineThickness, tremblingIntensity,
    frameRate, tremblingAffectsText
  ])

  useEffect(() => {
    if(isPlaying){
      startTimeRef.current=null
      lastDisplayRef.current=0
      animationRef.current=requestAnimationFrame(animate)
    } else {
      if(animationRef.current) cancelAnimationFrame(animationRef.current)
      drawCanvas()
    }
    return ()=>{ if(animationRef.current) cancelAnimationFrame(animationRef.current) }
  },[isPlaying,isLooping])

  // ─── TEXT DIMENSION CALCS ──────────────────────────────────────────────────────
  const updateTextDimensions = (ctx:CanvasRenderingContext2D) => {
    const measure = (txt:string,fs:number)=>{
      ctx.font = `bold ${fs}px Arial`
      const m = ctx.measureText(txt)
      return {
        width: m.width,
        height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || fs*.8
      }
    }
    setTitlePositionsFrame1(tp1=> tp1.map((p,i)=>{
      const {width,height}=measure(titles[i],p.fontSize)
      return {...p,width,height,aspectRatio:width/height}
    }))
    setTitlePositionsFrame2(tp2=> tp2.map((p,i)=>{
      const {width,height}=measure(titles[i],p.fontSize)
      return {...p,width,height,aspectRatio:width/height}
    }))
    const sub1=subtitlePositionFrame1
    const sub2=subtitlePositionFrame2
    const {width:sw,height:sh} = measure(subtitle, sub2.fontSize)
    setSubtitlePositionFrame1(sp=>({...sp,width:sw,height:sh,aspectRatio:sw/sh}))
    setSubtitlePositionFrame2(sp=>({...sp,width:sw,height:sh,aspectRatio:sw/sh}))
  }

  // ─── DRAW ROUTINES ──────────────────────────────────────────────────────────────
  const drawCanvas = (progress = 0) => {
    const c = canvasRef.current; if(!c) return
    const ctx = c.getContext('2d'); if(!ctx) return

    // fill bg
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0,0,c.width,c.height)

    if(isPlaying){
      // animated sequence
      const f1=lines.filter(l=>l.frame===1)
      const f2=lines.filter(l=>l.frame===2)

      if(progress<=0.3){
        drawStaticText(ctx,1)
        drawAnimatedLines(ctx,progress/0.3,f1,[],'grow')
      } else if(progress<=0.6){
        drawStaticText(ctx,1)
        drawAnimatedLines(ctx,(progress-0.3)/0.3,f1,[],'shrink')
      } else if(progress<=0.7){
        drawAnimatedText(ctx,(progress-0.6)/0.1,1,2)
      } else if(progress<=1.0){
        drawStaticText(ctx,2)
        drawAnimatedLines(ctx,(progress-0.7)/0.3,[],f2,'grow')
      } else if(progress<=1.3){
        drawStaticText(ctx,2)
        drawAnimatedLines(ctx,(progress-1.0)/0.3,[],f2,'shrink')
      } else {
        drawAnimatedText(ctx,(progress-1.3)/0.1,2,1)
      }
      return
    }

    // static
    const frameLines=lines.filter(l=>l.frame===currentFrame)
    drawLines(ctx, frameLines)
    drawStaticText(ctx,currentFrame)

    if(currentFrame===2 && selectedTexts.length){
      const g=calculateGroupBoundingBox()
      if(g) drawGroupBoundingBox(ctx,g)
      else {
        titlePositionsFrame2.forEach((p,i)=>{
          if(selectedTexts.includes(`title${i+1}`)) drawBoundingBox(ctx,p)
        })
        if(selectedTexts.includes('subtitle')) drawBoundingBox(ctx,subtitlePositionFrame2)
      }
    }
  }

  // ─── DRAW HELPERS ───────────────────────────────────────────────────────────────
  const tremble = () => tremblingAffectsText
    ? { x:(Math.random()-.5)*tremblingIntensity, y:(Math.random()-.5)*tremblingIntensity }
    : { x:0, y:0 }

  const drawStaticText = (ctx:CanvasRenderingContext2D, frame:number) => {
    const titlesPos = frame===1 ? titlePositionsFrame1 : titlePositionsFrame2
    const subPos     = frame===1 ? subtitlePositionFrame1 : subtitlePositionFrame2

    titlesPos.forEach((p,i)=>{
      const t=tremble()
      ctx.save()
      ctx.translate(p.x + p.width/2 + t.x, p.y + p.height/2 + t.y)
      ctx.rotate(p.rotation)
      ctx.font         = `bold ${p.fontSize}px Arial`
      ctx.fillStyle    = getContrastColor(backgroundColor)
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(titles[i],0,0)
      ctx.restore()
    })

    const t2=tremble()
    ctx.save()
    ctx.translate(subPos.x + subPos.width/2 + t2.x, subPos.y + subPos.height/2 + t2.y)
    ctx.rotate(subPos.rotation)
    ctx.font         = `bold ${subPos.fontSize}px Arial`
    ctx.fillStyle    = getContrastColor(backgroundColor)
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(subtitle,0,0)
    ctx.restore()
  }

  const drawLines = (ctx:CanvasRenderingContext2D, arr:Line[]) => {
    ctx.lineWidth   = lineThickness
    ctx.lineCap     = 'butt'
    ctx.lineJoin    = 'round'
    ctx.strokeStyle = '#0000FF'
    arr.forEach(l=>{
      const trem = tremblingAffectsText
        ? { x:(Math.random()-.5)*tremblingIntensity, y:(Math.random()-.5)*tremblingIntensity }
        : { x:0,y:0 }
      ctx.beginPath()
      ctx.moveTo(l.start.x + trem.x, l.start.y + trem.y)
      ctx.lineTo(l.end.x   + trem.x, l.end.y   + trem.y)
      ctx.stroke()
    })
    if(currentLine){
      const trem = tremblingAffectsText
        ? { x:(Math.random()-.5)*tremblingIntensity, y:(Math.random()-.5)*tremblingIntensity }
        : { x:0,y:0 }
      ctx.beginPath()
      ctx.moveTo(currentLine.start.x + trem.x, currentLine.start.y + trem.y)
      ctx.lineTo(currentLine.end.x   + trem.x, currentLine.end.y   + trem.y)
      ctx.stroke()
    }
  }

  const drawAnimatedLines = (
    ctx:CanvasRenderingContext2D,
    prog:number,
    f1:Line[], f2:Line[],
    mode:'grow'|'shrink'
  ) => {
    ctx.lineWidth   = lineThickness
    ctx.lineCap     = 'butt'
    ctx.lineJoin    = 'round'
    ctx.strokeStyle = '#000000'

    const dur=0.3, stagMax=0.2
    const drawSeq=(seq:Line[],p:number)=>{
      const stag = seq.length>1 ? stagMax/(seq.length-1):0
      seq.forEach((l,i)=>{
        let t = Math.max(0,Math.min(1,(p - i*stag)/dur))
        t=easeInOutQuint(t)
        const endPt = {
          x: l.start.x + (l.end.x-l.start.x)*(mode==='grow'?t:1-t),
          y: l.start.y + (l.end.y-l.start.y)*(mode==='grow'?t:1-t),
        }
        const trem = tremblingAffectsText
          ? { x:(Math.random()-.5)*tremblingIntensity, y:(Math.random()-.5)*tremblingIntensity }
          : { x:0,y:0 }
        ctx.beginPath()
        ctx.moveTo(l.start.x + trem.x, l.start.y + trem.y)
        ctx.lineTo(endPt.x     + trem.x, endPt.y     + trem.y)
        ctx.stroke()
      })
    }

    if(f1.length) drawSeq(f1,prog)
    if(f2.length) drawSeq(f2,prog)
  }

  const drawAnimatedText = (
    ctx:CanvasRenderingContext2D,
    prog:number,
    fromF:number,
    toF:number
  ) => {
    type TP = TextPosition
    const lerp = (a:number,b:number,t:number)=>a+(b-a)*t
    const lerpP=(p1:TP,p2:TP,t:number):TP=>({
      x: lerp(p1.x,p2.x,t),
      y: lerp(p1.y,p2.y,t),
      width:  lerp(p1.width,p2.width,t),
      height: lerp(p1.height,p2.height,t),
      rotation: lerp(p1.rotation,p2.rotation,t),
      fontSize: lerp(p1.fontSize,p2.fontSize,t),
    })
    const t = easeInOutQuint(prog)

    titles.forEach((txt,i)=>{
      const p1 = (fromF===1 ? titlePositionsFrame1 : titlePositionsFrame2)[i]
      const p2 = (toF  ===1 ? titlePositionsFrame1 : titlePositionsFrame2)[i]
      const mid=lerpP(p1,p2,t)
      const trem = tremblingAffectsText
        ? { x:(Math.random()-.5)*tremblingIntensity, y:(Math.random()-.5)*tremblingIntensity }
        : { x:0,y:0 }
      ctx.save()
      ctx.translate(mid.x+mid.width/2 + trem.x, mid.y+mid.height/2 + trem.y)
      ctx.rotate(mid.rotation)
      ctx.font         = `bold ${mid.fontSize}px Arial`
      ctx.fillStyle    = getContrastColor(backgroundColor)
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt,0,0)
      ctx.restore()
    })

    const s1 = fromF===1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const s2 = toF  ===1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    const midS=lerpP(s1,s2,t)
    const tremS = tremblingAffectsText
      ? { x:(Math.random()-.5)*tremblingIntensity, y:(Math.random()-.5)*tremblingIntensity }
      : { x:0,y:0 }
    ctx.save()
    ctx.translate(midS.x+midS.width/2 + tremS.x, midS.y+midS.height/2 + tremS.y)
    ctx.rotate(midS.rotation)
    ctx.font         = `bold ${midS.fontSize}px Arial`
    ctx.fillStyle    = getContrastColor(backgroundColor)
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(subtitle,0,0)
    ctx.restore()
  }

  // ─── BOUNDING BOXES ──────────────────────────────────────────────────────────────
  const drawBoundingBox = (ctx:CanvasRenderingContext2D,p:TextPosition) => {
    const cx=p.x+p.width/2, cy=p.y+p.height/2
    ctx.save()
    ctx.translate(cx,cy)
    ctx.rotate(p.rotation)
    const hw=p.width/2, hh=p.height/2
    ctx.strokeStyle='rgba(0,120,255,0.8)'
    ctx.lineWidth=2
    ctx.strokeRect(-hw,-hh,p.width,p.height)
    const hs=8, corners=[[-hw,-hh],[ hw,-hh],[ hw, hh],[-hw, hh]]
    corners.forEach(([x,y])=>{
      ctx.beginPath()
      ctx.fillStyle='white'
      ctx.rect(x-hs/2,y-hs/2,hs,hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const drawGroupBoundingBox = (ctx:CanvasRenderingContext2D,box:GroupBoundingBox) => {
    const cx=box.x+box.width/2, cy=box.y+box.height/2
    ctx.save()
    ctx.translate(cx,cy)
    ctx.rotate(box.rotation)
    const hw=box.width/2, hh=box.height/2
    ctx.strokeStyle='rgba(0,120,255,0.8)'
    ctx.lineWidth=2
    ctx.strokeRect(-hw,-hh,box.width,box.height)
    const hs=8, corners=[[-hw,-hh],[ hw,-hh],[ hw, hh],[-hw, hh]]
    corners.forEach(([x,y])=>{
      ctx.beginPath()
      ctx.fillStyle='white'
      ctx.rect(x-hs/2,y-hs/2,hs,hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }

  const calculateGroupBoundingBox = ():GroupBoundingBox|null => {
    if(!selectedTexts.length) return null
    const arr:TextPosition[]=[]
    titlePositionsFrame2.forEach((p,i)=>{
      if(selectedTexts.includes(`title${i+1}`)) arr.push(p)
    })
    if(selectedTexts.includes('subtitle')) arr.push(subtitlePositionFrame2)
    if(!arr.length) return null
    let minX=Math.min(...arr.map(p=>p.x))
    let minY=Math.min(...arr.map(p=>p.y))
    let maxX=Math.max(...arr.map(p=>p.x+p.width))
    let maxY=Math.max(...arr.map(p=>p.y+p.height))
    return { x:minX,y:minY,width:maxX-minX,height:maxY-minY, rotation: initialGroupBox?.rotation||0 }
  }

  // ─── MOUSE & INTERACTION ────────────────────────────────────────────────────────
  const getRotatedBox = (pos:TextPosition):Point[] => {
    const cx=pos.x+pos.width/2, cy=pos.y+pos.height/2
    const w=pos.width,h=pos.height
    const corners=[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}]
    return corners.map(c=>{
      const rx=c.x*Math.cos(pos.rotation)-c.y*Math.sin(pos.rotation)
      const ry=c.x*Math.sin(pos.rotation)+c.y*Math.cos(pos.rotation)
      return { x:rx+cx, y:ry+cy }
    })
  }

  const isPointInRotatedBox = (x:number,y:number,box:Point[]):boolean => {
    let inside=false
    for(let i=0,j=box.length-1;i<box.length;j=i++){
      const xi=box[i].x, yi=box[i].y
      const xj=box[j].x, yj=box[j].y
      const intersect = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)
      if(intersect) inside=!inside
    }
    return inside
  }

  const getResizeHandle = (
    x:number,y:number,
    p:TextPosition|GroupBoundingBox
  ):string|null => {
    const size=20
    const cx=p.x+p.width/2, cy=p.y+p.height/2
    const dx=x-cx, dy=y-cy
    const ux=dx*Math.cos(-p.rotation)-dy*Math.sin(-p.rotation)
    const uy=dx*Math.sin(-p.rotation)+dy*Math.cos(-p.rotation)
    const hw=p.width/2, hh=p.height/2
    if(Math.abs(ux+hw)<=size/2&&Math.abs(uy+hh)<=size/2) return 'nw-resize'
    if(Math.abs(ux-hw)<=size/2&&Math.abs(uy+hh)<=size/2) return 'ne-resize'
    if(Math.abs(ux-hw)<=size/2&&Math.abs(uy-hh)<=size/2) return 'se-resize'
    if(Math.abs(ux+hw)<=size/2&&Math.abs(uy-hh)<=size/2) return 'sw-resize'
    if(Math.abs(ux)<hw && Math.abs(uy)<hh) return 'move'
    return null
  }

  const isPointNearRotationArea = (
    x:number,y:number,
    p:TextPosition|GroupBoundingBox
  ):boolean => {
    const handleSize=20, rotArea=15
    const cx=p.x+p.width/2, cy=p.y+p.height/2
    const dx=x-cx, dy=y-cy
    const ux=dx*Math.cos(-p.rotation)-dy*Math.sin(-p.rotation)
    const uy=dx*Math.sin(-p.rotation)+dy*Math.cos(-p.rotation)
    const hw=p.width/2, hh=p.height/2
    const corners=[[-hw,-hh],[ hw,-hh],[ hw, hh],[-hw, hh]]
    for(const [cx2,cy2] of corners){
      const dist=Math.hypot(ux-cx2, uy-cy2)
      if(dist>handleSize/2 && dist<=handleSize/2+rotArea) return true
    }
    return false
  }

  const isPointNear = (
    pt:Point,
    tg:Point|Line,
    thr=10
  ):boolean => {
    if('x' in tg && 'y' in tg){
      return Math.hypot(pt.x-tg.x, pt.y-tg.y)<thr
    } else {
      return pointToLineDistance(pt,tg.start,tg.end)<thr
    }
  }

  const pointToLineDistance = (p:Point,a:Point,b:Point):number => {
    const A=p.x-a.x, B=p.y-a.y
    const C=b.x-a.x, D=b.y-a.y
    const dot=A*C + B*D, len2=C*C + D*D
    let t = len2? dot/len2 : 0
    t = Math.max(0,Math.min(1,t))
    const xx=a.x + t*C
    const yy=a.y + t*D
    return Math.hypot(p.x-xx,p.y-yy)
  }

  // DRAG / RESIZE / ROTATE HELPERS
  const dragSingle = (x:number,y:number, type:'title1'|'title2'|'subtitle') => {
    if(!lastMousePos.current) return
    const dx=x-lastMousePos.current.x
    const dy=y-lastMousePos.current.y
    if(type==='subtitle'){
      setSubtitlePositionFrame2(p=>({...p,x:p.x+dx,y:p.y+dy}))
    } else {
      setTitlePositionsFrame2(arr=>{
        const a=[...arr]
        const i=type==='title1'?0:1
        a[i]={...a[i],x:a[i].x+dx,y:a[i].y+dy}
        return a
      })
    }
    lastMousePos.current={x,y}
  }

  const dragGroup = (x:number,y:number) => {
    if(!lastMousePos.current) return
    const dx=x-lastMousePos.current.x
    const dy=y-lastMousePos.current.y
    setTitlePositionsFrame2(arr=>arr.map((p,i)=>
      selectedTexts.includes(`title${i+1}`) ? {...p,x:p.x+dx,y:p.y+dy} : p
    ))
    if(selectedTexts.includes('subtitle')){
      setSubtitlePositionFrame2(p=>({...p,x:p.x+dx,y:p.y+dy}))
    }
    lastMousePos.current={x,y}
  }

  const resizeSingle = (
    x:number,y:number,
    p:TextPosition,
    type:'title1'|'title2'|'subtitle',
    handle:string
  ) => {
    if(!resizeStartPosition) return
    const cx=p.x+p.width/2, cy=p.y+p.height/2
    const sx=resizeStartPosition.x-cx, sy=resizeStartPosition.y-cy
    const cx2=x-cx, cy2=y-cy
    let scale=1
    if(handle.includes('e')||handle.includes('w')){
      const r = Math.abs(cx2)/Math.abs(sx||cx2)
      scale = sx? 1 + (r-1)*0.1 : 1
    } else {
      const r = Math.abs(cy2)/Math.abs(sy||cy2)
      scale = sy? 1 + (r-1)*0.1 : 1
    }
    scale = Math.max(0.1, scale)
    const newW=p.width*scale
    const newH=p.height*scale
    const newX=cx-newW/2
    const newY=cy-newH/2
    const np={...p,x:newX,y:newY,width:newW,height:newH,fontSize:p.fontSize*scale}
    if(type==='subtitle'){
      setSubtitlePositionFrame2(np)
    } else {
      setTitlePositionsFrame2(arr=>{
        const a=[...arr]
        const i=type==='title1'?0:1
        a[i]=np
        return a
      })
    }
  }

  const resizeGroup = (x:number,y:number, handle:string) => {
    if(!initialGroupBox||!resizeStartPosition) return
    const dx=x-resizeStartPosition.x
    const dy=y-resizeStartPosition.y
    const cx=initialGroupBox.x+initialGroupBox.width/2
    const cy=initialGroupBox.y+initialGroupBox.height/2
    let scale=1
    if(handle.includes('e')||handle.includes('w')){
      scale = 1 + (dx/initialGroupBox.width)*0.5
    } else {
      scale = 1 + (dy/initialGroupBox.height)*0.5
    }
    scale = Math.max(0.1, scale)
    const newW = initialGroupBox.width*scale
    const newH = initialGroupBox.height*scale
    const newX = cx-newW/2
    const newY = cy-newH/2

    const updater = (p:TextPosition):TextPosition => {
      const relX=(p.x+p.width/2-cx)/(initialGroupBox.width/2)
      const relY=(p.y+p.height/2-cy)/(initialGroupBox.height/2)
      return {
        ...p,
        x:cx + relX*(newW/2) - p.width*scale/2,
        y:cy + relY*(newH/2) - p.height*scale/2,
        width:p.width*scale,
        height:p.height*scale,
        fontSize:p.fontSize*scale
      }
    }

    setTitlePositionsFrame2(arr=>{
      return arr.map((p,i)=> selectedTexts.includes(`title${i+1}`)? updater(p):p)
    })
    if(selectedTexts.includes('subtitle')){
      setSubtitlePositionFrame2(updater)
    }
    setInitialGroupBox({ x:newX,y:newY,width:newW,height:newH, rotation: initialGroupBox.rotation })
  }

  const rotateSingle = (
    x:number,y:number,
    p:TextPosition,
    type:'title1'|'title2'|'subtitle'
  ) => {
    if(!lastMousePos.current) return
    const cx=p.x+p.width/2, cy=p.y+p.height/2
    const la=Math.atan2(lastMousePos.current.y-cy,lastMousePos.current.x-cx)
    const ca=Math.atan2(y-cy,       x-cx)
    let delta = ca - la
    if(delta>Math.PI)  delta-=2*Math.PI
    if(delta<-Math.PI) delta+=2*Math.PI

    if(type==='subtitle'){
      setSubtitlePositionFrame2(q=>({...q,rotation:q.rotation+delta}))
    } else {
      setTitlePositionsFrame2(arr=>{
        const a=[...arr]
        const i=type==='title1'?0:1
        a[i]={...a[i],rotation:a[i].rotation+delta}
        return a
      })
    }
    lastMousePos.current={x,y}
  }

  const rotateGroup = (
    x:number,y:number,
    box:GroupBoundingBox
  ) => {
    if(!lastMousePos.current) return
    const cx=box.x+box.width/2, cy=box.y+box.height/2
    const la=Math.atan2(lastMousePos.current.y-cy,lastMousePos.current.x-cx)
    const ca=Math.atan2(y-cy,       x-cx)
    let delta = ca - la
    if(delta>Math.PI)  delta-=2*Math.PI
    if(delta<-Math.PI) delta+=2*Math.PI

    setTitlePositionsFrame2(arr=>arr.map((p,i)=>
      selectedTexts.includes(`title${i+1}`)? rotateAroundPoint(p,cx,cy,delta):p
    ))
    if(selectedTexts.includes('subtitle')){
      setSubtitlePositionFrame2(q=>rotateAroundPoint(q,cx,cy,delta))
    }
    setInitialGroupBox(gb=> gb? {...gb,rotation:gb.rotation+delta}: gb)
    lastMousePos.current={x,y}
  }

  const rotateAroundPoint = (
    p:TextPosition,
    cx:number, cy:number,
    ang:number
  ):TextPosition => {
    const dx=p.x+p.width/2-cx
    const dy=p.y+p.height/2-cy
    const dist=Math.hypot(dx,dy)
    const baseAng=Math.atan2(dy,dx)
    const newAng=baseAng+ang
    const newX=cx+dist*Math.cos(newAng)-p.width/2
    const newY=cy+dist*Math.sin(newAng)-p.height/2
    return {...p,x:newX,y:newY,rotation:p.rotation+ang}
  }

  const handleTextInteraction = (
    p:TextPosition,
    type:'title1'|'title2'|'subtitle',
    x:number,y:number
  ) => {
    if(currentFrame!==2) return
    const now=Date.now()
    const dbl= now-lastClickTime.current < 300
    lastClickTime.current=now

    lastMousePos.current={x,y}
    if(isShiftPressed.current){
      setSelectedTexts(st=>{
        const next= st.includes(type)
          ? st.filter(t=>t!==type)
          : [...st,type]
        return next
      })
    } else {
      setSelectedTexts([type])
    }

    setIsRotating(false)
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)

    if(isPointNearRotationArea(x,y,p)){
      setIsRotating(true)
      const g=calculateGroupBoundingBox()
      if(g) setInitialGroupBox(g)
    } else {
      const h=getResizeHandle(x,y,p)
      if(h){
        if(h==='move') setIsDragging(true)
        else {
          setResizeHandle(h)
          setIsResizing(true)
          setResizeStartPosition({x,y})
          const g=calculateGroupBoundingBox()
          if(g) setInitialGroupBox(g)
        }
      } else {
        setIsDragging(true)
      }
    }

    drawCanvas()
    if(dbl){
      setPositionModalOpen(true)
      setEditingPosition(p)
      setEditingBaseFontSize(p.fontSize)
    }
  }

  const updateCursor = (c:HTMLCanvasElement, x:number,y:number) => {
    const g=calculateGroupBoundingBox()
    if(g && currentFrame===2 && isPointInRotatedBox(x,y,getRotatedBox(g) as any)){
      if(isPointNearRotationArea(x,y,g)){
        c.style.cursor='grab'
        return
      }
      const h=getResizeHandle(x,y,g)
      if(h){ c.style.cursor=h; return }
      c.style.cursor='move'
      return
    }

    const arr = currentFrame===1
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2]

    for(let i=0;i< arr.length;i++){
      const bb = getRotatedBox(arr[i])
      if(isPointInRotatedBox(x,y,bb)){
        if(currentFrame===2){
          if(isPointNearRotationArea(x,y,arr[i])){
            c.style.cursor='grab'
            return
          }
          const h=getResizeHandle(x,y,arr[i])
          if(h){ c.style.cursor=h; return }
          c.style.cursor='move'
          return
        }
      }
    }

    c.style.cursor='default'
  }

  const handleMouseDown = (e:React.MouseEvent<HTMLCanvasElement>) => {
    if(isPlaying) return
    const c = canvasRef.current; if(!c) return
    const r = c.getBoundingClientRect()
    const x = (e.clientX - r.left) * (c.width/r.width)
    const y = (e.clientY - r.top ) * (c.height/r.height)

    lastMousePos.current={x,y}

    // text hit?
    const arr = currentFrame===1 ? titlePositionsFrame1 : titlePositionsFrame2
    for(let i=0;i< arr.length;i++){
      if(isPointInRotatedBox(x,y,getRotatedBox(arr[i]))){
        return handleTextInteraction(arr[i], `title${i+1}` as any, x,y)
      }
    }
    const sp = currentFrame===1 ? subtitlePositionFrame1 : subtitlePositionFrame2
    if(isPointInRotatedBox(x,y,getRotatedBox(sp))){
      return handleTextInteraction(sp,'subtitle',x,y)
    }

    // clear selection?
    if(!isShiftPressed.current){
      setSelectedTexts([])
      setInitialGroupBox(null)
    }

    // line hit?
    const idx = lines.findIndex(l=>
      l.frame===currentFrame &&
      (isPointNear({x,y},l) || isPointNear({x,y},l.start) || isPointNear({x,y},l.end))
    )
    if(idx!==-1){
      setEditingLineIndex(idx)
    } else {
      setCurrentLine({start:{x,y},end:{x,y},frame:currentFrame})
    }

    drawCanvas()
  }

  const handleMouseMove = (e:React.MouseEvent<HTMLCanvasElement>) => {
    if(isPlaying) return
    const c = canvasRef.current; if(!c) return
    const r = c.getBoundingClientRect()
    const x = (e.clientX - r.left) * (c.width/r.width)
    const y = (e.clientY - r.top ) * (c.height/r.height)

    if(selectedTexts.length && currentFrame===2){
      if(isRotating){
        const g=calculateGroupBoundingBox()
        if(g) rotateGroup(x,y,g)
      }
      else if(isDragging){
        if(selectedTexts.length===1) dragSingle(x,y,selectedTexts[0])
        else dragGroup(x,y)
      }
      else if(isResizing && resizeHandle){
        if(selectedTexts.length===1){
          const t=selectedTexts[0]
          const p = t==='subtitle' ? subtitlePositionFrame2 : titlePositionsFrame2[t==='title1'?0:1]
          resizeSingle(x,y,p,t,resizeHandle)
        } else {
          resizeGroup(x,y,resizeHandle)
        }
      }
      drawCanvas()
    }
    else if(currentLine){
      setCurrentLine(cl=>cl?{...cl,end:{x,y}}:null)
      drawCanvas()
    }
    else if(editingLineIndex!==null){
      setLines(ls=>{
        const a=[...ls]
        const L={...a[editingLineIndex]}
        if(isPointNear({x,y},L.start)) L.start={x,y}
        else if(isPointNear({x,y},L.end))   L.end  ={x,y}
        a[editingLineIndex]=L
        return a
      })
      drawCanvas()
    }

    updateCursor(c,x,y)
  }

  const handleMouseUp = () => {
    if(isPlaying) return
    if(currentLine){
      setLines(ls=>[...ls,currentLine])
      setCurrentLine(null)
    }
    setEditingLineIndex(null)
    setIsResizing(false)
    setIsDragging(false)
    setIsRotating(false)
    setResizeHandle(null)
    setResizeStartPosition(null)
    lastMousePos.current=null
    drawCanvas()
  }

  // ─── POSITION MODAL ACTION ─────────────────────────────────────────────────────
  const updatePosition = (np:TextPosition) => {
    if(selectedTexts.includes('title1')||selectedTexts.includes('title2')){
      setTitlePositionsFrame2(arr=>{
        const a=[...arr]
        selectedTexts.forEach(st=>{
          const i=st==='title1'?0:1
          a[i]=np
        })
        return a
      })
    }
    if(selectedTexts.includes('subtitle')){
      setSubtitlePositionFrame2(np)
    }
    setPositionModalOpen(false)
    drawCanvas()
  }

  // ─── SETTINGS HANDLER ───────────────────────────────────────────────────────────
  const handleSettingsChange = (name:string, val:number) => {
    switch(name){
      case 'lineThickness':       setLineThickness(val); break
      case 'tremblingIntensity':  setTremblingIntensity(val); break
      case 'frameRate':           setFrameRate(val); break
    }
    drawCanvas()
  }

  // ─── ANIMATION ─────────────────────────────────────────────────────────────────
  const animate = (ts:number) => {
    if(!startTimeRef.current) startTimeRef.current=ts
    const elapsed = ts - startTimeRef.current
    const msPerFrame = 1000/baseFps
    let prog = elapsed / (msPerFrame*150)

    if(prog>1.4){
      if(isLooping){
        startTimeRef.current=ts
        prog=0
      } else {
        prog=1.4
        setIsPlaying(false)
      }
    }

    if(ts - lastDisplayRef.current >= 1000/frameRate){
      drawCanvas(prog)
      lastDisplayRef.current=ts
    }

    if(isPlaying||isLooping){
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawCanvas()
    }
  }

  // ─── CONTRAST ───────────────────────────────────────────────────────────────────
  const getContrastColor = (bg:string) => {
    const r=parseInt(bg.slice(1,3),16),
          g=parseInt(bg.slice(3,5),16),
          b=parseInt(bg.slice(5,7),16)
    const lum=(0.299*r+0.587*g+0.114*b)/255
    return lum>0.5 ? '#000000':'#FFFFFF'
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
            onChange={e=>setTitles([e.target.value,titles[1]])}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
          <Input
            value={titles[1]}
            onChange={e=>setTitles([titles[0],e.target.value])}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
        </div>
        <div className="space-y-4">
          <p className="text-gray-600">2. Write the instrument</p>
          <Input
            value={subtitle.replace('Instrumento: ','')}
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
      <div className="w-2/3 flex flex-col">
        <div className="flex-1 relative" style={{ backgroundColor }}>
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
        <div className="flex items-center justify-between px-8 py-4 bg-gray-50 border-t border-gray-200">
          <div className="space-x-2">
            <Button
              variant={currentFrame===1?"default":"outline"}
              onClick={()=>setCurrentFrame(1)}
              className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame===2?"default":"outline"}
              onClick={()=>setCurrentFrame(2)}
              className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Frame 2
            </Button>
          </div>

          <div className="flex space-x-4 items-center">
            <Button
              onClick={()=>setIsPlaying(p=>!p)}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black flex items-center justify-center"
            >
              {isPlaying
                ? <PauseIcon className="w-5 h-5 text-white"/>
                : <PlayIcon  className="w-5 h-5 text-white"/>}
            </Button>

            <Button
              onClick={()=>setIsLooping(l=>!l)}
              className={`w-[40px] h-[40px] p-0 rounded-full bg-black flex items-center justify-center ${isLooping?'ring-2 ring-blue-500':''}`}
            >
              <RotateCcwIcon className="w-5 h-5 text-white"/>
            </Button>

            <Button
              onClick={()=>setSettingsOpen(true)}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black flex items-center justify-center"
            >
              <SettingsIcon className="w-5 h-5 text-white"/>
            </Button>

            <Button
              onClick={()=>console.log("Export not implemented")}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black flex items-center justify-center"
            >
              <ShareIcon className="w-5 h-5 text-white"/>
            </Button>
          </div>
        </div>
      </div>

      {/* POSITION MODAL */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editingPosition && editingBaseFontSize !== null && (
            <div className="space-y-4 p-4">
              <div>
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={e => setEditingPosition({ ...editingPosition, x: +e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={e => setEditingPosition({ ...editingPosition, y: +e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (deg)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180/Math.PI)}
                  onChange={e => setEditingPosition({
                    ...editingPosition,
                    rotation: +e.target.value * (Math.PI/180)
                  })}
                />
              </div>
              <div>
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  value={Math.round((editingPosition.fontSize / editingBaseFontSize)*100)}
                  onChange={e=>{
                    const s = +e.target.value/100
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: editingBaseFontSize * s
                    })
                  }}
                />
              </div>
              <Button onClick={()=>updatePosition(editingPosition)}>Update</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SETTINGS MODAL */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div>
              <Label>Line Thickness</Label>
              <Slider
                min={1} max={10} step={1}
                value={[lineThickness]}
                onValueChange={v=>handleSettingsChange('lineThickness',v[0])}
              />
            </div>
            <div>
              <Label>Trembling Intensity</Label>
              <Slider
                min={0} max={10} step={1}
                value={[tremblingIntensity]}
                onValueChange={v=>handleSettingsChange('tremblingIntensity',v[0])}
              />
            </div>
            <div>
              <Label>Animation Speed (Base FPS: {baseFps})</Label>
              <Slider
                min={10} max={120} step={1}
                value={[baseFps]}
                onValueChange={v=>{ const n=+v[0]; if(!isNaN(n)) setBaseFps(n) }}
              />
            </div>
            <div>
              <Label>Frame Rate</Label>
              <Slider
                min={MIN_FRAME_RATE} max={120} step={1}
                value={[frameRate]}
                onValueChange={v=>handleSettingsChange('frameRate',v[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
