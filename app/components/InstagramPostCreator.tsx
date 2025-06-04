'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const colorOptions = [
  { name: 'Light Pink', value: '#F6A69B' },
  { name: 'Light Blue', value: '#5894D0' },
  { name: 'Olive Green', value: '#5B6B4E' },
  { name: 'Orange', value: '#FF6700' },
  { name: 'Gray', value: '#6B6B6B' },
  { name: 'Purple', value: '#E0B0FF' },
  { name: 'Mint Green', value: '#D0EBDA' },
]

interface Point { x: number, y: number }
interface Line { start: Point, end: Point, frame: number }
interface TextPosition { x: number, y: number, width: number, height: number, rotation: number, fontSize: number, aspectRatio?: number }
interface GroupBoundingBox { x: number, y: number, width: number, height: number, rotation: number }

// Add this to track initial state
interface RigidBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  centerX: number;
  centerY: number;
}

const ultraFastEaseInOutFunction = (t: number): number => {
  // Extremely fast ease-in and ease-out
  if (t < 0.5) {
    // Even faster ease-in (first half)
    return Math.pow(2 * t, 16) / 2;
  } else {
    // Even faster ease-out (second half)
    return 1 - Math.pow(-2 * t + 2, 16) / 2;
  }
}

export default function InstagramPostCreator() {
  const [titles, setTitles] = useState<string[]>(['John', 'Doe'])
  const [subtitle, setSubtitle] = useState('Instrumento: Kora')
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)
  const [titlePositionsFrame1, setTitlePositionsFrame1] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])
  const [titlePositionsFrame2, setTitlePositionsFrame2] = useState<TextPosition[]>([
    { x: 40, y: 400, width: 1000, height: 200, rotation: 0, fontSize: 180 },
    { x: 40, y: 550, width: 1000, height: 200, rotation: 0, fontSize: 180 }
  ])
  const [subtitlePositionFrame1, setSubtitlePositionFrame1] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36 })
  const [subtitlePositionFrame2, setSubtitlePositionFrame2] = useState<TextPosition>({ x: 40, y: 1000, width: 1000, height: 30, rotation: 0, fontSize: 36 })
  const [selectedTexts, setSelectedTexts] = useState<('title1' | 'title2' | 'subtitle')[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<TextPosition | null>(null)
  const [lineThickness, setLineThickness] = useState(2)
  const [easingSpeed, setEasingSpeed] = useState(10)
  const [staggerDelay, setStaggerDelay] = useState(0.2)
  const [tremblingIntensity, setTremblingIntensity] = useState(5)
  const tremblingIntensityRef = useRef(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupRotation, setGroupRotation] = useState(0)
  const [initialGroupBox, setInitialGroupBox] = useState<GroupBoundingBox | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPosition, setResizeStartPosition] = useState<Point | null>(null)
  const [initialPosition, setInitialPosition] = useState<TextPosition | null>(null)
  const [lastResizePosition, setLastResizePosition] = useState<Point | null>(null)
  const [resizeOrigin, setResizeOrigin] = useState<Point | null>(null)
  const [animationSpeed, setAnimationSpeed] = useState(0.00025); // State for animation speed
  const [resizeSpeed, setResizeSpeed] = useState(0.5); // Add resize speed state
  const [resizeStartCenter, setResizeStartCenter] = useState<Point | null>(null); // State for storing the center point
  const [initialGroupState, setInitialGroupState] = useState<{
    box: GroupBoundingBox;
    centerX: number;
    centerY: number;
  } | null>(null);
  const [initialUnrotatedBox, setInitialUnrotatedBox] = useState<GroupBoundingBox | null>(null);
  const [initialBox, setInitialBox] = useState<GroupBoundingBox | null>(null);
  const [initialBoundingBox, setInitialBoundingBox] = useState<GroupBoundingBox | null>(null);
  const [rigidBox, setRigidBox] = useState<RigidBoundingBox | null>(null);
  const [paperRect, setPaperRect] = useState<GroupBoundingBox | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastMousePosition = useRef<Point | null>(null)
  const isShiftPressed = useRef(false)
  const lastClickTime = useRef<number>(0)

  // Add this state to track last known rotations for each text element
  const [lastKnownRotations, setLastKnownRotations] = useState<{
    [key: string]: number;
  }>({
    title1: 0,
    title2: 0,
    subtitle: 0,
    group: 0
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        updateTextDimensions(ctx)
        drawCanvas()
      }
    }
  }, [titles, subtitle, backgroundColor, currentFrame, lines, lineThickness, tremblingIntensity])

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      drawCanvas()
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying])

  const updateTextDimensions = (ctx: CanvasRenderingContext2D) => {
    const measureText = (text: string, fontSize: number) => {
      ctx.font = `bold ${fontSize}px Arial`; // Set font style
      const metrics = ctx.measureText(text); // Measure text
      // Use actual text metrics for height instead of fontSize
      return {
        width: metrics.width, // Width of the text
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize * 0.8 // Fallback for height
      };
    };

    // Update title positions for frame 1
    setTitlePositionsFrame1(prev => 
      prev.map((pos, index) => {
        const { width, height } = measureText(titles[index], pos.fontSize); // Measure text dimensions
        const aspectRatio = width / height; // Calculate aspect ratio
        return { ...pos, width, height, aspectRatio }; // Update position with new dimensions
      })
    );

    // Update title positions for frame 2
    setTitlePositionsFrame2(prev => 
      prev.map((pos, index) => {
        const { width, height } = measureText(titles[index], pos.fontSize); // Measure text dimensions
        const aspectRatio = width / height; // Calculate aspect ratio
        return { ...pos, width, height, aspectRatio }; // Update position with new dimensions
      })
    );

    // Measure subtitle dimensions
    const { width: subtitleWidth, height: subtitleHeight } = measureText(subtitle, subtitlePositionFrame2.fontSize);
    const subtitleAspectRatio = subtitleWidth / subtitleHeight; // Calculate aspect ratio for subtitle
    
    // Update subtitle positions for frame 1
    setSubtitlePositionFrame1(prev => ({ 
      ...prev, 
      width: subtitleWidth, 
      height: subtitleHeight,
      aspectRatio: subtitleAspectRatio // Update aspect ratio
    }));
    
    // Update subtitle positions for frame 2
    setSubtitlePositionFrame2(prev => ({ 
      ...prev, 
      width: subtitleWidth, 
      height: subtitleHeight,
      aspectRatio: subtitleAspectRatio // Update aspect ratio
    }));
  };

  const calculateGroupBoundingBox = (): GroupBoundingBox | null => {
    if (selectedTexts.length === 0) return null; // Return null if no texts are selected

    // Calculate fresh bounds every time to ensure accurate rotation
    const selectedPositions = titlePositionsFrame2
      .filter((_, index) => selectedTexts.includes(`title${index + 1}` as 'title1' | 'title2'))
      .concat(selectedTexts.includes('subtitle') ? [subtitlePositionFrame2] : []);

    // Calculate the minimum and maximum coordinates
    let minX = Math.min(...selectedPositions.map(pos => pos.x));
    let minY = Math.min(...selectedPositions.map(pos => pos.y));
    let maxX = Math.max(...selectedPositions.map(pos => pos.x + pos.width));
    let maxY = Math.max(...selectedPositions.map(pos => pos.y + pos.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: groupRotation // Include current rotation
    };
  };

  const drawCanvas = (progress: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor; // Set background color
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear the canvas

    const frame1Lines = lines.filter(line => line.frame === 1); // Lines for frame 1
    const frame2Lines = lines.filter(line => line.frame === 2); // Lines for frame 2

    if (isPlaying) {
      if (progress <= 0.3) {
        // Frame 1 grow (0.3 units)
        drawStaticText(ctx, 1); // Draw static text for frame 1
        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow'); // Animate growing lines
      } else if (progress <= 0.6) {
        // Frame 1 shrink (0.3 units)
        drawStaticText(ctx, 1); // Draw static text for frame 1
        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink'); // Animate shrinking lines
      } else if (progress <= 0.7) {
        // Text transition 1->2 (0.1 units)
        const textProgress = (progress - 0.6) / 0.1; // Normalize text transition progress
        drawAnimatedText(ctx, textProgress, 1, 2); // Animate text transition to frame 2
      } else if (progress <= 1.0) {
        // Frame 2 grow (0.3 units)
        drawStaticText(ctx, 2); // Draw static text for frame 2
        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow'); // Animate growing lines for frame 2
      } else if (progress <= 1.3) {
        // Frame 2 shrink (0.3 units)
        drawStaticText(ctx, 2); // Draw static text for frame 2
        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink'); // Animate shrinking lines for frame 2
      } else if (progress <= 1.4) {
        // Text transition 2->1 (0.1 units)
        const textProgress = (progress - 1.3) / 0.1; // Normalize text transition progress
        drawAnimatedText(ctx, textProgress, 2, 1); // Animate final text transition back to frame 1
      }
    } else {
      // If not playing, draw the current frame's lines and static text
      drawLines(ctx, currentFrame === 1 ? frame1Lines : frame2Lines); // Draw lines for the current frame
      drawStaticText(ctx, currentFrame); // Draw static text for the current frame

      // Draw bounding boxes for selected texts if in frame 2
      if (selectedTexts.length > 0 && currentFrame === 2) {
        const groupBox = calculateGroupBoundingBox(); // Calculate bounding box for selected texts
        if (groupBox) {
          drawGroupBoundingBox(ctx, groupBox); // Draw the group bounding box
        } else {
          const positions = titlePositionsFrame2; // Get positions for titles
          selectedTexts.forEach(selectedText => {
            if (selectedText === 'title1' || selectedText === 'title2') {
              const index = selectedText === 'title1' ? 0 : 1; // Determine index for title
              drawBoundingBox(ctx, positions[index]); // Draw bounding box for title
            } else if (selectedText === 'subtitle') {
              drawBoundingBox(ctx, subtitlePositionFrame2); // Draw bounding box for subtitle
            }
          });
        }
      }
    }
  };

  const drawAnimatedText = (ctx: CanvasRenderingContext2D, progress: number, fromFrame: number, toFrame: number) => {
    const interpolate = (start: number, end: number, t: number) => start + (end - start) * t;

    const interpolatePosition = (pos1: TextPosition, pos2: TextPosition, t: number): TextPosition => ({
      x: interpolate(pos1.x, pos2.x, t),
      y: interpolate(pos1.y, pos2.y, t),
      width: interpolate(pos1.width, pos2.width, t),
      height: interpolate(pos1.height, pos2.height, t),
      rotation: interpolate(pos1.rotation, pos2.rotation, t),
      fontSize: interpolate(pos1.fontSize, pos2.fontSize, t),
    });

    const t = ultraFastEaseInOutFunction(progress);

    titles.forEach((title, index) => {
      const pos1 = fromFrame === 1 ? titlePositionsFrame1[index] : titlePositionsFrame2[index];
      const pos2 = toFrame === 1 ? titlePositionsFrame1[index] : titlePositionsFrame2[index];
      const interpolatedPos = interpolatePosition(pos1, pos2, t);
      drawRotatedText(ctx, interpolatedPos, title);
    });

    const subtitlePos1 = fromFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2;
    const subtitlePos2 = toFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2;
    const interpolatedSubtitlePos = interpolatePosition(subtitlePos1, subtitlePos2, t);
    drawRotatedText(ctx, interpolatedSubtitlePos, subtitle);
  }

  const drawStaticText = (ctx: CanvasRenderingContext2D, frame: number) => {
    const positions = frame === 1 ? titlePositionsFrame1 : titlePositionsFrame2; // Select title positions based on frame
    titles.forEach((title, index) => {
      drawRotatedText(ctx, positions[index], title); // Draw each title with rotation
    });
    const subtitlePosition = frame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2; // Corrected subtitle position selection
    drawRotatedText(ctx, subtitlePosition, subtitle); // Draw the subtitle with rotation
  }

  const drawRotatedText = (ctx: CanvasRenderingContext2D, position: TextPosition, text: string) => {
    ctx.save()
    
    ctx.translate(position.x + position.width / 2, position.y + position.height / 2)
    ctx.rotate(position.rotation)
    ctx.font = `bold ${position.fontSize}px Arial`
    
    ctx.fillStyle = getContrastColor(backgroundColor)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  const getContrastColor = (bgColor: string): string => {
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

  const drawLines = (ctx: CanvasRenderingContext2D, framelines: Line[]) => {
    ctx.lineWidth = lineThickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0000FF'

    framelines.forEach((line) => {
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()
    })

    if (currentLine) {
      ctx.beginPath()
      ctx.moveTo(currentLine.start.x, currentLine.start.y)
      ctx.lineTo(currentLine.end.x, currentLine.end.y)
      ctx.stroke()
    }
  }

  const drawAnimatedLines = (
    ctx: CanvasRenderingContext2D, 
    progress: number, 
    frame1Lines: Line[],
    frame2Lines: Line[],
    animationType: 'grow' | 'shrink'
) => {
    ctx.lineWidth = lineThickness; // Set line thickness
    ctx.lineCap = 'round'; // Set line cap style
    ctx.lineJoin = 'round'; // Set line join style
    ctx.strokeStyle = isPlaying ? '#000000' : '#0000FF'; // Set stroke color based on playing state

    const animationDuration = 0.3; // Match our progress window size
    const maxStaggerDelay = 0.2; // Maximum stagger delay across all lines
    
    const drawFrameLines = (lines: Line[], frameProgress: number) => {
        // Adjust stagger delay based on number of lines
        const adjustedStaggerDelay = lines.length > 1 ? maxStaggerDelay / (lines.length - 1) : 0;
        
        lines.forEach((line, index) => {
            // Calculate time with adjusted stagger
            let t = Math.max(0, Math.min(1, (frameProgress - index * adjustedStaggerDelay) / animationDuration));
            t = ultraFastEaseInOutFunction(t); // Apply easing function

            const { start, end } = line;
            const currentEnd = {
                x: start.x + (end.x - start.x) * (animationType === 'grow' ? t : 1 - t),
                y: start.y + (end.y - start.y) * (animationType === 'grow' ? t : 1 - t)
            };

            // Add trembling effect
            const tremblingX = (Math.random() - 0.5) * tremblingIntensity; // Random trembling effect on X
            const tremblingY = (Math.random() - 0.5) * tremblingIntensity; // Random trembling effect on Y

            ctx.beginPath();
            ctx.moveTo(start.x + tremblingX, start.y + tremblingY); // Move to start point with trembling
            ctx.lineTo(currentEnd.x + tremblingX, currentEnd.y + tremblingY); // Draw line to current end point with trembling
            ctx.stroke(); // Render the line
        });
    };

    // Draw lines for the appropriate frame
    if (frame1Lines.length > 0) {
        drawFrameLines(frame1Lines, progress); // Draw frame 1 lines
    }
    if (frame2Lines.length > 0) {
        drawFrameLines(frame2Lines, progress); // Draw frame 2 lines
    }
};

  // Draw bounding box for individual text position
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, position: TextPosition) => {
    // Calculate the center of rotation
    const centerX = position.x + position.width / 2; // Center x
    const centerY = position.y + position.height / 2; // Center y
    
    ctx.save(); // Save current context state
    
    // Move to center, rotate, then draw the box
    ctx.translate(centerX, centerY); // Translate to center
    ctx.rotate(position.rotation); // Apply rotation
    
    // Calculate the box dimensions relative to center
    const halfWidth = position.width / 2; // Half width
    const halfHeight = position.height / 2; // Half height
    
    // Draw the rotated rectangle
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'; // Set stroke color
    ctx.lineWidth = 2; // Set line width
    ctx.strokeRect(-halfWidth, -halfHeight, position.width, position.height); // Draw rectangle
    
    // Draw the handles at each corner
    const handleSize = 10; // Size of the handles
    const corners = [
      [-halfWidth, -halfHeight], // Top-left
      [halfWidth, -halfHeight],  // Top-right
      [halfWidth, halfHeight],   // Bottom-right
      [-halfWidth, halfHeight]   // Bottom-left
    ];
    
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'; // Set fill color for handles
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'; // Set stroke color for handles
      ctx.lineWidth = 2; // Set line width for handles
      ctx.beginPath();
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize); // Draw handle
      ctx.fill(); // Fill the handle
      ctx.stroke(); // Stroke the handle
    });
    
    ctx.restore(); // Restore the context state
  };

  // Update the group bounding box drawing function similarly
  const drawGroupBoundingBox = (ctx: CanvasRenderingContext2D, box: GroupBoundingBox) => {
    const centerX = box.x + box.width / 2; // Calculate center x
    const centerY = box.y + box.height / 2; // Calculate center y
    
    ctx.save(); // Save the current context state
    
    // Move to center and rotate
    ctx.translate(centerX, centerY); // Translate to center
    ctx.rotate(box.rotation); // Apply rotation
    
    // Draw the rotated rectangle
    const halfWidth = box.width / 2; // Half width
    const halfHeight = box.height / 2; // Half height
    
    ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'; // Set stroke color
    ctx.lineWidth = 2; // Set line width
    ctx.strokeRect(-halfWidth, -halfHeight, box.width, box.height); // Draw rectangle
    
    // Draw handles
    const handleSize = 10; // Size of the handles
    const corners = [
      [-halfWidth, -halfHeight], // Top-left
      [halfWidth, -halfHeight],  // Top-right
      [halfWidth, halfHeight],   // Bottom-right
      [-halfWidth, halfHeight]   // Bottom-left
    ];
    
    corners.forEach(([x, y]) => {
      ctx.fillStyle = 'white'; // Set fill color for handles
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)'; // Set stroke color for handles
      ctx.lineWidth = 2; // Set line width for handles
      ctx.beginPath();
      ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize); // Draw handle
      ctx.fill(); // Fill the handle
      ctx.stroke(); // Stroke the handle
    });
    
    ctx.restore(); // Restore the context state
  };

  // Get the appropriate resize handle based on mouse position
  const getResizeHandle = (x: number, y: number, position: TextPosition | GroupBoundingBox): string | null => {
    const handleSize = 20; // Size of the resize handles
    const centerX = position.x + position.width / 2; // Center x
    const centerY = position.y + position.height / 2; // Center y
    const rotation = 'rotation' in position ? position.rotation : position.rotation; // Get rotation

    // Transform point to rotated space
    const dx = x - centerX; // Difference in x
    const dy = y - centerY; // Difference in y
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation); // Unrotate x
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation); // Unrotate y

    // Define handle regions
    const halfWidth = position.width / 2; // Half width
    const halfHeight = position.height / 2; // Half height

    // Check corners for resize handles
    if (Math.abs(rotatedX + halfWidth) <= handleSize / 2 && Math.abs(rotatedY + halfHeight) <= handleSize / 2) return 'nw-resize'; // Top-left
    if (Math.abs(rotatedX - halfWidth) <= handleSize / 2 && Math.abs(rotatedY + halfHeight) <= handleSize / 2) return 'ne-resize'; // Top-right
    if (Math.abs(rotatedX - halfWidth) <= handleSize / 2 && Math.abs(rotatedY - halfHeight) <= handleSize / 2) return 'se-resize'; // Bottom-right
    if (Math.abs(rotatedX + halfWidth) <= handleSize / 2 && Math.abs(rotatedY - halfHeight) <= handleSize / 2) return 'sw-resize'; // Bottom-left

    // Check if inside box but not on handle
    if (Math.abs(rotatedX) < halfWidth && Math.abs(rotatedY) < halfHeight) {
      return 'move'; // Indicate that the box can be moved
    }

    return null; // No handle detected
  };

  // Helper function to detect if a point is near the rotation area
  const isPointNearRotationArea = (x: number, y: number, position: TextPosition | GroupBoundingBox): boolean => {
    const handleSize = 20; // Size of the resize handles
    const rotationAreaSize = 15; // Size of the rotation area
    const centerX = position.x + position.width / 2; // Center x
    const centerY = position.y + position.height / 2; // Center y
    const rotation = 'rotation' in position ? position.rotation : position.rotation; // Get rotation
    const halfWidth = position.width / 2; // Half width
    const halfHeight = position.height / 2; // Half height

    // Transform point to rotated space
    const dx = x - centerX; // Difference in x
    const dy = y - centerY; // Difference in y
    const rotatedX = dx * Math.cos(-rotation) - dy * Math.sin(-rotation); // Unrotate x
    const rotatedY = dx * Math.sin(-rotation) + dy * Math.cos(-rotation); // Unrotate y

    // Define corners in rotated space
    const corners = [
      { x: -halfWidth, y: -halfHeight }, // Top-left
      { x: halfWidth, y: -halfHeight },  // Top-right
      { x: halfWidth, y: halfHeight },   // Bottom-right
      { x: -halfWidth, y: halfHeight }   // Bottom-left
    ];

    // Check distance from each corner
    for (const corner of corners) {
      const distanceFromCorner = Math.sqrt(
        Math.pow(rotatedX - corner.x, 2) + 
        Math.pow(rotatedY - corner.y, 2)
      );
      
      // Check if the point is near the rotation area
      if (distanceFromCorner > handleSize / 2 && distanceFromCorner <= handleSize / 2 + rotationAreaSize) {
        return true; // Point is near the rotation area
      }
    }

    return false; // Point is not near the rotation area
  };

  const resizeGroup = (x: number, y: number, handle: string) => {
    if (!initialGroupBox || !resizeStartPosition) return; // Ensure initial conditions are met

    const dx = x - resizeStartPosition.x; // Change in x
    const dy = y - resizeStartPosition.y; // Change in y

    const centerX = initialGroupBox.x + initialGroupBox.width / 2; // Center x
    const centerY = initialGroupBox.y + initialGroupBox.height / 2; // Center y

    // Calculate scale based on the larger change to maintain aspect ratio
    let scale = 1;
    if (handle.includes('e') || handle.includes('w')) {
      scale = 1 + (dx / initialGroupBox.width) * resizeSpeed; // Use resizeSpeed for scaling
    } else if (handle.includes('n') || handle.includes('s')) {
      scale = 1 + (dy / initialGroupBox.height) * resizeSpeed; // Use resizeSpeed for scaling
    }

    // Ensure minimum scale
    const minScale = 0.1;
    scale = Math.max(scale, minScale); // Cap scale at minimum

    // Apply uniform scaling
    const newWidth = initialGroupBox.width * scale; // New width
    const newHeight = initialGroupBox.height * scale; // New height
    const newX = centerX - (newWidth / 2); // New x position
    const newY = centerY - (newHeight / 2); // New y position

    const updatePosition = (position: TextPosition) => {
      const relativeX = (position.x - centerX) / (initialGroupBox.width / 2);
      const relativeY = (position.y - centerY) / (initialGroupBox.height / 2);
      return {
        ...position,
        x: centerX + relativeX * (newWidth / 2), // Update x position
        y: centerY + relativeY * (newHeight / 2), // Update y position
        width: position.width * scale, // Update width
        height: position.height * scale, // Update height
        fontSize: position.fontSize * scale // Update font size
      };
    };

    // Update title positions for frame 2
    setTitlePositionsFrame2(prev => 
      prev.map((position, index) => 
        selectedTexts.includes(`title${index + 1}` as 'title1' | 'title2')
          ? updatePosition(position)
          : position
      )
    );

    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => updatePosition(prev));
    }

    setInitialGroupBox({ x: newX, y: newY, width: newWidth, height: newHeight, rotation: initialGroupBox.rotation });
    drawCanvas();
  };

  // Rotate the selected group based on mouse movement
  const rotateGroup = (x: number, y: number, groupBox: GroupBoundingBox) => {
    if (!lastMousePosition.current) return; // Ensure last mouse position is set

    const centerX = groupBox.x + groupBox.width / 2; // Center x
    const centerY = groupBox.y + groupBox.height / 2; // Center y

    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX); // Last angle
    const currentAngle = Math.atan2(y - centerY, x - centerX); // Current angle
    let deltaAngle = currentAngle - lastAngle; // Change in angle

    // Normalize the delta angle
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Update text positions with rotation
    setTitlePositionsFrame2(prev => 
      prev.map((position, index) => {
        const textType = `title${index + 1}` as 'title1' | 'title2';
        if (selectedTexts.includes(textType)) {
          // Store individual rotation
          setLastKnownRotations(prev => ({
            ...prev,
            [textType]: position.rotation + deltaAngle // Update stored rotation
          }));
          return rotateAroundPoint(position, centerX, centerY, deltaAngle); // Rotate selected titles
        }
        return position; // Return unchanged position
      })
    );

    // Rotate subtitle if selected
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => {
        const newPosition = rotateAroundPoint(prev, centerX, centerY, deltaAngle); // Rotate subtitle
        // Store subtitle rotation
        setLastKnownRotations(prev => ({
          ...prev,
          subtitle: newPosition.rotation // Update stored rotation
        }));
        return newPosition; // Return new position
      });
    }

    // Update group rotation
    setGroupRotation(prev => {
      const newRotation = prev + deltaAngle; // Calculate new rotation
      // Store group rotation
      setLastKnownRotations(prevRotations => ({
        ...prevRotations,
        group: newRotation // Update stored group rotation
      }));
      return newRotation; // Return new rotation
    });
    
    lastMousePosition.current = { x, y }; // Update last mouse position
  };

  const rotateAroundPoint = (position: TextPosition, centerX: number, centerY: number, angle: number): TextPosition => {
    const dx = position.x + position.width / 2 - centerX;
    const dy = position.y + position.height / 2 - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const currentAngle = Math.atan2(dy, dx);
    const newAngle = currentAngle + angle;
    const newX = centerX + distance * Math.cos(newAngle) - position.width / 2;
    const newY = centerY + distance * Math.sin(newAngle) - position.height / 2;
    return {
      ...position,
      x: newX,
      y: newY,
      rotation: position.rotation + angle
    };
  };

  // Update handleMouseUp to clean up properly
  const handleMouseUp = () => {
    if (isPlaying) return; // Prevent actions while playing
    
    if (currentLine) {
      setLines(prevLines => [...prevLines, currentLine]); // Save current line
      setCurrentLine(null); // Reset current line
    }

    setEditingLineIndex(null); // Reset editing line index
    setIsResizing(false); // Stop resizing
    setIsDragging(false); // Stop dragging
    setIsRotating(false); // Stop rotating
    setResizeHandle(null); // Clear resize handle
    setResizeStartPosition(null); // Clear resize start position
    lastMousePosition.current = null; // Clear last mouse position
    
    // Only clear paperRect if we're not rotating
    if (!isRotating) {
      setPaperRect(null); // Clear the paper rectangle
    }
    
    drawCanvas(); // Redraw the canvas
  };

  // Handle text interaction for titles and subtitles
  const handleTextInteraction = (position: TextPosition, textType: 'title1' | 'title2' | 'subtitle', x: number, y: number) => {
    if (currentFrame === 2) {
      lastMousePosition.current = { x, y }; // Store last mouse position

      // Store current rotation state before selection changes
      if (selectedTexts.length > 0) {
        setLastKnownRotations(prev => ({
          ...prev,
          group: groupRotation // Store current group rotation
        }));
      }

      // Handle selection
      if (isShiftPressed.current) {
        setSelectedTexts(prev => {
          const newSelection = prev.includes(textType) 
            ? prev.filter(t => t !== textType) 
            : [...prev, textType];
          
          // If selecting multiple items, use group rotation
          if (newSelection.length > 1) {
            setGroupRotation(lastKnownRotations.group); // Use stored group rotation
          } 
          // If selecting single item, use its individual rotation
          else if (newSelection.length === 1) {
            setGroupRotation(lastKnownRotations[newSelection[0]]); // Use stored rotation for the selected text
          }
          
          return newSelection; // Update selected texts
        });
      } else {
        setSelectedTexts([textType]); // Select only the current text type
        // Use individual rotation for single selection
        setGroupRotation(lastKnownRotations[textType]); // Set group rotation to the selected text's rotation
      }

        // Reset interaction states
        setIsResizing(false);
        setIsDragging(false);
        setIsRotating(false);
        setResizeHandle(null);

        // Determine interaction type
        if (isPointNearRotationArea(x, y, position)) {
          setIsRotating(true); // Start rotation
          const groupBox = calculateGroupBoundingBox();
          if (groupBox) {
            setInitialGroupBox(groupBox); // Store current group box for rotation
          }
        } else {
          const handle = getResizeHandle(x, y, position);
          if (handle) {
            if (handle === 'move') {
              setIsDragging(true); // Start dragging
            } else {
              setResizeHandle(handle); // Set resize handle
              setIsResizing(true); // Start resizing
              setResizeStartPosition({ x, y }); // Store starting position
            }
          } else {
            setIsDragging(true); // Start dragging if no handle is found
          }
        }

        drawCanvas(); // Redraw the canvas
    }
  };

  // Ensure resizeSingle properly uses and updates state
  const resizeSingle = (x: number, y: number, position: TextPosition, textType: 'title1' | 'title2' | 'subtitle', handle: string) => {
    if (!resizeStartPosition) return; // Ensure resize start position is set

    // Get the current position
    const currentPosition = textType === 'subtitle' 
      ? subtitlePositionFrame2 
      : titlePositionsFrame2[textType === 'title1' ? 0 : 1];

    // Center calculations and resizing logic...
    const centerX = currentPosition.x + currentPosition.width / 2; // Center x
    const centerY = currentPosition.y + currentPosition.height / 2; // Center y

    const startVector = {
      x: resizeStartPosition.x - centerX, // Vector from center to start position
      y: resizeStartPosition.y - centerY
    };

    const currentVector = {
      x: x - centerX, // Vector from center to current mouse position
      y: y - centerY
    };

    // Resize speed factor
    const resizeSpeedFactor = 0.1; // Adjusted sensitivity

    let scale = 1;
    if (handle.includes('e') || handle.includes('w')) {
      const startDist = Math.abs(startVector.x); // Distance from center to start position
      const currentDist = Math.abs(currentVector.x); // Distance from center to current position
      scale = startDist !== 0 ? 1 + ((currentDist / startDist - 1) * resizeSpeedFactor) : 1; // Apply speed factor
    } else if (handle.includes('n') || handle.includes('s')) {
      const startDist = Math.abs(startVector.y); // Distance from center to start position
      const currentDist = Math.abs(currentVector.y); // Distance from center to current position
      scale = startDist !== 0 ? 1 + ((currentDist / startDist - 1) * resizeSpeedFactor) : 1; // Apply speed factor
    }

    scale = Math.max(0.1, scale); // Ensure minimum scale

    const newWidth = currentPosition.width * scale; // Calculate new width
    const newHeight = currentPosition.height * scale; // Calculate new height
    const newX = centerX - newWidth / 2; // Calculate new x position
    const newY = centerY - newHeight / 2; // Calculate new y position

    const newPosition = {
      ...currentPosition,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      fontSize: currentPosition.fontSize * scale // Update font size
    };

    // Update position based on text type
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(newPosition); // Update subtitle position
    } else {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]; // Create a copy of previous positions
        const index = textType === 'title1' ? 0 : 1; // Determine index for title
        newPositions[index] = newPosition; // Update position for title
        return newPositions; // Return updated positions
      });
    }

    drawCanvas(); // Redraw the canvas
  };

  // Handle mouse movement for dragging, resizing, and rotating
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return; // Prevent actions while playing
    const canvas = canvasRef.current;
    if (!canvas) return; // Ensure canvas is available

    const rect = canvas.getBoundingClientRect(); // Get canvas dimensions
    const x = (e.clientX - rect.left) * (canvas.width / rect.width); // Calculate x position
    const y = (e.clientY - rect.top) * (canvas.height / rect.height); // Calculate y position

    if (selectedTexts.length > 0 && currentFrame === 2) {
        if (isRotating) {
            const groupBox = calculateGroupBoundingBox();
            if (groupBox) {
                rotateGroup(x, y, groupBox); // Rotate the group
            }
        } else if (isDragging) {
            if (selectedTexts.length === 1) {
                dragSingle(x, y, selectedTexts[0]); // Drag single text
            } else {
                dragGroup(x, y); // Drag group of texts
            }
        } else if (isResizing && resizeHandle) {
            if (selectedTexts.length === 1) {
                const textType = selectedTexts[0];
                const position = textType === 'subtitle' 
                    ? subtitlePositionFrame2 
                    : titlePositionsFrame2[textType === 'title1' ? 0 : 1];
                resizeSingle(x, y, position, textType, resizeHandle); // Resize single text
            } else {
                resizeGroup(x, y, resizeHandle); // Resize group of texts
            }
        }
        drawCanvas(); // Redraw the canvas
    }
    // Add line handling here, after the text manipulation checks
    else if (currentLine) {
        setCurrentLine(prevLine => ({
            ...prevLine!,
            end: { x, y } // Update the end position of the current line
        }));
        drawCanvas(); // Redraw the canvas
    }
    else if (editingLineIndex !== null) {
        setLines(prev => {
            const newLines = [...prev];
            const editedLine = { ...newLines[editingLineIndex] };
            if (isPointNear({ x, y }, editedLine.start)) {
                editedLine.start = { x, y }; // Move start point if near
            } else if (isPointNear({ x, y }, editedLine.end)) {
                editedLine.end = { x, y }; // Move end point if near
            }
            newLines[editingLineIndex] = editedLine; // Update the edited line
            return newLines; // Return updated lines
        });
        drawCanvas(); // Redraw the canvas
    }

    updateCursor(canvas, x, y); // Update cursor based on mouse position
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return; // Prevent actions while playing
    const canvas = canvasRef.current;
    if (!canvas) return; // Ensure canvas is available

    const rect = canvas.getBoundingClientRect(); // Get canvas dimensions
    const x = (e.clientX - rect.left) * (canvas.width / rect.width); // Calculate x position
    const y = (e.clientY - rect.top) * (canvas.height / rect.height); // Calculate y position

    lastMousePosition.current = { x, y }; // Set last mouse position

    const positions = currentFrame === 1 ? titlePositionsFrame1 : titlePositionsFrame2; // Get title positions
    const subtitlePosition = currentFrame === 1 ? subtitlePositionFrame1 : subtitlePositionFrame2; // Get subtitle position

    // Check for text interactions first
    for (let i = 0; i < positions.length; i++) {
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(positions[i]))) {
        handleTextInteraction(positions[i], `title${i + 1}` as 'title1' | 'title2', x, y); // Handle text interaction
        return; // Exit after handling interaction
      }
    }

    if (isPointInRotatedBox(x, y, getRotatedBoundingBox(subtitlePosition))) {
      handleTextInteraction(subtitlePosition, 'subtitle', x, y); // Handle subtitle interaction
      return; // Exit after handling interaction
    }

    // If no text interaction, handle lines
    if (!isShiftPressed.current) {
      setSelectedTexts([]); // Clear selection if shift is not pressed
      setGroupRotation(0); // Reset group rotation
    }

    // Find the index of the clicked line based on the current frame and mouse position
    const clickedLineIndex = lines.findIndex(line => 
      line.frame === currentFrame && 
      (isPointNear({ x, y }, line) || isPointNear({ x, y }, line.start) || isPointNear({ x, y }, line.end))
    );

    if (clickedLineIndex !== -1) {
      setEditingLineIndex(clickedLineIndex); // Set the index of the line being edited
    } else {
      setCurrentLine({ start: { x, y }, end: { x, y }, frame: currentFrame }); // Create a new line
    }

    drawCanvas(); // Redraw the canvas
  };

  // Update the cursor based on mouse position
  const updateCursor = (canvas: HTMLCanvasElement, x: number, y: number) => {
    // If we have a group box in frame 2
    const groupBox = calculateGroupBoundingBox();
    if (groupBox && currentFrame === 2 && isPointInRotatedBox(x, y, getRotatedGroupBoundingBox(groupBox))) {
      if (isPointNearRotationArea(x, y, groupBox)) {
        canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto';
        return;
      }
      const handle = getResizeHandle(x, y, groupBox);
      if (handle) {
        canvas.style.cursor = handle; // Set cursor based on handle
        return;
      }
      canvas.style.cursor = 'move'; // Default move cursor
      return;
    }

    // Check individual text elements
    const currentPositions = currentFrame === 1 
      ? [titlePositionsFrame1[0], titlePositionsFrame1[1], subtitlePositionFrame1]
      : [titlePositionsFrame2[0], titlePositionsFrame2[1], subtitlePositionFrame2];

    for (let i = 0; i < currentPositions.length; i++) {
      const position = currentPositions[i];
      if (isPointInRotatedBox(x, y, getRotatedBoundingBox(position))) {
        if (currentFrame === 2) {
          if (isPointNearRotationArea(x, y, position)) {
            canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16.8\' height=\'16.8\' viewBox=\'0 0 24 24\' fill=\'none\'%3E%3Cg stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpath d=\'M20.49 15a9 9 0 1 1-2.12-9.36L23 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23FFFFFF\' stroke-width=\'4.8\'/%3E%3Cpolyline points=\'23 4 23 10 17 10\' stroke=\'%23000000\' stroke-width=\'2.4\'/%3E%3C/g%3E%3C/svg%3E") 8 8, auto';
            return;
          }
          const handle = getResizeHandle(x, y, position);
          if (handle) {
            canvas.style.cursor = handle; // Set cursor based on handle
            return;
          }
          canvas.style.cursor = 'move'; // Default move cursor
          return;
        }
      }
    }

    canvas.style.cursor = 'default'; // Default cursor
  };

  const getRotatedBoundingBox = (position: TextPosition): Point[] => {
    // Get the true center of the text box
    const centerX = position.x + position.width / 2; // Center x
    const centerY = position.y + position.height / 2; // Center y

    // Fixed dimensions that won't change with rotation
    const width = position.width; // Width
    const height = position.height; // Height

    // Create corners relative to center (these distances remain constant)
    const corners = [
      { x: -width / 2, y: -height / 2 },  // top-left
      { x: width / 2, y: -height / 2 },   // top-right
      { x: width / 2, y: height / 2 },    // bottom-right
      { x: -width / 2, y: height / 2 }    // bottom-left
    ];

    // Apply rotation while maintaining exact distances
    return corners.map(corner => {
      const rotatedX = corner.x * Math.cos(position.rotation) - corner.y * Math.sin(position.rotation); // Rotate x
      const rotatedY = corner.x * Math.sin(position.rotation) + corner.y * Math.cos(position.rotation); // Rotate y
      return {
        x: rotatedX + centerX, // Adjust x to center
        y: rotatedY + centerY  // Adjust y to center
      };
    });
  };

  const getRotatedGroupBoundingBox = (groupBox: GroupBoundingBox): Point[] => {
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

  const isPointInRotatedBox = (x: number, y: number, box: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
      const xi = box[i].x, yi = box[i].y
      const xj = box[j].x, yj = box[j].y
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const isPointNear = (point: Point, target: Point | Line, threshold: number = 10): boolean => {
    if ('x' in target && 'y' in target) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      return Math.sqrt(dx * dx + dy * dy) < threshold
    } else {
      return pointToLineDistance(point, target.start, target.end) < threshold
    }
  }

  const pointToLineDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq

    let xx, yy

    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  const dragSingle = (x: number, y: number, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return; // Ensure last mouse position is set

    const dx = x - lastMousePosition.current.x; // Change in x
    const dy = y - lastMousePosition.current.y; // Change in y

    // Update position based on text type
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx, // Update x position
        y: prev.y + dy  // Update y position
      }));
    } else {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]; // Create a copy of previous positions
        const index = textType === 'title1' ? 0 : 1; // Determine index for title
        newPositions[index] = {
          ...newPositions[index],
          x: newPositions[index].x + dx, // Update x position
          y: newPositions[index].y + dy  // Update y position
        };
        return newPositions; // Return updated positions
      });
    }

    lastMousePosition.current = { x, y }; // Update last mouse position
  };

  const dragGroup = (x: number, y: number) => {
    if (!lastMousePosition.current) return; // Ensure last mouse position is set

    const dx = x - lastMousePosition.current.x; // Change in x
    const dy = y - lastMousePosition.current.y; // Change in y

    // Update positions for selected titles
    setTitlePositionsFrame2(prev => 
      prev.map((position, index) => 
        selectedTexts.includes(`title${index + 1}` as 'title1' | 'title2')
          ? { ...position, x: position.x + dx, y: position.y + dy } // Update position
          : position
      )
    );

    // Update position for subtitle if selected
    if (selectedTexts.includes('subtitle')) {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        x: prev.x + dx, // Update x position
        y: prev.y + dy  // Update y position
      }));
    }

    lastMousePosition.current = { x, y }; // Update last mouse position
  };

  const rotateSingle = (x: number, y: number, position: TextPosition, textType: 'title1' | 'title2' | 'subtitle') => {
    if (!lastMousePosition.current) return; // Ensure last mouse position is set

    const currentPosition = textType === 'subtitle' 
      ? subtitlePositionFrame2 
      : titlePositionsFrame2[textType === 'title1' ? 0 : 1];

    const centerX = currentPosition.x + currentPosition.width / 2; // Center x
    const centerY = currentPosition.y + currentPosition.height / 2; // Center y

    const lastAngle = Math.atan2(lastMousePosition.current.y - centerY, lastMousePosition.current.x - centerX);
    const currentAngle = Math.atan2(y - centerY, x - centerX);
    let deltaAngle = currentAngle - lastAngle; // Calculate change in angle

    // Normalize angle
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Update rotation based on text type
    if (textType === 'subtitle') {
      setSubtitlePositionFrame2(prev => ({
        ...prev,
        rotation: prev.rotation + deltaAngle // Update rotation for subtitle
      }));
    } else {
      setTitlePositionsFrame2(prev => {
        const newPositions = [...prev]; // Create a copy of previous positions
        const index = textType === 'title1' ? 0 : 1; // Determine index for title
        newPositions[index] = {
          ...newPositions[index],
          rotation: newPositions[index].rotation + deltaAngle // Update rotation for title
        };
        return newPositions; // Return updated positions
      });
    }

    lastMousePosition.current = { x, y }; // Update last mouse position
  };

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp; // Initialize start time
    }
    
    const elapsedTime = timestamp - startTimeRef.current; // Calculate elapsed time
    const animationSpeed = 0.0002; // Lower number = slower animation
    let progress = elapsedTime * animationSpeed; // Calculate progress based on elapsed time

    // Only reset for looping
    if (progress > 1.4) {
      if (isLooping) {
        startTimeRef.current = timestamp; // Reset start time for looping
        progress = 0; // Reset progress
      } else {
        progress = 1.4; // Cap progress at 1.4 if not looping
        setIsPlaying(false); // Stop playing
      }
    }

    drawCanvas(progress); // Draw the canvas with the current progress

    if (isLooping || isPlaying) {
      animationRef.current = requestAnimationFrame(animate); // Continue animation
    } else {
      drawCanvas(0); // Reset canvas if not playing
    }
  };

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame); // Set current frame
    setSelectedTexts([]); // Clear selected texts
    // Don't reset groupRotation here anymore
    drawCanvas(); // Redraw the canvas
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleLoop = () => {
    setIsLooping(!isLooping)
  }

  const handleExport = () => {
    // Implementation for export functionality
    console.log("Export functionality not implemented yet")
  }

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
    setPositionModalOpen(false)
    drawCanvas()
  }

  const handleSettingsChange = (name: string, value: number) => {
    switch (name) {
      case 'tremblingIntensity':
        setTremblingIntensity(value); // Update trembling intensity state
        drawCanvas(); // Redraw the canvas to reflect the updated trembling intensity
        break;
      // Other settings handlers
    }
  };

  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">Title 1</Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={(e) => setTitles([e.target.value, titles[1]])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">Title 2</Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={(e) => setTitles([titles[0], e.target.value])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">Subtitle</Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-600">Background Color</Label>
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
        <div className="w-[600px] flex flex-col">
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
          <div className="flex space-x-2 w-[540px]">
            <Button
              variant={currentFrame === 1 ? "default" : "outline"}
              onClick={() => handleFrameChange(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? "default" : "outline"}
              onClick={() => handleFrameChange(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button onClick={togglePlay} className="w-[40px] h-[40px] p-0 rounded-full bg-black">
              {isPlaying ? <PauseIcon className="h-5 w-5 text-white" /> : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button onClick={toggleLoop} className={`w-[40px] h-[40px] p-0 rounded bg-black ${isLooping ? 'ring-2 ring-blue-500' : ''}`}>
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={handleExport} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
            <Button onClick={() => setSettingsOpen(true)} className="w-[40px] h-[40px] p-0 rounded bg-black">
              <Settings className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
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
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
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
              <Label htmlFor="animationSpeed">Animation Speed</Label>
              <Slider
                id="animationSpeed"
                min={0.00005}
                max={0.0005}
                step={0.00001}
                value={[animationSpeed]} // Bind to state variable
                onValueChange={(value) => setAnimationSpeed(value[0])} // Update state on change
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
                onValueChange={(value) => handleSettingsChange('tremblingIntensity', value[0])}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}