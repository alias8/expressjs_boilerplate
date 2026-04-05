const enum TripStatus {
  REQUESTED = 'REQUESTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

type RATING = 1 | 2 | 3 | 4 | 5;

// Drivers and Riders register as a "user"
export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

export interface Driver {
  user_id: string; // FK to user DB
  on_trip: boolean;
  looking_for_trip: boolean;
}

export interface Rider {
  user_id: string; // FK to user DB
  on_trip: boolean;
}

export interface Trip {
  id: string;
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
  requested_at: Date;
  requested_by: string; // userid
  accepted_by?: string; // driverid
  status: TripStatus;
  ratingForDriver: RATING;
  ratingForRider: RATING;
}

// currentGPSLatitude: number
// currentGPSLongitude: number
