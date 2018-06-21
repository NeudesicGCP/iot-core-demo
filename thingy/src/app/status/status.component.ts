import { Component, OnInit, OnDestroy } from '@angular/core';
import { combineLatest, timer, BehaviorSubject, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, sampleTime } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';
import { StatusService } from './status.service';
import { SensorsService } from './sensors.service';
import { WindowService } from '../app.window.service';

import * as Debug from 'debug';
const debug = Debug('thingy:status.component');

const UPDATE_TELEMETRY_SAMPLE_MS = 125;

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
  private ua: string;
  private pingPong_: BehaviorSubject<boolean>;

  get pingPong(): Observable<boolean> {
    return this.pingPong_.pipe(distinctUntilChanged());
  }

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
    private sensorsService: SensorsService,
    private windowService: WindowService) {
    debug('Creating new StatusComponent instance');
    this.version_ = new BehaviorSubject(0);
    this.config_ = new BehaviorSubject<any>(null);
    this.registered_ = new BehaviorSubject(false);
    this.pingPong_ = new BehaviorSubject(false);
    this.ua = windowService.window.navigator.userAgent;
    this.authService.isRegistered.subscribe((registered) => {
      this.registered_.next(registered);
    });
    this.isBusy = this.authService.registering;
    this.name = authService.name;
  }

  ngOnInit(): void {
    debug('onInit: enter');
    this.configSub = timer(0, 5000)
      .pipe(filter(() => this.registered_.value))
      .subscribe(() => {
        this.statusService.config(this.version_.value)
          .subscribe((config) => {
            debug('updated config: %o', config);
            if (config != null) {
              this.version_.next(config.version);
              this.config_.next(config.config);
            }
          });
      });
    this.locationSub = this.sensorsService.geolocation
      .pipe(filter(() => this.registered_.value))
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
    this.telemetrySub = combineLatest(this.sensorsService.geolocation, this.sensorsService.acceleration,
      (position, acceleration) => {
        debug('combining telemetry: position = %o, acceleration = %o', position, acceleration);
        return {
          ts: Date.now(),
          ua: this.ua,
          position: position,
          acceleration: acceleration
        };
      })
      .pipe(filter(() => this.registered_.value),
        sampleTime(UPDATE_TELEMETRY_SAMPLE_MS))
      .subscribe((telemetry) => {
        this.pingPong_.next(!this.pingPong_.getValue());
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
