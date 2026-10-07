---
title: Keyboard Keys Not Registering? Tell a Hardware Fault from a Software One
seoTitle: 'Keyboard Keys Not Registering: Hardware or Software?'
seoDescription: A key that never registers, a key that registers twice, and a key that only fails in one app are three different faults. Here is the five-minute test that separates them.
coverImage: /uploads/keyboard-hardware-or-software.png
coverImageAlt: 'The DeviceTry cover card, showing the DeviceTry wordmark above the line "Free browser-based device tests".'
publishedAt: 2026-10-06
author: DeviceTry team
category: input-gaming
status: published
tags:
  - keyboard
  - troubleshooting
canonicalUrl: null
---

A keyboard key that stops working has three possible owners: the switch under the cap, the operating system between the switch and the application, or the application itself. Almost every "my keyboard is broken" report is one of those three, and they are separated by a test you can run in five minutes — before you buy a keyboard or reinstall Windows.

## The five-minute test

Open the [Keyboard Test](/test/keyboard-test) and press the suspect key twenty times. The page listens to the browser's raw `keydown` events, so nothing is filtered through an application on the way in.

The result tells you which layer owns the fault:

| What the tester shows | What it means | Where the fault is |
| --- | --- | --- |
| Nothing, ever | The event never reaches the browser | Hardware, cable, or firmware |
| Registers, but drops roughly 1 press in 5 | Intermittent contact wear | The switch itself |
| Registers twice per press | Contact bounce | The switch itself |
| Registers perfectly here, fails in one app | The event arrives; the app discards it | Software |

> A key that fails in the tester but works in the BIOS setup screen is not a software problem — the BIOS runs before any driver loads, so it is reading the raw hardware.

### Why "it works in Notepad" is the most useful result

If a key registers in the tester and in Notepad but not in the application you actually use, you have ruled out the two expensive layers. What remains is one of the following:

1. The application's own keyboard shortcut has claimed that key.
2. An input-method editor, macro tool, or remote-desktop client is intercepting the event.
3. A screen-reader or accessibility tool is swallowing repeat presses.

### Checking whether the OS sees the key at all

Windows and macOS both expose a raw view, and it is worth comparing against the browser's:

```powershell
# Windows: list the keyboard devices the OS has bound a driver to
Get-PnpDevice -Class Keyboard | Select-Object Status, FriendlyName
```

If your keyboard appears twice, or its status is anything other than `OK`, the fault is below the browser and no amount of clearing site data will help.

#### The one hardware check worth doing by hand

Pull the key cap and look at the switch, not the board. A worn switch shows a bright contact or a deformed dome; a healthy one does not. For a laptop, gently reseating the ribbon connector behind the keyboard fixes a surprising share of "dead column" reports, where several adjacent keys fail together.

## What this test cannot tell you

The browser reports what the operating system delivered. It cannot see a key that the firmware never produced, so a pass is evidence about this machine and this browser only. If you need proof that the *hardware* is at fault, repeat the test on a second computer: a fault that follows the keyboard is the keyboard.

## When it is genuinely the software

- A key that works in a private browsing window but not a normal one: an extension is intercepting it.
- A key that works after a restart and fails again within ten minutes: a background utility is starting and claiming it.
- A key that only fails after the machine wakes from sleep: a driver's power-management bug, not a broken switch.

Run the test again after each change. A fault that moves is a configuration problem, and one that does not move is hardware.

![The article's cover artwork: the DeviceTry wordmark with the line "Free browser-based device tests".](/uploads/keyboard-hardware-or-software.png 'Figure 1. The article cover artwork, shown inline here as an example figure with its own alt text and caption.')
