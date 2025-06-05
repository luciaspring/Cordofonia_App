// app/components/InstagramPostCreator.tsx
'use client';

import React, { useRef, useState, useEffect, MouseEvent, TouchEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { PlayIcon, PauseIcon, RotateCcwIcon, ShareIcon, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Point { x: number; y: number }
interface Line  { start: Point; end: Point; frame: number }

export default function InstagramPostCreator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ─── STATE ──────────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>(['John', 'Doe']);
  const [subtitle, setSubtitle] = useState('Instrumento: Kora');
  const [backgroundColor, setBackgroundColor] = useState('#E0B0FF');
  const [currentFrame, setCurrentFrame] = useState(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [lineThickness, setLineThickness] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Text state (Frame 2 only)
  const [textPos, setTextPos] = useState<{
    x: number; y: number;
    width: number; height: number;
    rotation: number; fontSize: number;
  }>({ x: 50, y: 80, width: 200, height: 36, rotation: 0, fontSize: 36 });

  const [draggingText, setDraggingText] = useState(false);
  const [rotatingText, setRotatingText] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [rotateStart, setRotateStart] = useState<{ angle: number; cx: number; cy: number } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<typeof textPos | null>(null);
  const [editingBaseFontSize, setEditingBaseFontSize] = useState<number>(36);

  // ─── EFFECT: draw on state change ─────────────────────────────────────────────
  useEffect(() => {
    drawCanvas();
  }, [lines, currentLine, currentFrame, textPos, backgroundColor, lineThickness]);

  // ─── DRAWING FUNCTION ────────────────────────────────────────────────────────
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
      // Draw saved lines
      ctx.lineWidth = lineThickness;
      ctx.strokeStyle = '#0000FF';
      lines.forEach(ln => {
        ctx.beginPath();
        ctx.moveTo(ln.start.x, ln.start.y);
        ctx.lineTo(ln.end.x, ln.end.y);
        ctx.stroke();
      });
      // Draw current “rubber‐band” line
      if (currentLine) {
        ctx.beginPath();
        ctx.moveTo(currentLine.start.x, currentLine.start.y);
        ctx.lineTo(currentLine.end.x, currentLine.end.y);
        ctx.stroke();
      }
    } else {
      // Frame 2: draw Title1 centered in its box
      const { x, y, width, height, rotation, fontSize } = textPos;
      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(rotation);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = getContrastColor(backgroundColor);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titles[0], 0, 0);
      ctx.restore();

      // Draw outline‐box + rotation handle if editing
      if (draggingText || rotatingText) {
        ctx.save();
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(rotation);
        ctx.strokeStyle = 'rgba(0,120,255,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        // rotation handle circle
        ctx.beginPath();
        ctx.arc(0, -height / 2 - 20, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  const getContrastColor = (bg: string) => {
    const r = parseInt(bg.slice(1, 3), 16),
          g = parseInt(bg.slice(3, 5), 16),
          b = parseInt(bg.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.5 ? '#000000' : '#FFFFFF';
  };

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

  const isPointInRotatedBox = (pt: Point, box: typeof textPos): boolean => {
    const cx = box.x + box.width / 2,
          cy = box.y + box.height / 2,
          w = box.width,
          h = box.height,
          θ = box.rotation;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x:  w / 2, y: -h / 2 },
      { x:  w / 2, y:  h / 2 },
      { x: -w / 2, y:  h / 2 },
    ].map(pt0 => ({
      x: cx + (pt0.x * Math.cos(θ) - pt0.y * Math.sin(θ)),
      y: cy + (pt0.x * Math.sin(θ) + pt0.y * Math.cos(θ)),
    }));
    let inside = false;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const xi = corners[i].x, yi = corners[i].y;
      const xj = corners[j].x, yj = corners[j].y;
      const intersect =
        (yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isPointNearRotationHandle = (pt: Point, box: typeof textPos): boolean => {
    const cx = box.x + box.width / 2,
          cy = box.y + box.height / 2,
          θ = box.rotation;
    const localX = 0,
          localY = -box.height / 2 - 20;
    const wx = cx + (localX * Math.cos(θ) - localY * Math.sin(θ));
    const wy = cy + (localX * Math.sin(θ) + localY * Math.cos(θ));
    return Math.hypot(pt.x - wx, pt.y - wy) < 10;
  };

  // ─── MOUSE / TOUCH HANDLERS ───────────────────────────────────────────────────
  const handlePointerDown = (e: MouseEvent | TouchEvent) => {
    if (currentFrame === 1) {
      const pos = toCanvasCoords(e);
      setCurrentLine({ start: pos, end: pos, frame: 1 });
      return;
    }
    const pos = toCanvasCoords(e);
    if (isPointNearRotationHandle(pos, textPos)) {
      const cx = textPos.x + textPos.width / 2;
      const cy = textPos.y + textPos.height / 2;
      const startAngle = Math.atan2(pos.y - cy, pos.x - cx);
      setRotateStart({ angle: startAngle, cx, cy });
      setRotatingText(true);
    } else if (isPointInRotatedBox(pos, textPos)) {
      setDragStart(pos);
      setDraggingText(true);
    }
  };

  const handlePointerMove = (e: MouseEvent | TouchEvent) => {
    if (currentFrame === 1 && currentLine) {
      const pos = toCanvasCoords(e);
      setCurrentLine(cur => (cur ? { ...cur, end: pos } : null));
      return;
    }
    if (currentFrame === 2) {
      const pos = toCanvasCoords(e);
      if (draggingText && dragStart) {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        setTextPos(txt => ({
          ...txt,
          x: txt.x + dx,
          y: txt.y + dy,
        }));
        setDragStart(pos);
      } else if (rotatingText && rotateStart) {
        const { angle: startAngle, cx, cy } = rotateStart;
        const currentAngle = Math.atan2(pos.y - cy, pos.x - cx);
        let delta = currentAngle - startAngle;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        setTextPos(txt => ({ ...txt, rotation: txt.rotation + delta }));
        setRotateStart({ angle: currentAngle, cx, cy });
      }
    }
  };

  const handlePointerUp = () => {
    if (currentFrame === 1 && currentLine) {
      setLines(prev => [...prev, currentLine]);
      setCurrentLine(null);
      return;
    }
    if (currentFrame === 2) {
      setDraggingText(false);
      setRotatingText(false);
      setDragStart(null);
      setRotateStart(null);
    }
  };

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Instagram Post Creator</h1>
      <div className="flex space-x-6">
        {/* ─── LEFT PANEL ────────────────────────────────────────────────────── */}
        <div className="w-[300px] space-y-5">
          <div>
            <Label htmlFor="title1" className="text-sm text-gray-600">Title 1</Label>
            <Input
              id="title1"
              value={titles[0]}
              onChange={e => setTitles([e.target.value, titles[1]])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="title2" className="text-sm text-gray-600">Title 2</Label>
            <Input
              id="title2"
              value={titles[1]}
              onChange={e => setTitles([titles[0], e.target.value])}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label htmlFor="subtitle" className="text-sm text-gray-600">Subtitle</Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              className="mt-1 bg-white rounded text-lg h-10"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-600">Background Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { name: 'Light Pink',   value: '#F6A69B' },
                { name: 'Light Blue',   value: '#5894D0' },
                { name: 'Olive Green',  value: '#5B6B4E' },
                { name: 'Orange',       value: '#FF6700' },
                { name: 'Gray',         value: '#6B6B6B' },
                { name: 'Purple',       value: '#E0B0FF' },
                { name: 'Mint Green',   value: '#D0EBDA' },
              ].map(c => (
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

        {/* ─── RIGHT PANEL: Canvas + Controls ───────────────────────────────── */}
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

          {/* ─── FRAME / PLAY / LOOP / SETTINGS / SHARE ────────────────────────── */}
          <div className="flex space-x-2 w-[540px]">
            <Button
              variant={currentFrame === 1 ? 'default' : 'outline'}
              onClick={() => setCurrentFrame(1)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 1
            </Button>
            <Button
              variant={currentFrame === 2 ? 'default' : 'outline'}
              onClick={() => setCurrentFrame(2)}
              className="flex-1 h-[40px] rounded"
            >
              Frame 2
            </Button>
            <Button
              onClick={() => setIsPlaying(p => !p)}
              className="w-[40px] h-[40px] p-0 rounded-full bg-black"
            >
              {isPlaying
                ? <PauseIcon className="h-5 w-5 text-white" />
                : <PlayIcon className="h-5 w-5 text-white" />}
            </Button>
            <Button
              onClick={() => setIsLooping(p => !p)}
              className={`w-[40px] h-[40px] p-0 rounded bg-black ${isLooping ? 'ring-2 ring-blue-500' : ''}`}
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

      {/* ─── POSITION MODAL (edit coords/rotation/scale) ────────────────────────── */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Text Position</DialogTitle>
          </DialogHeader>
          {editingPosition && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="xPos">X Position</Label>
                <Input
                  id="xPos"
                  type="number"
                  value={editingPosition.x}
                  onChange={e =>
                    setEditingPosition(pos =>
                      pos ? { ...pos, x: Number(e.target.value) } : pos
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
                  onChange={e =>
                    setEditingPosition(pos =>
                      pos ? { ...pos, y: Number(e.target.value) } : pos
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="rotation">Rotation (degrees)</Label>
                <Input
                  id="rotation"
                  type="number"
                  value={editingPosition.rotation * (180 / Math.PI)}
                  onChange={e => {
                    const deg = Number(e.target.value);
                    setEditingPosition(pos =>
                      pos ? { ...pos, rotation: deg * (Math.PI / 180) } : pos
                    );
                  }}
                />
              </div>
              <div>
                <Label htmlFor="scale">Scale (%)</Label>
                <Input
                  id="scale"
                  type="number"
                  value={Math.round((editingPosition.fontSize / editingBaseFontSize) * 100)}
                  onChange={e => {
                    const scale = Number(e.target.value) / 100;
                    setEditingPosition(pos =>
                      pos
                        ? {
                            ...pos,
                            fontSize: editingBaseFontSize * scale,
                            width: pos.width * scale,
                            height: pos.height * scale,
                          }
                        : pos
                    );
                  }}
                />
              </div>
              <Button
                onClick={() => {
                  setTextPos(editingPosition);
                  setPositionModalOpen(false);
                }}
              >
                Update
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SETTINGS MODAL (line thickness, etc.) ─────────────────────────────── */}
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
