import { GuideArticle } from '../schema';

/**
 * Webcam troubleshooting, supplied as authored markup.
 *
 * This article arrives as `rawBody` rather than as typed `sections`, and that is
 * the point of the field. The prose carries a `<details>` contents list, its
 * own `<h3>` sub-headings, inline `<code>`, a "three gates" figure built from
 * `<ol>` plus a `<figcaption>`, and a Sources list pointing at four different
 * vendors' documentation. The typed sections cannot express any of that, and
 * rewriting the prose to fit them would change the words the author chose.
 *
 * WHAT IS TYPED AND WHAT IS NOT, and why:
 *
 *   - The H1 comes from `title`, the byline's publication dates come from
 *     `publishedAt`/`updatedAt`, and the FAQPage JSON-LD comes from `faqs`.
 *     The markup therefore carries no `<h1>`, no date line, and no
 *     `<script>` — the page would otherwise print the headline, the dates and
 *     the structured data twice.
 *   - `seoTitle`/`seoDescription` are the article's own `<title>` and JSON-LD
 *     description strings, which differ from its H1 and its meta description.
 *   - `faqs` mirrors the FAQ section that already lives inside `rawBody`. It is
 *     not rendered again by the template (it stands down for an article with a
 *     raw body), but the generated FAQPage graph is built from it, so it has to
 *     list the questions the reader can actually find on the page.
 *
 * IMAGES. The two in-body figures and the 1200x630 social card are served
 * straight out of `/uploads/`, where the site keeps its supplied originals.
 * All three names are the files' real names, so the markup cannot point at a
 * path that does not exist.
 * tests/launchReadiness.test.ts is what keeps the declared card honest.
 */

export const webcamNotWorking: GuideArticle = {
  slug: 'webcam-not-working',
  title: 'Webcam Not Working? 14 Fixes for Windows & Mac in 2026',
  seoTitle: 'Webcam Not Working? 14 Fixes for Windows & Mac (2026)',
  description:
    'Webcam black screen or not detected? 14 ordered fixes for Windows 11 and Mac, plus Zoom/Teams problems and error codes like 0xA00F4244.',
  seoDescription:
    'Fix black screens, missing cameras, privacy blocks, driver errors and Zoom/Teams issues on Windows and Mac with 14 ordered fixes.',
  socialImage: {
    url: '/uploads/webcam-not-working-og.jpg',
    width: 1200,
    height: 630,
    alt: 'DeviceTry guide: Webcam Not Working, 14 fixes for Windows and Mac',
  },
  category: 'video',
  type: 'troubleshooting',
  relatedToolSlugs: ['webcam-test', 'permission-diagnostics', 'microphone-test'],
  relatedGuideSlugs: ['microphone-not-working', 'webcams-for-low-light-calls'],
  intro:
    'Webcam black screen or not detected? 14 ordered fixes for Windows 11 and Mac, plus Zoom/Teams problems and error codes like 0xA00F4244.',
  published: true,
  publishedAt: new Date('2026-08-14'),
  updatedAt: new Date('2026-10-05'),
  hasAffiliateLinks: false,
  sections: [],
  rawStyle: `
  .dt-guide [id] { scroll-margin-top: 96px; }
  .dt-guide img { max-width: 100%; height: auto; border-radius: 8px; }
  .dt-guide .dt-table { overflow-x: auto; }
  .dt-guide table { border-collapse: collapse; width: 100%; }
  .dt-guide th, .dt-guide td { border: 1px solid rgba(128,128,128,.35); padding: 8px 10px; text-align: left; vertical-align: top; }
  .dt-guide .dt-quick { border-left: 4px solid #1fa95b; background: rgba(31,169,91,.10); padding: 16px; border-radius: 6px; margin: 20px 0; }
  .dt-guide details.dt-toc { border: 1px solid rgba(128,128,128,.35); border-radius: 8px; padding: 10px 14px; margin: 16px 0; }
  .dt-guide details.dt-toc summary { cursor: pointer; font-weight: 600; }
  .dt-guide .dt-gates { margin: 16px 0; border: 1px solid rgba(128,128,128,.35); border-radius: 8px; }
  .dt-guide .dt-gates ol { list-style: none; margin: 0; padding: 0; counter-reset: gate; }
  .dt-guide .dt-gates li { position: relative; padding: 12px 14px 12px 52px; border-top: 1px solid rgba(128,128,128,.25); counter-increment: gate; }
  .dt-guide .dt-gates li:first-child { border-top: 0; }
  .dt-guide .dt-gates li::before { content: counter(gate); position: absolute; left: 14px; top: 12px; width: 26px; height: 26px; line-height: 26px; text-align: center; border-radius: 50%; background: #1fa95b; color: #fff; font-weight: 700; font-size: 14px; }
  .dt-guide .dt-gates li span { display: block; opacity: .8; font-size: .95em; }
  .dt-guide .dt-gates figcaption { padding: 10px 14px; border-top: 1px solid rgba(128,128,128,.25); font-size: .92em; opacity: .85; }
`,
  rawBody: `
<p class="byline"><em>By the <a href="/about">DeviceTry team</a> · Steps checked against Microsoft, Apple, Google and Zoom documentation (<a href="#sources">sources below</a>) · Covers Windows 11 and recent macOS versions (Tahoe, Sequoia, Sonoma) · <a href="#chromeos">ChromeOS short path</a> included.</em></p>

<p><img src="/uploads/webcam-not-working-14-fixes.webp" alt="Guide cover: Webcam Not Working, 14 fixes for Windows and Mac, showing a laptop with a 'Camera not detected' message" width="1536" height="1024" fetchpriority="high"></p>

<p>A webcam fails in a small number of recognisable ways: <strong>no camera detected</strong>, a <strong>black screen</strong>, video that works in one app but not another, a camera that vanished from Device Manager, an error code like <strong>0xA00F4244</strong>, or a glowing LED with no picture. Each symptom points at a different layer — hardware, driver, operating system, browser, or app — and the layers are cheap to rule out in order.</p>
<p>Before you reinstall anything, answer one question: <strong>does the operating system see the camera at all, or is the problem confined to one app or website?</strong> Open the built-in Camera app (Windows) or Photo Booth (Mac). If either shows a picture, your hardware and driver are fine and the fault is a permission or an app setting. If nothing can see the camera, start with the physical checks in <a href="#fix1">Fix 1</a>.</p>

<div class="dt-quick" id="quick-answer">
<strong>Quick answer — what to do first:</strong><br>
If your webcam is not working, check the physical privacy shutter or camera key first. On Windows, turn on all three toggles in Settings → Privacy &amp; security → Camera; on Mac, allow your app under System Settings → Privacy &amp; Security → Camera. Then close other video apps and test in the Camera app or Photo Booth before touching drivers.
</div>

<p>Want a ten-second check first? Open the free <a href="/test/webcam-test">Webcam Test</a>: if you see yourself, the camera works end to end and the problem is the specific app you were using.</p>

<details class="dt-toc">
<summary>Quick navigation (all 14 fixes)</summary>
<ul>
<li><a href="#symptom-map">Find your symptom (30-second triage)</a></li>
<li><a href="#fix1">1. Privacy shutter, camera switch &amp; USB connection</a></li>
<li><a href="#fix2">2. Windows 11 camera privacy settings</a></li>
<li><a href="#fix3">3. macOS camera permissions</a></li>
<li><a href="#fix4">4. Close apps that are holding the camera</a></li>
<li><a href="#fix5">5. Test the camera outside the failing app</a></li>
<li><a href="#fix6">6. Browser site permissions (Chrome, Edge, Firefox, Safari)</a></li>
<li><a href="#fix7">7. Check whether Windows detects the camera</a></li>
<li><a href="#fix8">8. Update, roll back, or reinstall the camera driver</a></li>
<li><a href="#fix9">9. BIOS/UEFI and manufacturer firmware</a></li>
<li><a href="#fix10">10. Black screen with the LED on</a></li>
<li><a href="#fix11">11. Zoom, Microsoft Teams &amp; Google Meet</a></li>
<li><a href="#fix12">12. Error codes: 0xA00F4244, 0xA00F4243, 0x80070005 and others</a></li>
<li><a href="#fix13">13. Antivirus webcam protection</a></li>
<li><a href="#fix14">14. When it is probably a hardware problem</a></li>
<li><a href="#chromeos">ChromeOS: the short path</a></li>
<li><a href="#decision-tree">Troubleshooting decision tree</a></li>
<li><a href="#prevent">How to prevent webcam problems</a></li>
<li><a href="#faq">FAQs</a></li>
<li><a href="#sources">Sources</a></li>
</ul>
</details>

<h2 id="symptom-map">Find your symptom — a 30-second triage</h2>
<p>The fixes below are ordered by cost, not by likelihood. This table rearranges the same material by symptom: read the first row that matches what you see, then go straight to the fix it names.</p>

<div class="dt-table">
<table>
<thead>
<tr><th>What you see</th><th>What it usually means</th><th>Start here</th></tr>
</thead>
<tbody>
<tr><td>Works in one app, not another</td><td>Another app is holding the camera, or the app picked the wrong device</td><td><a href="#fix4">Fix 4</a>, then <a href="#fix11">Fix 11</a></td></tr>
<tr><td>Works in the Camera app, not in a browser</td><td>Site-level browser permission</td><td><a href="#fix6">Fix 6</a></td></tr>
<tr><td>Works in the browser, not in Zoom/Teams</td><td>Desktop-app permission or device selection</td><td><a href="#fix2">Fix 2</a>, <a href="#fix11">Fix 11</a></td></tr>
<tr><td>Black screen, LED on</td><td>Shutter, reservation, or wrong device — rarely hardware</td><td><a href="#fix10">Fix 10</a></td></tr>
<tr><td>Fails in every app, including the built-in one</td><td>Antivirus block, driver, or deeper</td><td><a href="#fix13">Fix 13</a>, then <a href="#fix1">Fix 1</a></td></tr>
<tr><td>Not detected anywhere</td><td>Switch, USB, firmware, or hardware</td><td><a href="#fix1">Fix 1</a>, <a href="#fix7">Fix 7</a>, <a href="#fix9">Fix 9</a>, <a href="#fix14">Fix 14</a></td></tr>
<tr><td>Error 0xA00F4244 / 0xA00F4243</td><td>"No camera found" vs "camera already in use"</td><td><a href="#fix12">Fix 12</a></td></tr>
</tbody>
</table>
</div>

<p>One honest limit: a symptom tells you where to look, not what is broken. A camera blocked by antivirus, for example, looks identical to a camera blocked by a permission from inside an app — which is why the table sometimes names two fixes.</p>

<h2 id="fix1">Fix 1 — the privacy shutter, camera switch, and USB connection</h2>
<p>A closed shutter, a switched-off kill switch, or a half-seated USB plug all produce the same two symptoms: a black frame, or a camera the system reports as absent. No software setting overrides a physically closed shutter, which is why this check comes first.</p>
<p><strong>Ten-second shutter test:</strong> shine a phone flashlight straight into the lens from a centimetre away. If the light stops dead against a surface, you are looking at the back of a closed shutter, not glass.</p>

<h3>Check every physical control</h3>
<ul>
<li><strong>Laptop shutter slider</strong> — usually above the lens, often showing red or white when closed.</li>
<li><strong>External webcam cover</strong> — a sliding or twisting cap on the camera body.</li>
<li><strong>Electronic privacy switch</strong> — a physical button or slide switch on some laptops that disconnects the camera electrically. Off can mean "no camera installed at all."</li>
<li><strong>Keyboard camera key</strong> — a camera icon on an F-key, often F4, F8, or F10. Press <strong>Fn + that key</strong> to toggle.</li>
</ul>

<h3>Check the USB connection (external webcams)</h3>
<ul>
<li>Unplug and reconnect the camera; try a port on the machine itself, not a hub or dock.</li>
<li><strong>1080p/4K cameras need real bandwidth:</strong> unplug other USB devices and use a USB 3.x port (usually blue or marked SS). A camera that works in one port but drops in another is usually a bandwidth problem, not a dying camera.</li>
<li>Try a different cable if the camera has a detachable one — worn cables are a common, invisible cause of random disconnects.</li>
<li>Test the webcam on a second computer if you can.</li>
</ul>

<h3>If the camera works, then drops after sleep or idle time (Windows)</h3>
<p>Windows power saving can switch USB devices off to save energy. Two settings are worth changing for an external webcam that fails intermittently:</p>
<ol>
<li><strong>USB selective suspend:</strong> Control Panel → Power Options → Change plan settings → Change advanced power settings → USB settings → USB selective suspend setting → <strong>Disabled</strong>.</li>
<li><strong>Per-device power management:</strong> Device Manager → Universal Serial Bus controllers → USB Root Hub → Properties → Power Management → uncheck <strong>"Allow the computer to turn off this device to save power"</strong>.</li>
</ol>

<h2 id="fix2">Fix 2 — Windows 11 camera privacy settings</h2>
<p>Windows gates the camera behind <strong>three</strong> toggles, and the third is the one that surprises people: an app can be allowed to use the camera and still be blocked, because desktop programs do not get their own row in the list. Microsoft's own troubleshooting page names browsers such as Edge and many conferencing apps such as Teams as desktop apps that depend on this setting.</p>

<figure class="dt-gates">
<ol>
<li><strong>Camera access</strong><span>The device-wide master switch. If it is off and greyed out, an administrator has to turn it on.</span></li>
<li><strong>Let apps access your camera</strong><span>Controls Microsoft Store apps, which are listed individually below the switch.</span></li>
<li><strong>Let desktop apps access your camera</strong><span>Controls everything else — typically Chrome, Edge, Teams and the standard Zoom installer — all at once. There is no per-app row.</span></li>
</ol>
<figcaption>The three gates, from the outside in. A camera must pass the ones that apply to your app. (Diagram, not a screenshot.)</figcaption>
</figure>

<ol>
<li>Open <strong>Start → Settings → Privacy &amp; security → Camera</strong>.</li>
<li>Set <strong>Camera access</strong> to On.</li>
<li>Set <strong>Let apps access your camera</strong> to On.</li>
<li>Set <strong>Let desktop apps access your camera</strong> to On.</li>
<li>Close and reopen the app you were testing. Most apps read this permission once at launch and never look again.</li>
</ol>
<p>That is the whole of Fix 2 when the built-in Camera app works but Zoom, Teams, or Chrome does not: the desktop-apps toggle is off, and nothing inside the failing app will change that. The <a href="/test/permission-diagnostics">Permission Diagnostics check</a> reads the permission states your browser reports for this site without asking for any — if it says the camera is granted but the <a href="/test/webcam-test">Webcam Test</a> still shows nothing, the block sits below the browser: the Windows toggles, another app, antivirus, or the driver.</p>
<p><strong>On a managed work or school device</strong> you may see "Some settings are managed by your organization." Those toggles are set by policy, so the route is your IT department, not the Settings app.</p>

<h2 id="fix3">Fix 3 — camera permissions on macOS</h2>
<p>macOS asks for camera access <strong>per application</strong>, and it does not ask in advance: an app that has never requested the camera stays out of the list until it tries. That is why the list you see depends entirely on which apps you have launched. Apple's own apps such as FaceTime and Photo Booth do not need permission, which is what makes Photo Booth a clean test camera.</p>
<ol>
<li>Open <strong>Apple menu → System Settings → Privacy &amp; Security → Camera</strong>.</li>
<li>Turn on the toggle for every app you take calls in — Zoom, Teams, Chrome, and Safari each keep a separate entry.</li>
<li>Restart the app after changing a toggle; macOS re-reads permissions when the process starts.</li>
</ol>
<p><strong>If an app is missing from the list,</strong> make it ask: quit completely with <strong>Cmd+Q</strong> (closing the window is not quitting), reopen it, trigger the camera, and approve the prompt. Declining once is remembered — the app then appears with its toggle off, which is the state to change.</p>
<p><strong>Also check Screen Time:</strong> System Settings → Screen Time → Content &amp; Privacy can enforce camera restrictions across every app at once — worth a look on family or managed Macs.</p>

<h3>If the camera fails in every Mac app at once</h3>
<ul>
<li><strong>Restart the camera service (older macOS on Intel Macs):</strong> open Terminal and run <code>sudo killall VDCAssistant</code>, then reopen your app. This command belongs to older macOS versions — on current releases there is no user-facing camera daemon to kill, and a full restart of the Mac performs the same reset.</li>
<li><strong>Test in Safe Mode</strong> (hold Shift while starting an Intel Mac; hold the power button and choose Safe Mode on Apple silicon). A camera that works in Safe Mode but not normally is being blocked by third-party software.</li>
<li><strong>Camera vanished right after a macOS update?</strong> Some users report the built-in camera disappearing from System Information after upgrading. A full restart restores it in many cases; if not, check for a follow-up macOS point update, and use an iPhone via <strong>Continuity Camera</strong> as a temporary workaround while you wait for the patch.</li>
</ul>
<p>There is no per-device camera driver to reinstall on a Mac — cameras are driven by the operating system, so skip anything that resembles <a href="#fix8">Fix 8</a>.</p>

<h2 id="fix4">Fix 4 — close the other apps holding the camera</h2>
<p>A camera is a <strong>single-user device</strong>: Windows and macOS allow one application at a time to open the capture stream, so the second app gets a black frame, a frozen frame, or nothing — while the first looks perfectly healthy. That makes this the cheapest diagnosis in the article: if the camera works in one app but not another, the hardware is not dead, it is reserved.</p>
<ul>
<li><strong>Windows:</strong> press <strong>Ctrl + Shift + Esc</strong>, open Task Manager, and end Zoom, Teams, Discord, Skype, OBS Studio, and any Camera helper process. Check the system tray too — apps hiding there still count as running.</li>
<li><strong>macOS:</strong> open Activity Monitor and quit the same apps. Check the Dock and menu bar — closing a window is not quitting.</li>
<li><strong>Close browser tabs</strong> left on a call; some browsers keep the capture stream open in a tab that never navigated away.</li>
<li><strong>Remove virtual cameras outright.</strong> OBS Virtual Camera, ManyCam, and XSplit sit in the same device list and can occupy the default slot — which is exactly what makes an app show a blank feed while believing it is using your webcam. If you do not use them, uninstall them; if you do, disable them in Device Manager when not needed.</li>
</ul>
<p>Re-test after each one. The <a href="/test/webcam-test">Webcam Test</a> shows the picture the moment the lock is gone, which turns a guess into an observation.</p>
<p>If the microphone is silent in the same call while the video is fine, that is a separate fault — the <a href="/guides/microphone-not-working">microphone troubleshooting guide</a> starts there.</p>

<h2 id="fix5">Fix 5 — test the camera outside the app that is failing</h2>
<p>Testing in a second place costs a minute and splits the problem in half. The built-in Camera app (Windows) and Photo Booth (Mac) open the camera directly, with no app settings and no site permission in the way — anything they show is coming from the operating-system layer.</p>
<ol>
<li>Open the <strong>Camera app</strong> (Start → Camera) or <strong>Photo Booth</strong>.</li>
<li>Open the <a href="/test/webcam-test">Webcam Test</a> in the same browser and compare — its camera picker lists every camera the browser can see, including virtual ones that often take the default slot. The test runs in your browser and the video is not uploaded (see the <a href="/privacy">privacy policy</a>).</li>
<li>Note which of the two worked. That one answer decides which half of this article you need.</li>
</ol>
<p>Compare your result with the <a href="#symptom-map">symptom map</a> above — it translates each outcome into the fix to start with.</p>

<h2 id="fix6">Fix 6 — browser site permissions (Chrome, Edge, Firefox, Safari)</h2>
<p>Every browser keeps its <strong>own</strong> per-site permission and its own default camera. Allowing the camera in the Windows Camera app says nothing about Chrome, and a permission granted to Chrome says nothing about Firefox. The control lives beside the address bar — a site blocked once stays blocked until you change it there.</p>
<ol>
<li><strong>Chrome and Edge:</strong> click the padlock or tune icon left of the address bar → Site settings → set <strong>Camera</strong> to <strong>Allow</strong> → reload. Chrome also keeps a global list at Settings → Privacy and security → Site settings → Camera; check the blocked list if the per-site control changes nothing.</li>
<li><strong>Firefox:</strong> open the padlock → More information → Permissions → set <strong>Use the Camera</strong> to Allow.</li>
<li><strong>Safari:</strong> Safari → Settings → Websites → Camera → set the site to Allow.</li>
</ol>
<p>Chrome's global camera page (<code>chrome://settings/content/camera</code>) looks like this. Check the default camera in the dropdown at the top, and the "Not allowed to use your camera" list at the bottom:</p>
<p><img src="/uploads/chrome-camera-site-settings.webp" alt="Chrome Settings, Privacy and security, Site settings, Camera: default camera dropdown, 'Sites can ask to use your camera' selected, and an empty 'Not allowed to use your camera' list" width="1303" height="761" loading="lazy"></p>
<p>The <a href="/test/permission-diagnostics">Permission Diagnostics check</a> shows the state your browser reports for this site — granted, denied, still prompting, or not readable — before you go hunting through menus. It never asks for a permission itself.</p>
<p><strong>Google Meet black screen with permission granted?</strong> Users report a recurring conflict with browser hardware acceleration. In Chrome/Edge: Settings → System → turn off <strong>"Use graphics acceleration when available"</strong> → relaunch the browser, then re-test.</p>

<h2 id="fix7">Fix 7 — check whether Windows detects the camera</h2>
<p>Device Manager answers a question nothing else can: <strong>is Windows enumerating this camera right now?</strong> It also reports a fault message in the device's Properties — far more specific than anything a conferencing app will tell you.</p>
<ol>
<li>Open <strong>Start → Device Manager</strong>.</li>
<li>Expand <strong>Cameras</strong>, and also look under <strong>Imaging devices</strong>, <strong>Sound, video and game controllers</strong> and <strong>Universal Serial Bus controllers</strong> — a camera can appear there when it has not loaded its own driver. If the camera is listed but disabled, right-click it → <strong>Enable device</strong>.</li>
<li>Check <strong>Unknown devices</strong> — a camera whose driver failed to install frequently lands there.</li>
<li>Choose <strong>Action → Scan for hardware changes</strong>. Windows rescans and may reinstall a missing driver on its own.</li>
<li>Click <strong>View → Show hidden devices</strong>. Cameras that drop out of the system sometimes linger here, greyed out — a useful clue that Windows saw the camera before and lost it.</li>
<li>If the camera is listed, right-click it → <strong>Properties</strong> → read the status on the General tab and write the code down (see <a href="#fix12">Fix 12</a>).</li>
<li>If it is <strong>not listed at all</strong>, skip to <a href="#fix1">Fix 1</a> and <a href="#fix9">Fix 9</a>. A device the system cannot enumerate has not reached the driver stage, and updating a driver for a camera Windows does not know about does nothing.</li>
</ol>

<h2 id="fix8">Fix 8 — update, roll back, or reinstall the camera driver</h2>
<p>A driver that has lost track of the camera produces exactly the symptoms above, and it is the first suspect when the fault began after a Windows update or a new install — camera drivers are among the most commonly replaced by an update that was meant to fix something else.</p>
<p><strong>Free first try (Windows 11):</strong> run Microsoft's camera troubleshooter — Settings → System → Troubleshoot → Other troubleshooters → Camera → Run.</p>
<ol>
<li><strong>Update:</strong> right-click the camera in Device Manager → Update driver → Search automatically for drivers.</li>
<li><strong>Roll back</strong> (if the problem started right after an update): Properties → Driver tab → <strong>Roll Back Driver</strong>. It restores the previous version and is fully reversible. Some drivers do not offer this button — then move to the next step.</li>
<li><strong>Reinstall:</strong> Properties → Driver tab → Uninstall Device, tick "Attempt to remove the driver for this device", then Action → Scan for hardware changes and restart Windows.</li>
<li><strong>Switch to the generic UVC driver:</strong> Update driver → Browse my computer → Let me pick from a list → <strong>USB Video Device</strong>. Microsoft documents this route for external USB webcams before any manufacturer download. One trade-off: the generic driver may lack extras such as Windows Hello face sign-in.</li>
<li><strong>Manufacturer driver last:</strong> if the maker publishes a Windows 11 driver for your exact model, install it last — it usually carries settings the generic driver lacks.</li>
</ol>
<p><strong>Older external webcams (e.g., Logitech C920/C270 era):</strong> their bundled software dates back years and clashes with current Windows 11 builds. Uninstall the bundled driver suite in Device Manager (tick "Attempt to remove the driver"), unplug, reboot, and let Windows install its native USB Video Device driver.</p>
<p><strong>If the breakage coincides with a specific Windows update, remove the update itself:</strong> Settings → Windows Update → Update history → Uninstall updates → remove the most recent one → restart → re-test. This often beats any driver manoeuvre.</p>
<p><strong>Also restart the camera service:</strong> press Win + R, type <code>services.msc</code>, find <strong>Windows Camera Frame Server</strong>, choose Restart. A hung frame server takes the camera down in every app at once while leaving the driver looking healthy.</p>
<p><em>Never use a third-party "driver updater" utility. They exist to install drivers nobody asked for, and a camera driver is exactly the component they get wrong. On macOS there is no equivalent step — see <a href="#fix3">Fix 3</a>.</em></p>

<h2 id="fix9">Fix 9 — BIOS/UEFI and manufacturer firmware</h2>
<p>Some laptops can switch the camera off <strong>below Windows entirely</strong>, in the firmware setup screen. It is not common, but it is the one thing that explains a camera missing from Device Manager no matter what you change in Windows.</p>
<ol>
<li>Restart and press the firmware key repeatedly as the machine powers on: <strong>F2</strong> (Dell, most others), <strong>F1</strong> (ThinkPad), <strong>F10</strong> (HP), <strong>Delete</strong> (desktops), or <strong>Esc</strong>.</li>
<li>Look for a <strong>Camera</strong> or <strong>Integrated Camera</strong> entry. Common locations:
<ul>
<li><strong>Dell:</strong> System Configuration → Miscellaneous Devices</li>
<li><strong>Lenovo ThinkPad:</strong> Security → I/O Port Access → Integrated Camera</li>
<li><strong>HP business laptops:</strong> Advanced → Built-in Device Options</li>
</ul></li>
<li>Set it to <strong>Enabled</strong>, save, exit, and check Device Manager again.</li>
<li>On the manufacturer's support page, enter your <strong>exact model number</strong> and read the release notes of any BIOS/firmware update that mentions camera, webcam, or microphone. Model-specific camera faults — including integrated cameras that the motherboard stops recognising entirely — are frequently fixed there.</li>
</ol>
<p>Menu names vary by model and BIOS version; if nothing matches, search the maker's manual for "camera" rather than guessing. On business laptops the camera can also be disabled by device-management policy — that route leads to your IT department.</p>

<h2 id="fix10">Fix 10 — a black screen with the LED on</h2>
<p>An illuminated indicator means the camera is <strong>powered and in use</strong>. It says nothing about whether the lens is uncovered — a closed shutter over a live sensor looks identical from the outside, and Windows lights the indicator whenever the camera is active, even when nothing reaches the screen.</p>
<p>Work this list in order — each item is cheaper than the next:</p>
<ol>
<li>The privacy shutter is closed (<a href="#fix1">Fix 1</a>).</li>
<li>Another app has the camera open (<a href="#fix4">Fix 4</a>).</li>
<li>The app selected a different device — OBS Virtual Camera, a second webcam, or an unpaired Bluetooth camera all appear in the same list, and a virtual camera driver can also intercept the stream (<a href="#fix11">Fix 11</a>, <a href="#fix4">Fix 4</a>).</li>
<li>The browser or the OS is blocking access (<a href="#fix2">Fix 2</a>, <a href="#fix3">Fix 3</a>, <a href="#fix6">Fix 6</a>).</li>
<li>The driver loads but delivers no frames (<a href="#fix8">Fix 8</a>).</li>
</ol>
<p>The <a href="/test/webcam-test">Webcam Test</a> separates the first cases cleanly: a stream that never starts points at a physical block or a permission; a stream that starts and shows black points at device selection. If the Camera app shows a picture but your meeting app does not, the camera is fine — the fault is the selected device or a permission.</p>

<h2 id="fix11">Fix 11 — Zoom, Microsoft Teams, and Google Meet</h2>
<p>Each conferencing app keeps its <strong>own</strong> camera selection, independent of the system default and of every other app. A stale entry for a webcam you unplugged months ago tends to stay selected long after the hardware is gone.</p>

<h3>Zoom</h3>
<ul>
<li>Click your profile picture → Settings → <strong>Video &amp; effects</strong> (older versions call the tab "Video") and choose the camera from the dropdown; the preview shows what Zoom is receiving. In a meeting, click the arrow next to the Video button → Video settings. Close competing apps first, so the list reflects what is actually free.</li>
<li><strong>macOS black-screen trick (community-reported):</strong> leave Zoom open, launch Photo Booth to force the camera to initialise, then switch back to Zoom. Users report this wakes a camera that Zoom failed to grab on recent macOS versions. It costs twenty seconds and is safe to try.</li>
</ul>

<h3>Microsoft Teams</h3>
<ul>
<li>Settings → Devices → pick the camera → <strong>restart Teams</strong>. Teams reads the device list at launch and caches it.</li>
<li><strong>Persistent black screen or detection failure?</strong> On Windows, reset the app: sign out and quit Teams, then Settings → Apps → Installed apps → Microsoft Teams → Advanced options → <strong>Repair</strong>, then <strong>Reset</strong>. On Mac, the clean equivalent is to quit Teams, delete the app, and reinstall it fresh. (Classic Teams has been retired — if you are somehow still on it, updating Teams is itself the fix.)</li>
</ul>

<h3>Google Meet</h3>
<ul>
<li>The ⋮ menu → Settings → Video → choose the camera. Watch for the browser permission prompt at the top of the page — Meet asks for the camera as well as the microphone.</li>
<li>If video stays black despite a granted permission, try the hardware-acceleration toggle in <a href="#fix6">Fix 6</a>, and make sure OBS or another app is not holding the camera (<a href="#fix4">Fix 4</a>).</li>
</ul>

<p><strong>If the camera dropdown inside the app is empty,</strong> that app cannot enumerate any camera — an empty list is a permission problem (<a href="#fix2">Fix 2</a> or <a href="#fix3">Fix 3</a>), not a broken camera. And the classic signature test still holds: video working in the built-in Camera app but failing inside the meeting app points here, not at hardware.</p>

<h2 id="fix12">Fix 12 — error codes: 0xA00F4244, 0xA00F4243, 0x80070005 and others</h2>
<p>Windows reports camera failures as codes, not sentences. The two most common describe very different problems, and reading the meaning is faster than trying every fix in order.</p>

<h3>0xA00F4244 — NoCamerasAreAttached</h3>
<p>Windows found no camera to hand to the app. Work <a href="#fix1">Fix 1</a> (shutter, switch, USB), <a href="#fix2">Fix 2</a> (privacy toggles), <a href="#fix7">Fix 7</a> (is the device enumerated at all — including hidden devices), and only then <a href="#fix8">Fix 8</a> (driver) and <a href="#fix9">Fix 9</a> (firmware). Note that a closed privacy shutter or a disconnected USB plug produces exactly this code — it does not prove a driver fault.</p>

<h3>0xA00F4243 (also 0xA00F4289) — camera in use by another app</h3>
<p>The camera exists and works; something else has it. Close Zoom, Teams, OBS, Discord, and leftover call tabs, then retry (<a href="#fix4">Fix 4</a>). There is no driver fix for this one.</p>

<h3>0x80070005 — access denied</h3>
<p>A permission block, not a detection problem: check <a href="#fix2">Fix 2</a> (Windows camera privacy toggles), then <a href="#fix13">Fix 13</a> (antivirus webcam protection).</p>

<h3>Other codes in Microsoft's camera troubleshooting list</h3>
<ul>
<li><strong>0xA00F4246</strong> — camera locked by security software: see <a href="#fix13">Fix 13</a>.</li>
<li><strong>0xA00F4292</strong> — camera access restricted by policy: on a work or school device, ask your administrator (see the note in <a href="#fix2">Fix 2</a>).</li>
<li><strong>0x800705AA</strong> — insufficient system resources: close unnecessary apps, restart, then update the driver (<a href="#fix8">Fix 8</a>).</li>
</ul>

<p>None of these codes names a failed part. They say where in the chain the attempt stopped — which is why one points at the top of this article and another at the middle.</p>

<h2 id="fix13">Fix 13 — antivirus and webcam protection</h2>
<p>Several security suites ship a <strong>webcam protection</strong> feature that prompts before an app may use the camera — and some block silently. It sits above the operating-system permission, so a camera blocked here fails everywhere at once: Camera app, Photo Booth, and every meeting app, with no message explaining why. Windows may report it as error 0xA00F4246. That is worth knowing precisely because the symptom looks identical to a privacy setting that is off — and the two need opposite fixes.</p>
<ol>
<li>Find the webcam, camera, or privacy protection section in your security product — Norton, McAfee, Bitdefender, Kaspersky, ESET, or Windows Security itself.</li>
<li>Look for the app on a blocked list or an ask-before-use list, and allow it.</li>
<li>Re-test. If it works, <strong>leave the protection switched on</strong> — allowlisting one app solves the problem without disabling the feature.</li>
</ol>
<p>Microsoft's own guide suggests pausing security software briefly as a test. If you do, re-enable it immediately after: a camera test is never a reason to run unprotected.</p>

<h2 id="fix14">Fix 14 — when it is probably a hardware problem</h2>
<p>A camera that appears in no app, is missing from Device Manager after several restarts, and still fails on a second computer is a camera fault. At that point more settings will not help; the honest move is to stop testing and start a warranty claim or a replacement.</p>
<p><strong>The decisive test is a swap:</strong> put a known-working camera into this computer, or this camera into another one. If the fault follows the camera, it is the camera. If it stays behind, it is the computer.</p>
<p>One caution: a camera that works on one machine and not another is evidence, not a verdict — pairing state, per-app device selection, and heat-related faults all produce the same reading. What a swap reliably establishes is where to stop looking.</p>
<p>Signs that point at hardware:</p>
<ul>
<li>Missing from every app and from Device Manager, after a restart.</li>
<li>No response on any port, or a response that stops when the cable moves.</li>
<li>Visible damage to the cable, connector, or hinge on a built-in camera.</li>
<li>Still fails when connected to a second computer.</li>
</ul>
<p>If the camera works but the picture was always grainy or dark, the <a href="/guides/webcams-for-low-light-calls">buying guide for webcams in low-light calls</a> covers which sensor and exposure specifications actually help. And a known-good USB camera in a drawer is the cheapest insurance against a critical meeting — this failure is usually sudden.</p>

<h2 id="chromeos">ChromeOS: the short path</h2>
<p>Chromebooks skip most of the list above:</p>
<ol>
<li>Open the built-in <strong>Camera</strong> app. If it works, the fault is a site permission — click the padlock in Chrome's address bar and allow the camera (<a href="#fix6">Fix 6</a>).</li>
<li>Check <strong>Settings → Privacy and security → Site settings → Camera</strong> for blocked sites.</li>
<li>Restart the device — a full restart, not closing the lid.</li>
<li>Still failing everywhere? Run <strong>Settings → About ChromeOS → Diagnostics</strong> to test the hardware. On a school device, camera access is often policy-controlled — contact the administrator.</li>
</ol>

<h2 id="decision-tree">The decision tree, in one place</h2>
<p>The whole article in five questions — follow the branch that matches what you see:</p>
<ol>
<li><strong>Does the camera appear in Device Manager / System Information?</strong> If not: <a href="#fix1">Fix 1</a> → <a href="#fix7">Fix 7</a> → <a href="#fix9">Fix 9</a> → <a href="#fix14">Fix 14</a>. If yes, keep reading.</li>
<li><strong>Does it work in the built-in Camera app / Photo Booth?</strong> If yes, the fault is a permission or an app setting: <a href="#fix2">Fix 2</a>, <a href="#fix3">Fix 3</a>, <a href="#fix6">Fix 6</a>, <a href="#fix11">Fix 11</a>. If no: <a href="#fix8">Fix 8</a> and <a href="#fix10">Fix 10</a>.</li>
<li><strong>Does it work in one app but not another?</strong> Then it is a reservation or a device-selection problem: <a href="#fix4">Fix 4</a> and <a href="#fix11">Fix 11</a>.</li>
<li><strong>Is there an error code?</strong> Read it in <a href="#fix12">Fix 12</a> before trying anything else — the two common codes point at opposite ends of this article.</li>
<li><strong>Does it fail in every app, including the built-in one?</strong> Run <a href="#fix13">Fix 13</a> first — an antivirus block hides everywhere and looks exactly like a permission problem.</li>
</ol>
<p>Each branch narrows where to look; none names a failed part. If you would rather run the checks than read about them, the <a href="/inspection?suite=pre_call">Pre-Call Readiness check</a> in Guided Inspection runs microphone, webcam and speaker tests in about three minutes and builds one printable report. Results stay in your browser's local storage.</p>

<h2 id="prevent">How to keep it from coming back</h2>
<ul>
<li>Keep the camera driver and the machine's firmware current through Windows Update, macOS updates, or the manufacturer's support page — and re-check <a href="#fix2">Fix 2</a> after every major OS update, because the camera permission list is occasionally rewritten by one.</li>
<li>Avoid third-party driver updater utilities.</li>
<li>Keep a known-good USB camera within reach if you take meetings that matter. This failure is usually sudden, and usually minutes before a call.</li>
<li>Leave antivirus webcam protection enabled; allow the one app you need instead.</li>
<li>After an OS upgrade, run the <a href="/test/webcam-test">Webcam Test</a> once. A camera that has worked for years is the thing most likely to have been changed underneath you — and thirty seconds confirms it.</li>
</ul>

<h2 id="faq">Frequently asked questions</h2>

<h3>Why is my webcam light on but the screen is black?</h3>
<p>The LED means the camera is powered and in use — not that an image is getting through. The usual causes, in order: a closed privacy shutter, another app holding the camera, the app selecting a different device (like OBS Virtual Camera), or a permission block in the operating system, browser or antivirus. Work through <a href="#fix10">Fix 10</a>.</p>

<h3>How do I fix error 0xA00F4244 (NoCamerasAreAttached)?</h3>
<p>Error 0xA00F4244 means Windows currently finds no available camera. Check the physical privacy shutter or camera key and the USB connection first, then the Windows camera privacy toggles, then look for the camera in Device Manager (including hidden devices). Only then move to the driver (<a href="#fix8">Fix 8</a>) and firmware (<a href="#fix9">Fix 9</a>). The full sequence is in <a href="#fix12">Fix 12</a>.</p>

<h3>Why does my webcam work in the Camera app but not in Zoom?</h3>
<p>If the built-in Camera app shows a picture, the hardware and driver are fine. The cause is almost always one of three: Zoom has the wrong camera selected (Settings → Video &amp; effects), the Windows "Let desktop apps access your camera" toggle is off, or another app or virtual camera is holding the device. See <a href="#fix11">Fix 11</a>.</p>

<h3>Can antivirus software block my webcam?</h3>
<p>Yes. Security products such as Norton, McAfee, Bitdefender, and Kaspersky include webcam protection that can block apps silently, so the camera fails in every app at once. Open the security product's webcam or privacy protection section and allow the app you need instead of disabling the feature. Details in <a href="#fix13">Fix 13</a>.</p>

<h3>My camera disappeared after a macOS update. What now?</h3>
<p>Restart the Mac fully first, then check System Information → Hardware → Camera to see whether the system still detects the camera. If it is still missing, test in Safe Mode and install any follow-up macOS update (<a href="#fix3">Fix 3</a>). As a temporary workaround, an iPhone works as a webcam through Continuity Camera.</p>

<h2 id="sources">Sources and further reading</h2>
<ul>
<li><a href="https://support.microsoft.com/en-us/windows/hardware/camera/camera-doesn-t-work-in-windows">Microsoft Support — Camera doesn't work in Windows</a> (error codes, shutter/switch guidance, the three privacy toggles, driver and UVC routes)</li>
<li><a href="https://support.apple.com/guide/mac-help/control-access-to-your-camera-mchlf6d108da/mac">Apple Mac User Guide — Control access to the camera on Mac</a> (per-app camera access)</li>
<li><a href="https://support.google.com/chrome/answer/2693767">Google Chrome Help — Use your camera and microphone in Chrome</a> (site permissions and default camera)</li>
<li><a href="https://support.zoom.com/hc/en/article?id=zm_kb&amp;sysparm_article=KB0061836">Zoom Support — Testing your video</a> (camera selection and preview)</li>
</ul>
<p><em>Community-reported workarounds in this guide (the Zoom/Photo Booth camera wake-up, browser hardware acceleration for Meet) reflect current user reports rather than vendor documentation; they are safe to try and cost seconds.</em></p>
`,
  faqs: [
    {
      q: 'Why is my webcam light on but the screen is black?',
      a: 'The LED means the camera is powered and in use, not that an image is getting through. The usual causes, in order: a closed privacy shutter, another app holding the camera, the app selecting a different device (like OBS Virtual Camera), or a permission block in the operating system, browser or antivirus.',
    },
    {
      q: 'How do I fix error 0xA00F4244 (NoCamerasAreAttached)?',
      a: 'Error 0xA00F4244 means Windows currently finds no available camera. Check the physical privacy shutter or camera key and the USB connection first, then the Windows camera privacy toggles, then look for the camera in Device Manager (including hidden devices). Only then move to the driver and firmware (BIOS/UEFI).',
    },
    {
      q: 'Why does my webcam work in the Camera app but not in Zoom?',
      a: "If the built-in Camera app shows a picture, the hardware and driver are fine. The cause is almost always one of three: Zoom has the wrong camera selected (Settings > Video & effects), the Windows 'Let desktop apps access your camera' toggle is off, or another app or virtual camera is holding the device.",
    },
    {
      q: 'Can antivirus software block my webcam?',
      a: 'Yes. Security products such as Norton, McAfee, Bitdefender and Kaspersky include webcam protection that can block apps silently, so the camera fails in every app at once. Open the security product\'s webcam or privacy protection section and allow the app you need instead of disabling the feature.',
    },
    {
      q: 'My camera disappeared after a macOS update. What now?',
      a: 'Restart the Mac fully first, then check System Information > Hardware > Camera to see whether the system still detects the camera. If it is still missing, test in Safe Mode and install any follow-up macOS update. As a temporary workaround, an iPhone works as a webcam through Continuity Camera.',
    },
  ],
};