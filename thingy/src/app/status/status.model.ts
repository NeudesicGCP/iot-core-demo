import { Acceleration, Position } from './sensors.model';

export interface Config {
  readonly version: number;
  readonly config: any;
}

export interface IoTConfig {
  readonly version: number;
  readonly binaryData: any;
}

export interface State {
  readonly locationEnabled: boolean;
  readonly locationError: string;
}

export interface Telemetry {
  readonly ts: number;
  readonly ua: string;
  readonly position: Position;
  readonly acceleration: Acceleration;
  readonly deviceId: string;
}
