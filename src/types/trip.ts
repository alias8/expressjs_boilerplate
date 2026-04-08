export const HARD_CODED_CITY = 'sydney';
// Redis channel names
export const REDIS_TRIP_CHANNEL = 'trip:';
export const REDIS_TRIPS_AVAILABLE_CHANNEL = `trips:available:${HARD_CODED_CITY}`;

// Message types (the `type` field on all messages)
export const TRIP_AVAILABLE = 'TRIP_AVAILABLE';
export const TRIP_ACCEPTED = 'TRIP_ACCEPTED';
export const TRIP_PICKED_UP = 'TRIP_PICKED_UP';
export const TRIP_DROPPED_OFF = 'TRIP_DROPPED_OFF';
export const TRIP_UPDATE_CURRENT_LOCATION = 'TRIP_UPDATE_CURRENT_LOCATION';

export interface TripRequest {
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
}

type RedisTripMessageTypes =
  | typeof TRIP_AVAILABLE
  | typeof TRIP_ACCEPTED
  | typeof TRIP_PICKED_UP
  | typeof TRIP_DROPPED_OFF
  | typeof TRIP_UPDATE_CURRENT_LOCATION;

export interface RedisTripMessages {
  type: RedisTripMessageTypes;
  tripId: string;
  rider_id: string;
}

export interface TripAvailableMessage extends RedisTripMessages {
  type: typeof TRIP_AVAILABLE;
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
  requested_at: Date;
}

export interface TripAcceptedMessage extends RedisTripMessages {
  type: typeof TRIP_ACCEPTED;
  driver_id: string;
  accepted_at: Date;
}

export interface TripUpdatedPickUpMessage extends RedisTripMessages {
  type: typeof TRIP_PICKED_UP;
  startGPSLatitude_actual: number;
  startGPSLongitude_actual: number;
  picked_up_at: Date;
}

export interface TripUpdatedNewLocationMessage extends RedisTripMessages {
  type: typeof TRIP_UPDATE_CURRENT_LOCATION;
  currentGPSLatitude: number;
  currentGPSLongitude: number;
}

export interface TripUpdatedDropOffMessage extends RedisTripMessages {
  type: typeof TRIP_DROPPED_OFF;
  endGPSLatitude_actual: number;
  endGPSLongitude_actual: number;
  dropped_off_at: Date;
}
