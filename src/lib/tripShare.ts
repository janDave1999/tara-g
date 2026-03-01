export interface TripShareData {
  tripId: string;
  shareCode?: string;
  timestamp: number;
}

const COOKIE_NAME = 'trip_share_pending';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

export function getPendingTripShare(): TripShareData | null {
  if (typeof document === 'undefined') return null;
  
  try {
    const match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
    if (!match) return null;
    
    const data: TripShareData = JSON.parse(decodeURIComponent(match[2]));
    
    // Check if older than 24 hours
    if (Date.now() - data.timestamp > COOKIE_MAX_AGE * 1000) {
      clearPendingTripShare();
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export function setPendingTripShare(tripId: string, shareCode?: string): void {
  if (typeof document === 'undefined') return;
  
  const data: TripShareData = {
    tripId,
    shareCode,
    timestamp: Date.now(),
  };
  
  const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(data))};expires=${expires};path=/;SameSite=Lax`;
}

export function clearPendingTripShare(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export function hasPendingTripShare(): boolean {
  const data = getPendingTripShare();
  return data !== null;
}
