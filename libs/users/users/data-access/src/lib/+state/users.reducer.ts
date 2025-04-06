import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on, Action } from '@ngrx/store';

import * as UsersActions from './users.actions';
import { UsersEntity } from '@users/core/data-access';
import { LoadingStatus } from '@users/core/data-access';
import { TimersState } from '../models/timer.model';

export const USERS_FEATURE_KEY = 'users';

export type UsersErrors = {
  status: number;
  [key: string]: unknown;
};

export interface UsersState extends EntityState<UsersEntity> {
  selectedId?: string | number; // which Users record has been selected
  status: LoadingStatus;
  error: UsersErrors | null;
  timers: TimersState;
}

export interface UsersPartialState {
  readonly [USERS_FEATURE_KEY]: UsersState;
}

export const usersAdapter: EntityAdapter<UsersEntity> = createEntityAdapter<UsersEntity>();

export const initialUsersState: UsersState = usersAdapter.getInitialState({
  // set initial required properties
  status: 'init',
  error: null,
  timers: {},
});

function persistTimersState(state: UsersState): UsersState {
  const safeTimersState = Object.fromEntries(
    Object.entries(state.timers).map(([userId, timer]) => [
      userId,
      {
        accumulatedTime: timer.accumulatedTime || 0,
        isRunning: timer.isRunning || false,
        startTimestamp: timer.startTimestamp || undefined
      },
    ])
  );
  console.log('Сохраняю состояние таймеров в localStorage:', safeTimersState);

  localStorage.setItem('timers_state', JSON.stringify(safeTimersState));
  return state;
}

const reducer = createReducer(
  initialUsersState,
  on(UsersActions.initUsers, (state) => ({
    ...state,
    status: 'loading' as const,
  })),
  on(UsersActions.loadUsersSuccess, (state, { users }) =>
    usersAdapter.setAll(users, { ...state, status: 'loaded' as const })
  ),
  on(UsersActions.loadUsersFailure, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),
  on(UsersActions.deleteUserSuccess, (state, { id }) => usersAdapter.removeOne(id, { ...state })),
  on(UsersActions.addUserSuccess, (state, { userData }) => usersAdapter.addOne({ ...userData }, { ...state })),
  on(UsersActions.editUserSuccess, (state, { userData }) =>
    usersAdapter.updateOne(
      {
        id: userData.id,
        changes: userData,
      },
      state
    )
  ),
  on(UsersActions.editUserFailed, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),
  on(UsersActions.loadUser, (state) => ({
    ...state,
    status: 'loading' as const,
  })),
  on(UsersActions.loadUserSuccess, (state, { userData }) =>
    usersAdapter.addOne({ ...userData }, { ...state, status: 'loaded' as const })
  ),
  on(UsersActions.loadUserFailed, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),
  on(UsersActions.updateUserStatus, (state, { status }) => ({
    ...state,
    status,
  })),
  on(UsersActions.initializeTimer, (state, { userId, state: timerState }) =>
    persistTimersState({
      ...state,
      timers: { ...state.timers, [userId]: timerState },
    })
  ),

  on(UsersActions.startTimer, (state, { userId }) => {
    const currentTimerState = state.timers[userId] || { accumulatedTime: 0 };

    return persistTimersState({
      ...state,
      timers: {
        ...state.timers,
        [userId]: {
          accumulatedTime: currentTimerState.accumulatedTime || 0,
          startTimestamp: Date.now(),
          isRunning: true,
        },
      },
    });
  }),

  on(UsersActions.stopTimer, (state, { userId }) => {
    const timer = state.timers[userId];
    const elapsedTime = timer.startTimestamp ? Date.now() - timer.startTimestamp : 0;

    return persistTimersState({
      ...state,
      timers: {
        ...state.timers,
        [userId]: {
          ...timer,
          accumulatedTime: timer.accumulatedTime + elapsedTime,
          startTimestamp: undefined,
          isRunning: false,
        },
      },
    });
  }),

  on(UsersActions.resetTimer, (state, { userId }) =>
    persistTimersState({
      ...state,
      timers: {
        ...state.timers,
        [userId]: { accumulatedTime: 0, startTimestamp: undefined, isRunning: false },
      },
    })
  ),

  on(UsersActions.updateTimer, (state, { userId, state: timerState }) => {
    const currentTimer = state.timers[userId] || {};

    return persistTimersState({
      ...state,
      timers: {
        ...state.timers,
        [userId]: {
          ...timerState,
          // Используем isRunning из текущего состояния, а не из параметра
          // isRunning: currentTimer.isRunning || false
        }
      },
    });
  })

);

export function usersReducer(state: UsersState | undefined, action: Action) {
  return reducer(state, action);
}
