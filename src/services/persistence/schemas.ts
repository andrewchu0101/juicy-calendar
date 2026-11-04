import { z } from 'zod';
import { EVENT_MAX_MINUTES } from '../../features/calendar/engine/limits';
import { validateTitle } from '../../features/calendar/engine/mutations';
import type { Settings } from '../../types';

export const SCHEMA_VERSION = 2;

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const validName = (name: string) => validateTitle(name) !== null;
const NAME_MESSAGE = 'name is empty or too long';
const isoInstant = z.iso.datetime({ offset: true });

export const workspaceSchema = z.object({
  schemaVersion: z.number().int().positive(),
  name: z.string(),
  createdAt: isoInstant,
});

export const templateSchema = z.object({
  id: safeId,
  name: z.string().refine(validName, { message: NAME_MESSAGE }),
  color: hexColor,
  defaultDuration: z.number().positive(),
  order: z.number(),
});

export const eventSchema = z
  .object({
    id: safeId,
    templateId: z.string(),
    title: z.string().refine(validName, { message: NAME_MESSAGE }),
    startAt: isoInstant,
    endAt: isoInstant,
    color: hexColor,
  })
  .refine((event) => new Date(event.endAt) > new Date(event.startAt), {
    message: 'endAt must be after startAt',
  })
  .refine((event) => new Date(event.endAt).getTime() - new Date(event.startAt).getTime() <= EVENT_MAX_MINUTES * 60_000, {
    message: 'event is longer than the maximum length',
  });

export const settingsSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(24),
  pixelsPerMinute: z.number().min(0.4).max(4),
  view: z.enum(['week', 'day']),
  inspectorCollapsed: z.boolean(),
  magnetEnabled: z.boolean().default(true),
});

export const DEFAULT_SETTINGS: Settings = {
  startHour: 8,
  endHour: 3,
  pixelsPerMinute: 1,
  view: 'week',
  inspectorCollapsed: false,
  magnetEnabled: true,
};
