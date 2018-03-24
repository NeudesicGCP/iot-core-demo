import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/observable/interval';
import 'rxjs/add/operator/sampleTime';
import 'rxjs/add/operator/map';
import { Buffer } from 'buffer';

import { AuthService } from '../auth/auth.service';
import { Config, IoTConfig, State, Telemetry } from './status.model';

import * as Debug from 'debug';
const debug = Debug('thingy:status.service');

const UPDATE_SAMPLE_TIME_MS = 5000;

@Injectable()
export class StatusService {
  private state_: BehaviorSubject<State>;
  private isRegistered: boolean;

  get state(): State {
    return this.state_.value;
  }

  set state(state: State) {
    this.state_.next(state);
  }

  constructor(private authService: AuthService,
    private httpClient: HttpClient) {
    debug('Creating new StatusService instance');
    this.authService.isRegistered.subscribe((registered) => {
      this.isRegistered = registered;
    });
    const state = {
      locationEnabled: false,
      locationError: ''
    };
    this.state_ = new BehaviorSubject<State>(state);
    this.state_.sampleTime(UPDATE_SAMPLE_TIME_MS)
      .filter(sample => this.isRegistered && sample != null)
      .subscribe((sample) => {
        const path = this.authService.currentPath;
        const binary = Buffer.from(JSON.stringify(state)).toString('base64');
        this.httpClient.post(`${path}:setState`, {
          state: {
            binaryData: binary
          }
        })
          .subscribe((resp) => {
            debug('state: state has been sent to IoT Core');
          }, (err) => {
            debug('state: error setting state: %o', err);
          });
      });
  }

  config(version: number = 0): Observable<Config> {
    debug('config: enter, version = %d', version);
    const path = this.authService.currentPath;
    return this.httpClient.get<IoTConfig>(`${path}/config?local_version=${version}`)
      .map((resp) => {
        if (version === resp.version) {
          debug('config: no changes from version %d', version);
          return null;
        }
        if (resp.binaryData === undefined || resp.binaryData === null || resp.binaryData === '') {
          debug('config: new version, empty binary data');
          return {
            version: resp.version,
            config: {}
          };
        }
        const config = JSON.parse(Buffer.from(resp.binaryData, 'base64'));
        debug('config: new version, config = %o', config);
        return {
          version: resp.version,
          config: config
        };
      });
  }

  telemetry(telemetry: Telemetry): void {
    debug('telemetry: enter, telemetry = %o', telemetry);
    const path = this.authService.currentPath;
    const binary = Buffer.from(JSON.stringify(telemetry)).toString('base64');
    this.httpClient.post(`${path}:publishEvent`, {
      binaryData: binary
    })
      .subscribe((resp) => {
        debug('telemetry: data has been sent to IoT Core');
      }, (err) => {
        debug('telemetry: error publishing event: %o', err);
      });

    debug('telemetry: exit');
  }
}

