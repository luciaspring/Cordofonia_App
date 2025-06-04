import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exportType: 'image' | 'video'
  setExportType: React.Dispatch<React.SetStateAction<'image' | 'video'>>
  performExport: () => void
}

export default function ExportModal({
  open,
  onOpenChange,
  exportType,
  setExportType,
  performExport
}: ExportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
          <DialogDescription>Choose the type of file you want to export</DialogDescription>
        </DialogHeader>
        <Select value={exportType} onValueChange={(value: 'image' | 'video') => setExportType(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select export type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">Image (PNG)</SelectItem>
            <SelectItem value="video">Video (WebM)</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={performExport}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}