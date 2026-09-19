// DeviceTry is intentionally English-only: no locale switcher, no ?lang params,
// and no language mentions anywhere in the UI or metadata.
export type Locale = 'en';
export type TextDirection = 'ltr' | 'rtl';

export interface LocaleConfig {
  code: Locale;
  name: string;
  englishName: string;
  dir: TextDirection;
  localeString: string;
}

export const LOCALES: Record<Locale, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    englishName: 'English',
    dir: 'ltr',
    localeString: 'en-US',
  },
};

export const DEFAULT_LOCALE: Locale = 'en';

export function isValidLocale(locale: string): locale is Locale {
  return locale === 'en';
}

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    homeTitle: string;
    free: string;
    startTest: string;
    stopTest: string;
    reset: string;
    status: string;
    idle: string;
    running: string;
    completed: string;
    passed: string;
    warning: string;
    failed: string;
    inconclusive: string;
    unsupported: string;
    permissionDenied: string;
    deviceUnavailable: string;
    error: string;
    retry: string;
    next: string;
    previous: string;
    save: string;
    cancel: string;
    delete: string;
    export: string;
    download: string;
    print: string;
    loading: string;
    viewAll: string;
    learnMore: string;
    privacyNote: string;
    modeFreeOnly: string;
  };
  nav: {
    home: string;
    tools: string;
    mic: string;
    webcam: string;
    keyboard: string;
    mouse: string;
    speakers: string;
    display: string;
    gamepad: string;
    battery: string;
    guidedInspection: string;
    help: string;
    about: string;
    contact: string;
    privacy: string;
    terms: string;
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    featureLocal: string;
    featurePrivacy: string;
    featureNoSignup: string;
  };
  landing: {
    searchPlaceholder: string;
    searchNoResults: string;
    toolsTitle: string;
    toolsSubtitle: string;
    inspectionTitle: string;
    inspectionSubtitle: string;
    inspectionCta: string;
    popularTitle: string;
  };
  permissionPrompt: {
    title: string;
    body: string;
    allowButton: string;
    troubleshoot: string;
    troubleshootHint: string;
    why: string;
    whyBody: string;
    deviceSettings: string;
    windowsHelp: string;
    macHelp: string;
  };
  toolsOverview: {
    title: string;
    subtitle: string;
    runAllInspection: string;
    runAllInspectionDesc: string;
    toolsListTitle: string;
  };
  micTest: {
    title: string;
    shortDesc: string;
    startPrompt: string;
    grantPermission: string;
    requesting: string;
    deniedMessage: string;
    selectDevice: string;
    defaultDevice: string;
    inputLevel: string;
    peakLevel: string;
    waveform: string;
    recordVoice: string;
    recordPrompt: string;
    recordingTime: string;
    playbackPrompt: string;
    downloadRecording: string;
    cleanFeedbackNotice: string;
    interpretationTitle: string;
    interpretationText: string;
    troubleshootingTitle: string;
    troubleshootingSteps: string[];
    hardwareLimitationNotice: string;
  };
  webcamTest: {
    title: string;
    shortDesc: string;
    startPrompt: string;
    selectCamera: string;
    deliveredResolution: string;
    observedFps: string;
    aspectRatio: string;
    takeSnapshot: string;
    downloadSnapshot: string;
    interpretationTitle: string;
    interpretationText: string;
    troubleshootingTitle: string;
    troubleshootingSteps: string[];
    hardwareLimitationNotice: string;
  };
  keyboardTest: {
    title: string;
    shortDesc: string;
    layoutSelector: string;
    layoutQwerty: string;
    layoutAzerty: string;
    layoutArabic: string;
    lastKeyPressed: string;
    keyCodeLabel: string;
    physicalCodeLabel: string;
    activeCombos: string[];
    resetKeys: string[];
    pressInstruction: string;
    osInterceptionNotice: string;
    interpretationTitle: string;
    interpretationText: string;
    troubleshootingTitle: string;
    troubleshootingSteps: string[];
  };
  mouseTest: {
    title: string;
    shortDesc: string;
    leftButton: string;
    rightButton: string;
    middleButton: string;
    wheelScroll: string;
    scrollUp: string;
    scrollDown: string;
    clickAreaPrompt: string;
    doubleClickTest: string;
    doubleClickThreshold: string;
    observedDoubleClickTiming: string;
    doubleClickDetected: string;
    singleClickDetected: string;
    totalClicks: string;
    resetCounter: string;
    latencyDisclaimer: string;
    interpretationTitle: string;
    interpretationText: string;
  };
  speakersTest: {
    title: string;
    shortDesc: string;
    startStereoTest: string;
    playLeft: string;
    playRight: string;
    playBoth: string;
    stopTone: string;
    soundLevelCaution: string;
    confirmPrompt: string;
    heardLeft: string;
    heardRight: string;
    heardBoth: string;
    heardNothing: string;
    interpretationTitle: string;
    interpretationText: string;
    physicalDisclaimer: string;
  };
  displayTest: {
    title: string;
    shortDesc: string;
    launchFullscreen: string;
    exitFullscreen: string;
    modeRed: string;
    modeGreen: string;
    modeBlue: string;
    modeWhite: string;
    modeBlack: string;
    modeGray: string;
    modeGradient: string;
    modeContrast: string;
    cycleInstruction: string;
    deadPixelCheck: string;
    observedRefreshRate: string;
    refreshRateNotice: string;
    userConfirmObservation: string;
    noDeadPixelsFound: string;
    deadPixelsObserved: string;
    uniformityGood: string;
    uniformityIssues: string;
  };
  gamepadTest: {
    title: string;
    shortDesc: string;
    connectPrompt: string;
    noGamepadDetected: string;
    detectedCount: string;
    controllerName: string;
    buttonsTitle: string;
    axesTitle: string;
    leftStick: string;
    rightStick: string;
    triggers: string;
    neutralPosition: string;
    driftNotice: string;
    calibrationDisclaimer: string;
  };
  batteryTest: {
    title: string;
    shortDesc: string;
    batteryLevel: string;
    chargingState: string;
    charging: string;
    discharging: string;
    chargingTime: string;
    dischargingTime: string;
    calculating: string;
    unsupportedTitle: string;
    unsupportedText: string;
    healthDisclaimer: string;
    interpretationTitle: string;
    interpretationText: string;
  };
  inspection: {
    title: string;
    subtitle: string;
    selectPreset: string;
    presetPreMeeting: string;
    presetPrePurchase: string;
    presetComprehensive: string;
    customSelection: string;
    stepCount: string;
    currentTest: string;
    skipTest: string;
    markResult: string;
    markPass: string;
    markWarning: string;
    markFail: string;
    markInconclusive: string;
    notesPrompt: string;
    finishInspection: string;
    viewReport: string;
  };
  report: {
    title: string;
    subtitle: string;
    summary: string;
    inspectionDate: string;
    inspectionId: string;
    language: string;
    deviceIdentifier: string;
    deviceIdentifierPlaceholder: string;
    testedBy: string;
    classificationBrowser: string;
    classificationUser: string;
    classificationInconclusive: string;
    classificationUnsupported: string;
    classificationSkipped: string;
    disclaimerTitle: string;
    disclaimerText: string;
    localHistorySaved: string;
    localHistoryExplanation: string;
    printReport: string;
    downloadJson: string;
  };



  footer: {
    builtForTrust: string;
    copyright: string;
    allRightsReserved: string;
    localProcessingGuarantee: string;
    disclaimer: string;
    quickLinks: string;
    tests: string;
    legal: string;
  };
  seo: {
    metaTitleHome: string;
    metaDescHome: string;
    metaTitleMic: string;
    metaDescMic: string;
    metaTitleWebcam: string;
    metaDescWebcam: string;
    metaTitleKeyboard: string;
    metaDescKeyboard: string;
    metaTitleMouse: string;
    metaDescMouse: string;
    metaTitleSpeakers: string;
    metaDescSpeakers: string;
    metaTitleDisplay: string;
    metaDescDisplay: string;
    metaTitleGamepad: string;
    metaDescGamepad: string;
    metaTitleBattery: string;
    metaDescBattery: string;
    metaTitleInspection: string;
    metaDescInspection: string;
  };
}
