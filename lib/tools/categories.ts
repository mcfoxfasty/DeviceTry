import type { ComponentType } from 'react';
import { Mic, Keyboard, Monitor, Gamepad, Music, Gauge } from 'lucide-react';
import { ToolCategory } from './types';

export interface CategoryMeta {
  key: ToolCategory;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  illustration: string;
  chip: string;
  tile: string;
}

export const CATEGORY_META: CategoryMeta[] = [
  {
    key: 'audio-camera',
    label: 'Audio & Camera',
    description: 'Microphones, webcams, speakers, and voice recorders.',
    icon: Mic,
    illustration: 'microphone',
    chip: 'bg-teal-500/10 text-[#0F766E] dark:text-[#14B8A6]',
    tile: 'group-hover:bg-teal-500/10',
  },
  {
    key: 'keyboard-mouse',
    label: 'Keyboard & Mouse',
    description: 'Key rollover, button clicks, and scroll wheels.',
    icon: Keyboard,
    illustration: 'keyboard',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    tile: 'group-hover:bg-violet-500/10',
  },
  {
    key: 'screen',
    label: 'Display & Screen',
    description: 'Dead pixels, uniformity, resolution, and FPS.',
    icon: Monitor,
    illustration: 'monitor',
    chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    tile: 'group-hover:bg-blue-500/10',
  },
  {
    key: 'mobile-controllers',
    label: 'Sensors & Controllers',
    description: 'Touchscreens, motion sensors, gamepads, and battery.',
    icon: Gamepad,
    illustration: 'gamepad',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    tile: 'group-hover:bg-amber-500/10',
  },
  {
    key: 'music',
    label: 'Acoustics & Music',
    description: 'Tuners, pitch detection, and instrument tuning.',
    icon: Music,
    illustration: 'headphones',
    chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    tile: 'group-hover:bg-rose-500/10',
  },
  {
    key: 'browser-performance',
    label: 'Browser & Performance',
    description: 'WebRTC, storage, codecs, and speed benchmarks.',
    icon: Gauge,
    illustration: 'gauge',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    tile: 'group-hover:bg-sky-500/10',
  },
];
