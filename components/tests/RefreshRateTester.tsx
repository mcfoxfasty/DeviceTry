'use client';

import React from 'react';
import { DisplayFpsTester } from './DisplayFpsTester';

/**
 * Phase 9 (item B/E): the Refresh Rate Test is the existing Display FPS
 * tester re-exported under its final identity — one implementation, no fork.
 * It measures browser-rendering timing (requestAnimationFrame cadence), and
 * its copy already explains that this is not panel certification or a gaming
 * performance rating.
 */
export function RefreshRateTester(props: React.ComponentProps<typeof DisplayFpsTester>) {
  return <DisplayFpsTester {...props} />;
}
