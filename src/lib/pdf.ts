import { getS3Object } from "@/lib/s3"

// ---------------------------------------------------------------------------
// Polyfill browser APIs that pdfjs-dist expects but are absent in Node.js.
// We only use pdf.js for text extraction (not rendering), so stubs suffice.
//
// IMPORTANT: These must run BEFORE pdf-parse is imported, so we use dynamic
// import() below. ES module static imports are hoisted above all other code,
// which would cause pdfjs-dist to initialize before polyfills are in place.
// ---------------------------------------------------------------------------
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error — minimal stub, not a full implementation
  globalThis.DOMMatrix = class DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    is2D = true; isIdentity = true;
    static fromMatrix() { return new DOMMatrix(); }
    static fromFloat32Array() { return new DOMMatrix(); }
    static fromFloat64Array() { return new DOMMatrix(); }
    inverse() { return new DOMMatrix(); }
    multiply() { return new DOMMatrix(); }
    translate() { return new DOMMatrix(); }
    scale() { return new DOMMatrix(); }
    rotate() { return new DOMMatrix(); }
    transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
  };
}

if (typeof globalThis.Path2D === "undefined") {
  // @ts-expect-error — stub
  globalThis.Path2D = class Path2D {
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    rect() {}
  };
}

if (typeof globalThis.ImageData === "undefined") {
  // @ts-expect-error — stub
  globalThis.ImageData = class ImageData {
    width = 0;
    height = 0;
    data = new Uint8ClampedArray(0);
    constructor(w: number = 0, h: number = 0) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  };
}

/**
 * Fetch a PDF from S3 by key (using IAM credentials) and extract plain text.
 * Uses dynamic import() so polyfills above are guaranteed to run first.
 */
export async function extractPdfText(s3Key: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const buffer = await getS3Object(s3Key)
  const parser = new PDFParse({ data: buffer, verbosity: -1 })
  const result = await parser.getText() as { text: string }
  return result.text
}
