export type OutgoingEventData = Record<string, unknown> & {
  pillar?: number;
  type?: string;
};
