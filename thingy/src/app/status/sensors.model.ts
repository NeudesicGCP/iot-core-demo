import * as Debug from 'debug';
const debug = Debug('thingy:sensors.model');

export interface Acceleration {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function buildAcceleration(obj: any): Acceleration {
  debug('buildAcceleration: enter, obj = %o', obj);
  let result = null;
  let data = null;
  if (obj && obj.acceleration) {
    data = obj.acceleration;
  } else if (obj && obj.accelerationIncludingGravity) {
    data = obj.accelerationIncludingGravity;
  }
  if (data) {
    result = {
      x: data.x || 0,
      y: data.y || 0,
      z: data.z || 0
    };
  }
  debug('buildAcceleration: exit, returning %o', result);
  return result;
}

export interface Position {
  readonly latitude: number;
  readonly longitude: number;
}

export function buildPosition(obj: any): Position {
  debug('buildPosition: enter, obj = %o', obj);
  let result = null;
  if (obj && obj.coords) {
    result = {
      latitude: obj.coords.latitude,
      longitude: obj.coords.longitude
    };
  }
  debug('buildPosition: exit, returning %o', result);
  return result;
}
