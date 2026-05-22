// src/dashboard/auth/csrf.ts
// CSRF protection via csrf-csrf (double-submit cookie pattern).
// Import doubleCsrfProtection and generateToken from here — do not configure doubleCsrf elsewhere.

import { doubleCsrf } from 'csrf-csrf';
import { env } from '../../config/env';

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.DASHBOARD_SESSION_SECRET,
  getSessionIdentifier: (req) => req.session?.id ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    sameSite: 'strict' as const,
    secure:   env.NODE_ENV === 'production',
    httpOnly: true,
  },
  size: 64,
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  errorConfig: {
    statusCode: 403,
    message: 'CSRF token mismatch',
  },
});

// Re-export under the names the task spec expects
export { generateCsrfToken as generateToken, doubleCsrfProtection };
