import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule } from '@angular/material';

import { StatusComponent } from './status.component';
import { StatusService } from './status.service';
import { SensorsComponent } from './sensors.component';
import { SensorsService } from './sensors.service';

import * as Debug from 'debug';
const debug = Debug('thingy:status.module');

@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  exports: [StatusComponent, SensorsComponent],
  declarations: [StatusComponent, SensorsComponent],
  providers: [StatusService, SensorsService]
})
export class StatusModule { }
