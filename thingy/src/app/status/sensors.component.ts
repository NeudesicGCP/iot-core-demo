import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/sampleTime';

import { SensorsService } from './sensors.service';

import * as Debug from 'debug';
const debug = Debug('thingy:sensors.component');

@Component({
  selector: 'app-sensors-component',
  templateUrl: './sensors.component.html',
  styleUrls: ['./sensors.component.scss']
})
export class SensorsComponent implements OnInit, OnDestroy {
  private locationSub: Subscription;
  private accelerationSub: Subscription;
  private positionEnabled_: BehaviorSubject<boolean>;
  private haveAPosition_: BehaviorSubject<boolean>;
  private haveAnAcceleration_: BehaviorSubject<boolean>;

  get positionEnabled(): Observable<boolean> {
    return this.positionEnabled_.distinctUntilChanged();
  }
  get haveAPosition(): Observable<boolean> {
    return this.haveAPosition_.distinctUntilChanged();
  }
  get haveAnAcceleration(): Observable<boolean> {
    return this.haveAnAcceleration_.distinctUntilChanged();
  }

  constructor(private sensorsService: SensorsService) {
    debug('Creating new SensorsComponent instance');
    this.positionEnabled_ = new BehaviorSubject(false);
    this.haveAPosition_ = new BehaviorSubject(false);
    this.haveAnAcceleration_ = new BehaviorSubject(false);
  }

  ngOnInit() {
    debug('ngOnInit: enter');
    this.accelerationSub = this.sensorsService.acceleration
      .filter((acceleration: any) => acceleration)
      .subscribe((acceleration) => {
        debug('acceleration: %o', acceleration);
        this.haveAnAcceleration_.next(true);
      }, (err) => {
        this.haveAnAcceleration_.next(false);
      });
    this.locationSub = this.sensorsService.geolocation
      .filter((position: any) => position)
      .subscribe((position) => {
        debug('position: %o', position);
        this.positionEnabled_.next(true);
        this.haveAPosition_.next(true);
      }, (err) => {
        this.positionEnabled_.next(this.sensorsService.errorIsPositionEnabled(err));
        this.haveAPosition_.next(false);
      });
    debug('ngOnInit: exit');
  }

  ngOnDestroy(): void {
    debug('ngOnDestroy: enter');
    if (this.locationSub) {
      this.locationSub.unsubscribe();
    }
    if (this.accelerationSub) {
      this.accelerationSub.unsubscribe();
    }
    debug('ngOnDestroy: exit');
  }
}

