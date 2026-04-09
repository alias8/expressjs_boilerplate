export type UserId = string & { readonly _brand: 'UserId' };
export type DriverId = string & { readonly _brand: 'DriverId' };
export type TripId = string & { readonly _brand: 'TripId' };

// Helper casts — used at trust boundaries (JWT decode, DB results)
export const asUserId = (id: string) => id as UserId;
export const asDriverId = (id: string) => id as DriverId;
