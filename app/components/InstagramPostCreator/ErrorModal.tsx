import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errorMessage: string
}

export default function ErrorModal({ open, onOpenChange, errorMessage }: ErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Error</DialogTitle>
          <DialogDescription>{errorMessage}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}