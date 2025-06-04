export interface Point {
  x: number
  y: number
}

export interface Line {
  points: [Point, Point]
  frame: number
}

export interface TextPosition {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fontSize: number
}

export interface GroupBoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}