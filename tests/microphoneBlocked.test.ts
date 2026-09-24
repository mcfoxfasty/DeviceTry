import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const microphoneSource = readFileSync('components/tests/MicrophoneTester.tsx', 'utf8');
const dictionarySource = readFileSync('lib/i18n/dictionaries/en.ts', 'utf8');

test('microphone - denied and unavailable getUserMedia errors are blocked states, not failed measurements', () => {
  const denied = microphoneSource.slice(microphoneSource.indexOf("if (error.name === 'NotAllowedError'"), microphoneSource.indexOf("} else {", microphoneSource.indexOf("if (error.name === 'NotAllowedError'")));
  const unavailable = microphoneSource.slice(microphoneSource.indexOf("} else if (error.name === 'NotFoundError'"), microphoneSource.indexOf("} else {", microphoneSource.indexOf("} else if (error.name === 'NotFoundError'")));
  assert.match(denied, /onBlockedRef\.current\?\.\('denied'\)/);
  assert.match(denied, /return;/);
  assert.match(unavailable, /onBlockedRef\.current\?\.\('unavailable'\)/);
  assert.match(unavailable, /return;/);
  assert.ok(!denied.includes("status: 'failed'"), 'denied permission must not emit a failed result');
  assert.ok(!unavailable.includes("status: 'failed'"), 'missing device must not emit a failed result');
});

test('microphone - copy uses Start Microphone Test and not Enable Microphone', () => {
  assert.match(dictionarySource, /startPrompt: 'Click "Start Microphone Test"/);
  assert.match(dictionarySource, /grantPermission: 'Start Microphone Test'/);
  assert.ok(!dictionarySource.includes('Enable Microphone'), 'obsolete microphone CTA must be removed');
});
