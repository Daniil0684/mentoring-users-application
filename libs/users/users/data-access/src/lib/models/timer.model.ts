export type TimerState = {
  startTimestamp?: number; // Unix Timestamp (milliseconds)
  accumulatedTime: number; // milliseconds
  isRunning: boolean;
};

export type TimersState = Record<number, TimerState>;
