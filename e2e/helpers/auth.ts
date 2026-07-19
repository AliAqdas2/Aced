/**
 * Shared Playwright auth helpers.
 *
 * The admin session cookie is obtained once in globalSetup (to avoid the auth
 * rate limiter) and written to .tmp-e2e-session.json. Each test injects that
 * cookie into the Playwright browser context before navigating.
 */
import { type Page } from '@playwright/test';
import { readFileSync } from 'fs';

interface SessionCookie {
  name: string;
  value: string;
}

let _cachedCookie: SessionCookie | null = null;

function getAdminCookie(): SessionCookie {
  if (_cachedCookie) return _cachedCookie;
  try {
    const raw = readFileSync('.tmp-e2e-session.json', 'utf-8');
    _cachedCookie = JSON.parse(raw) as SessionCookie;
    return _cachedCookie;
  } catch {
    throw new Error(
      'Admin session cookie not found. Did globalSetup run successfully? ' +
        'Check .tmp-e2e-session.json.',
    );
  }
}

/**
 * Inject the pre-obtained admin session cookie into the page's browser context.
 * After calling this, navigate to the desired admin page with page.goto().
 */
export async function loginAsAdmin(page: Page) {
  const cookie = getAdminCookie();

  await page.context().addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
