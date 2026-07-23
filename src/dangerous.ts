const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+.*-[a-z]*r[a-z]*f\b/i, // rm -rf and variants
  /\brm\s+.*-[a-z]*f[a-z]*r\b/i,
  /\bgit\s+push\b.*(--force|-f\b)/i,
  /\bgit\s+reset\b.*--hard\b/i,
  /\bgit\s+clean\b.*-[a-z]*f/i,
  /\bsudo\b/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bdocker\s+(rm|system\s+prune|volume\s+rm)\b/i,
  /\bnpm\s+publish\b/i,
  /\b(curl|wget)\b.*\|\s*(sh|bash)\b/i,
  /\b(stripe|charge|payment|invoice|checkout|withdraw|transfer)\b/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
];

export function isDangerousBashCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}
