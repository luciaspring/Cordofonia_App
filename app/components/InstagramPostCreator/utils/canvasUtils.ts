import { TextPosition, Line, Point, GroupBoundingBox } from '../types'

function ultraFastEaseInOutFunction(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export function drawAnimatedText(
  ctx: CanvasRenderingContext2D,
  progress: number,
  fromFrame: number,
  toFrame: number,
  titles: string[],
  subtitle: string,
  titlePositionsFrame1: TextPosition[],
  titlePositionsFrame2: TextPosition[],
  subtitlePositionFrame1: TextPosition,
  subtitlePositionFrame2: TextPosition
) {
  const t = ultraFastEaseInOutFunction(progress)
  const fromPositions = fromFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2
  const toPositions = fromFrame === 1 ? titlePositionsFrame2 : titlePositionsFrame1
  const fromSubPos = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2
  const toSubPos = fromFrame === 1 ? subtitlePositionFrame2 : subtitlePositionFrame1

  // Draw titles with interpolation
  titles.forEach((title, i) => {
    const fromPos = fromPositions[i]
    const toPos = toPositions[i]
    const x = fromPos.x + (toPos.x - fromPos.x) * t
    const y = fromPos.y + (toPos.y - fromPos.y) * t
    const width = fromPos.width + (toPos.width - fromPos.width) * t
    const height = fromPos.height + (toPos.height - fromPos.height) * t
    const rotation = fromPos.rotation + (toPos.rotation - fromPos.rotation) * t
    const fontSize = fromPos.fontSize + (toPos.fontSize - fromPos.fontSize) * t

    ctx.save()
    ctx.translate(x + width / 2, y + height / 2)
    ctx.rotate(rotation)
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(title, 0, 0)
    ctx.restore()
  })

  // Draw subtitle with interpolation
  const subX = fromSubPos.x + (toSubPos.x - fromSubPos.x) * t
  const subY = fromSubPos.y + (toSubPos.y - fromSubPos.y) * t
  const subWidth = fromSubPos.width + (toSubPos.width - fromSubPos.width) * t
  const subHeight = fromSubPos.height + (toSubPos.height - fromSubPos.height) * t
  const subRotation = fromSubPos.rotation + (toSubPos.rotation - fromSubPos.rotation) * t
  const subFontSize = fromSubPos.fontSize + (toSubPos.fontSize - fromSubPos.fontSize) * t

  ctx.save()
  ctx.translate(subX + subWidth / 2, subY + subHeight / 2)
  ctx.rotate(subRotation)
  ctx.font = `${subFontSize}px Arial`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(subtitle, 0, 0)
  ctx.restore()
}

export function drawFrameLines(
  ctx: CanvasRenderingContext2D,
  lines: Line[],
  frameProgress: number,
  animationType: 'grow' | 'shrink',
  staggerDelay: number,
  lineThickness: number,
  tremblingIntensity: number
) {
  const animationDuration = 0.3
  const adjustedStaggerDelay = lines.length > 1
    ? staggerDelay / (lines.length - 1)
    : 0

  lines.forEach((line, index) => {
    let t = Math.max(0, Math.min(1,
      (frameProgress - index * adjustedStaggerDelay) / animationDuration))
    t = ultraFastEaseInOutFunction(t)

    const start = line.start
    const end = line.end
    const frac = animationType === 'grow' ? t : 1 - t
    const currentEnd = {
      x: start.x + (end.x - start.x) * frac,
      y: start.y + (end.y - start.y) * frac
    }

    const dx = currentEnd.x - start.x
    const dy = currentEnd.y - start.y
    const len2 = dx * dx + dy * dy
    const cap2 = (lineThickness / 2) ** 2
    if (len2 <= cap2) return

    ctx.lineCap = len2 < cap2 * 4 ? 'butt' : 'round'

    const tremX = (Math.random() - 0.5) * tremblingIntensity
    const tremY = (Math.random() - 0.5) * tremblingIntensity

    ctx.beginPath()
    ctx.moveTo(start.x + tremX, start.y + tremY)
    ctx.lineTo(currentEnd.x + tremX, currentEnd.y + tremY)
    ctx.stroke()
  })
}

export function getContrastColor(bgColor: string): string {
  const r = parseInt(bgColor.slice(1, 3), 16)
  const g = parseInt(bgColor.slice(3, 5), 16)
  const b = parseInt(bgColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

export function isPointInRotatedBox(x: number, y: number, box: Point[]): boolean {
  let inside = false
  for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
    const xi = box[i].x, yi = box[i].y
    const xj = box[j].x, yj = box[j].y
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export function getRotatedBoundingBox(position: TextPosition): Point[] {
  const { x, y, width, height, rotation } = position
  const centerX = x + width / 2
  const centerY = y + height / 2
  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ]

  return corners.map(corner => {
    const rotatedX = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation)
    const rotatedY = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
    return { x: rotatedX + centerX, y: rotatedY + centerY }
  })
}

export function getRotatedGroupBoundingBox(groupBox: GroupBoundingBox): Point[] {
  const { x, y, width, height, rotation } = groupBox
  const centerX = x + width / 2
  const centerY = y + height / 2
  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ]

  return corners.map(corner => {
    const rotatedX = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation)
    const rotatedY = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
    return { x: rotatedX + centerX, y: rotatedY + centerY }
  })
}

export function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: {
    titles: string[]
    subtitle: string
    backgroundColor: string
    currentFrame: number
    lines: Line[]
    titlePositionsFrame1: TextPosition[]
    titlePositionsFrame2: TextPosition[]
    subtitlePositionFrame1: TextPosition
    subtitlePositionFrame2: TextPosition
    selectedTexts: ('title1' | 'title2' | 'subtitle')[]
    groupRotation: number
    lineThickness: number
    easingSpeed: number
    staggerDelay: number
    tremblingIntensity: number
    isPlaying: boolean
  },
  progress: number = 0
) {
  // Clear canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Set background
  ctx.fillStyle = state.backgroundColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Set text color
  ctx.fillStyle = getContrastColor(state.backgroundColor)

  if (state.isPlaying) {
    if (progress <= 0.3) {
      drawStaticText(ctx, state, 1)
      drawFrameLines(ctx, state.lines.filter(l => l.frame === 1), progress / 0.3, 'grow', state.staggerDelay, state.lineThickness, state.tremblingIntensity)
    } else if (progress <= 0.6) {
      drawStaticText(ctx, state, 1)
      drawFrameLines(ctx, state.lines.filter(l => l.frame === 1), (progress - 0.3) / 0.3, 'shrink', state.staggerDelay, state.lineThickness, state.tremblingIntensity)
    } else if (progress <= 0.7) {
      const tp = (progress - 0.6) / 0.1
      drawAnimatedText(ctx, tp, 1, 2, state.titles, state.subtitle, state.titlePositionsFrame1, state.titlePositionsFrame2, state.subtitlePositionFrame1, state.subtitlePositionFrame2)
    } else if (progress <= 1.0) {
      drawStaticText(ctx, state, 2)
      drawFrameLines(ctx, state.lines.filter(l => l.frame === 2), (progress - 0.7) / 0.3, 'grow', state.staggerDelay, state.lineThickness, state.tremblingIntensity)
    } else if (progress <= 1.3) {
      drawStaticText(ctx, state, 2)
      drawFrameLines(ctx, state.lines.filter(l => l.frame === 2), (progress - 1.0) / 0.3, 'shrink', state.staggerDelay, state.lineThickness, state.tremblingIntensity)
    } else if (progress <= 1.4) {
      const tp = (progress - 1.3) / 0.1
      drawAnimatedText(ctx, tp, 2, 1, state.titles, state.subtitle, state.titlePositionsFrame1, state.titlePositionsFrame2, state.subtitlePositionFrame1, state.subtitlePositionFrame2)
    }
  } else {
    drawStaticText(ctx, state, state.currentFrame)
    const currentFrameLines = state.lines.filter(l => l.frame === state.currentFrame)
    drawFrameLines(ctx, currentFrameLines, 1, 'grow', state.staggerDelay, state.lineThickness, state.tremblingIntensity)
  }
}

function drawStaticText(
  ctx: CanvasRenderingContext2D,
  state: {
    titles: string[]
    subtitle: string
    titlePositionsFrame1: TextPosition[]
    titlePositionsFrame2: TextPosition[]
    subtitlePositionFrame1: TextPosition
    subtitlePositionFrame2: TextPosition
  },
  frame: number
) {
  const positions = frame === 1 ? state.titlePositionsFrame1 : state.titlePositionsFrame2
  const subPos = frame === 1 ? state.subtitlePositionFrame1 : state.subtitlePositionFrame2

  // Draw titles
  state.titles.forEach((title, i) => {
    const pos = positions[i]
    ctx.save()
    ctx.translate(pos.x + pos.width / 2, pos.y + pos.height / 2)
    ctx.rotate(pos.rotation)
    ctx.font = `bold ${pos.fontSize}px Arial`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(title, 0, 0)
    ctx.restore()
  })

  // Draw subtitle
  ctx.save()
  ctx.translate(subPos.x + subPos.width / 2, subPos.y + subPos.height / 2)
  ctx.rotate(subPos.rotation)
  ctx.font = `${subPos.fontSize}px Arial`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(state.subtitle, 0, 0)
  ctx.restore()
}