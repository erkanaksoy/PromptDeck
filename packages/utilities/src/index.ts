export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorDescriptor {
  name?: string;
  scaleFactor: number;
  bounds: Rectangle;
  primary: boolean;
}

export interface SavedWindowPlacement extends Rectangle {
  monitorName?: string;
  monitorScaleFactor?: number;
  maximized: boolean;
}

function intersectionArea(a: Rectangle, b: Rectangle): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

export function recoverWindowPlacement(
  saved: SavedWindowPlacement,
  monitors: readonly MonitorDescriptor[],
  minimumVisiblePixels = 80
): SavedWindowPlacement {
  if (!monitors.length) return { ...saved, x: 50, y: 50 };
  const primary = monitors.find((monitor) => monitor.primary) ?? monitors[0]!;
  const named = saved.monitorName
    ? monitors.find((monitor) => monitor.name === saved.monitorName)
    : undefined;
  const best = named ?? [...monitors].sort(
    (a, b) => intersectionArea(saved, b.bounds) - intersectionArea(saved, a.bounds)
  )[0] ?? primary;
  const target = best.bounds;
  const width = Math.min(Math.max(saved.width, 320), target.width);
  const height = Math.min(Math.max(saved.height, 480), target.height);
  const visible = intersectionArea({ ...saved, width, height }, target);
  if (visible >= minimumVisiblePixels * minimumVisiblePixels) {
    return { ...saved, width, height, monitorName: best.name, monitorScaleFactor: best.scaleFactor };
  }
  return {
    ...saved,
    x: target.x + Math.max(0, Math.round((target.width - width) / 2)),
    y: target.y + Math.max(0, Math.round((target.height - height) / 2)),
    width,
    height,
    monitorName: best.name,
    monitorScaleFactor: best.scaleFactor
  };
}
