import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { TimerObservable } from 'rxjs/observable/TimerObservable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/takeWhile';

import { AuthService } from '../auth/auth.service';
import { StatusService } from './status.service';
import { SensorsService } from './sensors.service';

import * as Debug from 'debug';
const debug = Debug('thingy:status.component');

@Component({
  selector: 'app-status-component',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss']
})
export class StatusComponent implements OnInit, OnDestroy {
  private registered_: BehaviorSubject<boolean>;
  private version_: BehaviorSubject<number>;
  private config_: BehaviorSubject<any>;
  private locationSub: Subscription;
  private configSub: Subscription;
  private telemetrySub: Subscription;

  get isRegistered(): Observable<boolean> {
    return this.registered_.asObservable();
  }

  get version(): Observable<number> {
    return this.version_.asObservable();
  }

  get config(): Observable<any> {
    return this.config_.asObservable();
  }

  isBusy: Observable<boolean>;
  name: Observable<string>;

  constructor(private statusService: StatusService,
    private authService: AuthService,
    private sensorsService: SensorsService) {
    debug('Creating new StatusComponent instance');
    this.version_ = new BehaviorSubject(0);
    this.config_ = new BehaviorSubject<any>(null);
    this.registered_ = new BehaviorSubject(false);
    this.authService.isRegistered.subscribe((registered) => {
      this.registered_.next(registered);
    });
    this.isBusy = this.authService.registering;
    this.name = authService.name;
  }

  ngOnInit(): void {
    debug('onInit: enter');
    this.configSub = TimerObservable.create(0, 5000)
      .takeWhile(() => this.registered_.value)
      .subscribe(() => {
        this.statusService.config()
          .subscribe((config) => {
            this.version_.next(config.version);
            if (config.config != null) {
              this.config_.next(config.config);
            }
          });
      });
    this.locationSub = this.sensorsService.geolocation
      .takeWhile(() => this.registered_.value)
      .subscribe((location) => {
        const state = this.statusService.state;
        if (state.locationEnabled && state.locationError === '') {
          debug('location event, but nothing to change in state: %o', state);
          return;
        }
        debug('new location event; updating state');
        this.statusService.state = {
          locationEnabled: true,
          locationError: ''
        };
      }, (err) => {
        debug('location event error; updating state');
        this.statusService.state = {
          locationEnabled: false,
          locationError: err
        };
      });
    this.telemetrySub = this.sensorsService.acceleration
      .combineLatest(this.sensorsService.geolocation,
      this.sensorsService.ua,
      (acceleration, position, ua) => {
        return {
          ua: ua,
          position: position,
          acceleration: acceleration
        };
      })
      .sampleTime(250)
      .subscribe((telemetry) => {
        this.statusService.telemetry(telemetry);
      });
    debug('onInit: exit');
  }

  ngOnDestroy(): void {
    debug('ngOnDestroy: enter');
    if (this.locationSub) {
      debug('ngOnDestroy: unsubscribing from location events');
      this.locationSub.unsubscribe();
    }
    if (this.configSub != null) {
      debug('ngOnDestroy: unsubscribing from config events');
      this.configSub.unsubscribe();
    }
    if (this.telemetrySub) {
      debug('ngOnDestroy: unsubscribing from telemetry events');
      this.telemetrySub.unsubscribe();
    }
    debug('ngOnDestroy: exit');
  }

  register($event: MouseEvent): void {
    debug('register: enter');
    this.authService.register();
    debug('register: exit');
  }

  reset($event: MouseEvent): void {
    debug('reset: enter');
    this.authService.reset();
    debug('reset: exit');
  }
}
