import { ToolDefinition, ToolCategory } from './types';

export type { ToolDefinition, ToolCategory } from './types';

export const TOOLS_REGISTRY: ToolDefinition[] = [
  {
    id: "microphone-test",
    slug: "microphone-test",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Microphone Test",
    shortDesc: "Real-time volume meter, audio waveform and recording playback test.",
    supportHint: "Requires getUserMedia & Web Audio",
    keywords: ["mic test","microphone test","audio input","test mic online"],
    iconType: "microphone",
    requiredApis: ["navigator.mediaDevices.getUserMedia","AudioContext"],
    componentName: "MicrophoneTester",
    relatedToolIds: ["voice-recorder","speakers-test","pitch-detector","online-mirror"],
    instructions: [
      "Click Start Test to grant microphone permission.",
      "Speak into your microphone and observe the live relative input level and waveform.",
      "Optionally record a 5-second sample to verify clarity and background noise."
    ],
    limitations: [
      "Digital meter readings reflect browser input gain, not calibrated acoustic sound pressure (SPL).",
      "Noise suppression applied by your operating system or browser may alter waveforms."
    ],
    troubleshooting: [
      "If permission is blocked, click the lock icon in your browser address bar and allow microphone access.",
      "Check that your headset or external mic is selected in the device dropdown."
    ],
  },
  {
    id: "webcam-test",
    slug: "webcam-test",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Webcam Test",
    shortDesc: "Inspect live camera stream, actual video dimensions, frame rate and snapshot.",
    supportHint: "Requires getUserMedia & requestVideoFrameCallback",
    keywords: ["webcam test","camera test","test camera online"],
    iconType: "webcam",
    requiredApis: ["navigator.mediaDevices.getUserMedia"],
    componentName: "WebcamTester",
    relatedToolIds: ["online-mirror","microphone-test","display-test"],
    instructions: [
      "Click Start Test to request camera access.",
      "View the stream properties, delivered resolution, and observed frame cadence.",
      "Use the Take Snapshot button to download a local JPG photo."
    ],
    limitations: [
      "Delivered resolution depends on browser WebRTC constraints and hardware driver limits.",
      "Observed FPS measures video frame delivery rate, not display refresh rate."
    ],
    troubleshooting: [
      "Ensure no other application (Zoom, Teams, OBS) is exclusively holding the camera lock.",
      "Unplug and reconnect external USB webcams if no stream appears."
    ],
  },
  {
    id: "speakers-test",
    slug: "speakers-test",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Speaker & Headphone Test",
    shortDesc: "Verify stereo separation with independent Left, Right, and Center audio tones.",
    supportHint: "Requires Web Audio API StereoPannerNode",
    keywords: ["speaker test","sound test","audio test","left right audio test","stereo test"],
    iconType: "headphones",
    requiredApis: ["AudioContext"],
    componentName: "SpeakersTester",
    relatedToolIds: ["tone-generator","metronome","microphone-test"],
    instructions: [
      "Set your system volume to a moderate level.",
      "Click Play Left to verify the left audio channel, then Play Right for the right channel.",
      "Confirm whether you hear the tone clearly in the designated ear/speaker."
    ],
    limitations: [
      "Audible output verification relies on human listening confirmation.",
      "Bluetooth headphones with mono hands-free profiles may mix both channels together."
    ],
    troubleshooting: [
      "Make sure your physical mute switch or volume knob is not turned down.",
      "Check your operating system sound output device."
    ],
  },
  {
    id: "voice-recorder",
    slug: "voice-recorder",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Online Voice Recorder",
    shortDesc: "Record audio locally, pause/resume, playback waveform and download audio files.",
    supportHint: "Requires MediaRecorder API",
    keywords: ["voice recorder","audio recorder","record mic online"],
    iconType: "microphone",
    requiredApis: ["navigator.mediaDevices.getUserMedia","MediaRecorder"],
    componentName: "VoiceRecorderTester",
    relatedToolIds: ["microphone-test","tone-generator","pitch-detector"],
    instructions: [
      "Click Start Recording to begin capturing audio.",
      "Use Pause/Resume as needed, then click Stop when finished.",
      "Play back your recording and click Download to save the file locally."
    ],
    limitations: [
      "Recordings are stored purely in browser memory and capped at 5 minutes.",
      "The download container depends on your browser's supported codecs (typically WebM, or Ogg in Firefox); the file extension always matches the actual recording."
    ],
    troubleshooting: [
      "If the audio is silent, verify the correct microphone is selected.",
      "Check that microphone permissions are allowed in the browser."
    ],
  },
  {
    id: "online-mirror",
    slug: "online-mirror",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Online Mirror",
    shortDesc: "Quick, high-resolution full-screen webcam mirror with flip and zoom controls.",
    supportHint: "Requires camera video stream",
    keywords: ["online mirror","webcam mirror","camera mirror"],
    iconType: "webcam",
    requiredApis: ["navigator.mediaDevices.getUserMedia"],
    componentName: "OnlineMirrorTester",
    relatedToolIds: ["webcam-test","display-test"],
    instructions: [
      "Click Enable Mirror to turn on the camera preview.",
      "Toggle the Horizontal Flip button to switch between natural and mirrored views.",
      "Adjust zoom or go fullscreen for grooming or quick checks."
    ],
    limitations: [
      "No video frames or images are transmitted or saved without an explicit snapshot download.",
      "Digital zoom is rendered via CSS transforms."
    ],
    troubleshooting: [
      "Allow camera permission when prompted by the browser.",
      "Ensure adequate ambient lighting for clear video quality."
    ],
  },
  {
    id: "tone-generator",
    slug: "tone-generator",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Tone Generator",
    shortDesc: "Generate clean sine, square, sawtooth and triangle audio frequencies.",
    supportHint: "Requires Web Audio OscillatorNode",
    keywords: ["tone generator","frequency generator","audio sine wave","440hz tone"],
    iconType: "headphones",
    requiredApis: ["AudioContext"],
    componentName: "ToneGeneratorTester",
    relatedToolIds: ["speakers-test","pitch-detector","metronome"],
    instructions: [
      "Select frequency (Hz) using the slider, direct input or preset notes.",
      "Choose your waveform: Sine (smooth), Square (rich), Sawtooth (bright), or Triangle.",
      "Click Play Tone with volume at a comfortable level."
    ],
    limitations: [
      "Extreme low (<30Hz) and high (>15kHz) frequencies depend on hardware speaker transducer frequency response.",
      "This is a technical audio tool, not a certified clinical hearing diagnostic."
    ],
    troubleshooting: [
      "If no sound is heard, start with 440 Hz (standard concert pitch) at 20% gain.",
      "Check that headphones or speakers are connected and not muted."
    ],
  },
  {
    id: "keyboard-test",
    slug: "keyboard-test",
    category: "keyboard-mouse" as ToolCategory,
    categoryLabel: "Keyboard & Mouse",
    title: "Keyboard Tester",
    shortDesc: "Interactive key matrix diagram showing real-time presses, codes and key ghosting.",
    supportHint: "Requires KeyboardEvent API",
    keywords: ["keyboard test","keyboard tester","key ghosting test"],
    iconType: "keyboard",
    requiredApis: ["KeyboardEvent"],
    componentName: "KeyboardTester",
    relatedToolIds: ["mouse-test","click-counter"],
    instructions: [
      "Click inside the interactive keyboard area to focus the test.",
      "Press every key on your physical keyboard to verify its switch registers.",
      "Switch between QWERTY, AZERTY, and Arabic layout presets."
    ],
    limitations: [
      "Certain OS shortcuts (e.g. Win+L, Alt+F4, Ctrl+Alt+Del) are intercepted by the operating system before reaching the browser.",
      "Tab and Esc navigation keys have special exit handlers for accessibility."
    ],
    troubleshooting: [
      "If keys do not highlight, make sure the test canvas has active focus.",
      "For mechanical keyboards with sticky switches, clean underneath keycaps with compressed air."
    ],
  },
  {
    id: "mouse-test",
    slug: "mouse-test",
    category: "keyboard-mouse" as ToolCategory,
    categoryLabel: "Keyboard & Mouse",
    title: "Mouse & Click Tester",
    shortDesc: "Test left, right, middle clicks, scroll wheel delta, and double-click switch chatter.",
    supportHint: "Requires PointerEvent & MouseEvent",
    keywords: ["mouse test","mouse double click test","scroll wheel test"],
    iconType: "mouse",
    requiredApis: ["MouseEvent","WheelEvent"],
    componentName: "MouseTester",
    relatedToolIds: ["click-counter","keyboard-test","touchscreen-test"],
    instructions: [
      "Click inside the designated testing box with Left, Middle, and Right mouse buttons.",
      "Scroll up and down to check wheel direction and delta.",
      "Perform rapid single clicks to detect faulty micro-switch double-clicking."
    ],
    limitations: [
      "Extra side buttons (Button 4 & 5) are supported where exposed by the browser PointerEvent standard.",
      "Browser context menu is suppressed only within the test container."
    ],
    troubleshooting: [
      "If right click opens a context menu, ensure your cursor is inside the active testing pad.",
      "Clean optical sensor underneath the mouse if cursor movement jitters."
    ],
  },
  {
    id: "click-counter",
    slug: "click-counter",
    category: "keyboard-mouse" as ToolCategory,
    categoryLabel: "Keyboard & Mouse",
    title: "Click & Spacebar Speed Test",
    shortDesc: "Measure your clicks per second (CPS) and spacebar tap speed with timed challenges.",
    supportHint: "Requires DOM performance timer",
    keywords: ["click speed test","cps test","spacebar counter","clicks per second","test cps"],
    iconType: "mouse",
    requiredApis: ["performance.now"],
    componentName: "ClickCounterTester",
    relatedToolIds: ["mouse-test","keyboard-test"],
    instructions: [
      "Select duration (5s, 10s, 30s, or freeform).",
      "Choose Mouse Click mode or Spacebar mode.",
      "Start clicking as fast as possible to calculate your average CPS."
    ],
    limitations: [
      "Measured CPS is constrained by browser event loop timing and operating system polling rates.",
      "Scores reflect input burst frequency and are not uploaded to any remote leaderboard."
    ],
    troubleshooting: [
      "Use steady jitter-click or butterfly-click techniques for high CPS.",
      "Ensure the testing area is clicked."
    ],
  },
  {
    id: "touchscreen-test",
    slug: "touchscreen-test",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Touchscreen Coverage Test",
    shortDesc: "Draw across grid tiles to inspect touch accuracy, dead zones and digitizer response.",
    supportHint: "Requires Touch Events / Pointer Events",
    keywords: ["touchscreen test","touch screen test","screen digitizer test"],
    iconType: "touch-phone",
    requiredApis: ["PointerEvent","TouchEvent"],
    componentName: "TouchscreenTester",
    relatedToolIds: ["multitouch-test","display-test"],
    instructions: [
      "Touch and drag your finger across all grid cells on the screen.",
      "Filled cells change color to indicate registered touch coordinates.",
      "Click Clear or Reset Grid to start a new sweep."
    ],
    limitations: [
      "Drawing coverage serves as a visual inspection aid, not an automatic hardware digitizer health diagnosis.",
      "Browser edge-swipe gestures may trigger system navigation."
    ],
    troubleshooting: [
      "If drawing stutters, clean screen surface of oil or moisture.",
      "Remove thick screen protectors that may dampen capacitive touch sensitivity."
    ],
  },
  {
    id: "multitouch-test",
    slug: "multitouch-test",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Multi-Touch Test",
    shortDesc: "Track simultaneous touch points with distinct markers, radii and max observed fingers.",
    supportHint: "Requires TouchEvent API",
    keywords: ["multitouch test","multi touch tester","10 finger touch test","test multi-touch"],
    iconType: "touch-phone",
    requiredApis: ["TouchEvent"],
    componentName: "MultitouchTester",
    relatedToolIds: ["touchscreen-test","display-test"],
    instructions: [
      "Place 2 or more fingers simultaneously on the interactive testing pad.",
      "Observe live touch coordinates, touch radius (where supported), and active identifier tokens.",
      "Check the Maximum Observed Simultaneous Touch count."
    ],
    limitations: [
      "Reported count represents the maximum observed touches received by the browser, not a guaranteed hardware ceiling.",
      "Desktop browsers with mice report 0 or 1 simulated touch points."
    ],
    troubleshooting: [
      "Test on a mobile phone, tablet or touchscreen laptop for multi-finger detection.",
      "Disable three-finger screenshot gestures in OS settings if they intercept touches."
    ],
  },
  {
    id: "gamepad-test",
    slug: "gamepad-test",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Gamepad & Controller Tester",
    shortDesc: "Inspect analog thumbsticks, stick drift dead zones, triggers, and button states.",
    supportHint: "Requires Gamepad API",
    keywords: ["gamepad tester","controller test","stick drift test","ps5 controller test","xbox controller test"],
    iconType: "gamepad",
    requiredApis: ["navigator.getGamepads"],
    componentName: "GamepadTester",
    relatedToolIds: ["keyboard-test","mouse-test"],
    instructions: [
      "Connect your Xbox, PlayStation, Switch Pro, or generic USB/Bluetooth controller.",
      "Press any button on the controller so the browser detects the device.",
      "Move analog sticks to inspect center deadzone drift and trigger pressure levels."
    ],
    limitations: [
      "Browsers require a physical button press before exposing gamepad telemetry for security.",
      "Stick drift visualization highlights resting offset; it cannot physically repair worn potentiometer sensors."
    ],
    troubleshooting: [
      "If the gamepad is not detected, press the A/Cross button firmly.",
      "Reconnect USB cable or re-pair Bluetooth if connection drops."
    ],
  },
  {
    id: "dead-pixel-test",
    slug: "dead-pixel-test",
    category: "screen" as ToolCategory,
    categoryLabel: "Screen & Display",
    title: "Dead Pixel Screen Test",
    shortDesc: "Full-screen solid primary color cycles to visually spot stuck, dead or lit pixels.",
    supportHint: "Requires Fullscreen API",
    keywords: ["dead pixel test","stuck pixel test","screen test","test pixel mort"],
    iconType: "monitor",
    requiredApis: ["document.documentElement.requestFullscreen"],
    componentName: "DeadPixelTester",
    relatedToolIds: ["display-patterns","screen-info","display-fps"],
    instructions: [
      "Click Launch Fullscreen to start the test.",
      "Press Left/Right arrow keys or click the screen to cycle through Red, Green, Blue, White, and Black.",
      "Inspect your panel closely for non-illuminating dots (dead) or incorrect colored dots (stuck).",
      "Press Esc to exit fullscreen."
    ],
    limitations: [
      "Pixel defects require human visual observation; web browsers cannot automatically scan panel subpixels.",
      "Cleaning physical screen dust before testing prevents false positives."
    ],
    troubleshooting: [
      "Wipe screen gently with a microfiber cloth to distinguish surface debris from dead subpixels.",
      "If Esc does not exit, tap top-right corner."
    ],
  },
  {
    id: "display-patterns",
    slug: "display-patterns",
    category: "screen" as ToolCategory,
    categoryLabel: "Screen & Display",
    title: "Display Calibration Patterns",
    shortDesc: "Grayscale ramps, contrast steps, color gradients, and pixel alignment grids.",
    supportHint: "Requires Canvas 2D & Fullscreen",
    keywords: ["monitor calibration","contrast test","display test pattern"],
    iconType: "monitor",
    requiredApis: ["HTMLCanvasElement"],
    componentName: "DisplayPatternsTester",
    relatedToolIds: ["dead-pixel-test","screen-info","font-rendering"],
    instructions: [
      "Select the pattern: Grayscale Steps, Gamma Gradient, Black Level, White Level, or Sharpness Grid.",
      "Adjust monitor brightness/contrast until every shaded step is distinguishable.",
      "View patterns in fullscreen in a dimly lit room for optimal assessment."
    ],
    limitations: [
      "This tool provides visual reference patterns for manual adjustment, not a hardware colorimeter profile (ICC).",
      "Viewing angles on TN/VA panels will affect perceived gamma."
    ],
    troubleshooting: [
      "Reset monitor hardware picture settings to default before fine-tuning contrast.",
      "Disable dynamic contrast or ambient light sensors in your monitor OSD."
    ],
  },
  {
    id: "screen-info",
    slug: "screen-info",
    category: "screen" as ToolCategory,
    categoryLabel: "Screen & Display",
    title: "Screen & Display Specs",
    shortDesc: "Inspect viewport size, logical resolution, physical device pixel ratio, and color depth.",
    supportHint: "Reads window.screen properties",
    keywords: ["screen resolution test","device pixel ratio","viewport size","screen specs"],
    iconType: "monitor",
    requiredApis: ["window.screen","window.devicePixelRatio"],
    componentName: "ScreenInfoTester",
    relatedToolIds: ["dead-pixel-test","display-fps","display-patterns"],
    instructions: [
      "View your current window viewport width and height.",
      "Examine your OS logical resolution versus calculated physical canvas resolution.",
      "Check reported Color Depth and HDR color gamut support."
    ],
    limitations: [
      "Physical resolution is computed from window.screen multiplied by devicePixelRatio; browser privacy zooming may adjust these figures.",
      "Exact panel diagonal inches cannot be queried via web APIs."
    ],
    troubleshooting: [
      "If resolution appears smaller than expected, check OS display scaling (125%, 150%, 200%).",
      "Disable browser page zoom (Ctrl+0 / Cmd+0) for 100% 1:1 scale."
    ],
  },
  {
    id: "display-fps",
    slug: "display-fps",
    category: "screen" as ToolCategory,
    categoryLabel: "Screen & Display",
    title: "Display Refresh Rate / FPS Test",
    shortDesc: "Sample browser animation frame timestamps to estimate screen refresh cadence (60, 120, 144Hz).",
    supportHint: "Requires requestAnimationFrame & high-res timer",
    keywords: ["monitor hz test","refresh rate test","screen fps test","144hz test"],
    iconType: "monitor",
    requiredApis: ["requestAnimationFrame","performance.now"],
    componentName: "DisplayFpsTester",
    relatedToolIds: ["screen-info","dead-pixel-test","canvas-benchmark"],
    instructions: [
      "Click Start Benchmark to sample high-resolution animation frames.",
      "Keep this tab in foreground and refrain from heavy scrolling or window resizing.",
      "View estimated refresh rate (Hz), frame time consistency and dropped frame variance."
    ],
    limitations: [
      "Result reflects the browser compositing frame cadence, which caps at monitor VSync frequency.",
      "Power-saving modes or background throttling can cause lower observed FPS."
    ],
    troubleshooting: [
      "Connect laptops to AC power to prevent battery refresh rate throttling to 60Hz.",
      "Verify high-refresh display settings in your OS display control panel."
    ],
  },
  {
    id: "battery-monitor",
    slug: "battery-monitor",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Battery Status Monitor",
    shortDesc: "Inspect live percentage, charging status and estimated charging/discharging time.",
    supportHint: "Requires Battery Status API (Chromium / Android)",
    keywords: ["battery test","battery health monitor","laptop battery test"],
    iconType: "battery",
    requiredApis: ["navigator.getBattery"],
    componentName: "BatteryTester",
    relatedToolIds: ["screen-info","system-info"],
    instructions: [
      "Observe your live battery percentage gauge.",
      "Plug in or unplug your charger to observe immediate charging event status updates.",
      "Review estimated minutes to full charge or discharge when calculated by the OS."
    ],
    limitations: [
      "Firefox and Safari removed Battery API access for privacy protection.",
      "The API reports current charge level; it cannot measure physical battery wear or original milliamp-hour capacity."
    ],
    troubleshooting: [
      "Use Chrome, Edge, or Opera on Windows, Android, or ChromeOS for Battery API access.",
      "Allow a few minutes after plugging in for the OS to calculate charging time."
    ],
  },
  {
    id: "accelerometer-test",
    slug: "accelerometer-test",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Accelerometer & Motion Test",
    shortDesc: "Inspect live 3-axis acceleration (X, Y, Z) including gravity vectors on mobile devices.",
    supportHint: "Requires DeviceMotionEvent",
    keywords: ["accelerometer test","device motion test","phone sensor test"],
    iconType: "sensor-phone",
    requiredApis: ["DeviceMotionEvent"],
    componentName: "AccelerometerTester",
    relatedToolIds: ["gyroscope-test","vibration-test"],
    instructions: [
      "Click Start Motion Test (iOS will prompt for explicit motion permission).",
      "Tilt, shake, or move your mobile phone in 3D space.",
      "Observe live numerical acceleration readings (m/s²) and dynamic axis displacement visualizers."
    ],
    limitations: [
      "Desktop computers without built-in IMU sensor hardware will report unavailable sensors.",
      "Apple iOS requires an explicit user gesture to trigger PermissionState.request()."
    ],
    troubleshooting: [
      "Open this page on a smartphone over HTTPS to access motion sensors.",
      "Grant motion & orientation permission when prompted by iOS Safari."
    ],
  },
  {
    id: "gyroscope-test",
    slug: "gyroscope-test",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Gyroscope & Orientation Test",
    shortDesc: "Inspect real-time Alpha, Beta, Gamma rotation angles and 3D device tilt preview.",
    supportHint: "Requires DeviceOrientationEvent",
    keywords: ["gyroscope test","orientation test","phone gyro test","test gyroscope"],
    iconType: "sensor-phone",
    requiredApis: ["DeviceOrientationEvent"],
    componentName: "GyroscopeTester",
    relatedToolIds: ["accelerometer-test","vibration-test"],
    instructions: [
      "Click Enable Orientation Sensors.",
      "Rotate your device around its axes: Alpha (compass heading), Beta (front/back pitch), and Gamma (left/right roll).",
      "Watch the interactive 3D phone model tilt in sync with your real device."
    ],
    limitations: [
      "Absolute compass orientation requires an internal magnetometer which may experience magnetic interference indoors.",
      "Laptops report orientation only if fitted with hinge sensors."
    ],
    troubleshooting: [
      "Calibrate phone compass by moving device in a figure-8 motion if angles drift.",
      "Ensure screen auto-rotate lock does not block orientation events."
    ],
  },
  {
    id: "vibration-test",
    slug: "vibration-test",
    category: "mobile-controllers" as ToolCategory,
    categoryLabel: "Mobile & Controllers",
    title: "Vibration Motor Test",
    shortDesc: "Trigger haptic pulses, pulse sequences and custom vibration patterns on supported devices.",
    supportHint: "Requires navigator.vibrate (Android / Mobile Chrome)",
    keywords: ["vibration test","haptic test","phone vibration tester"],
    iconType: "sensor-phone",
    requiredApis: ["navigator.vibrate"],
    componentName: "VibrationTester",
    relatedToolIds: ["accelerometer-test","gamepad-test"],
    instructions: [
      "Select a test pattern: Single Pulse (200ms), Double Pulse, SOS Morse Code, or Heartbeat.",
      "Tap Test Vibration to trigger the phone motor.",
      "Click Stop Vibration at any time to halt active patterns."
    ],
    limitations: [
      "Apple iOS Safari does not support the Web Vibration API for security/policy reasons.",
      "Browser vibration calls do not guarantee the user physically perceived the motor."
    ],
    troubleshooting: [
      "Open this page on an Android phone using Google Chrome or Firefox.",
      "Ensure your device is not set to Do Not Disturb or Silent mode without vibration enabled."
    ],
  },
  {
    id: "pitch-detector",
    slug: "pitch-detector",
    category: "music" as ToolCategory,
    categoryLabel: "Music Tools",
    title: "Pitch Detector",
    shortDesc: "Autocorrelation audio algorithm estimating live pitch frequency and nearest musical note.",
    supportHint: "Requires Web Audio & microphone",
    keywords: ["pitch detector","note detector","audio pitch test","detecteur de note"],
    iconType: "microphone",
    requiredApis: ["AudioContext","navigator.mediaDevices.getUserMedia"],
    componentName: "PitchDetectorTester",
    relatedToolIds: ["instrument-tuner","tone-generator","metronome"],
    instructions: [
      "Click Start Listening to grant microphone access.",
      "Sing, hum, or play an acoustic note into your microphone.",
      "Observe the detected fundamental frequency (Hz), nearest musical note (A4, C3), and cents offset."
    ],
    limitations: [
      "Detects monophonic pitches (single voice or single instrument note); polyphonic chords will report the dominant fundamental.",
      "Background ambient noise may reduce pitch detection confidence."
    ],
    troubleshooting: [
      "Get closer to the microphone for stronger signal-to-noise ratio.",
      "Hold notes steadily for at least 0.5 seconds."
    ],
  },
  {
    id: "instrument-tuner",
    slug: "instrument-tuner",
    category: "music" as ToolCategory,
    categoryLabel: "Music Tools",
    title: "Chromatic Instrument Tuner",
    shortDesc: "Real-time chromatic needle tuner with presets for Guitar, Bass, Ukulele and Violin.",
    supportHint: "Requires Web Audio & microphone",
    keywords: ["guitar tuner","chromatic tuner","online tuner","accordeur guitare"],
    iconType: "microphone",
    requiredApis: ["AudioContext","navigator.mediaDevices.getUserMedia"],
    componentName: "InstrumentTunerTester",
    relatedToolIds: ["pitch-detector","tone-generator","metronome"],
    instructions: [
      "Select your instrument tuning (Standard Guitar EADGBE, Bass, Ukulele, Violin, or Chromatic).",
      "Pluck a string near your microphone.",
      "Tune your peg until the needle reaches the center (0 cents) and the green In Tune indicator lights up."
    ],
    limitations: [
      "Acoustic harmonic overtones on unmuted strings may briefly register as higher octaves.",
      "Configurable standard reference pitch is A4 = 440 Hz."
    ],
    troubleshooting: [
      "Mute adjacent vibrating strings with your palm while tuning a single string.",
      "Pluck with moderate force near the 12th fret for clear fundamental tone."
    ],
  },
  {
    id: "metronome",
    slug: "metronome",
    category: "music" as ToolCategory,
    categoryLabel: "Music Tools",
    title: "Precision Audio Metronome",
    shortDesc: "Sample-accurate audio scheduling with customizable BPM, time signatures and downbeat accents.",
    supportHint: "Requires Web Audio lookahead scheduler",
    keywords: ["online metronome","metronome bpm","tempo test","metronome en ligne"],
    iconType: "headphones",
    requiredApis: ["AudioContext"],
    componentName: "MetronomeTester",
    relatedToolIds: ["tone-generator","pitch-detector"],
    instructions: [
      "Set your desired tempo using the BPM slider, +/- buttons, or Tap Tempo button.",
      "Choose beats per measure (2/4, 3/4, 4/4, 6/8).",
      "Click Start Metronome to hear the precision synthesized woodblock ticks."
    ],
    limitations: [
      "Uses Web Audio AudioContext high-precision hardware clocks rather than imprecise JavaScript setInterval timers.",
      "Audio output volume follows browser master volume."
    ],
    troubleshooting: [
      "Use Tap Tempo button 4 times to naturally detect your desired song speed.",
      "Connect headphones for silent practice."
    ],
  },
  {
    id: "browser-system-info",
    slug: "browser-system-info",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Browser & System Information",
    shortDesc: "Inspect legitimate browser-exposed parameters, hardware concurrency, platform and user agent.",
    supportHint: "Queries standard navigator object",
    keywords: ["browser info","user agent test","hardware concurrency","system specs test"],
    iconType: "monitor",
    requiredApis: ["navigator.userAgent"],
    componentName: "BrowserSystemInfoTester",
    relatedToolIds: ["browser-compatibility","permission-diagnostics","browser-storage-test"],
    instructions: [
      "Review your detected Browser Engine, Operating System, and Architecture.",
      "Check reported Logical CPU Core concurrency and Device Memory (where supported).",
      "Inspect network connection type and cookies enabled state."
    ],
    limitations: [
      "Displays only legitimately exposed browser properties; does not extract confidential serial numbers or unshared hardware specs.",
      "Device memory reports approximate RAM (e.g. 8GB max in Chrome) to prevent fingerprinting."
    ],
    troubleshooting: [
      "If user agent appears generic, your browser may be using privacy anti-tracking protections.",
      "Check hardware concurrency matches your physical CPU thread count."
    ],
  },
  {
    id: "browser-compatibility",
    slug: "browser-compatibility",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Browser Feature Compatibility Matrix",
    shortDesc: "Read-only capability matrix verifying support for 25+ modern Web APIs without prompting permissions.",
    supportHint: "Passive feature detection",
    keywords: ["html5 compatibility","web api support","browser feature test","compatibilite navigateur"],
    iconType: "monitor",
    requiredApis: ["window"],
    componentName: "BrowserCompatibilityTester",
    relatedToolIds: ["browser-system-info","permission-diagnostics","webrtc-test"],
    instructions: [
      "Inspect the support status for MediaDevices, Web Audio, WebGL, WebAssembly, Gamepad, ServiceWorker, and more.",
      "Use the category filters to focus on Audio, Video, Sensors, or Graphics APIs.",
      "Identify which hardware APIs are supported by your current browser."
    ],
    limitations: [
      "Distinguishes whether an API interface exists in the window object; does not execute intrusive hardware actions.",
      "Disabled browser flags or policies may prevent runtime API usage."
    ],
    troubleshooting: [
      "Update to the latest browser version to gain support for modern APIs.",
      "Switch from in-app web views (e.g. social media browsers) to full Safari or Chrome."
    ],
  },
  {
    id: "permission-diagnostics",
    slug: "permission-diagnostics",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Permission Status Diagnostics",
    shortDesc: "Inspect granted, denied and prompt states for Camera, Mic, Clipboard and Notifications.",
    supportHint: "Requires Permissions API query",
    keywords: ["permissions test","camera permission check","mic permission test","permissions navigateur"],
    iconType: "monitor",
    requiredApis: ["navigator.permissions"],
    componentName: "PermissionDiagnosticsTester",
    relatedToolIds: ["microphone-test","webcam-test","browser-system-info"],
    instructions: [
      "View current state (Granted, Denied, or Prompt) for microphone, camera, clipboard, notifications and geolocation.",
      "Learn how to reset blocked permissions in Chrome, Firefox, Safari, and Edge.",
      "Click Refresh Status after adjusting browser settings."
    ],
    limitations: [
      "Queries supported permission descriptors without popping up authorization dialogs.",
      "Browsers that do not support navigator.permissions.query() will report query unavailable."
    ],
    troubleshooting: [
      "To unblock a permission, click the site settings icon on the left of your URL bar and change Block to Allow.",
      "Reload the tab after changing permissions."
    ],
  },
  {
    id: "clipboard-test",
    slug: "clipboard-test",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Clipboard Copy & Paste Tester",
    shortDesc: "Verify asynchronous clipboard writeText and readText with fallback support.",
    supportHint: "Requires Async Clipboard API",
    keywords: ["clipboard test","copy paste test","test presse papier"],
    iconType: "keyboard",
    requiredApis: ["navigator.clipboard"],
    componentName: "ClipboardTester",
    relatedToolIds: ["keyboard-test","browser-storage-test"],
    instructions: [
      "Click Copy Sample Text to test writing formatted text to your system clipboard.",
      "Click Paste from Clipboard to verify read capabilities (requires user interaction).",
      "Observe the test confirmation logs."
    ],
    limitations: [
      "Clipboard read is strictly bound to explicit user gestures and requires focused browser documents for privacy.",
      "Never stores or uploads pasted content."
    ],
    troubleshooting: [
      "Allow clipboard permission when prompted by the browser on paste.",
      "If copy fails, use Ctrl+C / Cmd+C manual keyboard shortcut."
    ],
  },
  {
    id: "browser-storage-test",
    slug: "browser-storage-test",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Browser Storage & Quota Test",
    shortDesc: "Inspect origin storage quota, test IndexedDB read/write/delete and check localStorage.",
    supportHint: "Requires StorageManager & IndexedDB",
    keywords: ["storage quota test","indexeddb test","localstorage test","test stockage navigateur"],
    iconType: "monitor",
    requiredApis: ["navigator.storage","indexedDB","localStorage"],
    componentName: "BrowserStorageTester",
    relatedToolIds: ["devicetry-storage-inspector","browser-system-info"],
    instructions: [
      "Click Run Storage Diagnostics to query estimated quota and usage.",
      "Perform a non-destructive temporary IndexedDB read/write/delete cycle.",
      "Verify persistent storage support and localStorage availability."
    ],
    limitations: [
      "Storage quota reflects the browser allotted partition for this origin, not total free hard drive capacity.",
      "Private browsing modes assign temporary restricted storage quotas."
    ],
    troubleshooting: [
      "If storage test fails, check that cookies and site data are not disabled in privacy settings.",
      "Exit Incognito/Private mode if persistent storage is required."
    ],
  },
  {
    id: "devicetry-storage-inspector",
    slug: "devicetry-storage-inspector",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "DeviceTry Privacy & Data Inspector",
    shortDesc: "Inspect and clear all local inspection records, theme settings, and origin storage items.",
    supportHint: "100% Client-Side origin management",
    keywords: ["privacy inspector","clear history","local data inspector","supprimer historique"],
    iconType: "monitor",
    requiredApis: ["localStorage"],
    componentName: "PrivacyStorageInspectorTester",
    relatedToolIds: ["browser-storage-test","browser-system-info"],
    instructions: [
      "View every key and record currently stored by DeviceTry in your browser.",
      "Inspect your saved inspection histories, language preference, and theme settings.",
      "Click Clear All DeviceTry Data to instantly reset your browser state."
    ],
    limitations: [
      "Inspects and manages exclusively records belonging to this DeviceTry origin; cannot access data from third-party websites.",
      "HTTP-only server cookies are not used."
    ],
    troubleshooting: [
      "Use the Export Backup button before clearing if you wish to retain your past inspection reports.",
      "Clearing data will reset theme and language preferences to default."
    ],
  },
  {
    id: "font-rendering",
    slug: "font-rendering",
    category: "screen" as ToolCategory,
    categoryLabel: "Screen & Display",
    title: "Font & Text Rendering Test",
    shortDesc: "Inspect typography subpixel antialiasing, kerning, international ligatures and font sizes.",
    supportHint: "Multilingual typography test",
    keywords: ["font rendering test","subpixel antialiasing","text clarity test","test police ecriture"],
    iconType: "monitor",
    requiredApis: ["document.fonts"],
    componentName: "FontRenderingTester",
    relatedToolIds: ["display-patterns","screen-info"],
    instructions: [
      "Inspect international typography samples at varying point sizes (9px to 36px).",
      "Toggle between Light and Dark backgrounds to evaluate subpixel text contrast.",
      "Verify proper cursive letter connection and ligature shaping in international fonts."
    ],
    limitations: [
      "Font antialiasing (ClearType or FreeType) is controlled by your operating system display settings.",
      "Text rendering depends on hardware screen subpixel layout (RGB vs BGR)."
    ],
    troubleshooting: [
      "Run the Windows ClearType Text Tuner if text edges appear blurry or colored.",
      "Enable high DPI display scaling if available on your monitor."
    ],
  },
  {
    id: "codec-support",
    slug: "codec-support",
    category: "audio-camera" as ToolCategory,
    categoryLabel: "Audio & Camera",
    title: "Audio & Video Codec Support",
    shortDesc: "Inspect browser decoding and recording support for MP4, H.264, VP9, AV1, AAC, Opus, FLAC.",
    supportHint: "Requires HTMLMediaElement.canPlayType & MediaRecorder.isTypeSupported",
    keywords: ["codec test","av1 support test","h264 test","media codec check","support codecs"],
    iconType: "headphones",
    requiredApis: ["HTMLMediaElement.prototype.canPlayType","MediaRecorder.isTypeSupported"],
    componentName: "CodecSupportTester",
    relatedToolIds: ["microphone-test","webcam-test","voice-recorder"],
    instructions: [
      "Review playback support (Probably, Maybe, No) across major video and audio containers.",
      "Check MediaRecorder capture format support for local video and voice recording.",
      "Filter by Audio Codecs, Video Codecs, or Recording Codecs."
    ],
    limitations: [
      "canPlayType responses represent browser codec decoder indications, not guarantee that corrupted files will play.",
      "Hardware accelerated decoding depends on installed GPU drivers."
    ],
    troubleshooting: [
      "For AV1 hardware acceleration, install official AV1 Video Extensions from your OS app store.",
      "Use standard MP4/H.264 or WebM/VP9 for maximum cross-browser compatibility."
    ],
  },
  {
    id: "canvas-benchmark",
    slug: "canvas-benchmark",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Canvas 2D Rendering Benchmark",
    shortDesc: "Measure 2D graphics performance: shapes, particle physics, text rendering and composite operations.",
    supportHint: "Runs a bounded local 2D stress test",
    keywords: ["canvas benchmark","2d graphics test","browser benchmark","test canvas 2d"],
    iconType: "monitor",
    requiredApis: ["HTMLCanvasElement","CanvasRenderingContext2D"],
    componentName: "CanvasBenchmarkTester",
    relatedToolIds: ["webgl-test","javascript-benchmark","display-fps"],
    instructions: [
      "Click Start Benchmark to launch the 5-second standardized 2D rendering workload.",
      "Watch live particle physics and geometry fill operations.",
      "Review your rendered frame count, average FPS, and 2D rendering score."
    ],
    limitations: [
      "Results reflect local CPU/GPU browser 2D acceleration and current tab priority.",
      "Benchmark runs locally and does not upload scores to any external leaderboard."
    ],
    troubleshooting: [
      "Enable Hardware Acceleration in browser settings if scores are unusually low.",
      "Close background tabs playing heavy video streams for reliable results."
    ],
  },
  {
    id: "webgl-test",
    slug: "webgl-test",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "WebGL & GPU Browser Test",
    shortDesc: "Inspect WebGL 1 & 2 contexts, GPU unmasked renderer details, texture limits and 3D cube mesh.",
    supportHint: "Requires WebGL / WebGL2 context",
    keywords: ["webgl test","gpu test","graphics card test","webgl2 support","test webgl"],
    iconType: "monitor",
    requiredApis: ["WebGLRenderingContext","WebGL2RenderingContext"],
    componentName: "WebGLTester",
    relatedToolIds: ["canvas-benchmark","javascript-benchmark","display-fps"],
    instructions: [
      "Inspect detected WebGL 1.0 and WebGL 2.0 support status.",
      "Review unmasked GPU vendor, renderer model, maximum texture dimensions, and supported extensions.",
      "Interact with the live rendered spinning 3D geometric mesh."
    ],
    limitations: [
      "GPU renderer name is read via WEBGL_debug_renderer_info (may be masked in privacy browsers).",
      "Does not report physical GPU temperature or total VRAM capacity."
    ],
    troubleshooting: [
      "Update your graphics card drivers if WebGL contexts fail to initialize.",
      "Check that webgl.disabled is set to false in browser advanced settings."
    ],
  },
  {
    id: "javascript-benchmark",
    slug: "javascript-benchmark",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "JavaScript Engine CPU Benchmark",
    shortDesc: "Run repeatable local mathematical, array manipulation, and cryptographic hashing workloads.",
    supportHint: "Runs bounded client-side computations",
    keywords: ["javascript benchmark","browser cpu test","speedometer alternative","benchmark javascript"],
    iconType: "monitor",
    requiredApis: ["performance.now","crypto.subtle"],
    componentName: "JavascriptBenchmarkTester",
    relatedToolIds: ["webassembly-benchmark","canvas-benchmark"],
    instructions: [
      "Click Run Benchmark to initiate the standardized computational suite.",
      "Executes Prime Sieve calculation, Matrix Multiplication, String Processing, and SHA-256 Hashing.",
      "Compare your operations-per-second and execution elapsed time."
    ],
    limitations: [
      "Workload runs within the browser JavaScript JIT compiler sandbox and reflects single-thread engine efficiency.",
      "Background tasks and battery throttling affect completion times."
    ],
    troubleshooting: [
      "Plug in laptop power adapter for maximum CPU clock boost.",
      "Close heavy background applications for consistent benchmark scores."
    ],
  },
  {
    id: "webassembly-benchmark",
    slug: "webassembly-benchmark",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "WebAssembly (Wasm) Support & Speed Test",
    shortDesc: "Validate WebAssembly binary compilation, instantiate a local module and compute Fibonacci speed.",
    supportHint: "Requires WebAssembly API",
    keywords: ["webassembly test","wasm benchmark","wasm support test","test webassembly"],
    iconType: "monitor",
    requiredApis: ["WebAssembly.instantiate"],
    componentName: "WebAssemblyTester",
    relatedToolIds: ["javascript-benchmark","canvas-benchmark"],
    instructions: [
      "Check WebAssembly feature flags (MVP, SIMD, Threads, BigInt).",
      "Click Run Wasm Benchmark to compile and execute an in-memory binary module.",
      "Observe native bytecode execution time and compare against interpreted execution."
    ],
    limitations: [
      "Module is instantiated dynamically from a bundled byte array in browser memory.",
      "Advanced Wasm SIMD instructions depend on underlying CPU vector extensions."
    ],
    troubleshooting: [
      "Ensure WebAssembly is not disabled in browser enterprise flags.",
      "Update your browser if WebAssembly 2.0 features fail to compile."
    ],
  },
  {
    id: "webrtc-test",
    slug: "webrtc-test",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Local WebRTC Capability Test",
    shortDesc: "Establish a local loopback peer connection, test RTCDataChannel and candidate gathering without external servers.",
    supportHint: "Requires RTCPeerConnection (Zero STUN/TURN)",
    keywords: ["webrtc test","datachannel test","peerconnection test","test webrtc"],
    iconType: "monitor",
    requiredApis: ["RTCPeerConnection"],
    componentName: "WebRTCTester",
    relatedToolIds: ["browser-compatibility","offline-check"],
    instructions: [
      "Click Test Local WebRTC Loopback.",
      "Initializes two RTCPeerConnection instances within the same tab using empty iceServers: [].",
      "Sends roundtrip ping messages across an in-memory RTCDataChannel and records connection handshake time."
    ],
    limitations: [
      "Tests browser internal WebRTC engine and data channel stack; does not test external internet firewall or remote packet loss.",
      "Cleanly closes all connections on test completion."
    ],
    troubleshooting: [
      "If WebRTC fails, check if privacy extensions (e.g. WebRTC blockers) are active.",
      "Verify that RTCPeerConnection is enabled in your browser."
    ],
  },
  {
    id: "offline-check",
    slug: "offline-check",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Offline & Service Worker Status",
    shortDesc: "Inspect navigator.onLine state, network type, CacheStorage availability and offline readiness.",
    supportHint: "Inspects navigator.onLine & Cache API",
    keywords: ["offline test","service worker test","pwa cache check","test hors ligne"],
    iconType: "monitor",
    requiredApis: ["navigator.onLine","caches"],
    componentName: "OfflineCheckTester",
    relatedToolIds: ["browser-storage-test","devicetry-storage-inspector"],
    instructions: [
      "Inspect live connection indicator (Online / Offline).",
      "Check CacheStorage API availability and inspect cached asset partitions.",
      "Toggle your Wi-Fi or Airplane mode to observe immediate online/offline event handlers."
    ],
    limitations: [
      "navigator.onLine indicates LAN/Wi-Fi link state; it does not guarantee actual internet transit routing.",
      "Static assets must be visited at least once online to populate local cache."
    ],
    troubleshooting: [
      "If offline mode fails to load pages, clear outdated browser cache and refresh.",
      "Ensure cookies/site data are allowed."
    ],
  },
  {
    id: "clock-timezone",
    slug: "clock-timezone",
    category: "browser-performance" as ToolCategory,
    categoryLabel: "Browser & Performance",
    title: "Clock & Timezone Information",
    shortDesc: "Inspect device local time, UTC offset, IANA timezone string, daylight saving and localized formats.",
    supportHint: "Reads Intl & Date API",
    keywords: ["timezone test","clock test","utc offset check","test fuseau horaire"],
    iconType: "monitor",
    requiredApis: ["Intl.DateTimeFormat"],
    componentName: "ClockTimezoneTester",
    relatedToolIds: ["browser-system-info"],
    instructions: [
      "View live ticking local system clock and UTC timestamp.",
      "Review detected IANA Time Zone (e.g. Europe/Paris, America/New_York).",
      "Check active UTC offset minutes, Daylight Saving Time (DST) status, and Intl locale date strings."
    ],
    limitations: [
      "Reports system-configured clock time and timezone; does not connect to remote NTP time servers.",
      "If your computer clock is manually set incorrectly, this tool shows the exact erroneous local clock."
    ],
    troubleshooting: [
      "Enable Set time automatically in your operating system settings if the clock drifts.",
      "Verify your system timezone matches your geographical location."
    ],
  },
];
