import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const databaseFile = path.resolve(directory, '../data.json');

function defaultData() {
  return { tournaments: {} };
}

function read() {
  try {
    const parsed = JSON.parse(fs.readFileSync(databaseFile, 'utf8'));
    return { ...defaultData(), ...parsed, tournaments: parsed?.tournaments ?? {} };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const initial = defaultData();
      fs.writeFileSync(databaseFile, JSON.stringify(initial, null, 2));
      return initial;
    }
    throw new Error(`Could not read data.json: ${error.message}`);
  }
}

function write(data) {
  const temporary = `${databaseFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
  fs.renameSync(temporary, databaseFile);
}

export function snapshot() {
  return structuredClone(read());
}

export function mutate(change) {
  const data = read();
  const result = change(data);
  write(data);
  return result;
}
