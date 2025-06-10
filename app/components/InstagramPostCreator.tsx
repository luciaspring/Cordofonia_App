'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'

import Canvas from './InstagramPostCreator/Canvas'
import ControlPanel from './InstagramPostCreator/ControlPanel'
import PositionModal from './InstagramPostCreator/PositionModal'
import SettingsModal from './InstagramPostCreator/SettingsModal'
import ErrorModal from './InstagramPostCreator/ErrorModal'
import ExportModal from './InstagramPostCreator/ExportModal'

import { useAnimationState } from './InstagramPostCreator/hooks/useAnimationState'
import { useCanvasOperations } from './InstagramPostCreator/hooks/useCanvasOperations'
import { useExport } from './InstagramPostCreator/hooks/useExport'

export default function InstagramPostCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const animationRef = useRef<number | null>(null)

  // ─── FONT LOADING STATE ────────────────────────────────────────────────────────────
  const [fontLoaded, setFontLoaded] = useState(false)
  const [debug, setDebug] = useState('')

  // ─── FONT LOADING EFFECT ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadFont = async () => {
      try {
        const sulSansFont = new FontFace('SulSans-Bold', 'url(/fonts/SulSans-Bold.otf)')
        const font = await sulSansFont.load()
        document.fonts.add(font)
        setFontLoaded(true)
        console.log('SulSans-Bold font loaded successfully')
      } catch (error) {
        console.error('Error loading SulSans-Bold font:', error)
      }
    }
    loadFont()
  }, [])

  const state = useAnimationState()
  
  // Add fontLoaded to the state object
  const stateWithFont = {
    ...state,
    fontLoaded,
    setDebug
  }

  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const canvasActions = {
    setTitlePositionsFrame2: state.setTitlePositionsFrame2,
    setSubtitlePositionFrame2: state.setSubtitlePositionFrame2,
    setLines: state.setLines,
    setSelectedTexts: state.setSelectedTexts,
    setGroupRotation: state.setGroupRotation,
    setPositionModalOpen
  }

  const { handleMouseDown, handleMouseMove, handleMouseUp, drawCanvas } = useCanvasOperations(
    canvasRef,
    stateWithFont,
    canvasActions
  )

  const { handleExport, performExport } = useExport(
    canvasRef,
    mediaRecorderRef,
    state.exportType,
    state.setIsPlaying,
    setErrorMessage,
    setErrorModalOpen
  )

  // ─── REDRAW CANVAS WHEN STATE CHANGES ──────────────────────────────────────────────
  useEffect(() => {
    drawCanvas()
  }, [
    state.titles,
    state.subtitle,
    state.backgroundColor,
    state.currentFrame,
    state.lines,
    state.titlePositionsFrame1,
    state.titlePositionsFrame2,
    state.subtitlePositionFrame1,
    state.subtitlePositionFrame2,
    state.selectedTexts,
    state.groupRotation,
    state.lineThickness,
    state.tremblingIntensity,
    fontLoaded,
    drawCanvas
  ])

  // ─── ANIMATION CONTROL FUNCTIONS ───────────────────────────────────────────────────
  const togglePlay = () => {
    state.setIsPlaying(!state.isPlaying)
    if (!state.isPlaying) {
      startAnimation()
    } else {
      stopAnimation()
    }
  }

  const toggleLoop = () => {
    state.setIsLooping(!state.isLooping)
  }

  const startAnimation = () => {
    if (animationRef.current) return

    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const duration = 5000 // 5 seconds total animation
      const progress = elapsed / duration

      if (progress >= 1) {
        if (state.isLooping) {
          startAnimation()
          return
        } else {
          state.setIsPlaying(false)
          drawCanvas()
          return
        }
      }

      drawCanvas(progress)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  useEffect(() => {
    if (state.isPlaying) {
      startAnimation()
    } else {
      stopAnimation()
    }
    return () => stopAnimation()
  }, [state.isPlaying, state.isLooping])

  const handleFrameChange = (frame: number) => {
    state.setCurrentFrame(frame)
    state.setSelectedTexts([])
  }

  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        <ControlPanel
          titles={state.titles}
          setTitles={state.setTitles}
          subtitle={state.subtitle}
          setSubtitle={state.setSubtitle}
          backgroundColor={state.backgroundColor}
          setBackgroundColor={state.setBackgroundColor}
        />

        <div className="w-[600px] flex flex-col">
          <Canvas
            canvasRef={canvasRef}
            backgroundColor={state.backgroundColor}
            handleMouseDown={handleMouseDown}
            handleMouseMove={handleMouseMove}
            handleMouseUp={handleMouseUp}
          />
          
          <div className="flex space-x-2 w-[540px]">
            <Button
              variant={state.currentFrame === 1 ? "default" : "outline"}
              onClick={() => handleFrameChange(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={state.currentFrame === 2 ? "default" : "outline"}
              onClick={() => handleFrameChange(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button onClick={togglePlay} className="w-[40px] h-[40px] p-0 rounded-full bg-black">
              {state.isPlaying ? <PauseIcon className="h-5 w-5 text-white" /> : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button onClick={toggleLoop} className={`w-[40px] h-[40px] p-0 rounded bg-black ${state.isLooping ? 'ring-2 ring-blue-500' : ''}`}>
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setExportModalOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      <PositionModal
        open={positionModalOpen}
        onOpenChange={setPositionModalOpen}
        selectedTexts={state.selectedTexts}
        titlePositionsFrame2={state.titlePositionsFrame2}
        subtitlePositionFrame2={state.subtitlePositionFrame2}
        setTitlePositionsFrame2={state.setTitlePositionsFrame2}
        setSubtitlePositionFrame2={state.setSubtitlePositionFrame2}
        drawCanvas={drawCanvas}
      />

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        lineThickness={state.lineThickness}
        setLineThickness={state.setLineThickness}
        easingSpeed={state.easingSpeed}
        setEasingSpeed={state.setEasingSpeed}
        staggerDelay={state.staggerDelay}
        setStaggerDelay={state.setStaggerDelay}
        tremblingIntensity={state.tremblingIntensity}
        setTremblingIntensity={state.setTremblingIntensity}
      />

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        exportType={state.exportType}
        setExportType={state.setExportType}
        performExport={performExport}
      />

      <ErrorModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        errorMessage={errorMessage}
      />

      {debug && (
        <div className="mt-4 p-2 bg-gray-200 text-xs">
          Debug: {debug}
        </div>
      )}
    </div>
  )
}