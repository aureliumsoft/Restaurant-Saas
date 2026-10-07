export function computeHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadian = (angle: number) => (Math.PI / 180) * angle;
  const distance =
    0.5 -
    Math.cos(toRadian(lat2 - lat1)) / 2 +
    (Math.cos(toRadian(lat1)) *
      Math.cos(toRadian(lat2)) *
      (1 - Math.cos(toRadian(lon2 - lon1)))) /
      2;

  return 12742 * Math.asin(Math.sqrt(distance)); // 2 * R; R = 6371 km
}
