import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, generateToken, hashToken } from '../lib/auth/session';

test('Auth - Token Generation & Hashing', async () => {
  const token = generateToken();
  assert.strictEqual(typeof token, 'string');
  assert.strictEqual(token.length, 64); // 32 bytes hex encoded

  const hash = await hashToken(token);
  assert.strictEqual(typeof hash, 'string');
  assert.strictEqual(hash.length, 64); // SHA-256 hex encoded
});

test('Auth - Password Hashing and Verification', async () => {
  const password = 'SuperSecretDeviceTestPassword123!';
  const hashedPassword = await hashPassword(password);

  assert.ok(hashedPassword.includes(':'), 'Hash format must be salt:hash');

  const isValid = await verifyPassword(password, hashedPassword);
  assert.strictEqual(isValid, true, 'Valid password must verify');

  const isInvalid = await verifyPassword('WrongPassword', hashedPassword);
  assert.strictEqual(isInvalid, false, 'Invalid password must fail verification');
});
