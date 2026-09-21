import type { ComponentType } from 'react';
import { Mic, Keyboard, Monitor, Wifi, Wrench } from 'lucide-react';
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
    key: 'audio-video',
    label: 'Audio & Video',
    description: 'Microphone, webcam, speakers, recorder, and tone tools.',
    icon: Mic,
    illustration: 'microphone',
    chip: 'bg-teal-500/10 text-[#0F766E] dark:text-[#14B8A6]',
    tile: 'group-hover:bg-teal-500/10',
  },
  {
    key: 'input-devices',
    label: 'Input & Gaming',
    description: 'Keyboards, mice, gamepads, touchscreens, and reaction tests.',
    icon: Keyboard,
    illustration: 'keyboard',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    tile: 'group-hover:bg-violet-500/10',
  },
  {
    key: 'display',
    label: 'Display & Screen',
    description: 'Screen testing, dead pixels, patterns, and refresh timing.',
    icon: Monitor,
    illustration: 'monitor',
    chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    tile: 'group-hover:bg-blue-500/10',
  },
  {
    key: 'network',
    label: 'Network',
    description: 'Internet speed and connection diagnostics.',
    icon: Wifi,
    illustration: 'gauge',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    tile: 'group-hover:bg-sky-500/10',
  },
  {
    key: 'supporting',
    label: 'Supporting Diagnostics',
    description: 'Browser, permission, and privacy diagnostics linked from help contexts.',
    icon: Wrench,
    illustration: 'gauge',
    chip: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
    tile: 'group-hover:bg-slate-500/10',
  },
];
