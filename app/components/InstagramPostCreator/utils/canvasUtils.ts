import { TextPosition, Line, Point, GroupBoundingBox } from '../types'

// Font loading with proper error handling
let fontLoaded = false

// Load font and set up error handling
async function loadFont() {
  try {
    const sulSansFont = new FontFace('SulSans-Bold', 'url(/fonts/SulSans-Bold.otf)')
    const font = await sulSansFont.load()
    document.fonts.add(font)
    fontLoaded = true
    console.log('SulSans-Bold font loaded successfully')
  } catch (error) {
    console.error('Error loading SulSans-Bold font:', error)
  }
}

// Initialize font loading
if (typeof window !== 'undefined') {
  loadFont()
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
    fontLoaded?: boolean
    setDebug: React.Dispatch<React.SetStateAction<string>>
  },
  progress: number = 0
) {
  // Clear canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Set background
  ctx.fillStyle = state.backgroundColor
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Draw text
  ctx.fillStyle = getContrastColor(state.backgroundColor)
  ctx.textBaseline = 'top'

  const drawText = () => {
    // Draw titles
    state.titles.forEach((title, index) => {
      const pos1 = state.titlePositionsFrame1[index]
      const pos2 = state.titlePositionsFrame2[index]
      
      // Calculate interpolated position
      const x = pos1.x + (pos2.x - pos1.x) * progress
      const y = pos1.y + (pos2.y - pos1.y) * progress
      const rotation = pos1.rotation + (pos2.rotation - pos1.rotation) * progress
      
      ctx.save()
      ctx.translate(x + pos1.width / 2, y + pos1.height / 2)
      ctx.rotate(rotation)
      ctx.font = `${pos1.fontSize}px ${state.fontLoaded ? 'SulSans-Bold' : 'sans-serif'}`
      ctx.fillText(title, -pos1.width / 2, -pos1.height / 2)
      ctx.restore()
    })

    // Draw subtitle
    const subPos1 = state.subtitlePositionFrame1
    const subPos2 = state.subtitlePositionFrame2
    const subX = subPos1.x + (subPos2.x - subPos1.x) * progress
    const subY = subPos1.y + (subPos2.y - subPos1.y) * progress
    const subRotation = subPos1.rotation + (subPos2.rotation - subPos1.rotation) * progress

    ctx.save()
    ctx.translate(subX + subPos1.width / 2, subY + subPos1.height / 2)
    ctx.rotate(subRotation)
    ctx.font = `${subPos1.fontSize}px ${state.fontLoaded ? 'SulSans-Bold' : 'sans-serif'}`
    ctx.fillText(state.subtitle, -subPos1.width / 2, -subPos1.height / 2)
    ctx.restore()
  }

  if (state.fontLoaded) {
    drawText()
  } else {
    // If font isn't loaded yet, wait for it
    document.fonts.ready.then(() => {
      if (document.fonts.check('12px SulSans-Bold')) {
        drawText()
      }
    })
  }

  // Draw lines
  ctx.strokeStyle = getContrastColor(state.backgroundColor)
  ctx.lineWidth = state.lineThickness
  state.lines.forEach(line => {
    if (line.frame === state.currentFrame) {
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    }
  })
  
  state.setDebug(`Canvas rendered. Progress: ${progress.toFixed(2)}, Frame: ${state.currentFrame}, Font loaded: ${state.fontLoaded}`)
}