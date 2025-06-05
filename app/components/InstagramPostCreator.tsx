// app/components/InstagramPostCreator.tsx
'use client';

import React, {
  useRef,
  useState,
  useEffect,
  MouseEvent,
  TouchEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  ShareIcon,
  Settings,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Point {
  x: number;
  y: number;
}
interface Line {
  start: Point;
  end: Point;
  frame: number;
}

// We’ll keep three separate “text items” in state for Frame 2: Title 1, Title 2, and Subtitle.
type TextItem = {
  key: 'title1' | 'title2' | 'subtitle';
  text: string;
  x: number;
  y: number;
  rotation: number; // in radians
  fontSize: number;
};

export default function InstagramPostCreator() {
  // ─── CORE STATE ────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Text‐input values (controlled inputs)
  const [titles, setTitles] = useState<[string, string]>(['John', 'Doe']);
  const [subtitle, setSubtitle] = useState('Instrumento: Kora');

  // Background color picker
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF');

  // Frame toggling (1 or 2), play/loop state
  const [currentFrame, setCurrentFrame] = useState<1 | 2>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // ─── LINES (Frame 1 drawing) ─────────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [lineThickness, setLineThickness] = useState(4);

  // ─── TEXT ITEMS (Frame 2) ─────────────────────────────────────────────────────
  // Initialize three items with default positions/rotations/fontSizes
  const [textItems, setTextItems] = useState<TextItem[]>([
    {
      key: 'title1',
      text: titles[0],
      x: 40,
      y: 400,
      rotation: 0,
      fontSize: 180,
    },
    {
      key: 'title2',
      text: titles[1],
      x: 40,
      y: 550,
      rotation: 0,
      fontSize: 180,
    },
    {
      key: 'subtitle',
      text: subtitle,
      x: 40,
      y: 1000,
      rotation: 0,
      fontSize: 36,
    },
  ]);

  // Which text index is currently active (dragging/rotating)? 
  const [activeTextIndex, setActiveTextIndex] = useState<number | null>(null);

  // Are we dragging or rotating right now?
  const [draggingText, setDraggingText] = useState(false);
  const [rotatingText, setRotatingText] = useState(false);

  // Reference points for drag/rotate math
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [rotateStart, setRotateStart] = useState<{
    angle: number;
    cx: number;
    cy: number;
  } | null>(null);

  // ─── MODALS ────────────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);

  // When you open the “Edit Position” modal, we copy the active text’s coords
  // so you can tweak X/Y/rotation/scale numerically.
  const [editingPosition, setEditingPosition] = useState<{
    x: number;
    y: number;
    rotation: number;
    fontSize: number;
  } | null>(null);
  const [editingBaseFontSize, setEditingBaseFontSize] = useState(36);

  // ─── EFFECT: Update textItems ANY time the input strings (titles/subtitle) change ─
  useEffect(() => {
    setTextItems((prev) =>
      prev.map((item) => {
        if (item.key === 'title1') return { ...item, text: titles[0] };
        if (item.key === 'title2') return { ...item, text: titles[1] };
        if (item.key === 'subtitle') return { ...item, text: subtitle };
        return item;
      })
    );
  }, [titles, subtitle]);

  // ─── EFFECT: Redraw canvas whenever anything changes ────────────────────────────
  useEffect(() => {
    drawCanvas();
  }, [
    lines,
    currentLine,
    currentFrame,
    textItems,
    backgroundColor,
    lineThickness,
  ]);

  // ─── DRAWING ROUTINE ───────────────────────────────────────────────────────────
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear + fill background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentFrame === 1) {
      // DRAW FRAME 1: all saved lines + “rubber‐band” line if dragging
      ctx.lineWidth = lineThickness;
      ctx.strokeStyle = '#0000FF';
      lines.forEach((ln) => {
        ctx.beginPath();
        ctx.moveTo(ln.start.x, ln.start.y);
        ctx.lineTo(ln.end.x, ln.end.y);
        ctx.stroke();
      });
      if (currentLine) {
        ctx.beginPath();
        ctx.moveTo(currentLine.start.x, currentLine.start.y);
        ctx.lineTo(currentLine.end.x, currentLine.end.y);
        ctx.stroke();
      }
    } else {
      // DRAW FRAME 2: loop over textItems
      textItems.forEach((item, idx) => {
        // Measure the text’s width/height for hit‐testing
        ctx.save();
        ctx.font = `bold ${item.fontSize}px Arial`;
        const metrics = ctx.measureText(item.text);
        const textWidth = metrics.width;
        const textHeight =
          (metrics.actualBoundingBoxAscent || item.fontSize * 0.8) +
          (metrics.actualBoundingBoxDescent || item.fontSize * 0.2);

        // Draw the text at its rotated position
        ctx.translate(item.x + textWidth / 2, item.y + textHeight / 2);
        ctx.rotate(item.rotation);
        ctx.fillStyle = getContrastColor(backgroundColor);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.text, 0, 0);

        // If it’s the active item (being dragged/rotated), draw a bounding box + handle
        if (idx === activeTextIndex && (draggingText || rotatingText)) {
          ctx.strokeStyle = 'rgba(0,120,255,0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            -textWidth / 2,
            -textHeight / 2,
            textWidth,
            textHeight
          );

          // Draw rotation‐handle circle above center
          ctx.beginPath();
          ctx.arc(0, -textHeight / 2 - 20, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'white';
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  };

  // ─── UTILITY: Contrast color for any bg hex ────────────────────────────────────
  const getContrastColor = (bg: string) => {
    const r = parseInt(bg.slice(1, 3), 16),
      g = parseInt(bg.slice(3, 5), 16),
      b = parseInt(bg.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.5 ? '#000000' : '#FFFFFF';
  };

  // ─── MOUSE/TOUCH COORD CONVERSION ─────────────────────────────────────────────
  const toCanvasCoords = (e: MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  // ─── HIT‐TEST: is point inside this rotated text’s box? ────────────────────────
  const isPointInRotatedBox = (pt: Point, item: TextItem): boolean => {
    // First measure width/height with canvas
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `bold ${item.fontSize}px Arial`;
    const metrics = ctx.measureText(item.text);
    const textWidth = metrics.width;
    const textHeight =
      (metrics.actualBoundingBoxAscent || item.fontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || item.fontSize * 0.2);

    // Build the four corner points in “local” coordinates:
    const w = textWidth;
    const h = textHeight;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ].map((c) => {
      // rotate each corner by item.rotation, then translate to item.x + w/2, item.y + h/2
      const rx = c.x * Math.cos(item.rotation) - c.y * Math.sin(item.rotation);
      const ry = c.x * Math.sin(item.rotation) + c.y * Math.cos(item.rotation);
      return {
        x: rx + item.x + w / 2,
        y: ry + item.y + h / 2,
      };
    });

    // Standard “point‐in‐polygon” test:
    let inside = false;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const xi = corners[i].x,
        yi = corners[i].y;
      const xj = corners[j].x,
        yj = corners[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // ─── HIT‐TEST: is point near this text’s rotation‐handle? ─────────────────────
  const isPointNearRotationHandle = (pt: Point, item: TextItem): boolean => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `bold ${item.fontSize}px Arial`;
    const metrics = ctx.measureText(item.text);
    const textWidth = metrics.width;
    const textHeight =
      (metrics.actualBoundingBoxAscent || item.fontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || item.fontSize * 0.2);

    // Local handle coordinates: (0, -h/2 - 20), then rotate + translate
    const localX = 0,
      localY = -textHeight / 2 - 20;
    const rx = localX * Math.cos(item.rotation) -
      localY * Math.sin(item.rotation);
    const ry = localX * Math.sin(item.rotation) +
      localY * Math.cos(item.rotation);
    const hx = rx + item.x + textWidth / 2;
    const hy = ry + item.y + textHeight / 2;
    return Math.hypot(pt.x - hx, pt.y - hy) < 10;
  };

  // ─── POINTER‐DOWN (Mouse or Touch) ────────────────────────────────────────────
  const handlePointerDown = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const pos = toCanvasCoords(e);

    if (currentFrame === 1) {
      // Begin drawing a new line
      const newLine: Line = { start: pos, end: pos, frame: 1 };
      setCurrentLine(newLine);
      return;
    }

    // FRAME 2: see if we clicked/ touched ANY text’s rotate handle first:
    for (let i = textItems.length - 1; i >= 0; i--) {
      const item = textItems[i];
      if (isPointNearRotationHandle(pos, item)) {
        // Start rotating this item
        const canvasCx = item.x + getTextMetrics(item).width / 2;
        const canvasCy = item.y + getTextMetrics(item).height / 2;
        const startAngle = Math.atan2(pos.y - canvasCy, pos.x - canvasCx);
        setRotateStart({ angle: startAngle, cx: canvasCx, cy: canvasCy });
        setActiveTextIndex(i);
        setRotatingText(true);
        return;
      }
    }

    // Otherwise, see if we clicked inside ANY text’s box:
    for (let i = textItems.length - 1; i >= 0; i--) {
      const item = textItems[i];
      if (isPointInRotatedBox(pos, item)) {
        // Begin dragging this item
        setDragStart(pos);
        setActiveTextIndex(i);
        setDraggingText(true);
        return;
      }
    }

    // If we reached here, didn’t hit any text: clear active
    setActiveTextIndex(null);
  };

  // ─── POINTER‐MOVE (Mouse or Touch) ────────────────────────────────────────────
  const handlePointerMove = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const pos = toCanvasCoords(e);

    if (currentFrame === 1 && currentLine) {
      // Update rubber‐band
      setCurrentLine((prev) =>
        prev ? { ...prev, end: pos } : prev
      );
      return;
    }

    if (currentFrame === 2 && activeTextIndex !== null) {
      // If dragging, translate that one item
      if (draggingText && dragStart) {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        setTextItems((prev) => {
          const copy = [...prev];
          copy[activeTextIndex] = {
            ...copy[activeTextIndex],
            x: copy[activeTextIndex].x + dx,
            y: copy[activeTextIndex].y + dy,
          };
          return copy;
        });
        setDragStart(pos);
        return;
      }
      // If rotating, update that one item’s rotation
      if (rotatingText && rotateStart) {
        const { angle: startAngle, cx, cy } = rotateStart;
        const currentAngle = Math.atan2(pos.y - cy, pos.x - cx);
        let delta = currentAngle - startAngle;
        // Normalize into [-π, +π]
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        setTextItems((prev) => {
          const copy = [...prev];
          copy[activeTextIndex] = {
            ...copy[activeTextIndex],
            rotation: copy[activeTextIndex].rotation + delta,
          };
          return copy;
        });
        setRotateStart({ angle: currentAngle, cx, cy });
        return;
      }
    }
  };

  // ─── POINTER‐UP (Mouse or Touch) ──────────────────────────────────────────────
  const handlePointerUp = (e?: MouseEvent | TouchEvent) => {
    e?.preventDefault();
    if (currentFrame === 1 && currentLine) {
      // Commit the line
      setLines((prev) => [...prev, currentLine]);
      setCurrentLine(null);
      return;
    }
    // Stop any drag/rotate
    setDraggingText(false);
    setRotatingText(false);
    setDragStart(null);
    setRotateStart(null);
  };

  // ─── MEASURE TEXT METRICS HELPER ───────────────────────────────────────────────
  function getTextMetrics(item: TextItem) {
    // Return width/height for hit‐testing/drawing of a text
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `bold ${item.fontSize}px Arial`;
    const metrics = ctx.measureText(item.text);
    const textWidth = metrics.width;
    const textHeight =
      (metrics.actualBoundingBoxAscent || item.fontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || item.fontSize * 0.2);
    return { width: textWidth, height: textHeight };
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ─── LEFT PANEL: Inputs / Color Picker ───────────────────────────────────── */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">
              Title 1
            </Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={(e) =>
                setTitles([e.target.value, titles[1]])
              }
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">
              Title 2
            </Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={(e) =>
                setTitles([titles[0], e.target.value])
              }
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">
              Subtitle
            </Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-600">
              Background Color
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { name: 'Light Pink', value: '#F6A69B' },
                { name: 'Light Blue', value: '#5894D0' },
                { name: 'Olive Green', value: '#5B6B4E' },
                { name: 'Orange', value: '#FF6700' },
                { name: 'Gray', value: '#6B6B6B' },
                { name: 'Purple', value: '#E0B0FF' },
                { name: 'Mint Green', value: '#D0EBDA' },
              ].map((c) => (
                <button
                  key={c.value}
                  onClick={() => setBackgroundColor(c.value)}
                  className="w-8 h-8 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  style={{ backgroundColor: c.value }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Canvas & Controls ─────────────────────────────────────── */}
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
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </div>

          <div className="flex space-x-2 w-[540px]">
            <Button
              variant={currentFrame === 1 ? 'default' : 'outline'}
              onClick={() => {
                setCurrentFrame(1);
                setActiveTextIndex(null);
              }}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? 'default' : 'outline'}
              onClick={() => {
                setCurrentFrame(2);
                setActiveTextIndex(null);
              }}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button
              onClick={() => setIsPlaying((p) => !p)}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black"
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5 text-white" />
              ) : (
                <PlayIcon className="h-5 w-5 text-white" />
              )}
            </Button>
            <Button
              onClick={() => setIsLooping((p) => !p)}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${
                isLooping ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <RotateCcwIcon className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={() => setSettingsOpen(true)}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
            >
              <Settings className="h-5 w-5 text-white" />
            </Button>
            <Button
              onClick={() => console.log('Export not implemented')}
              className="w-[40px] h-[40px] p-0 rounded bg-black"
            >
              <ShareIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── POSITION MODAL (for numeric edits) ──────────────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Text Position</DialogTitle>
          </DialogHeader>
          {editingPosition && activeTextIndex !== null && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={(e) =>
                    setEditingPosition((pos) =>
                      pos
                        ? { ...pos, x: Number(e.target.value) }
                        : pos
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="yPos">Y Position</Label>
                <Input
                  id="yPos"
                  type="number"
                  value={editingPosition.y}
                  onChange={(e) =>
                    setEditingPosition((pos) =>
                      pos
                        ? { ...pos, y: Number(e.target.value) }
                        : pos
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (deg)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    setEditingPosition((pos) =>
                      pos
                        ? { ...pos, rotation: deg * (Math.PI / 180) }
                        : pos
                    );
                  }}
                />
              </div>
              <div>
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  value={Math.round(
                    (editingPosition.fontSize / editingBaseFontSize) * 100
                  )}
                  onChange={(e) => {
                    const scale = Number(e.target.value) / 100;
                    setEditingPosition((pos) =>
                      pos
                        ? {
                            ...pos,
                            fontSize: editingBaseFontSize * scale,
                          }
                        : pos
                    );
                  }}
                />
              </div>
              <Button
                onClick={() => {
                  if (activeTextIndex !== null && editingPosition) {
                    setTextItems((prev) => {
                      const copy = [...prev];
                      copy[activeTextIndex] = {
                        ...copy[activeTextIndex],
                        x: editingPosition.x,
                        y: editingPosition.y,
                        rotation: editingPosition.rotation,
                        fontSize: editingPosition.fontSize,
                      };
                      return copy;
                    });
                  }
                  setPositionModalOpen(false);
                }}
              >
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SETTINGS MODAL (Line Thickness) ─────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="thicknessSlider">Line Thickness</Label>
              <Slider
                id="thicknessSlider"
                min={1}
                max={20}
                step={1}
                value={[lineThickness]}
                onValueChange={([v]) => setLineThickness(v)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
