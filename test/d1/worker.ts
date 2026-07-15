/**
 * Minimal Worker entry used only by the Vitest/D1 harness.
 * Avoids requiring a built `.open-next/worker.js` for database route tests.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response("ok");
  },
};
