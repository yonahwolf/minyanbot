import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, 'SCHEDULE.md'), 'utf8');
const { data } = matter(raw);

export default data;
