import { TripStatus } from '../generated/prisma/enums';

export const HARD_CODED_CITY = 'sydney';
export const REDIS_TRIP_KEY = 'trip:';
export const REDIS_TRIPS_AVAILABLE_KEY = `trips:available:${HARD_CODED_CITY}`;
export const TRIP_AVAILABLE = 'TRIP_AVAILABLE';
export const TRIP_ACCEPTED = 'TRIP_ACCEPTED';
export const TRIP_UPDATED = 'TRIP_UPDATED';

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

export interface TripUpdatedMessage {
  type: typeof TRIP_UPDATED;
  tripId: string;
  currentGPSLatitude: number;
  currentGPSLongitude: number;
  picked_up_at: Date;
  status: TripStatus;
}
