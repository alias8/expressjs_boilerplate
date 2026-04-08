export const HARD_CODED_CITY = 'sydney';
// Redis channel names
export const REDIS_TRIP_CHANNEL = 'trip:';
export const REDIS_TRIPS_AVAILABLE_CHANNEL = `trips:available:${HARD_CODED_CITY}`;

// Message types (the `type` field on all messages)
export const TRIP_AVAILABLE = 'TRIP_AVAILABLE';
export const TRIP_ACCEPTED = 'TRIP_ACCEPTED';
export const TRIP_UPDATED_PICKED_UP = 'TRIP_UPDATED_PICKED_UP';
export const TRIP_UPDATED_DROP_OFF = 'TRIP_UPDATED_DROP_OFF';
export const TRIP_UPDATED_NEW_LOCATION = 'TRIP_UPDATED_NEW_LOCATION';

export interface TripRequest {
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
}

type RedisTripMessageTypes =
  | typeof TRIP_AVAILABLE
  | typeof TRIP_ACCEPTED
  | typeof TRIP_UPDATED_PICKED_UP
  | typeof TRIP_UPDATED_DROP_OFF
  | typeof TRIP_UPDATED_NEW_LOCATION;

interface RedisTripMessages {
  type: RedisTripMessageTypes;
  tripId: string;
}

export interface TripAvailableMessage extends RedisTripMessages {
  type: typeof TRIP_AVAILABLE;
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
  requested_at: Date;
  requested_by: string;
}

export interface TripAcceptedMessage extends RedisTripMessages {
  type: typeof TRIP_ACCEPTED;
  rider_id: string;
  driver_id: string;
  accepted_at: Date;
}

export interface TripUpdatedPickUpMessage extends RedisTripMessages {
  type: typeof TRIP_UPDATED_PICKED_UP;
  rider_id: string;
  startGPSLatitude_actual: number;
  startGPSLongitude_actual: number;
  picked_up_at: Date;
}

export interface TripUpdatedNewLocationMessage extends RedisTripMessages {
  type: typeof TRIP_UPDATED_NEW_LOCATION;
  rider_id: string;
  currentGPSLatitude: number;
  currentGPSLongitude: number;
}

export interface TripUpdatedDropOffMessage extends RedisTripMessages {
  type: typeof TRIP_UPDATED_DROP_OFF;
  rider_id: string;
  endGPSLatitude_actual: number;
  endGPSLongitude_actual: number;
  dropped_off_at: Date;
}
