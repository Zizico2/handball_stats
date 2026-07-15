declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

interface Env {
  TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
}
