/*
 * MOCK ONLY. Shows a version by drawing the sample JPEG through an SVG
 * filter built from the mock look. The engine will hand over rendered pixels
 * and this component goes away.
 */

import { useId, useMemo, type ImgHTMLAttributes } from "react";
import type { Params } from "../model/types";
import type { PreviewProps } from "../session/Session";
import { mockLook, tableValues } from "./filter";

interface MockPreviewProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  url: string;
  params: Params;
  /** Params of the photo's original, which the preview file already shows. */
  asShot: Params;
  alt: string;
}

export function MockPreview({ url, params, asShot, alt, style, ...rest }: MockPreviewProps) {
  const id = `mock-look-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const look = useMemo(() => mockLook(params, asShot), [params, asShot]);

  return (
    <>
      {!look.identity && (
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tableValues(look.red)} />
              <feFuncG type="table" tableValues={tableValues(look.green)} />
              <feFuncB type="table" tableValues={tableValues(look.blue)} />
            </feComponentTransfer>
            <feColorMatrix type="saturate" values={String(look.saturation)} />
          </filter>
        </svg>
      )}
      <img
        {...rest}
        src={url}
        alt={alt}
        draggable={false}
        decoding="async"
        style={look.identity ? style : { ...style, filter: `url(#${id})` }}
      />
    </>
  );
}

/** The mock's answer to the session's Preview: the sample JPEG through the mock look. */
export function MockSessionPreview({ photo, version, size: _size, ...rest }: PreviewProps) {
  return <MockPreview url={photo.previewUrl} params={version.params} asShot={photo.versions[0]!.params} {...rest} />;
}
