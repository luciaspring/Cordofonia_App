import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lineThickness: number
  setLineThickness: React.Dispatch<React.SetStateAction<number>>
  easingSpeed: number
  setEasingSpeed: React.Dispatch<React.SetStateAction<number>>
  staggerDelay: number
  setStaggerDelay: React.Dispatch<React.SetStateAction<number>>
  tremblingIntensity: number
  setTremblingIntensity: React.Dispatch<React.SetStateAction<number>>
}

export default function SettingsModal({
  open,
  onOpenChange,
  lineThickness,
  setLineThickness,
  easingSpeed,
  setEasingSpeed,
  staggerDelay,
  setStaggerDelay,
  tremblingIntensity,
  setTremblingIntensity
}: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="lineThickness">Line Thickness</Label>
            <Slider
              id="lineThickness"
              min={1}
              max={10}
              step={1}
              value={[lineThickness]}
              onValueChange={(value) => setLineThickness(value[0])}
            />
          </div>
          <div>
            <Label htmlFor="easingSpeed">Easing Speed</Label>
            <Slider
              id="easingSpeed"
              min={1}
              max={10}
              step={1}
              value={[easingSpeed]}
              onValueChange={(value) => setEasingSpeed(value[0])}
            />
          </div>
          <div>
            <Label htmlFor="staggerDelay">Line Stagger Delay</Label>
            <Slider
              id="staggerDelay"
              min={0}
              max={0.5}
              step={0.01}
              value={[staggerDelay]}
              onValueChange={(value) => setStaggerDelay(value[0])}
            />
          </div>
          <div>
            <Label htmlFor="tremblingIntensity">Trembling Intensity</Label>
            <Slider
              id="tremblingIntensity"
              min={0}
              max={10}
              step={1}
              value={[tremblingIntensity]}
              onValueChange={(value) => setTremblingIntensity(value[0])}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}