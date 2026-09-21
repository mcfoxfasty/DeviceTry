import { GuideArticle } from './schema';

import { microphoneNotWorking } from './audio/microphone-not-working';
import { microphoneTooQuiet } from './audio/microphone-too-quiet';
import { oneHeadphoneSideNotWorking } from './audio/one-headphone-side-not-working';
import { webcamNotWorking } from './video/webcam-not-working';
import { keyboardKeysNotRegistering } from './input-gaming/keyboard-keys-not-registering';
import { mouseDoubleClicking } from './input-gaming/mouse-double-clicking';
import { controllerStickDrift } from './input-gaming/controller-stick-drift';
import { checkingScreenDeadPixels } from './display/checking-screen-dead-pixels';
import { lowInternetSpeedResult } from './network/low-internet-speed-result';
import { microphonesForMeetings } from './buying/microphones-for-meetings';
import { webcamsForLowLightCalls } from './buying/webcams-for-low-light-calls';
import { mechanicalKeyboards } from './buying/mechanical-keyboards';
import { budgetHeadphones } from './buying/budget-headphones';
import { homeOfficeMonitors } from './buying/home-office-monitors';
import { pcControllers } from './buying/pc-controllers';

export * from './schema';

/** All guide articles, including drafts. Public listings filter by `published`. */
export const GUIDE_ARTICLES: GuideArticle[] = [
  // ---------------------------------------------------------- troubleshooting
  microphoneNotWorking,
  microphoneTooQuiet,
  oneHeadphoneSideNotWorking,
  webcamNotWorking,
  keyboardKeysNotRegistering,
  mouseDoubleClicking,
  controllerStickDrift,
  checkingScreenDeadPixels,
  lowInternetSpeedResult,
  // ----------------------------------------------------------- buying guides
  microphonesForMeetings,
  webcamsForLowLightCalls,
  mechanicalKeyboards,
  budgetHeadphones,
  homeOfficeMonitors,
  pcControllers,
];
