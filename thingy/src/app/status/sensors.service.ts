import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/operator/sampleTime';
import 'rxjs/add/operator/startWith';

import { WindowService } from '../app.window.service';
import { Acceleration, buildAcceleration, Position, buildPosition } from './sensors.model';

import * as Debug from 'debug';
const debug = Debug('thingy:sensors.service');

const SENSOR_SAMPLE_TIME_MS = 100;
const SENSOR_ERROR_UNKNOWN = 'Unknown sensor error';
const SENSOR_ERROR_GEOLOC_UNSUPPORTED = 'Geolocation is unsupported on this device';
const SENSOR_ERROR_GEOLOC_PERMISSIONS = 'Geolocation support has been denied';
const SENSOR_ERROR_GEOLOC_UNAVAILABLE = 'Geolocation position is unavailable';
const SENSOR_ERROR_GEOLOC_TIMEOUT = 'Timeout before fixing your geolocation position';
const SENSOR_ERROR_GEOLOC_UNKNOWN = 'Unknown Geolocation error';

@Injectable()
export class SensorsService {
  private window: any;

  get geolocation(): Observable<Position> {
    debug('get geolocation: enter');
    return Observable.create(observer => {
      if (this.window && this.window.navigator && this.window.navigator.geolocation) {
        this.window.navigator.geolocation.watchPosition((position) => {
          const next = buildPosition(position);
          if (next) {
            observer.next(next);
          }
        }, (error) => {
          switch (error.code) {
            case 1:
              observer.error(SENSOR_ERROR_GEOLOC_PERMISSIONS);
              break;

            case 2:
              observer.error(SENSOR_ERROR_GEOLOC_UNAVAILABLE);
              break;

            case 3:
              observer.error(SENSOR_ERROR_GEOLOC_TIMEOUT);
              break;

            default:
              observer.error(`${SENSOR_ERROR_GEOLOC_UNKNOWN}: ${error.code}`);
          }
        }, {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 15000
          });
      } else {
        observer.error('Geolocation is unsupported');
      }
    })
      .startWith(null)
      .sampleTime(SENSOR_SAMPLE_TIME_MS);
  }

  get acceleration(): Observable<Acceleration> {
    debug('get acceleration: enter');
    if (!this.window || !this.window.addEventListener) {
      debug('get acceleration: window doesn\'t have addEventListener');
      return Observable.throw(SENSOR_ERROR_UNKNOWN);
    }
    return Observable.fromEvent(this.window, 'devicemotion')
      .sampleTime(SENSOR_SAMPLE_TIME_MS)
      .map((motion) => {
        return buildAcceleration(motion);
      })
      .startWith(null)
  }

  constructor(private windowService: WindowService) {
    debug('Creating new SensorsService instance');
    this.window = windowService.window;
  }

  errorIsPositionEnabled(err: string): boolean {
    return err === SENSOR_ERROR_GEOLOC_TIMEOUT;
  }
}
