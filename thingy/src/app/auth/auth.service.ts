import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { combineLatest, BehaviorSubject, Observable } from 'rxjs';
import { filter, shareReplay } from 'rxjs/operators';
import * as shortid from 'shortid';
import { Buffer } from 'buffer';

import { environment } from '../../environments/environment';

import * as Debug from 'debug';
const debug = Debug('thingy:auth.service');

/* AuthService handles all device registration and key generation actions.
 */
@Injectable()
export class AuthService {
  private privKey: BehaviorSubject<string>;
  private name_: BehaviorSubject<string>;
  private path_: BehaviorSubject<string>;
  private registering_: BehaviorSubject<boolean>;

  // Properties shared with consumers
  isRegistered: Observable<boolean>;
  name: Observable<string>;
  path: Observable<string>;
  registering: Observable<boolean>;
  get currentPath(): string {
    return this.path_.value;
  }

  constructor(private httpClient: HttpClient) {
    debug('Creating new AuthService instance');

    // Initialise private key and name from local storage if possible
    this.privKey = new BehaviorSubject(localStorage.getItem('privKey') || '');
    this.name_ = new BehaviorSubject(localStorage.getItem('name') || '');
    this.path_ = new BehaviorSubject(localStorage.getItem('path') || '');
    this.registering_ = new BehaviorSubject(false);
    this.name = this.name_.pipe(shareReplay(1));
    this.path = this.path_.pipe(shareReplay(1));
    this.registering = this.registering_.pipe(shareReplay(1));

    // isRegistered will be true when private key is known and the device has
    // a name.
    this.isRegistered = combineLatest(this.privKey, this.name_, this.path_, (privKey, name, path) => {
      return privKey != null && privKey !== '' &&
        name != null && name !== '' && path != null && path !== '';
    }).pipe(shareReplay(1));

    // Update local storage when name, path or private key changes
    this.name_.subscribe(name => {
      localStorage.setItem('name', name);
    });
    this.path_.subscribe(path => {
      localStorage.setItem('path', path);
    });
    this.privKey.subscribe(key => {
      localStorage.setItem('privKey', key);
    });
  }

  // Register method forces a device name change, and subsequent rotation of
  // any RSA keypair from remote service.
  register(): void {
    debug('register: enter');
    this.registering_.next(true);
    const name = shortid.generate();
    const req = this.httpClient.post(environment.registrationURL, {
      name: name
    })
      .subscribe((resp) => {
        debug('response from registration POST: %o', resp);
        this.name_.next(resp['name']);
        this.path_.next(resp['path']);
        const key = Buffer.from(resp['key'], 'base64').toString('ascii');
        this.privKey.next(key);
        this.registering_.next(false);
      },
        (err) => {
          debug('Error response from registration POST: %o', err);
          this.reset();
        });
    debug('register: exit');
  }

  reset(): void {
    debug('reset: enter');
    this.privKey.next('');
    this.name_.next('');
    this.path_.next('');
    this.registering_.next(false);
    debug('reset: exit');
  }
}
