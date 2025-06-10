'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Download, Settings, Move, Pencil } from 'lucide-react'
import Canvas from './Canvas'
import ControlPanel from './ControlPanel'
import PositionModal from './PositionModal'
import SettingsModal from './SettingsModal'
import ExportModal from './ExportModal'
import ErrorModal from './ErrorModal'
import { useAnimationState } from './hooks/useAnimationState'
import { useCanvasOperations } from './hooks/useCanvasOperations'
import { useExport } from './hooks/useExport'
import { TextPosition, Line, Point } from './types'
import { drawCanvas as drawCanvasUtil, getContrastColor } from './utils/canvasUtils'

export default function InstagramPostCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [debug, setDebug] = useState('')
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [lineDisappearEffect, setLineDisappearEffect] = useState(true)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [currentLine, setCurrentLine] = useState<Point | null>(null)

  const state = useAnimationState()
  const {
    titles,
    setTitles,
    subtitle,
    setSubtitle,
    backgroundColor,
    setBackgroundColor,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    isLooping,
    setIsLooping,
    lines,
    setLines,
    titlePositionsFrame1,
    setTitlePositionsFrame1,
    titlePositionsFrame2,
    setTitlePositionsFrame2,
    subtitlePositionFrame1,
    setSubtitlePositionFrame1,
    subtitlePositionFrame2,
    setSubtitlePositionFrame2,
    selectedTexts,
    setSelectedTexts,
    groupRotation,
    setGroupRotation,
    lineThickness,
    setLineThickness,
    easingSpeed,
    setEasingSpeed,
    staggerDelay,
    setStaggerDelay,
    tremblingIntensity,
    setTremblingIntensity,
    exportType,
    setExportType
  } = state

  // Animation timing constants
  const PLACEMENT_DURATION = 2.0 // seconds for placement animation
  const SCALE_DURATION = 1.5 // seconds for scale animation
  const LINES_DELAY = 0.5 // delay before lines start appearing
  const TOTAL_ANIMATION_DURATION = PLACEMENT_DURATION + SCALE_DURATION + LINES_DELAY + 2.0 // total cycle

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // Handle line drawing
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setCurrentLine({ x, y })
  }, [isDrawingMode])

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !currentLine) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Only add line if there's significant distance
    const distance = Math.sqrt(Math.pow(x - currentLine.x, 2) + Math.pow(y - currentLine.y, 2))
    if (distance > 10) {
      const newLine: Line = {
        points: [currentLine, { x, y }],
        frame: currentFrame
      }

      setLines(prev => [...prev, newLine])
    }

    setCurrentLine(null)
    drawCanvas(currentFrame === 1 ? 0 : 1)
  }, [isDrawingMode, currentLine, currentFrame, setLines])

  const drawAnimatedLines = useCallback((ctx: CanvasRenderingContext2D, progress: number) => {
    if (lines.length === 0) return

    const linesStartTime = (PLACEMENT_DURATION + SCALE_DURATION + LINES_DELAY) / TOTAL_ANIMATION_DURATION
    
    if (progress < linesStartTime) return

    const linesProgress = (progress - linesStartTime) / ((TOTAL_ANIMATION_DURATION - (PLACEMENT_DURATION + SCALE_DURATION + LINES_DELAY)) / TOTAL_ANIMATION_DURATION)
    const clampedProgress = Math.max(0, Math.min(1, linesProgress))

    ctx.strokeStyle = getContrastColor(backgroundColor)
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'

    lines.forEach((line, index) => {
      if (line.frame !== currentFrame) return

      const lineDelay = index * staggerDelay
      const lineProgress = Math.max(0, Math.min(1, (clampedProgress - lineDelay) / (1 - lineDelay)))
      
      if (lineProgress <= 0) return

      const easedProgress = easeInOutCubic(lineProgress)
      
      let startX, startY, endX, endY

      if (easedProgress <= 0.5) {
        // Growing phase (0 to 0.5) - line grows from point A to point B
        const growProgress = easedProgress * 2
        startX = line.points[0].x
        startY = line.points[0].y
        endX = line.points[0].x + (line.points[1].x - line.points[0].x) * growProgress
        endY = line.points[0].y + (line.points[1].y - line.points[0].y) * growProgress
      } else {
        // Shrinking phase (0.5 to 1.0)
        const shrinkProgress = (easedProgress - 0.5) * 2
        
        if (lineDisappearEffect) {
          // New behavior: point A moves toward point B, point B stays fixed
          startX = line.points[0].x + (line.points[1].x - line.points[0].x) * shrinkProgress
          startY = line.points[0].y + (line.points[1].y - line.points[0].y) * shrinkProgress
          endX = line.points[1].x
          endY = line.points[1].y
        } else {
          // Original behavior: point B moves toward point A, point A stays fixed
          startX = line.points[0].x
          startY = line.points[0].y
          endX = line.points[1].x - (line.points[1].x - line.points[0].x) * shrinkProgress
          endY = line.points[1].y - (line.points[1].y - line.points[0].y) * shrinkProgress
        }
      }

      // Apply trembling effect
      if (tremblingIntensity > 0) {
        const trembleX = (Math.random() - 0.5) * tremblingIntensity
        const trembleY = (Math.random() - 0.5) * tremblingIntensity
        startX += trembleX
        startY += trembleY
        endX += trembleX
        endY += trembleY
      }

      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    })
  }, [lines, currentFrame, backgroundColor, lineThickness, staggerDelay, tremblingIntensity, lineDisappearEffect, PLACEMENT_DURATION, SCALE_DURATION, LINES_DELAY, TOTAL_ANIMATION_DURATION])

  const drawStaticLines = useCallback((ctx: CanvasRenderingContext2D) => {
    if (lines.length === 0) return

    ctx.strokeStyle = getContrastColor(backgroundColor)
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'

    lines.forEach((line) => {
      if (line.frame !== currentFrame) return

      ctx.beginPath()
      ctx.moveTo(line.points[0].x, line.points[0].y)
      ctx.lineTo(line.points[1].x, line.points[1].y)
      ctx.stroke()
    })
  }, [lines, currentFrame, backgroundColor, lineThickness])

  const drawCanvas = useCallback((progress: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Set background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Set text properties
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    // Calculate animation phases with clear boundaries
    const placementEndTime = PLACEMENT_DURATION / TOTAL_ANIMATION_DURATION
    const scaleEndTime = (PLACEMENT_DURATION + SCALE_DURATION) / TOTAL_ANIMATION_DURATION

    const drawText = () => {
      // Draw titles
      titles.forEach((title, index) => {
        if (!title.trim()) return

        const pos1 = titlePositionsFrame1[index]
        const pos2 = titlePositionsFrame2[index]
        
        let x, y, rotation, fontSize

        if (progress < placementEndTime) {
          // PHASE 1: POSITION & ROTATION ONLY - Scale stays at Frame 1
          const placementProgress = easeInOutCubic(progress / placementEndTime)
          
          // Position and rotation animate
          x = pos1.x + (pos2.x - pos1.x) * placementProgress
          y = pos1.y + (pos2.y - pos1.y) * placementProgress
          rotation = pos1.rotation + (pos2.rotation - pos1.rotation) * placementProgress
          
          // Font size LOCKED at Frame 1 value
          fontSize = pos1.fontSize
          
        } else if (progress < scaleEndTime) {
          // PHASE 2: SCALE ONLY - Position locked at Frame 2
          const scalePhaseProgress = (progress - placementEndTime) / (scaleEndTime - placementEndTime)
          const scaleProgress = easeInOutCubic(scalePhaseProgress)
          
          // Position and rotation LOCKED at Frame 2 values
          x = pos2.x
          y = pos2.y
          rotation = pos2.rotation
          
          // Only font size animates
          fontSize = pos1.fontSize + (pos2.fontSize - pos1.fontSize) * scaleProgress
          
        } else {
          // PHASE 3: BOTH COMPLETE - Everything at Frame 2 values
          x = pos2.x
          y = pos2.y
          rotation = pos2.rotation
          fontSize = pos2.fontSize
        }
        
        // Use a FIXED center point that doesn't change based on width/height
        const centerX = x + 500 // Fixed offset for centering
        const centerY = y + 100 // Fixed offset for centering
        
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(rotation)
        ctx.font = `${fontSize}px SulSans-Bold, sans-serif`
        
        // Draw text centered at origin (0,0) since we translated
        ctx.fillText(title, 0, 0)
        ctx.restore()
      })

      // Draw subtitle with same logic
      if (subtitle.trim()) {
        const subPos1 = subtitlePositionFrame1
        const subPos2 = subtitlePositionFrame2
        
        let subX, subY, subRotation, subFontSize

        if (progress < placementEndTime) {
          // PHASE 1: POSITION & ROTATION ONLY
          const placementProgress = easeInOutCubic(progress / placementEndTime)
          
          subX = subPos1.x + (subPos2.x - subPos1.x) * placementProgress
          subY = subPos1.y + (subPos2.y - subPos1.y) * placementProgress
          subRotation = subPos1.rotation + (subPos2.rotation - subPos1.rotation) * placementProgress
          
          // Font size LOCKED at Frame 1
          subFontSize = subPos1.fontSize
          
        } else if (progress < scaleEndTime) {
          // PHASE 2: SCALE ONLY
          const scalePhaseProgress = (progress - placementEndTime) / (scaleEndTime - placementEndTime)
          const scaleProgress = easeInOutCubic(scalePhaseProgress)
          
          // Position LOCKED at Frame 2
          subX = subPos2.x
          subY = subPos2.y
          subRotation = subPos2.rotation
          
          // Only font size animates
          subFontSize = subPos1.fontSize + (subPos2.fontSize - subPos1.fontSize) * scaleProgress
          
        } else {
          // PHASE 3: BOTH COMPLETE
          subX = subPos2.x
          subY = subPos2.y
          subRotation = subPos2.rotation
          subFontSize = subPos2.fontSize
        }

        // Use a FIXED center point for subtitle too
        const centerX = subX + 500 // Fixed offset for centering
        const centerY = subY + 15 // Fixed offset for centering (smaller for subtitle)

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(subRotation)
        ctx.font = `${subFontSize}px SulSans-Bold, sans-serif`
        
        // Draw text centered at origin (0,0) since we translated
        ctx.fillText(subtitle, 0, 0)
        ctx.restore()
      }
    }

    drawText()

    // Draw lines - animated during animation, static otherwise
    if (isPlaying) {
      drawAnimatedLines(ctx, progress)
    } else {
      drawStaticLines(ctx)
    }

    // Draw current line being drawn
    if (currentLine && isDrawingMode) {
      ctx.strokeStyle = getContrastColor(backgroundColor)
      ctx.lineWidth = lineThickness
      ctx.lineCap = 'round'
      ctx.setLineDash([5, 5])
      
      ctx.beginPath()
      ctx.moveTo(currentLine.x, currentLine.y)
      // Draw to mouse position (we'll need to track this)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Enhanced debug info
    let phase = 'Complete'
    let phaseProgress = 0
    
    if (progress < placementEndTime) {
      phase = 'Position/Rotation ONLY'
      phaseProgress = (progress / placementEndTime) * 100
    } else if (progress < scaleEndTime) {
      phase = 'Scale ONLY'
      phaseProgress = ((progress - placementEndTime) / (scaleEndTime - placementEndTime)) * 100
    } else if (progress < (PLACEMENT_DURATION + SCALE_DURATION + LINES_DELAY) / TOTAL_ANIMATION_DURATION) {
      phase = 'Waiting for Lines'
      phaseProgress = 100
    } else {
      phase = 'Lines'
      phaseProgress = 100
    }

    setDebug(`Progress: ${progress.toFixed(3)} | Phase: ${phase} (${phaseProgress.toFixed(0)}%) | Frame: ${currentFrame} | Lines: ${lines.filter(l => l.frame === currentFrame).length}`)
  }, [
    backgroundColor,
    titles,
    subtitle,
    titlePositionsFrame1,
    titlePositionsFrame2,
    subtitlePositionFrame1,
    subtitlePositionFrame2,
    currentFrame,
    drawAnimatedLines,
    drawStaticLines,
    currentLine,
    isDrawingMode,
    lineThickness,
    lines,
    isPlaying,
    PLACEMENT_DURATION,
    SCALE_DURATION,
    TOTAL_ANIMATION_DURATION
  ])

  const animate = useCallback(() => {
    const startTime = Date.now()
    
    const frame = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / TOTAL_ANIMATION_DURATION, 1)
      
      drawCanvas(progress)
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(frame)
      } else if (isLooping) {
        // Restart animation
        animationRef.current = requestAnimationFrame(() => animate())
      } else {
        setIsPlaying(false)
      }
    }
    
    animationRef.current = requestAnimationFrame(frame)
  }, [drawCanvas, isLooping, TOTAL_ANIMATION_DURATION])

  const togglePlayPause = () => {
    if (isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      animate()
    }
  }

  const resetAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    setIsPlaying(false)
    drawCanvas(0)
  }

  const switchFrame = () => {
    setCurrentFrame(currentFrame === 1 ? 2 : 1)
  }

  const clearLines = () => {
    setLines(prev => prev.filter(line => line.frame !== currentFrame))
    drawCanvas(currentFrame === 1 ? 0 : 1)
  }

  const canvasOperations = useCanvasOperations(
    canvasRef,
    { ...state, setDebug },
    {
      setTitlePositionsFrame2,
      setSubtitlePositionFrame2,
      setLines,
      setSelectedTexts,
      setGroupRotation,
      setPositionModalOpen
    }
  )

  const exportOperations = useExport(
    canvasRef,
    mediaRecorderRef,
    exportType,
    setIsPlaying,
    setErrorMessage,
    setErrorModalOpen
  )

  // Initial draw and frame switching effect
  useEffect(() => {
    drawCanvas(currentFrame === 1 ? 0 : 1)
  }, [drawCanvas, currentFrame, backgroundColor, titles, subtitle, titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="flex gap-8 items-start">
        <div className="flex flex-col items-center">
          <Canvas
            canvasRef={canvasRef}
            backgroundColor={backgroundColor}
            handleMouseDown={isDrawingMode ? handleCanvasMouseDown : canvasOperations.handleMouseDown}
            handleMouseMove={canvasOperations.handleMouseMove}
            handleMouseUp={isDrawingMode ? handleCanvasMouseUp : canvasOperations.handleMouseUp}
          />
          
          <div className="flex gap-2 mb-4">
            <Button onClick={togglePlayPause} variant="outline" size="sm">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button onClick={resetAnimation} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button onClick={switchFrame} variant="outline" size="sm">
              <Move className="w-4 h-4" />
              Frame {currentFrame}
            </Button>
            <Button 
              onClick={() => setIsDrawingMode(!isDrawingMode)} 
              variant={isDrawingMode ? "default" : "outline"} 
              size="sm"
            >
              <Pencil className="w-4 h-4" />
              {isDrawingMode ? 'Drawing' : 'Draw'}
            </Button>
            <Button onClick={clearLines} variant="outline" size="sm">
              Clear Lines
            </Button>
            <Button onClick={() => setSettingsModalOpen(true)} variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button onClick={() => setExportModalOpen(true)} variant="outline" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-xs text-gray-500 max-w-md text-center">
            {debug}
          </div>
          
          {isDrawingMode && (
            <div className="text-xs text-blue-600 max-w-md text-center mt-2">
              Click and drag to draw lines on Frame {currentFrame}
            </div>
          )}
        </div>

        <ControlPanel
          titles={titles}
          setTitles={setTitles}
          subtitle={subtitle}
          setSubtitle={setSubtitle}
          backgroundColor={backgroundColor}
          setBackgroundColor={setBackgroundColor}
        />
      </div>

      <PositionModal
        open={positionModalOpen}
        onOpenChange={setPositionModalOpen}
        selectedTexts={selectedTexts}
        titlePositionsFrame2={titlePositionsFrame2}
        subtitlePositionFrame2={subtitlePositionFrame2}
        setTitlePositionsFrame2={setTitlePositionsFrame2}
        setSubtitlePositionFrame2={setSubtitlePositionFrame2}
        drawCanvas={() => drawCanvas(currentFrame === 1 ? 0 : 1)}
      />

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        lineThickness={lineThickness}
        setLineThickness={setLineThickness}
        easingSpeed={easingSpeed}
        setEasingSpeed={setEasingSpeed}
        staggerDelay={staggerDelay}
        setStaggerDelay={setStaggerDelay}
        tremblingIntensity={tremblingIntensity}
        setTremblingIntensity={setTremblingIntensity}
        lineDisappearEffect={lineDisappearEffect}
        setLineDisappearEffect={setLineDisappearEffect}
      />

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        exportType={exportType}
        setExportType={setExportType}
        performExport={exportOperations.performExport}
      />

      <ErrorModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        errorMessage={errorMessage}
      />
    </div>
  )
}