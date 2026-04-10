export type UserId = string & { readonly _brand: 'UserId' };

// Helper cast — used at trust boundaries (JWT decode, DB results)
export const asUserId = (id: string) => id as UserId;
