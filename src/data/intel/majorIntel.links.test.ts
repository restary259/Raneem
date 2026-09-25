import { describe, expect, it } from 'vitest';
import { ALL_MAJOR_INTEL } from './majorIntel';

const TIMEOUT_MS = 15_000;
const NETWORK_RETRIES = 2;

async function checkUrl(url: string): Promise<{ status: number; finalUrl: string }> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= NETWORK_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'DARB-Major-Intelligence-Link-Checker/1.0' },
      });

      // Some university servers reject HEAD. A GET is a valid fallback.
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': 'DARB-Major-Intelligence-Link-Checker/1.0' },
        });
      }

      return { status: response.status, finalUrl: response.url || url };
    } catch (error) {
      lastError = error;
      if (attempt < NETWORK_RETRIES) continue;
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

// This suite makes live HTTP requests to real university sites, so it is opt-in:
// `npm test` must stay deterministic and must not fail when a third-party site is
// slow or down (uni-leipzig.de intermittently returns HTTP/2 INTERNAL_ERROR).
// The dedicated `major-intel-links.yml` workflow sets RUN_NETWORK_LINK_CHECK=1.
const describeNetwork =
  process.env.RUN_NETWORK_LINK_CHECK === '1' ? describe : describe.skip;

describeNetwork('Major Intelligence displayed links', () => {
  it(
    'does not contain broken 404/410/5xx displayed programme destinations',
    async () => {
      const urls = Array.from(
        new Set(
          ALL_MAJOR_INTEL.flatMap((major) => [
            ...(major.universityRecommendations ?? []).map((recommendation) => recommendation.programUrl),
            ...major.programs.map((program) => program.programUrl),
          ]),
        ),
      );

      expect(urls.length).toBeGreaterThan(0);

      const failures: string[] = [];
      for (const url of urls) {
        try {
          const result = await checkUrl(url);
          if (result.status === 404 || result.status === 410 || result.status >= 500) {
            failures.push(`${result.status} ${url} → ${result.finalUrl}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`NETWORK ${url} → ${message}`);
        }
      }

      expect(failures, `Broken recommendation links:\\n${failures.join('\\n')}`).toEqual([]);
    },
    300_000,
  );
});
