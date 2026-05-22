import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**', '**/.claude/worktrees/**'],
    env: {
      DISCORD_TOKEN: 'test-token',
      CLIENT_ID:     'test-client-id',
    },
  },
});
