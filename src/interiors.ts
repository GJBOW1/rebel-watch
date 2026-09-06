/** Physical building rooms share the city's coordinates and continuous navigation. */
import source from './interiors.json';
import type { Vec2 } from './simulation';

export const INTERIORS = source.buildings;
export type Interior = typeof INTERIORS[number];
export const INTERIOR_LANDMARKS = INTERIORS.flatMap(building =>
  building.landmarks.map(landmark => ({ ...landmark, interiorId: building.id })),
);

/** Membership uses the room envelope; static shell colliders determine walkability. */
export function getInterior(point: Vec2): Interior | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
  return INTERIORS.find(({ bounds }) => point.x >= bounds.minX && point.x <= bounds.maxX
    && point.z >= bounds.minZ && point.z <= bounds.maxZ) ?? null;
}

export interface DoorApproach {
  building: Interior;
  entering: boolean;
  destination: Vec2;
}

/** A doorway interaction walks through the same opening used by manual movement. */
export function getNearbyDoor(point: Vec2, reach = 2.3): DoorApproach | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z) || !Number.isFinite(reach) || reach < 0) return null;
  let nearest: DoorApproach | null = null;
  let closest = reach;
  for (const building of INTERIORS) {
    const { door } = building;
    // Do not offer a door through either solid flank of its wall.
    if (Math.abs(point.x - door.x) > door.width / 2 + 0.45) continue;
    const distance = Math.hypot(point.x - door.x, point.z - door.z);
    if (distance > closest) continue;
    const entering = (point.z - door.z) * door.normalZ >= 0;
    nearest = { building, entering, destination: entering ? { ...building.center } : { x: door.outside.x, z: door.outside.z + door.normalZ * 1.5 } };
    closest = distance;
  }
  return nearest;
}
