import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'overrides.json');

function load() {
  if (!existsSync(FILE)) return {};
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getOverride(dateStr, service) {
  return load()[dateStr]?.[service] ?? null;
}

export function setOverride(dateStr, service, times, note = null) {
  const data = load();
  data[dateStr] ??= {};
  data[dateStr][service] = { times: Array.isArray(times) ? times : [times], note };
  save(data);
}

export function clearOverride(dateStr, service) {
  const data = load();
  if (!data[dateStr]) return false;
  const existed = service in data[dateStr];
  delete data[dateStr][service];
  if (Object.keys(data[dateStr]).length === 0) delete data[dateStr];
  save(data);
  return existed;
}

export function listOverrides() {
  return load();
}
