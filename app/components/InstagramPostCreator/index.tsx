'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Download, Settings, Move } from 'lucide-react'
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

  // Animation timing constants
  const PLACEMENT_DURATION = 1.5 // seconds for placement animation
  const SCALE_DURATION = 1.0 // seconds for scale animation
  const LINES_DELAY = 0.5 // delay before lines start appearing
  const TOTAL_ANIMATION_DURATION = PLACEMENT_DURATION + SCALE_DURATION + LINES_DELAY + 2.0 // total cycle

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

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
        // Growing phase (0 to 0.5)
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
          // Original behavior: point B moves toward point A
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
    ctx.textBaseline = 'top'

    // Calculate animation phases
    const placementEndTime = PLACEMENT_DURATION / TOTAL_ANIMATION_DURATION
    const scaleEndTime = (PLACEMENT_DURATION + SCALE_DURATION) / TOTAL_ANIMATION_DURATION

    let placementProgress = 0
    let scaleProgress = 0

    if (progress <= placementEndTime) {
      // Phase 1: Only placement animation
      placementProgress = easeInOutCubic(progress / placementEndTime)
      scaleProgress = 0 // No scale animation yet
    } else if (progress <= scaleEndTime) {
      // Phase 2: Placement complete, now scale animation
      placementProgress = 1 // Placement is complete
      const scalePhaseProgress = (progress - placementEndTime) / ((scaleEndTime - placementEndTime))
      scaleProgress = easeInOutCubic(scalePhaseProgress)
    } else {
      // Phase 3: Both animations complete
      placementProgress = 1
      scaleProgress = 1
    }

    const drawText = () => {
      // Draw titles
      titles.forEach((title, index) => {
        if (!title.trim()) return

        const pos1 = titlePositionsFrame1[index]
        const pos2 = titlePositionsFrame2[index]
        
        // Phase 1: Calculate position (placement animation only)
        let x, y, rotation, fontSize, width, height
        
        if (placementProgress < 1) {
          // During placement phase: animate position, keep Frame 1 scale
          x = pos1.x + (pos2.x - pos1.x) * placementProgress
          y = pos1.y + (pos2.y - pos1.y) * placementProgress
          rotation = pos1.rotation + (pos2.rotation - pos1.rotation) * placementProgress
          fontSize = pos1.fontSize // Keep Frame 1 scale
          width = pos1.width // Keep Frame 1 scale
          height = pos1.height // Keep Frame 1 scale
        } else {
          // After placement phase: use Frame 2 position, animate scale
          x = pos2.x // Final position
          y = pos2.y // Final position
          rotation = pos2.rotation // Final rotation
          fontSize = pos1.fontSize + (pos2.fontSize - pos1.fontSize) * scaleProgress
          width = pos1.width + (pos2.width - pos1.width) * scaleProgress
          height = pos1.height + (pos2.height - pos1.height) * scaleProgress
        }
        
        ctx.save()
        ctx.translate(x + width / 2, y + height / 2)
        ctx.rotate(rotation)
        ctx.font = `${fontSize}px SulSans-Bold, sans-serif`
        ctx.fillText(title, -width / 2, -height / 2)
        ctx.restore()
      })

      // Draw subtitle
      if (subtitle.trim()) {
        const subPos1 = subtitlePositionFrame1
        const subPos2 = subtitlePositionFrame2
        
        // Phase 1: Calculate position (placement animation only)
        let subX, subY, subRotation, subFontSize, subWidth, subHeight
        
        if (placementProgress < 1) {
          // During placement phase: animate position, keep Frame 1 scale
          subX = subPos1.x + (subPos2.x - subPos1.x) * placementProgress
          subY = subPos1.y + (subPos2.y - subPos1.y) * placementProgress
          subRotation = subPos1.rotation + (subPos2.rotation - subPos1.rotation) * placementProgress
          subFontSize = subPos1.fontSize // Keep Frame 1 scale
          subWidth = subPos1.width // Keep Frame 1 scale
          subHeight = subPos1.height // Keep Frame 1 scale
        } else {
          // After placement phase: use Frame 2 position, animate scale
          subX = subPos2.x // Final position
          subY = subPos2.y // Final position
          subRotation = subPos2.rotation // Final rotation
          subFontSize = subPos1.fontSize + (subPos2.fontSize - subPos1.fontSize) * scaleProgress
          subWidth = subPos1.width + (subPos2.width - subPos1.width) * scaleProgress
          subHeight = subPos1.height + (subPos2.height - subPos1.height) * scaleProgress
        }

        ctx.save()
        ctx.translate(subX + subWidth / 2, subY + subHeight / 2)
        ctx.rotate(subRotation)
        ctx.font = `${subFontSize}px SulSans-Bold, sans-serif`
        ctx.fillText(subtitle, -subWidth / 2, -subHeight / 2)
        ctx.restore()
      }
    }

    drawText()

    // Draw animated lines (only after placement and scale animations are complete)
    drawAnimatedLines(ctx, progress)

    setDebug(`Progress: ${progress.toFixed(3)}, Placement: ${placementProgress.toFixed(3)}, Scale: ${scaleProgress.toFixed(3)}, Frame: ${currentFrame}`)
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
            handleMouseDown={canvasOperations.handleMouseDown}
            handleMouseMove={canvasOperations.handleMouseMove}
            handleMouseUp={canvasOperations.handleMouseUp}
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