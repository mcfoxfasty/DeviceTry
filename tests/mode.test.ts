import test from 'node:test';
import assert from 'node:assert/strict';
import { isProMode, isFreeOnlyMode, getAppMode } from '../lib/config/mode';

test('Mode Configuration - Default is FREE_ONLY', () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_MODE;
  try {
    delete process.env.NEXT_PUBLIC_APP_MODE;
    assert.strictEqual(getAppMode(), 'FREE_ONLY');
    assert.strictEqual(isFreeOnlyMode(), true);
    assert.strictEqual(isProMode(), false);
  } finally {
    if (originalEnv) process.env.NEXT_PUBLIC_APP_MODE = originalEnv;
  }
});

test('Mode Configuration - Recognizes PRO_ENABLED', () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_MODE;
  try {
    process.env.NEXT_PUBLIC_APP_MODE = 'PRO_ENABLED';
    assert.strictEqual(getAppMode(), 'PRO_ENABLED');
    assert.strictEqual(isProMode(), true);
    assert.strictEqual(isFreeOnlyMode(), false);
  } finally {
    if (originalEnv) process.env.NEXT_PUBLIC_APP_MODE = originalEnv;
    else delete process.env.NEXT_PUBLIC_APP_MODE;
  }
});
