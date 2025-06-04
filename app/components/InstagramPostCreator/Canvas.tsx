import React from 'react'

interface CanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  backgroundColor: string
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  handleMouseUp: () => void
}

export default function Canvas({
  canvasRef,
  backgroundColor,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp
}: CanvasProps) {
  return (
    <div
      className="w-[540px] h-[675px] bg-white rounded-lg shadow-lg mb-4 relative overflow-hidden"
      style={{ backgroundColor }}
    >
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
  )
}