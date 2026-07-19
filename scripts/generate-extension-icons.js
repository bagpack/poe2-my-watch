import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const OUTPUTS = [
  ["apps/extension/assets/icon16.png", 16],
  ["apps/extension/assets/icon32.png", 32],
  ["apps/extension/assets/icon48.png", 48],
  ["apps/extension/assets/icon128.png", 128]
];

for (const [path, size] of OUTPUTS) {
  writeFileSync(path, createIconPng(size));
}

function createIconPng(size) {
  const scale = 4;
  const canvasSize = size * scale;
  const pixels = new Uint8Array(canvasSize * canvasSize * 4);
  const ctx = createRasterContext(pixels, canvasSize);

  ctx.roundedRect(0, 0, canvasSize, canvasSize, canvasSize * 0.22, [31, 35, 40, 255]);
  ctx.roundedRect(canvasSize * 0.08, canvasSize * 0.08, canvasSize * 0.84, canvasSize * 0.84, canvasSize * 0.17, [9, 105, 218, 255]);
  ctx.circle(canvasSize * 0.5, canvasSize * 0.5, canvasSize * 0.31, [255, 255, 255, 255]);
  ctx.circle(canvasSize * 0.5, canvasSize * 0.5, canvasSize * 0.22, [9, 105, 218, 255]);
  ctx.polyline([
    [canvasSize * 0.31, canvasSize * 0.58],
    [canvasSize * 0.43, canvasSize * 0.50],
    [canvasSize * 0.52, canvasSize * 0.56],
    [canvasSize * 0.68, canvasSize * 0.39]
  ], canvasSize * 0.075, [255, 255, 255, 255]);
  ctx.circle(canvasSize * 0.68, canvasSize * 0.39, canvasSize * 0.055, [255, 211, 77, 255]);

  return encodePng(downsample(pixels, canvasSize, size));
}

function createRasterContext(pixels, size) {
  return {
    roundedRect(x, y, width, height, radius, color) {
      paint((px, py) => {
        const innerX = Math.max(x + radius, Math.min(px, x + width - radius));
        const innerY = Math.max(y + radius, Math.min(py, y + height - radius));
        return distance(px, py, innerX, innerY) <= radius;
      }, color);
    },
    circle(cx, cy, radius, color) {
      paint((px, py) => distance(px, py, cx, cy) <= radius, color);
    },
    polyline(points, width, color) {
      const radius = width / 2;
      paint((px, py) => {
        for (let index = 1; index < points.length; index += 1) {
          if (distanceToSegment(px, py, points[index - 1], points[index]) <= radius) {
            return true;
          }
        }
        return false;
      }, color);
    }
  };

  function paint(contains, color) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!contains(x + 0.5, y + 0.5)) {
          continue;
        }
        const offset = ((y * size) + x) * 4;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = color[3];
      }
    }
  }
}

function downsample(source, sourceSize, targetSize) {
  const factor = sourceSize / targetSize;
  const target = new Uint8Array(targetSize * targetSize * 4);
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const offset = ((((y * factor) + sy) * sourceSize) + ((x * factor) + sx)) * 4;
          totals[0] += source[offset];
          totals[1] += source[offset + 1];
          totals[2] += source[offset + 2];
          totals[3] += source[offset + 3];
        }
      }
      const count = factor * factor;
      const targetOffset = ((y * targetSize) + x) * 4;
      target[targetOffset] = Math.round(totals[0] / count);
      target[targetOffset + 1] = Math.round(totals[1] / count);
      target[targetOffset + 2] = Math.round(totals[2] / count);
      target[targetOffset + 3] = Math.round(totals[3] / count);
    }
  }
  return { pixels: target, width: targetSize, height: targetSize };
}

function encodePng({ pixels, width, height }) {
  const scanlines = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    scanlines.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), rowOffset + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", concatBytes(uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0]))),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  return concatBytes(uint32(data.length), typeBytes, data, uint32(crc32(concatBytes(typeBytes, data))));
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function concatBytes(...buffers) {
  return Buffer.concat(buffers);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function distanceToSegment(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distance(px, py, x1, y1);
  }
  const t = Math.max(0, Math.min(1, (((px - x1) * dx) + ((py - y1) * dy)) / lengthSquared));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}
