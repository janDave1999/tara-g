// Push notification utility functions
import { supabaseAdmin, getSupabaseClient } from "@/lib/supabase";

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

// Check if push is supported
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Request notification permission
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Get current permission status
export function getPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined') return 'default';
  return Notification.permission;
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return existingSubscription;
    }

    // Subscribe to push - cast to any to bypass TypeScript strict typing
    const vapidKey = getVapidPublicKey();
    const keyArray = urlBase64ToUint8Array(vapidKey) as unknown as BufferSource;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray,
    });

    // Save subscription to server
    await savePushSubscription(subscription);

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      // Remove from server
      await removePushSubscription(subscription.endpoint);
    }
    
    return true;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

// Test push notification
export async function testPushNotification(): Promise<boolean> {
  if (!isPushSupported()) return false;
  
  try {
    const permission = await requestPermission();
    if (permission !== 'granted') {
      console.log('Push permission not granted');
      return false;
    }

    await subscribeToPush();
    
    // Show test notification
    new Notification('Push Notifications Enabled!', {
      body: 'You will receive notifications about your trips.',
      icon: '/icon-192.png',
      tag: 'test',
    });
    
    return true;
  } catch (error) {
    console.error('Error testing push:', error);
    return false;
  }
}

// Helper: Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Get VAPID public key from environment
function getVapidPublicKey(): string {
  // This should be set in your environment variables
  return import.meta.env.PUBLIC_VAPID_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
}

// Save subscription to server
async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  // Get user from client (since this runs in browser)
  const supabase = getSupabaseClient({} as any);
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  const subJson = subscription.toJSON();
  const subscriptionData = {
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subJson.keys?.p256dh,
    auth: subJson.keys?.auth,
  };

  // This would call an API endpoint to save the subscription
  // For now, store in localStorage as fallback
  localStorage.setItem('push_subscription', JSON.stringify(subscriptionData));
}

// Remove subscription from server
async function removePushSubscription(endpoint: string): Promise<void> {
  localStorage.removeItem('push_subscription');
}
