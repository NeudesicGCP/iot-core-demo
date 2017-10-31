import { Injectable } from '@angular/core';

import * as Debug from 'debug';
const debug = Debug('thingy:app.window.service');

// Returns the browser window object, if defined
function getWindow(): any {
  return window;
}

// Provides a service to inject window object into classes
@Injectable()
export class WindowService {
  get window(): any {
    const w = getWindow();
    debug('get window: returning %o', w);
    return w;
  }

  constructor() {
    debug('Creating new WindowService instance');
  }
}
