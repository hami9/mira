export type Weekday = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export const WEEKDAYS: Weekday[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

export interface BusinessHoursDay {
  enabled: boolean;
  start: string; // "HH:mm" به وقت تهران
  end: string; // "HH:mm" به وقت تهران
}

export interface BusinessHours {
  days: Record<Weekday, BusinessHoursDay>;
}

export interface TriggerMessageConfig {
  enabled: boolean;
  delaySeconds: number;
  text: string;
}
