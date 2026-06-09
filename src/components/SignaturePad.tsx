import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadRef {
  clear: () => void;
  toDataURL: () => string;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  className?: string;
  onChange?: (hasContent: boolean) => void;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ width = 600, height = 200, className, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasContent, setHasContent] = useState(false);
    const initializedRef = useRef(false);

    // Use ResizeObserver to configure canvas when actual dimensions are available
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const configureCanvas = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const newWidth = rect.width * dpr;
        const newHeight = rect.height * dpr;

        // Skip if dimensions haven't meaningfully changed
        if (
          initializedRef.current &&
          Math.abs(canvas.width - newWidth) < 2 &&
          Math.abs(canvas.height - newHeight) < 2
        ) {
          return;
        }

        // Preserve existing content before resizing
        let savedImage: string | null = null;
        if (initializedRef.current && canvas.width > 0 && canvas.height > 0) {
          savedImage = canvas.toDataURL("image/png");
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.scale(dpr, dpr);

        // Restore stroke settings after resize (reset by dimension change)
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Restore previous drawing if any
        if (savedImage) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = savedImage;
        }

        initializedRef.current = true;
      };

      const observer = new ResizeObserver(() => {
        configureCanvas();
      });

      observer.observe(canvas);
      // Also run once immediately in case observer doesn't fire
      configureCanvas();

      return () => {
        observer.disconnect();
      };
    }, []);

    const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      // Use actual ratio between internal and CSS dimensions for accuracy
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const dpr = window.devicePixelRatio || 1;
      return {
        x: (e.clientX - rect.left) * scaleX / dpr,
        y: (e.clientY - rect.top) * scaleY / dpr,
      };
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      const ctx = canvas.getContext("2d")!;
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasContent(true);
      onChange?.(true);
    }, [getCoords, onChange]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }, [isDrawing, getCoords]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(false);
    }, []);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      setHasContent(false);
      onChange?.(false);
    }, [onChange]);

    useImperativeHandle(ref, () => ({
      clear,
      toDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
      isEmpty: () => !hasContent,
    }));

    return (
      <div className={className}>
        <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: `${height}px`, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {!hasContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground/40 text-lg">Assine aqui</p>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser className="mr-1 h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
