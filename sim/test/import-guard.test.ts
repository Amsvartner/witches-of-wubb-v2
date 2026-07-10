/**
 * Safety guard required by WOW-003 / ADR-001: the simulator must be incapable
 * of reaching Ableton or hardware, enforced by its import graph rather than
 * config. This test fails if anyone wires sim code to a forbidden module.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SIM_ROOT = path.join(process.cwd(), 'sim');

function listTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(fullPath);
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

function importsOf(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const specifiers: string[] = [];
  const importPattern =
    /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    specifiers.push(match[1] ?? match[2]);
  }
  return specifiers;
}

describe('sim import guard', () => {
  const simFiles = listTsFiles(SIM_ROOT);
  const coreFiles = simFiles.filter((file) => file.includes(`${path.sep}core${path.sep}`));

  it('finds the sim sources', () => {
    expect(coreFiles.length).toBeGreaterThan(0);
    expect(simFiles.length).toBeGreaterThan(coreFiles.length);
  });

  it('sim/** never imports ableton-js, node-osc, or backend modules', () => {
    simFiles.forEach((file) => {
      importsOf(file).forEach((specifier) => {
        expect(specifier, `${file} imports ${specifier}`).not.toMatch(
          /ableton-js|node-osc|(^|\/)backend(\/|$)|\.\.\/backend/,
        );
      });
    });
  });

  it('sim/core/** never imports socket.io (ADR-001: transport-free core)', () => {
    coreFiles.forEach((file) => {
      importsOf(file).forEach((specifier) => {
        expect(specifier, `${file} imports ${specifier}`).not.toMatch(/socket\.io/);
      });
    });
  });

  it('sim/core/** imports nothing outside sim/core (pure module)', () => {
    coreFiles.forEach((file) => {
      importsOf(file).forEach((specifier) => {
        expect(specifier.startsWith('.'), `${file} imports ${specifier}`).toBe(true);
      });
    });
  });
});
