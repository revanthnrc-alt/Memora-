/**
 * Normalizes an angle to the range -180 to +180 degrees.
 * This is crucial for calculating the shortest rotation from the device heading
 * to the destination bearing.
 * @param angle The angle in degrees.
 * @returns The normalized angle in the range -180 to 180.
 */
export function normalizeAngle(angle: number): number {
  let a = ((angle + 180) % 360 + 360) % 360 - 180;
  return a;
}

/**
 * Placeholder for a function to compute the bearing between two GPS coordinates.
 * In a real application, this would use the Haversine formula.
 * For this demo, we use a fixed bearing.
 * @param p1 - Start point { lat: number, lon: number }
 * @param p2 - End point { lat: number, lon: number }
 * @returns The bearing in degrees from 0 to 360.
 */
export function bearingBetweenPoints(
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLon = toRad(p2.lon - p1.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}
