export interface TripShareData {
  tripId: string;
  referrerUserId?: string;
  timestamp: number;
  expiresAt: number;
}

const STORAGE_KEY = 'trip_share_pending';
const EXPIRY_HOURS = 24;

export function storePendingTripShare(tripId: string, referrerUserId?: string): void {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const data: TripShareData = {
    tripId,
    referrerUserId,
    timestamp: now,
    expiresAt: now + (EXPIRY_HOURS * 60 * 60 * 1000),
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to store pending trip share:', e);
  }
}

export function getPendingTripShare(): TripShareData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data: TripShareData = JSON.parse(stored);
    
    if (Date.now() > data.expiresAt) {
      clearPendingTripShare();
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Failed to get pending trip share:', e);
    clearPendingTripShare();
    return null;
  }
}

export function clearPendingTripShare(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear pending trip share:', e);
  }
}

export function getShareUrl(tripId: string, referrerUserId?: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(`/trips/${tripId}`, baseUrl);
  
  if (referrerUserId) {
    url.searchParams.set('ref', referrerUserId);
  }
  
  return url.toString();
}

export async function copyShareLink(tripId: string, referrerUserId?: string): Promise<boolean> {
  const url = getShareUrl(tripId, referrerUserId);
  
  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Check out this trip!',
        text: 'Join me on this trip!',
        url,
      });
      return true;
    } else {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch (e) {
    console.error('Failed to share:', e);
    return false;
  }
}
