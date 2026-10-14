export default async function globalTeardown() {
  await globalThis.__PG__?.stop();
}
