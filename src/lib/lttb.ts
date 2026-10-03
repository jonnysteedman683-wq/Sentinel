/**
 * Largest Triangle Three Buckets (LTTB) downsampling algorithm
 * Reduces large datasets while preserving significant features
 * @template T - Data point type
 * @param data - Input data array
 * @param threshold - Target number of output points
 * @param xAccessor - Function to extract X coordinate
 * @param yAccessor - Function to extract Y coordinate
 * @returns Downsampled array preserving important data points
 */
export function lttb<T>(
  data: T[],
  threshold: number,
  xAccessor: (d: T) => number,
  yAccessor: (d: T) => number
): T[] {
  const dataLength = data.length;
  if (threshold >= dataLength || threshold === 0) {
    return data;
  }

  const sampled: T[] = [];
  let sampledIndex = 0;

  // Bucket size. Leave room for start and end data points
  const every = (dataLength - 2) / (threshold - 2);

  let a = 0;
  let maxAreaPoint: { point: T; index: number } = { point: data[0]!, index: 0 };
  let nextA = 0;

  sampled[sampledIndex++] = data[a]!;

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * every) + 1;
    let avgRangeEnd = Math.floor((i + 2) * every) + 1;
    avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;
    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
      avgX += xAccessor(data[avgRangeStart]!);
      avgY += yAccessor(data[avgRangeStart]!);
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    let rangeOffs = Math.floor((i + 0) * every) + 1;
    const rangeTo = Math.floor((i + 1) * every) + 1;
    
    const pointAX = xAccessor(data[a]!);
    const pointAY = yAccessor(data[a]!);

    let maxArea = -1;
    
    for (; rangeOffs < rangeTo; rangeOffs++) {
      // Calculate triangle area over three buckets
      const area = Math.abs(
        (pointAX - avgX) * (yAccessor(data[rangeOffs]!) - pointAY) -
        (pointAX - xAccessor(data[rangeOffs]!)) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = { point: data[rangeOffs]!, index: rangeOffs };
        nextA = rangeOffs;
      }
    }

    sampled[sampledIndex++] = maxAreaPoint.point;
    a = nextA;
  }

  sampled[sampledIndex++] = data[dataLength - 1]!;
  return sampled;
}
