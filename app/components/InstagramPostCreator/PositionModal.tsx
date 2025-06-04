import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TextPosition } from './types'

interface PositionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTexts: ('title1' | 'title2' | 'subtitle')[]
  titlePositionsFrame2: TextPosition[]
  subtitlePositionFrame2: TextPosition
  setTitlePositionsFrame2: React.Dispatch<React.SetStateAction<TextPosition[]>>
  setSubtitlePositionFrame2: React.Dispatch<React.SetStateAction<TextPosition>>
  drawCanvas: () => void
}

export default function PositionModal({
  open,
  onOpenChange,
  selectedTexts,
  titlePositionsFrame2,
  subtitlePositionFrame2,
  setTitlePositionsFrame2,
  setSubtitlePositionFrame2,
  drawCanvas
}: PositionModalProps) {
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)

  useEffect(() => {
    if (open && selectedTexts.length === 1) {
      const textType = selectedTexts[0]
      if (textType === 'subtitle') {
        setEditingPosition(subtitlePositionFrame2)
      } else {
        const index = textType === 'title1' ? 0 : 1
        setEditingPosition(titlePositionsFrame2[index])
      }
    }
  }, [open, selectedTexts, titlePositionsFrame2, subtitlePositionFrame2])

  const updatePosition = (newPosition: TextPosition) => {
    if (selectedTexts.includes('title1') || selectedTexts.includes('title2')) {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]
        selectedTexts.forEach(selectedText => {
          if (selectedText === 'title1' || selectedText === 'title2') {
            const index = selectedText === 'title1' ? 0 : 1
            newPositions[index] = newPosition
          }
        })
        return newPositions
      })
    }
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(newPosition)
    }
    onOpenChange(false)
    drawCanvas()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Position</DialogTitle>
        </DialogHeader>
        {editingPosition && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="xPosition">X Position</Label>
              <Input
                id="xPosition"
                type="number"
                value={editingPosition.x}
                onChange={(e) => setEditingPosition({...editingPosition, x: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="yPosition">Y Position</Label>
              <Input
                id="yPosition"
                type="number"
                value={editingPosition.y}
                onChange={(e) => setEditingPosition({...editingPosition, y: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="rotation">Rotation (degrees)</Label>
              <Input
                id="rotation"
                type="number"
                value={editingPosition.rotation * (180 / Math.PI)}
                onChange={(e) => setEditingPosition({...editingPosition, rotation: Number(e.target.value) * (Math.PI / 180)})}
              />
            </div>
            <Button onClick={() => updatePosition(editingPosition)}>Update</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}