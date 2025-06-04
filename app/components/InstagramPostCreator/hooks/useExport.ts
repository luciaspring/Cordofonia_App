import { useCallback } from 'react'

export function useExport(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  mediaRecorderRef: React.RefObject<MediaRecorder | null>,
  exportType: 'image' | 'video',
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>,
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>,
  setErrorModalOpen: React.Dispatch<React.SetStateAction<boolean>>
) {
  const handleExport = useCallback(() => {
    // Implement export dialog opening logic
  }, [])

  const performExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      setErrorMessage('Canvas not found')
      setErrorModalOpen(true)
      return
    }

    if (exportType === 'image') {
      exportImage(canvas)
    } else {
      exportVideo(canvas)
    }
  }, [canvasRef, exportType, setErrorMessage, setErrorModalOpen])

  const exportImage = useCallback((canvas: HTMLCanvasElement) => {
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = 'instagram-post.png'
      link.href = dataUrl
      link.click()
    } catch (error) {
      setErrorMessage('Error exporting image: ' + (error as Error).message)
      setErrorModalOpen(true)
    }
  }, [setErrorMessage, setErrorModalOpen])

  const exportVideo = useCallback((canvas: HTMLCanvasElement) => {
    const stream = canvas.captureStream(30) // 30 FPS
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' })

    const chunks: Blob[] = []
    mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data)
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = 'instagram-post.webm'
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    }

    setIsPlaying(true)
    mediaRecorderRef.current.start()

    // Record for the duration of one full animation cycle
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        setIsPlaying(false)
      }
    }, 5000) // 5 seconds, matching the animation duration
  }, [mediaRecorderRef, setIsPlaying])

  return {
    handleExport,
    performExport
  }
}