import { lookup } from 'node:dns/promises';
import { describe, expect, it } from 'vitest';
import { ALL_MAJOR_INTEL } from './majorIntel';

const TIMEOUT_MS = 15_000;
const NETWORK_RETRIES = 2;

/** Distinguishes a dead link (bad hostname) from an origin that refuses us. */
async function resolves(url: string): Promise<boolean> {
  try {
    await lookup(new URL(url).hostname);
    return true;
  } catch {
    return false;
  }
}

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

describe('Major Intelligence displayed links', () => {
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
      const unverified: string[] = [];
      for (const url of urls) {
        try {
          const result = await checkUrl(url);
          if (result.status === 404 || result.status === 410 || result.status >= 500) {
            failures.push(`${result.status} ${url} → ${result.finalUrl}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // A transport-level failure does not prove the programme URL is dead:
          // several university hosts refuse requests from datacenter IPs (DNS
          // and TLS succeed, then the connection is reset), which is how GitHub
          // runners appear to them. A name that does not resolve, however, is a
          // genuinely broken link.
          if (await resolves(url)) {
            unverified.push(`${url} → ${message}`);
          } else {
            failures.push(`UNRESOLVED ${url} → ${message}`);
          }
        }
      }

      if (unverified.length > 0) {
        console.warn(
          `[majorIntel.links] Could not reach ${unverified.length} URL(s) from this ` +
            `environment; they were not verified:\n${unverified.join('\n')}`,
        );
      }

      expect(failures, `Broken recommendation links:\\n${failures.join('\\n')}`).toEqual([]);
    },
    300_000,
  );
});
