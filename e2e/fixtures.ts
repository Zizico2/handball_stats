import { test as base, expect } from "@playwright/test";
import { refreshE2eSession } from "./e2eAuth";
import { resetE2eData, seedE2eData } from "./seedE2eData";

export const test = base.extend<{ e2eBaseline: undefined }>({
  e2eBaseline: [
    async ({ page }, use) => {
      const request = await refreshE2eSession(page);
      await resetE2eData(request);
      await seedE2eData(request);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
