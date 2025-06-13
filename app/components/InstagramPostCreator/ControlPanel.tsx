import React from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

interface ControlPanelProps {
  titles: string[]
  setTitles: React.Dispatch<React.SetStateAction<string[]>>
  subtitle: string
  setSubtitle: React.Dispatch<React.SetStateAction<string>>
  backgroundColor: string
  setBackgroundColor: React.Dispatch<React.SetStateAction<string>>
}

export default function ControlPanel({
  titles,
  setTitles,
  subtitle,
  setSubtitle,
  backgroundColor,
  setBackgroundColor
}: ControlPanelProps) {
  return (
    <div className="w-[300px] space-y-5">
      <div>
        <Label htmlFor="title1" className="text-sm text-gray-600">1. Write a title</Label>
        <Input
          id="title1"
          value={titles[0]}
          onChange={(e) => setTitles([e.target.value, titles[1]])}
          className="mt-1 bg-gray-100 border-gray-300 rounded-none text-lg h-10 focus:bg-gray-50"
        />
        <Input
          id="title2"
          value={titles[1]}
          onChange={(e) => setTitles([titles[0], e.target.value])}
          className="mt-2 bg-gray-100 border-gray-300 rounded-none text-lg h-10 focus:bg-gray-50"
        />
      </div>
      <div>
        <Label htmlFor="subtitle" className="text-sm text-gray-600">2. Write a sub-title</Label>
        <Input
          id="subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="mt-1 bg-gray-100 border-gray-300 rounded-none text-lg h-10 focus:bg-gray-50"
        />
      </div>
      <div>
        <Label className="text-sm text-gray-600">3. Pick a color:</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              onClick={() => setBackgroundColor(color.value)}
              className="w-8 h-8 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              style={{ backgroundColor: color.value }}
              aria-label={color.name}
            />
          ))}
        </div>
      </div>
    </div>
  )
}