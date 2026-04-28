export type DbEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export type DbChangeEvent = {
  table: 'triagens' | 'appointments' | 'profiles' | 'respostas_triagem' | 'messages' | string;
  eventType: DbEventType;
  new: any | null;
  old: any | null;
  commitTimestamp?: string;
};

export type RealtimeEvents = {
  'db:change': DbChangeEvent;
  'app:resume': { timestamp: number };
  'net:online': { timestamp: number };
  'realtime:status': { connected: boolean; status?: string };
};
