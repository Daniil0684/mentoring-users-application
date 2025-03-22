import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersFacade } from '@users/users/data-access';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

@Component({
  selector: 'users-users-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users-filter.component.html',
  styleUrls: ['./users-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersFilterComponent implements OnInit {
  @Output() filterChanged = new EventEmitter<string>();

  usersFilter = new FormControl('');
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.usersFilter.valueChanges
      .pipe(debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filterChanged.emit(value ?? '');
      });
  }
}
