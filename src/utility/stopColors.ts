// File: src/utils/stopColors.ts
// Color mappings for different stop types

import type { StopType } from '../types/itinerary';

export interface StopColors {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export const stopTypeColors: Record<StopType, StopColors> = {
  pickup: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    dot: 'bg-blue-500'
  },
  dropoff: {
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
    dot: 'bg-purple-500'
  },
  destination: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500'
  },
  activity: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    dot: 'bg-orange-500'
  },
  meal_break: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    dot: 'bg-amber-500'
  },
  rest_stop: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
    text: 'text-cyan-700',
    dot: 'bg-cyan-500'
  },
  transit: {
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-700',
    dot: 'bg-slate-500'
  },
  checkpoint: {
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    text: 'text-pink-700',
    dot: 'bg-pink-500'
  },
  accommodation: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500'
  }
};

export const getStopColors = (stopType: StopType): StopColors => {
  return stopTypeColors[stopType] || stopTypeColors.activity;
};