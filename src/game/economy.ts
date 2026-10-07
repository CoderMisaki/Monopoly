/**
 * economy.ts — the money rules of City Empire.
 *
 * Building ladder per tile:
 *   0 houses                    = bare land
 *   1..3 houses                 = small houses (rumah kecil) — CAN be taken over
 *   landmark                    = upgraded from 3 houses — CANNOT be taken over
 */

export type SpaceType = 'Start' | 'City' | 'Fortune' | 'Tax';

export interface BoardSpace {
  x: number;
  y: number;
  width: number;
  height: number;
  type: SpaceType;
  name: string;
  ownerId: number | null;
  houses: number; // 0..3 small houses
  landmark: boolean;
  basePrice: number;
}

export interface PlayerState {
  id: number;
  name: string;
  position: number;
  color: number;
  cash: number;
  bankrupt: boolean;
}

export const START_CASH = 2_000_000;
export const START_BONUS = 200_000;
export const MAX_HOUSES = 3;
export const TAKEOVER_MULTIPLIER = 1.5;

/** City names per tier (7 each, 28 total for tiles 1-7, 9-15, 17-23, 25-31). */
export const CITY_NAMES: string[] = [
  // Tier 1 — 60k
  'Cengkareng', 'Kalideres', 'Cilincing', 'Koja', 'Pasar Rebo', 'Ciracas', 'Cipayung',
  // Tier 2 — 100k
  'Tebet', 'Pancoran', 'Jagakarsa', 'Cilandak', 'Kebayoran', 'Pesanggrahan', 'Setiabudi',
  // Tier 3 — 150k
  'Menteng', 'Senen', 'Cikini', 'Gambir', 'Tanah Abang', 'Kuningan', 'Casablanca',
  // Tier 4 — 220k
  'SCBD', 'Pondok Indah', 'Kelapa Gading', 'PIK', 'Thamrin', 'Sudirman', 'Mega Kuningan'
];

export const TIER_PRICES = [60_000, 100_000, 150_000, 220_000];

export function basePriceForTile(tileIndex: number): number {
  if (tileIndex >= 1 && tileIndex <= 7) return TIER_PRICES[0];
  if (tileIndex >= 9 && tileIndex <= 15) return TIER_PRICES[1];
  if (tileIndex >= 17 && tileIndex <= 23) return TIER_PRICES[2];
  if (tileIndex >= 25 && tileIndex <= 31) return TIER_PRICES[3];
  return 100_000;
}

export function cityNameForTile(tileIndex: number): string {
  const order = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31];
  const pos = order.indexOf(tileIndex);
  return pos >= 0 ? CITY_NAMES[pos] : 'Kota';
}

/** Cost of building ONE small house on this tile. */
export function houseCost(space: BoardSpace): number {
  return Math.round(space.basePrice * 0.5);
}

/** Cost of upgrading 3 houses into a landmark. */
export function landmarkCost(space: BoardSpace): number {
  return Math.round(space.basePrice * 1.0);
}

/** Total invested value on the tile (for asset calc + takeover pricing). */
export function investedValue(space: BoardSpace): number {
  let v = space.basePrice;
  v += space.houses * houseCost(space);
  if (space.landmark) v += landmarkCost(space);
  return v;
}

/** Toll owed when landing on an opponent's tile. */
export function tollFor(space: BoardSpace): number {
  if (space.landmark) return Math.round(space.basePrice * 1.2);
  return Math.round(space.basePrice * (0.1 + 0.2 * space.houses));
}

/** Price to take over an opponent's tile. Landmarks are immune (returns null). */
export function takeoverPrice(space: BoardSpace): number | null {
  if (space.landmark) return null;
  return Math.round(investedValue(space) * TAKEOVER_MULTIPLIER);
}

export function canTakeOver(space: BoardSpace, playerId: number): boolean {
  return space.ownerId !== null && space.ownerId !== playerId && !space.landmark;
}

export function describeTier(space: BoardSpace): string {
  if (space.landmark) return 'Landmark';
  if (space.houses === 0) return 'Tanah kosong';
  return `${space.houses} rumah kecil`;
}

export function formatIDR(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  return `${sign}Rp${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
