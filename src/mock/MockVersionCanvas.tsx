/*
 * MOCK ONLY. One version's pixels on a canvas, at the preview's own size.
 * Compare moves and scales it with CSS transforms, so zoom and pan cost
 * nothing per frame. The engine's rendered tiles will take its place.
 */

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Params, Photo } from "../model/types";
import { bakedPreview } from "./bake";
import { mockLook } from "./filter";

interface MockVersionCanvasProps {
  photo: Photo;
  params: Params;
  className?: string;
  style?: CSSProperties;
}

/** Every value the mock look reads. Two versions with the same key look the same. */
function lookKey(p: Params): string {
  return [p.exposure, p.contrast, p.highlights, p.shadows, p.whites, p.blacks, p.temp, p.tint, p.vibrance, p.saturation].join(",");
}

export function MockVersionCanvas({ photo, params, className, style }: MockVersionCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const asShot = photo.versions[0]!.params;
  const key = lookKey(params);
  const look = useMemo(() => mockLook(params, asShot), [params, asShot]);

  useEffect(() => {
    let current = true;
    bakedPreview(photo.previewUrl, key, look).then(
      (bitmap) => {
        const element = canvas.current;
        if (!current || !element) return;
        element.width = bitmap.width;
        element.height = bitmap.height;
        element.getContext("2d")?.drawImage(bitmap, 0, 0);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [photo.previewUrl, key, look]);

  return <canvas ref={canvas} className={className} style={style} role="img" aria-label={photo.fileName} />;
}
