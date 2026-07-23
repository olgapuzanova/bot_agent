import fs from "node:fs";
import path from "node:path";

export interface FileSnapshotEntry {
  path: string;
  mtimeMs: number;
}

function walk(dir: string, base: string, out: FileSnapshotEntry[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, base, out);
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      out.push({ path: fullPath, mtimeMs: stat.mtimeMs });
    }
  }
}

export function snapshotFiles(rootDir: string): Map<string, number> {
  const entries: FileSnapshotEntry[] = [];
  walk(rootDir, rootDir, entries);
  return new Map(entries.map((e) => [e.path, e.mtimeMs]));
}

// Files that are new or whose mtime moved forward since `before` was taken.
export function filesChangedSince(rootDir: string, before: Map<string, number>): string[] {
  const after = snapshotFiles(rootDir);
  const changed: string[] = [];
  for (const [filePath, mtimeMs] of after) {
    const previous = before.get(filePath);
    if (previous === undefined || mtimeMs > previous) {
      changed.push(filePath);
    }
  }
  return changed;
}
