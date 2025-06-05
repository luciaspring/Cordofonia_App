'use client'

import React, { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { TextPosition, Line, Point } from './types'

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

const MIN_FRAME_RATE = 10
const MAX_LINE_THICKNESS = 10
const BASE_FPS = 60

// Ease In-Out Quint easing function (piecewise)
const easeInOutQuint = (t: number): number => {
  if (t < 0.5) {
    return 16 * Math.pow(t, 5)
  } else {
    return 1 - Math.pow(-2 * t + 2, 5) / 2
  }
}

export default function InstagramPostCreator() {
  // State management
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#F6A69B')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 100, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 300, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])

  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 100, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 300, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])

  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({ x: 40, y: 500, width: 1000, height: 30, rotation: 0, fontSize: 36 })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({ x: 40, y: 500, width: 1000, height: 30, rotation: 0, fontSize: 36 })

  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number | null>(null)

  // Preset values for animation controls
  const [lineThickness, setLineThickness] = useState<number>(MAX_LINE_THICKNESS)
  const [tremblingIntensity, setTremblingIntensity] = useState<number>(3)
  const [frameRate, setFrameRate] = useState<number>(MIN_FRAME_RATE)
  const [baseFps, setBaseFps] = useState<number>(35)

  const [settingsOpen, setSettingsOpen] = useState(false)

  // Animation state
  const [lastDisplayTime, setLastDisplayTime] = useState<number>(0)
  const lastDisplayTimeRef = useRef<number>(0)
  const animationStartTimeRef = useRef<number>(0)

  // Mouse state
  const [mouseState, setMouseState] = useState<{
    isDrawing: boolean
    lastPoint: Point | null
  } | null>(null)

  // Ref's for animation and mouse tracking
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)

  const togglePlay = () => setIsPlaying(!isPlaying)
  const toggleLoop = () => setIsLooping(!isLooping)

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame)
    setSelectedTexts([])
  }

  const handleMouseDown = () => {
    // Implementation needed
  }

  const handleMouseMove = () => {
    // Implementation needed
  }

  const handleMouseUp = () => {
    // Implementation needed
  }

  const updatePosition = (position: TextPosition) => {
    // Implementation needed
  }

  return (
    <div className="bg-white rounded-lg shadow-lg flex w-full h-[90vh] overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-1/3 border-r border-gray-200 px-8 py-6 space-y-8 overflow-auto">
        <h2 className="text-xl font-semibold mb-4">Cordofonia Instagram<br/>Posts Creator Tool</h2>

        <div className="space-y-4">
          <p className="text-gray-600">1. Write a title</p>
          <Input
            value={titles[0]}
            onChange={e => setTitles([e.target.value, titles[1]])}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
          <Input
            value={titles[1]}
            onChange={e => setTitles([titles[0], e.target.value])}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">2. Write the instrument</p>
          <Input
            value={subtitle.replace('Instrumento: ', '')}
            onChange={e => setSubtitle(`Instrumento: ${e.target.value}`)}
            className="w-full bg-gray-100 border-gray-300 text-lg h-10"
          />
        </div>

        <div className="space-y-2">
          <p className="text-gray-600">3. Pick a Color</p>
          <div className="flex items-center space-x-2">
            {colorOptions.map(c => (
              <button
                key={c.value}
                onClick={() => setBackgroundColor(c.value)}
                className={`w-8 h-8 rounded ${backgroundColor === c.value ? 'ring-2 ring-black' : 'border border-gray-300'}`}
                style={{ backgroundColor: c.value }}
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
              variant={currentFrame === 1 ? "default" : "outline"}
              onClick={() => handleFrameChange(1)}
              className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? "default" : "outline"}
              onClick={() => handleFrameChange(2)}
              className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Frame 2
            </Button>
          </div>

          <div className="flex space-x-4 items-center">
            <Button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              {isPlaying
                ? <PauseIcon className="w-6 h-6 text-black"/>
                : <PlayIcon className="w-6 h-6 text-black"/>}
            </Button>

            <Button
              onClick={toggleLoop}
              className={`w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center ${isLooping ? 'ring-2 ring-black' : ''}`}
            >
              <RotateCcwIcon className="w-6 h-6 text-black"/>
            </Button>

            <Button
              onClick={() => setSettingsOpen(true)}
              className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
            >
              <Settings className="w-6 h-6 text-black"/>
            </Button>

            <Button
              onClick={() => console.log("Export not implemented")}
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
                  onChange={e => setEditingPosition({ ...editingPosition, x: Number(e.target.value) })}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={e => setEditingPosition({ ...editingPosition, y: Number(e.target.value) })}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (deg)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={e => setEditingPosition({ ...editingPosition, rotation: Number(e.target.value) * (Math.PI / 180) })}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  min={1}
                  max={500}
                  value={Math.round((editingPosition.fontSize / editingBaseFontSize) * 100)}
                  onChange={e => {
                    const scale = Number(e.target.value) / 100
                    setEditingPosition({
                      ...editingPosition,
                      fontSize: editingBaseFontSize * scale
                    })
                  }}
                  className="w-full bg-gray-100 border-gray-300"
                />
              </div>
              <Button onClick={() => updatePosition(editingPosition)} className="mt-4 w-full bg-black text-white">
                Update
              </Button>
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
              <Label htmlFor="thicknessSlider">Line Thickness (max 10)</Label>
              <Slider
                id="thicknessSlider"
                min={1}
                max={10}
                step={1}
                value={[lineThickness]}
                onValueChange={([v]) => setLineThickness(v)}
              />
            </div>
            <div>
              <Label htmlFor="tremblingSlider">Trembling Intensity</Label>
              <Slider
                id="tremblingSlider"
                min={0}
                max={10}
                step={1}
                value={[tremblingIntensity]}
                onValueChange={([v]) => setTremblingIntensity(v)}
              />
            </div>
            <div>
              <Label htmlFor="frameRateSlider">Frame Rate (min {MIN_FRAME_RATE})</Label>
              <Slider
                id="frameRateSlider"
                min={MIN_FRAME_RATE}
                max={60}
                step={1}
                value={[frameRate]}
                onValueChange={([v]) => setFrameRate(v)}
              />
            </div>
            <div>
              <Label htmlFor="baseFpsSlider">Animation Speed (Base FPS {baseFps})</Label>
              <Slider
                id="baseFpsSlider"
                min={30}
                max={120}
                step={1}
                value={[baseFps]}
                onValueChange={([v]) => setBaseFps(v)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}