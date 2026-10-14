import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEKKI_VI_CORRIDOR,
  RouteGeometry,
  RegisterPassengerBody,
  canTransitionHail,
  canTransitionTrip,
  formatEta,
  formatNaira,
  haversine,
  pointAlong,
  seatBand,
} from './index';

const geo = new RouteGeometry(LEKKI_VI_CORRIDOR);
const stops = LEKKI_VI_CORRIDOR.stops;

test('corridor is a plausible length (VI → Ajah ≈ 16 km)', () => {
  assert.ok(geo.length > 14_000 && geo.length < 19_000, `got ${geo.length}`);
});

test('stops sit on the path in west → east order', () => {
  const positions = stops.map((s) => geo.stopPos.get(s.id)!);
  for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i - 1]);
  assert.ok(positions[0] < 1);
  assert.ok(Math.abs(positions[positions.length - 1] - geo.length) < 1);
});

test('eastbound bus reaches stops ahead first and stops behind only after turning', () => {
  const atIkate = geo.stopPos.get('stop_ikate')!;
  const ahead = geo.metresUntilStop(atIkate, 'stop_chevron');
  const behind = geo.metresUntilStop(atIkate, 'stop_lekki_phase1');
  assert.ok(ahead < 5_000);
  assert.ok(behind > ahead, 'stop behind requires a trip to Ajah and back');
});

test('westbound bus counts down toward VI', () => {
  const chevronWest = geo.loopPos(geo.stopPos.get('stop_chevron')!, 'WESTBOUND');
  assert.equal(geo.directionAt(chevronWest), 'WESTBOUND');
  assert.equal(geo.nextStop(chevronWest).stopId, 'stop_jakande');
});

test('nextStop skips the stop a bus is sitting at', () => {
  assert.equal(geo.nextStop(geo.stopPos.get('stop_vgc')!).stopId, 'stop_ajah');
});

test('loop wraps cleanly at both termini', () => {
  assert.equal(geo.wrap(geo.loopLength + 10), 10);
  assert.equal(geo.wrap(-10), geo.loopLength - 10);
  assert.ok(Math.abs(geo.linePos(geo.loopLength - 5) - 5) < 1e-6);
});

test('pointAlong interpolates on the road', () => {
  const mid = pointAlong(geo.path, geo.cumulative, geo.length / 2);
  const nearest = geo.nearestStop(mid);
  assert.ok(nearest.metres < 3_000);
  assert.ok(haversine(pointAlong(geo.path, geo.cumulative, 0), stops[0]) < 1);
});

test('seat bands follow the PRD colours', () => {
  assert.equal(seatBand(0, 18), 'EMPTY');
  assert.equal(seatBand(7, 18), 'AVAILABLE');
  assert.equal(seatBand(18, 18), 'FULL');
});

test('state machines reject illegal moves', () => {
  assert.ok(canTransitionHail('PENDING', 'ACKNOWLEDGED'));
  assert.ok(!canTransitionHail('EXPIRED', 'BOARDED'));
  assert.ok(canTransitionTrip('BOARDED', 'COMPLETED'));
  assert.ok(!canTransitionTrip('COMPLETED', 'BOARDED'));
});

test('money and ETA formatting', () => {
  assert.equal(formatNaira(50_000), '₦500');
  assert.equal(formatNaira(123_456), '₦1,234.56');
  assert.equal(formatNaira(-50_000), '-₦500');
  assert.equal(formatEta(30), 'Now');
  assert.equal(formatEta(61), '2 min');
});

test('registration contract normalises input', () => {
  const parsed = RegisterPassengerBody.parse({ name: ' Ada ', email: ' ADA@Example.com ', password: 'longenough', phone: '' });
  assert.equal(parsed.email, 'ada@example.com');
  assert.equal(parsed.name, 'Ada');
  assert.equal(parsed.phone, undefined);
  assert.equal(RegisterPassengerBody.safeParse({ name: 'A', email: 'x', password: 'short' }).success, false);
});
