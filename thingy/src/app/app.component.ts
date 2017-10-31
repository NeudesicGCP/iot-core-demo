import { Component } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { environment } from '../environments/environment';

import * as Debug from 'debug';

// Hook debug into browser console
(<any>window).debugApp = Debug;
if (!environment.debug) {
  // Disable debug output
  (<any>window).debugApp.disable('*');
} else {
  // Enable thingy namespace to be sent to console
  (<any>window).debugApp.enable('thingy:*');
}

@Component({
  moduleId: module.id,
  // tslint:disable-next-line:component-selector
  selector: 'body',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent { }
