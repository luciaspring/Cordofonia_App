'use client'

import React, { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import ControlPanel from './ControlPanel'
import Canvas from './Canvas'
import ErrorModal from './ErrorModal'
import PositionModal from './PositionModal'
import SettingsModal from './SettingsModal'
import ExportModal from './ExportModal'
import { useAnimationState } from './hooks/useAnimationState'
import { useCanvasOperations } from './hooks/useCanvasOperations'
import { useExport } from './hooks/useExport'

export default function InstagramPostCreator() {
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [debug, setDebug] = useState<string>('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

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
  } = useAnimationState()

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    drawCanvas
  } = useCanvasOperations(
    canvasRef,
    {
      titles,
      subtitle,
      backgroundColor,
      currentFrame,
      lines,
      titlePositionsFrame1,
      titlePositionsFrame2,
      subtitlePositionFrame1,
      subtitlePositionFrame2,
      selectedTexts,
      groupRotation,
      lineThickness,
      easingSpeed,
      staggerDelay,
      tremblingIntensity,
      isPlaying,
      setDebug
    },
    {
      setTitlePositionsFrame2,
      setSubtitlePositionFrame2,
      setLines,
      setSelectedTexts,
      setGroupRotation,
      setPositionModalOpen
    }
  )

  const { handleExport, performExport } = useExport(
    canvasRef,
    mediaRecorderRef,
    exportType,
    setIsPlaying,
    setErrorMessage,
    setErrorModalOpen
  )

  const togglePlay = () => setIsPlaying(!isPlaying)
  const toggleLoop = () => setIsLooping(!isLooping)

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
    setGroupRotation(0)
    drawCanvas()
  }

  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Cordofonia Instagram Posts Creator Tool</h1>
      <div className="flex gap-6">
        <ControlPanel
          titles={titles}
          setTitles={setTitles}
          subtitle={subtitle}
          setSubtitle={setSubtitle}
          backgroundColor={backgroundColor}
          setBackgroundColor={setBackgroundColor}
        />
        <div className="flex flex-col w-[540px]">
          <Canvas
            canvasRef={canvasRef}
            backgroundColor={backgroundColor}
            handleMouseDown={handleMouseDown}
            handleMouseMove={handleMouseMove}
            handleMouseUp={handleMouseUp}
          />
          <div className="flex gap-2">
            <Button
              variant={currentFrame === 1 ? "default" : "outline"}
              onClick={() => handleFrameChange(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? "default" : "outline"}
              onClick={() => handleFrameChange(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button onClick={togglePlay} className="w-[40px] h-[40px] p-0 rounded-full">
              {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </Button>
            <Button onClick={toggleLoop} className={`w-[40px] h-[40px] p-0 rounded ${isLooping ? 'bg-blue-500' : ''}`}>
              <RotateCcwIcon className="h-5 w-5" />
            </Button>
            <Button onClick={handleExport} className="w-[40px] h-[40px] p-0 rounded">
              <ShareIcon className="h-5 w-5" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      <ErrorModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        errorMessage={errorMessage}
      />
      <PositionModal
        open={positionModalOpen}
        onOpenChange={setPositionModalOpen}
        selectedTexts={selectedTexts}
        titlePositionsFrame2={titlePositionsFrame2}
        subtitlePositionFrame2={subtitlePositionFrame2}
        setTitlePositionsFrame2={setTitlePositionsFrame2}
        setSubtitlePositionFrame2={setSubtitlePositionFrame2}
        drawCanvas={drawCanvas}
      />
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        lineThickness={lineThickness}
        setLineThickness={setLineThickness}
        easingSpeed={easingSpeed}
        setEasingSpeed={setEasingSpeed}
        staggerDelay={staggerDelay}
        setStaggerDelay={setStaggerDelay}
        tremblingIntensity={tremblingIntensity}
        setTremblingIntensity={setTremblingIntensity}
      />
      <ExportModal
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        exportType={exportType}
        setExportType={setExportType}
        performExport={performExport}
      />
      <div className="mt-4 text-sm text-gray-600">
        Debug: {debug}
      </div>
    </div>
  )
}