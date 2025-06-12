'use client'

import React, { useRef, useEffect, useState } from 'react'
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

export default function InstagramPostCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)
  
  const [debug, setDebug] = useState('')
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const animationState = useAnimationState()
  const {
    titles,
    subtitle,
    backgroundColor,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    isLooping,
    setIsLooping,
    titlePositionsFrame1,
    titlePositionsFrame2,
    subtitlePositionFrame1,
    subtitlePositionFrame2,
    selectedTexts,
    exportType,
    setExportType
  } = animationState

  const canvasOperations = useCanvasOperations(
    canvasRef,
    { ...animationState, setDebug },
    {
      setTitlePositionsFrame2: animationState.setTitlePositionsFrame2,
      setSubtitlePositionFrame2: animationState.setSubtitlePositionFrame2,
      setLines: animationState.setLines,
      setSelectedTexts: animationState.setSelectedTexts,
      setGroupRotation: animationState.setGroupRotation,
      setPositionModalOpen
    }
  )

  const exportHooks = useExport(
    canvasRef,
    mediaRecorderRef,
    exportType,
    setIsPlaying,
    setErrorMessage,
    setErrorModalOpen
  )

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return

    const startTime = Date.now()
    const duration = 5000 // 5 seconds

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
      const easedProgress = easeInOutCubic(progress)

      canvasOperations.drawCanvas(easedProgress)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else if (isLooping) {
        // Restart animation
        animationRef.current = requestAnimationFrame(() => {
          const newStartTime = Date.now()
          const newAnimate = () => {
            const newElapsed = Date.now() - newStartTime
            const newProgress = Math.min(newElapsed / duration, 1)
            const newEasedProgress = easeInOutCubic(newProgress)
            
            canvasOperations.drawCanvas(newEasedProgress)
            
            if (newProgress < 1 && isPlaying) {
              animationRef.current = requestAnimationFrame(newAnimate)
            } else if (isLooping && isPlaying) {
              // Continue looping
              animationRef.current = requestAnimationFrame(animate)
            } else {
              setIsPlaying(false)
            }
          }
          newAnimate()
        })
      } else {
        setIsPlaying(false)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, isLooping, canvasOperations])

  // Initial canvas draw
  useEffect(() => {
    if (!isPlaying) {
      canvasOperations.drawCanvas(currentFrame === 1 ? 0 : 1)
    }
  }, [canvasOperations, currentFrame, isPlaying, titles, subtitle, backgroundColor, titlePositionsFrame1, titlePositionsFrame2, subtitlePositionFrame1, subtitlePositionFrame2])

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const resetAnimation = () => {
    setIsPlaying(false)
    setCurrentFrame(1)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    canvasOperations.drawCanvas(0)
  }

  const switchFrame = () => {
    if (!isPlaying) {
      const newFrame = currentFrame === 1 ? 2 : 1
      setCurrentFrame(newFrame)
      canvasOperations.drawCanvas(newFrame === 1 ? 0 : 1)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-6 bg-gray-50 min-h-screen">
      {/* Canvas Section */}
      <div className="flex flex-col items-center">
        <Canvas
          canvasRef={canvasRef}
          backgroundColor={backgroundColor}
          handleMouseDown={canvasOperations.handleMouseDown}
          handleMouseMove={canvasOperations.handleMouseMove}
          handleMouseUp={canvasOperations.handleMouseUp}
        />
        
        {/* Controls */}
        <div className="flex gap-2 mt-4">
          <Button onClick={togglePlayPause} className="btn-hover-grey">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button onClick={resetAnimation} variant="outline" className="btn-hover-grey">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button 
            onClick={switchFrame} 
            variant="outline" 
            className="btn-hover-grey"
            disabled={isPlaying}
          >
            <Move className="w-4 h-4" />
            Frame {currentFrame}
          </Button>
          <Button 
            onClick={() => setIsLooping(!isLooping)} 
            variant={isLooping ? "default" : "outline"}
            className="btn-hover-grey"
          >
            Loop
          </Button>
          <Button onClick={() => setExportModalOpen(true)} variant="outline" className="btn-hover-grey">
            <Download className="w-4 h-4" />
          </Button>
          <Button onClick={() => setSettingsModalOpen(true)} variant="outline" className="btn-hover-grey">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Debug info */}
        {debug && (
          <div className="mt-2 text-xs text-gray-500 max-w-md">
            {debug}
          </div>
        )}
      </div>

      {/* Control Panel */}
      <ControlPanel {...animationState} />

      {/* Modals */}
      <PositionModal
        open={positionModalOpen}
        onOpenChange={setPositionModalOpen}
        selectedTexts={selectedTexts}
        titlePositionsFrame2={titlePositionsFrame2}
        subtitlePositionFrame2={subtitlePositionFrame2}
        setTitlePositionsFrame2={animationState.setTitlePositionsFrame2}
        setSubtitlePositionFrame2={animationState.setSubtitlePositionFrame2}
        drawCanvas={canvasOperations.drawCanvas}
      />

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        lineThickness={animationState.lineThickness}
        setLineThickness={animationState.setLineThickness}
        easingSpeed={animationState.easingSpeed}
        setEasingSpeed={animationState.setEasingSpeed}
        staggerDelay={animationState.staggerDelay}
        setStaggerDelay={animationState.setStaggerDelay}
        tremblingIntensity={animationState.tremblingIntensity}
        setTremblingIntensity={animationState.setTremblingIntensity}
      />

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        exportType={exportType}
        setExportType={setExportType}
        performExport={exportHooks.performExport}
      />

      <ErrorModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        errorMessage={errorMessage}
      />
    </div>
  )
}