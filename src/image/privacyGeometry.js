/** Privacy rectangles live in normalized source coordinates, independently of the current view. */
function mapRectangle(area, mapPoint) {
  const points = [[area.x, area.y], [area.x + area.width, area.y],
    [area.x, area.y + area.height], [area.x + area.width, area.y + area.height]].map(mapPoint);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { ...area, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function turn(point, rotation) {
  const [x, y] = point;
  switch (((rotation % 360) + 360) % 360) {
    case 90: return [1 - y, x];
    case 180: return [1 - x, 1 - y];
    case 270: return [y, 1 - x];
    default: return [x, y];
  }
}

export function privacyAreaToSource(area, crop, width, height, rotation, flipX) {
  return mapRectangle(area, (point) => {
    const [u, v] = turn(point, -rotation);
    return [(crop.sx + (flipX ? 1 - u : u) * crop.sw) / width, (crop.sy + v * crop.sh) / height];
  });
}

export function privacyAreaToView(area, crop, width, height, rotation, flipX) {
  return mapRectangle(area, ([x, y]) => {
    const u = (x * width - crop.sx) / crop.sw;
    const v = (y * height - crop.sy) / crop.sh;
    return turn([flipX ? 1 - u : u, v], rotation);
  });
}

/** Clip only for display/rendering; never discard the source rectangle when a crop hides it. */
export function clipPrivacyArea(area) {
  const x = Math.max(0, Math.min(1, area.x));
  const y = Math.max(0, Math.min(1, area.y));
  const right = Math.max(x, Math.min(1, area.x + area.width));
  const bottom = Math.max(y, Math.min(1, area.y + area.height));
  return { ...area, x, y, width: right - x, height: bottom - y };
}
