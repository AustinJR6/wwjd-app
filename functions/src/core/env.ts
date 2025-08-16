/**
 * Lightweight environment accessor that defers validation until runtime.
 * Use `env.get` for optional vars and `env.require` inside handlers when a
 * variable must be present.
 */

function get(name: string, fallback?: string): string {
  const v = process.env[name];
  return v === undefined || v === null || v === '' ? (fallback ?? '') : v;
}

function requireVar(name: string): string {
  const v = get(name);
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export const env = {
  get,
  require: requireVar,
};

export const projectId = process.env.GCLOUD_PROJECT || '';

