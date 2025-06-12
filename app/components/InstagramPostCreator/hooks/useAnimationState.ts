import { useState } from 'react'
import { TextPosition, Line } from '../types'

export function useAnimationState() {
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento:\nKora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 60, rotation: 0, fontSize: 36 })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 60, rotation: 0, fontSize: 36 })
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [groupRotation, setGroupRotation] = useState(0)
  const [lineThickness, setLineThickness] = useState(2)
  const [easingSpeed, setEasingSpeed] = useState(10)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(0)
  const [exportType, setExportType] = useState<'image' | 'video'>('image')

  return {
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
  }
}