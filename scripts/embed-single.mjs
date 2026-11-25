// Turns dist-single/index.html into an embeddable page body (used for the
// shareable web version): strips the doctype/html/head/body wrapper tags.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('dist-single/index.html', 'utf8');
const out = src
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body>/gi, '')
  .replace(/<meta charset="utf-8" \/>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
writeFileSync('dist-single/animal-adventures.html', out.trim() + '\n');
console.log('wrote dist-single/animal-adventures.html', out.length, 'bytes');
