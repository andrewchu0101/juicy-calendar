export type CalendarEvent = {
  id: string;
  templateId: string;
  title: string;
  startAt: string;
  endAt: string;
  color: string;
};

export type Template = {
  id: string;
  name: string;
  color: string;
  defaultDuration: number;
  order: number;
};

export type CalendarView = 'week' | 'day';

export type Settings = {
  startHour: number;
  endHour: number;
  pixelsPerMinute: number;
  view: CalendarView;
  inspectorCollapsed: boolean;
  magnetEnabled: boolean;
};

export type WorkspaceMeta = {
  schemaVersion: number;
  name: string;
  createdAt: string;
};
