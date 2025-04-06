import { Injectable, inject } from '@angular/core';
import { select, Store } from '@ngrx/store';
import * as UsersActions from './users.actions';
import * as UsersSelectors from './users.selectors';
import { interval, Observable, of, switchMap, take, takeWhile } from 'rxjs';
import { UsersErrors } from './users.reducer';
import { onSuccessEditionCbType } from './users.actions';
import { selectLoggedUser } from '@auth/data-access';
import { CreateUserDTO, UsersEntity } from '@users/core/data-access';
import { TimersState, TimerState } from '../models/timer.model';
import { selectTimerByUserId } from './users.selectors';

@Injectable({ providedIn: 'root' })
export class UsersFacade {
  private readonly store = inject(Store);

  /**
   * Combine pieces of state using createSelector,
   * and expose them as observables through the facade.
   */
  public readonly status$ = this.store.pipe(select(UsersSelectors.selectUsersStatus));
  public readonly allUsers$ = this.store.pipe(select(UsersSelectors.selectAllUsers));
  public readonly selectedUsers$ = this.store.pipe(select(UsersSelectors.selectEntity));
  public readonly openedUser$ = this.store.select(UsersSelectors.selectOpenedUser);
  public readonly loggedUser$ = this.store.select(selectLoggedUser);
  public readonly errors$: Observable<UsersErrors | null> = this.store.pipe(select(UsersSelectors.selectUsersError));
  private readonly LOCAL_STORAGE_KEY = 'timers_state';
  /**
   * Use the initialization action to perform one
   * or more tasks in your Effects.
   */
  init() {
    this.store.dispatch(UsersActions.initUsers());
  }

  deleteUser(id: number) {
    this.store.dispatch(UsersActions.deleteUser({ id }));
  }

  addUser(userData: CreateUserDTO) {
    this.store.dispatch(UsersActions.addUser({ userData }));
  }

  editUser(userData: CreateUserDTO, id: number, onSuccessCb: onSuccessEditionCbType) {
    this.store.dispatch(UsersActions.editUser({ userData, id, onSuccessCb }));
  }

  getUserFromStore(id: number) {
    return this.store.select(UsersSelectors.selectUserById(id)).pipe(
      switchMap((user: UsersEntity | undefined): Observable<UsersEntity | null> => {
        if (user) {
          return of(user);
        } else {
          return of(null);
        }
      })
    );
  }

  loadUser() {
    this.store.dispatch(UsersActions.loadUser());
  }

  // Получение таймера для конкретного пользователя
  getTimer(userId: number): Observable<TimerState | null> {
    return this.store.pipe(select(selectTimerByUserId(userId)));
  }

  // Сохранение состояния всех таймеров в LocalStorage
  private saveTimersToLocalStorage(state: TimersState) {
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(state));
  }

  // Загрузка таймеров из LocalStorage
  private loadTimersFromLocalStorage(): TimersState {
    const storedState = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    return storedState ? JSON.parse(storedState) : {};
  }

  // Инициализация таймеров из LocalStorage
  initializeTimers() {
    const timers = this.loadTimersFromLocalStorage();
    console.log('Загружены таймеры из localStorage:', timers);

    Object.entries(timers).forEach(([userId, timerState]) => {
      const timerStateObj = timerState as TimerState;
      // Сохраняем статус isRunning перед обновлением
      const wasRunning = timerStateObj.isRunning;

      // Вычисляем актуальное накопленное время, если таймер был запущен
      if (timerStateObj.isRunning && timerStateObj.startTimestamp) {
        const elapsedSinceStart = Date.now() - timerStateObj.startTimestamp;
        timerStateObj.accumulatedTime += elapsedSinceStart;
        // Обновляем startTimestamp на текущее время
        timerStateObj.startTimestamp = Date.now();
        // Сохраняем isRunning = true, чтобы таймер продолжал работать
      }

      this.store.dispatch(
        UsersActions.initializeTimer({
          userId: Number(userId),
          state: timerStateObj,
        })
      );

      // Если таймер был запущен, активируем его снова
      if (wasRunning) {
        this.startTimer(Number(userId));
      }
    });
  }

  // Инициализация таймера для конкретного пользователя
  initializeTimer(userId: number) {
    const timers = this.loadTimersFromLocalStorage();
    const existingState = timers[userId];

    if (existingState) {
      const wasRunning = existingState.isRunning || false;

      const correctedTimerState: TimerState = {
        accumulatedTime: existingState.accumulatedTime || 0,
        isRunning: wasRunning,
        startTimestamp: wasRunning ? Date.now() : undefined,
      };

      this.store.dispatch(
        UsersActions.initializeTimer({
          userId,
          state: correctedTimerState,
        })
      );

      // Если таймер был запущен, запускаем его снова
      if (wasRunning) {
        this.startTimer(userId);
      }
    }
  }

  startTimer(userId: number) {
    console.log('Вызван startTimer в фасаде для ID:', userId);

    this.getTimer(userId).pipe(take(1)).subscribe(timerState => {
      this.store.dispatch(UsersActions.startTimer({ userId }));
    });

    interval(1000).pipe(
      switchMap(() => this.getTimer(userId).pipe(take(1))),
      takeWhile((timerState) => timerState?.isRunning || false)
    ).subscribe((timerState) => {
      const accumulated = timerState?.accumulatedTime || 0;
      const currentRun = timerState?.startTimestamp ? Date.now() - timerState.startTimestamp : 0;
      const totalSeconds = Math.floor((accumulated + currentRun) / 1000);
      const time: TimerState = {
        isRunning: timerState?.isRunning || false,
        accumulatedTime: accumulated,
        startTimestamp: timerState?.startTimestamp,
      };

      this.store.dispatch(UsersActions.updateTimer({
        userId,
        state: time,
      }));
    });
  }

// Дополнительно реализуем вспомогательный метод получения всех таймеров:
  getAllTimers(): Observable<TimersState> {
    return this.store.select(UsersSelectors.selectTimers);
  }

  stopTimer(userId: number) {
    this.store.dispatch(UsersActions.stopTimer({ userId }));

    // Обновляем состояние таймера в LocalStorage (isRunning: false)
    // this.getTimer(userId).subscribe((timer) => {
    //   if (timer) {
    //     const updatedTimer = { ...timer, isRunning: false };
    //     this.saveTimerToLocalStorage(userId, updatedTimer);
    //   }
    // });
  }

  resetTimer(userId: number) {
    this.store.dispatch(UsersActions.resetTimer({ userId }));

    // Удаляем состояние таймера из LocalStorage
    this.removeTimerFromLocalStorage(userId);
  }

  private getTimersSnapshotAndSaveToLocalStorage() {
    this.store.pipe(
      select(UsersSelectors.selectTimers),
      take(1)
    ).subscribe(timers => {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(timers));
    });
  }

  private saveTimerToLocalStorage(userId: number, timer: TimerState) {
    const currentTimers = this.loadTimersFromLocalStorage();
    currentTimers[userId] = timer;
    this.saveTimersToLocalStorage(currentTimers);
  }

  private removeTimerFromLocalStorage(userId: number) {
    const currentTimers = this.loadTimersFromLocalStorage();
    if (currentTimers[userId]) {
      delete currentTimers[userId];
      this.saveTimersToLocalStorage(currentTimers);
    }
  }

}
