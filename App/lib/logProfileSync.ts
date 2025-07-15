export function logProfileSync(event: string, data?: any) {
  const msg = `[profile-sync] ${event}`;
  if (data) console.log(msg, data);
  else console.log(msg);
}
