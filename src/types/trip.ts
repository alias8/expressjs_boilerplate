import { TripStatus } from '../generated/prisma/enums';

export const HARD_CODED_CITY = 'sydney';
// Redis channel names
export const REDIS_TRIP_CHANNEL = 'trip:';
export const REDIS_TRIPS_AVAILABLE_CHANNEL = `trips:available:${HARD_CODED_CITY}`;

// Message types (the `type` field on all messages)
export const TRIP_AVAILABLE = 'TRIP_AVAILABLE';
export const TRIP_ACCEPTED = 'TRIP_ACCEPTED';
export const TRIP_UPDATED_PICKED_UP = 'TRIP_UPDATED_PICKED_UP';
export const TRIP_UPDATED_NEW_LOCATION = 'TRIP_UPDATED_NEW_LOCATION';

export interface TripRequest {
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
}

export interface TripAvailableMessage {
  type: typeof TRIP_AVAILABLE;
  tripId: string;
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
  requested_at: Date;
  requested_by: string;
}

export interface TripAcceptedMessage {
  type: typeof TRIP_ACCEPTED;
  rider_id: string;
  driver_id: string;
  accepted_at: Date;
}

export interface TripUpdatedNewLocationMessage {
  type: typeof TRIP_UPDATED_NEW_LOCATION;
  tripId: string;
  rider_id: string;
  currentGPSLatitude: number;
  currentGPSLongitude: number;
}

export interface TripUpdatedPickUpMessage {
  type: typeof TRIP_UPDATED_PICKED_UP;
  tripId: string;
  rider_id: string;
  currentGPSLatitude: number;
  currentGPSLongitude: number;
  picked_up_at: Date;
  status: TripStatus;
}
