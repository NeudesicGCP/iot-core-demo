import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import * as KJUR from 'jsrsasign';

import { environment } from '../../environments/environment';

import * as Debug from 'debug';
const debug = Debug('thingy:auth.interceptor');

/* Groups:
 * 1: GCP project-id, needed for audience field in JWT
 * 2: GCP location
 * 3: Cloud IoT registry name
 * 4: unique device id
 * 5: action
 */
// tslint:disable-next-line:max-line-length
const IOT_PATH_REGEX = /https:\/\/cloudiotdevice\.googleapis\.com\/v1\/projects\/([^\/]+)\/locations\/([^\/]+)\/registries\/([^\/]+)\/devices\/([^\/:]+)(.*)/;

/* AuthInterceptor adds JWT token to all requests that match the URL associated
 * with Cloud IoT Core REST endpoints.
 *
 * Note: this class avoids using anthing from AuthService to avoid circular
 * dependencies, as AuthService has to use HttpClient too.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor() {
    debug('Created new AuthInterceptor instance');
  }

  // Inspects each outgoing request and adds a JWT bearer token when needed
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    debug('intercept: enter');
    const token = this.getBearerToken(req);
    if (token === '') {
      debug('intercept: token is empty, execute next handler with existing request');
      return next.handle(req);
    }
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    debug('intercept: handing off to next handler with header');
    return next.handle(req);
  }

  // Returns a JWT token to insert into the request
  private getBearerToken(req: HttpRequest<any>): string {
    debug('getBearerToken: enter, req = %o', req);
    const regexResult = IOT_PATH_REGEX.exec(req.url);
    if (regexResult === null) {
      debug('getBearerToken: path doesn\'t match IoT regex, returning %s for token', environment.registrationAuthToken);
      return environment.registrationAuthToken;
    }
    const privKey = localStorage.getItem('privKey') || '';
    if (privKey === '') {
      debug('getBearerToken: private key is unknown, returning empty string for token');
      return '';
    }
    const audience = regexResult[1] || '';
    if (audience === '') {
      debug('getBearerToken: audience is unknown, returning empty string for token');
      return '';
    }
    const iat = Math.floor(Date.now() / 1000);
    let token = '';
    try {
      token = KJUR.jws.JWS.sign(null, { 'alg': 'RS256', 'typ': 'JWT' }, { 'iat': iat, 'exp': iat + 60, 'aud': audience }, privKey);
    } catch (err) {
      debug('getBearerToken: error: %o', err);
    }
    debug('getBearerToken: returning %o', token);
    return token;
  }
}
