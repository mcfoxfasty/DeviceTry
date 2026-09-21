'use client';

import React from 'react';
import { ClickCounterTester } from './ClickCounterTester';

/**
 * Phase 9 (item B): the CPS & Spacebar Test is the existing Click & Spacebar
 * Speed Test re-exported under its new identity — one implementation, no
 * fork. The registry's click-counter → click-speed-test migration lands here;
 * bounded durations (5/10/30 s), restart, and honest counts are already the
 * existing component's behavior.
 */
export function ClickSpeedTester(props: React.ComponentProps<typeof ClickCounterTester>) {
  return <ClickCounterTester {...props} />;
}
