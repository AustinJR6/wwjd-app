export function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var ${name}`);
  return val;
}

export const projectId = getEnv('GCLOUD_PROJECT');
export const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
