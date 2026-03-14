// Itinerary Map V2 Client-Side Script
// Handles Google Maps initialization, markers, routes, and interactions

import { actions } from 'astro:actions';

declare global {
  interface Window {
    PUBLIC_GOOGLE_MAPS_KEY: string;
    openEditStopModalV2: (stopId: string) => Promise<void>;
    deleteStopByIdV2: (stopId: string) => Promise<void>;
    refreshItineraryMapV2: () => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

// Google will be loaded dynamically at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

let map: any = null;
let markers: any[] = [];
let directionsService: any = null;
let directionsRenderer: any = null;
let autocompleteService: any = null;
let placesService: any = null;

// Module-level state
let allStops: Stop[] = [];
let mapCanEdit = false;
let mapTripId: string | undefined;
let activeDay = 'all';
let dragOriginalOrder: Stop[] = [];

interface Stop {
  id: string;
  location_type: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  waiting_time: number | null;
  order_index: number;
  notes: string | null;
  location?: {
    name: string;
  };
}

const stopTypeColors: Record<string, string> = {
  destination: '#3b82f6',
  activity: '#10b981',
  meal_break: '#f59e0b',
  rest_stop: '#8b5cf6',
  accommodation: '#ec4899',
  checkpoint: '#6366f1',
  pickup: '#14b8a6',
  dropoff: '#f97316',
  boat: '#06b6d4',
  ferry: '#0ea5e9',
};

function getStopColor(locationType: string): string {
  return stopTypeColors[locationType] || '#6b7280';
}

export async function initItineraryMapV2() {
  console.log('[ItineraryMapV2] init called');
  const container = document.getElementById('itinerary-map-v2');
  if (!container) { console.error('[ItineraryMapV2] #itinerary-map-v2 not found'); return; }

  const mapContainer = document.getElementById('map-container-v2');
  if (!mapContainer) { console.error('[ItineraryMapV2] #map-container-v2 not found'); return; }

  const stopsData = container.dataset.stops;
  const canEdit = container.dataset.canEdit === 'true';
  const tripId = container.dataset.tripId;
  const tripDetailsRaw = container.dataset.tripDetails;

  console.log('[ItineraryMapV2] tripId:', tripId, '| canEdit:', canEdit);
  console.log('[ItineraryMapV2] tripDetails raw:', tripDetailsRaw);

  if (!stopsData) {
    console.error('[ItineraryMapV2] No stops data found in data-stops attribute');
    return;
  }

  let rawStops: unknown[] = [];
  let stops: Stop[] = [];
  try {
    rawStops = JSON.parse(stopsData);
    console.log('[ItineraryMapV2] Raw stops count:', rawStops.length, '| raw:', rawStops);
    stops = (rawStops as Record<string, unknown>[]).map((s) => {
      const loc = s.location as Record<string, unknown> | undefined;
      const lat = (s.latitude ?? loc?.latitude ?? null) as number | null;
      const lng = (s.longitude ?? loc?.longitude ?? null) as number | null;

      console.log('[ItineraryMapV2] Mapping stop id=%s type=%s name=%s lat=%s lng=%s sched_start=%s order=%s',
        s.id, s.location_type,
        (s.location_name || loc?.name || '(no name)'),
        lat, lng,
        s.scheduled_start ?? 'null',
        s.order_index ?? 0
      );

      return {
        id: s.id as string,
        location_type: s.location_type as string,
        location_name: (s.location_name || loc?.name || null) as string,
        latitude: lat ? parseFloat(String(lat)) : null,
        longitude: lng ? parseFloat(String(lng)) : null,
        scheduled_start: s.scheduled_start as string | null,
        scheduled_end: s.scheduled_end as string | null,
        waiting_time: (s.waiting_time ?? null) as number | null,
        order_index: (s.order_index ?? 0) as number,
        notes: s.notes as string | null,
        location: loc as Stop['location'],
      };
    });
    console.log('[ItineraryMapV2] Parsed stops:', stops);
    console.log('[ItineraryMapV2] Stops with coords:', stops.filter(s => s.latitude && s.longitude).length, '/', stops.length);
    console.log('[ItineraryMapV2] Stops missing coords:', stops.filter(s => !s.latitude || !s.longitude).map(s => s.id));
  } catch (e) {
    console.error('[ItineraryMapV2] Failed to parse stops JSON:', e);
    return;
  }

  const apiKey = window.PUBLIC_GOOGLE_MAPS_KEY || '';
  if (!apiKey) {
    console.error('Google Maps API key not found');
    return;
  }

  // Check if Google Maps is already loaded
  if (typeof google !== 'undefined' && (window as any).google?.maps) {
    initializeMap(stops, canEdit, tripId);
    return;
  }

  // Load Google Maps with Places using the new importLibrary approach
  (window as any).initMap = () => initializeMap(stops, canEdit, tripId);
  
  // Load Google Maps script - include both places and routes libraries
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&v=weekly&libraries=places,routes`;
  script.async = true;
  script.defer = true;
  
  script.onload = () => {
    initializeMap(stops, canEdit, tripId);
  };
  
  script.onerror = () => {
    console.error('Failed to load Google Maps script');
  };
  
  document.head.appendChild(script);
}

function initializeMap(stops: Stop[], canEdit: boolean, tripId?: string) {
  console.log('[ItineraryMapV2] initializeMap called — stops:', stops.length, 'canEdit:', canEdit, 'tripId:', tripId);
  const mapElement = document.getElementById('map-container-v2');
  if (!mapElement) { console.error('[ItineraryMapV2] map element not found'); return; }

  const defaultCenter = { lat: 14.5995, lng: 120.9842 };

  map = new google.maps.Map(mapElement, {
    center: defaultCenter,
    zoom: 6,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [],
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#4285F4',
      strokeWeight: 4,
      strokeOpacity: 0.8,
    },
  });

  autocompleteService = new google.maps.places.AutocompleteService();
  placesService = new google.maps.places.PlacesService(map);

  allStops = stops;
  mapCanEdit = canEdit;
  mapTripId = tripId;

  renderMarkers(stops, canEdit, tripId);

  if (stops.length > 0) {
    fitBoundsToMarkers();
  }

  initSearchBox();
  initDayTabs(stops);
  renderTimeline('all');

  if (canEdit && tripId) {
    map.addListener('click', (e: any) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        
        // Try reverse geocoding to get place details
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const result = results[0];
            const placeDetails: PlaceDetails = {
              name: result.formatted_address?.split(',')[0] || 'Selected Location',
              address: result.formatted_address || '',
              lat,
              lng,
              placeId: result.place_id || '',
            };
            showLocationPreview(lat, lng, placeDetails.name, placeDetails);
          } else {
            // Fallback to simple preview
            showLocationPreview(lat, lng, `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          }
        });
      }
    });
  }

  initBottomSheet();
}

function renderMarkers(stops: Stop[], canEdit: boolean, tripId?: string) {
  if (!map) return;

  markers.forEach(m => m.setMap(null));
  markers = [];

  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);

  sortedStops.forEach((stop, index) => {
    if (!stop.latitude || !stop.longitude) return;

    const marker = new google.maps.Marker({
      position: { lat: stop.latitude, lng: stop.longitude },
      map: map!,
      title: stop.location?.name || stop.location_name || `Stop ${index + 1}`,
      zIndex: index + 1,
    });

    const infoWindow = createInfoWindow(stop, index, canEdit);

    marker.addListener('click', () => {
      infoWindow.open(map!, marker);
    });

    markers.push(marker);
  });

  if (sortedStops.length > 1) {
    updateRoute(sortedStops);
  } else {
    clearRoute();
  }
}

function createInfoWindow(stop: Stop, index: number, canEdit: boolean): any {
  const color = getStopColor(stop.location_type);
  const locationName = stop.location?.name || stop.location_name || `Stop ${index + 1}`;
  const typeLabel = stop.location_type?.replace(/_/g, ' ') || 'stop';

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const timeRange = (() => {
    const start = stop.scheduled_start;
    const end = stop.scheduled_end;
    const waiting = stop.waiting_time;

    if (!start && !end) return '';
    
    const primary = start || end;
    if (!primary) return '';

    const startTime = formatTime(start);
    let endTime = '';

    if (end) {
      endTime = formatTime(end);
    } else if (waiting && waiting > 0) {
      const endDate = new Date(new Date(primary).getTime() + waiting * 60000);
      endTime = formatTime(endDate.toISOString());
    }

    if (endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime;
  })();

  let buttons = '';
  if (canEdit) {
    buttons = `
      <div class="flex gap-2 mt-2 pt-2 border-t">
        <button class="text-xs text-blue-600 hover:underline edit-stop-btn" data-stop-id="${stop.id}">Edit</button>
        <button class="text-xs text-red-600 hover:underline delete-stop-btn" data-stop-id="${stop.id}">Delete</button>
      </div>
    `;
  }

  const content = `
    <div class="min-w-[200px] p-1">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
        <span class="text-xs text-gray-500 uppercase">${typeLabel}</span>
      </div>
      <h3 class="font-semibold text-gray-900">${locationName}</h3>
      ${timeRange ? `<p class="text-sm text-gray-500">${timeRange}</p>` : ''}
      ${stop.notes ? `<p class="text-xs text-gray-400 mt-1 italic">${stop.notes}</p>` : ''}
      ${buttons}
    </div>
  `;

  return new (google.maps.InfoWindow as any)({
    content: content,
    maxWidth: 280,
  });
}

function updateRoute(stops: Stop[]) {
  if (!map || !directionsService || !directionsRenderer || stops.length < 2) return;

  const origin = { lat: stops[0].latitude!, lng: stops[0].longitude! };
  const destination = { lat: stops[stops.length - 1].latitude!, lng: stops[stops.length - 1].longitude! };

  const waypoints = stops.slice(1, -1).map(s => ({
    location: { lat: s.latitude!, lng: s.longitude! },
    stopover: true,
  }));

  // Map UI profile values to Google Maps TravelMode
  const profileMap: Record<string, string> = {
    DRIVING: 'DRIVING',
    TWO_WHEELER: 'DRIVING', // Google Maps JS API doesn't have TWO_WHEELER; use DRIVING
    TRANSIT: 'TRANSIT',
    WALKING: 'WALKING',
    BICYCLING: 'BICYCLING',
  };
  const profile = profileMap[getRouteProfile()] ?? 'DRIVING';

  const request: any = {
    origin: origin,
    destination: destination,
    waypoints: waypoints,
    travelMode: profile as any,
    optimizeWaypoints: false,
  };

  directionsService.route(request, (result: any, status: any) => {
    if (status === 'OK' && result) {
      directionsRenderer!.setDirections(result);
    }
  });
}

function clearRoute() {
  if (directionsRenderer) {
    directionsRenderer.setDirections({ routes: [] });
  }
}

function getRouteProfile(): string {
  const selector = document.getElementById('route-selector-v2');
  return (selector?.dataset.routeProfile as string) || 'DRIVING';
}

function fitBoundsToMarkers() {
  if (!map || markers.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  markers.forEach(m => bounds.extend(m.getPosition()!));
  map.fitBounds(bounds, 60);
}

// ============ GOOGLE PLACES AUTOCOMPLETE WIDGET ============

function initSearchBox() {
  const searchContainer = document.getElementById('location-search-container');
  const searchInput = document.getElementById('location-search-input-v2') as HTMLInputElement | null;
  
  if (!searchInput || !map) return;

  const placesService = new google.maps.places.PlacesService(map);

  // Use Google's official PlaceAutocompleteElement
  const initAutocomplete = async () => {
    try {
      // Import the places library
      const { PlaceAutocompleteElement } = await google.maps.importLibrary('places') as any;
      
      // Create the autocomplete element (no 'options' key — not supported)
      const autocompleteElement = new PlaceAutocompleteElement({
        inputElement: searchInput,
      });
      
      // Add to container
      searchContainer?.appendChild(autocompleteElement);
      
      // Listen for place selection
      autocompleteElement.addEventListener('gmp-select', async (event: any) => {
        const prediction = event.placePrediction;
        if (!prediction) return;

        // Convert PlacePrediction → Place, then fetch fields (new Places API uses camelCase names)
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: [
            'displayName',
            'formattedAddress',
            'location',
            'rating',
            'userRatingCount',
            'photos',
            'id',
            'regularOpeningHours',
            'websiteURI',
            'nationalPhoneNumber',
            'priceLevel',
            'types',
          ]
        });

        if (place.location) {
          const lat = place.location.lat();
          const lng = place.location.lng();

          map?.panTo({ lat, lng });
          map?.setZoom(16);

          // Get photo (new API uses getURI() instead of getUrl())
          let photoUrl: string | undefined;
          if (place.photos && place.photos.length > 0) {
            try {
              photoUrl = (place.photos[0] as any).getURI?.({ maxWidth: 600, maxHeight: 400 })
                ?? (place.photos[0] as any).getUrl?.({ maxWidth: 600, maxHeight: 400 });
            } catch (_) {}
          }

          const placeDetails: PlaceDetails = {
            name: (place as any).displayName || 'Unknown Place',
            address: (place as any).formattedAddress || '',
            lat,
            lng,
            rating: place.rating,
            ratingCount: (place as any).userRatingCount,
            photoUrl,
            placeId: (place as any).id,
            phone: (place as any).nationalPhoneNumber,
            website: (place as any).websiteURI,
            priceLevel: (place as any).priceLevel,
            types: place.types,
            isOpen: (place as any).regularOpeningHours?.isOpen?.(),
            openingHours: (place as any).regularOpeningHours?.weekdayDescriptions,
          };
          
          showLocationPreview(lat, lng, (place as any).displayName || 'Unknown Place', placeDetails);
        }
      });
      
    } catch (error) {
      console.error('PlaceAutocompleteElement failed:', error);
      // Fallback to programmatic autocomplete
      initAutocompleteFallback();
    }
  };

  // Initialize
  initAutocomplete();
}

// Fallback using AutocompleteService
function initAutocompleteFallback() {
  const searchContainer = document.getElementById('location-search-container');
  const searchInput = document.getElementById('location-search-input-v2') as HTMLInputElement | null;
  
  if (!searchInput || !map) return;

  const autocompleteService = new google.maps.places.AutocompleteService();
  const placesService = new google.maps.places.PlacesService(map);

  let debounceTimer: ReturnType<typeof setTimeout>;

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.id = 'search-dropdown';
  dropdown.className = 'absolute top-full left-0 right-0 bg-white rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto mt-1 hidden';
  searchContainer?.appendChild(dropdown);

  const hideDropdown = () => {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
      hideDropdown();
      return;
    }

    debounceTimer = setTimeout(() => {
      autocompleteService.getPlacePredictions({
        input: query,
        componentRestrictions: { country: 'ph' },
      }, (predictions: any, status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
          dropdown.innerHTML = predictions.map((p: any) => `
            <div class="search-result flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer" data-place-id="${p.place_id}">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-gray-900">${p.structured_formatting?.main_text || p.description}</p>
                <p class="text-xs text-gray-500">${p.structured_formatting?.secondary_text || ''}</p>
              </div>
            </div>
          `).join('');
          
          dropdown.classList.remove('hidden');
          
          dropdown.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
              const placeId = (el as HTMLElement).dataset.placeId;
              if (placeId) {
                hideDropdown();
                searchInput.blur();
                getPlaceDetails(placeId);
              }
            });
          });
        } else {
          hideDropdown();
        }
      });
    }, 300);
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(hideDropdown, 200);
  });

  const getPlaceDetails = (placeId: string) => {
    showLocationPreview(0, 0, 'Loading...');
    
    placesService.getDetails({
      placeId,
      fields: [
        'name', 'formatted_address', 'geometry.location', 'rating',
        'user_ratings_total', 'photos', 'place_id', 'opening_hours',
        'website', 'formatted_phone_number', 'price_level', 'types'
      ]
      }, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        map?.panTo({ lat, lng });
        map?.setZoom(16);
        
        let photoUrl: string | undefined;
        if (place.photos?.length) {
          photoUrl = place.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 });
        }
        
        const details: PlaceDetails = {
          name: place.name || 'Unknown',
          address: place.formatted_address || '',
          lat, lng,
          rating: place.rating,
          ratingCount: place.user_ratings_total,
          photoUrl,
          placeId: place.place_id,
          phone: place.formatted_phone_number,
          website: place.website,
          priceLevel: place.price_level,
          types: place.types,
          isOpen: place.opening_hours?.isOpen(),
        };
        
        showLocationPreview(lat, lng, place.name || 'Unknown', details);
      }
    });
  };
}

interface PlaceDetails {
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  ratingCount?: number;
  photoUrl?: string;
  photoAttribution?: string;
  placeId: string;
  phone?: string;
  website?: string;
  priceLevel?: number;
  types?: string[];
  isOpen?: boolean;
  openingHours?: string[];
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  return new Promise((resolve) => {
    const placesService = new google.maps.places.PlacesService(map!);
    
    placesService.getDetails({
      placeId: placeId,
      fields: [
        'name',
        'formatted_address',
        'geometry.location',
        'rating',
        'photos',
        'user_ratings_total',
        'opening_hours',
        'price_level',
        'website',
        'formatted_phone_number',
      ],
      }, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        let photoUrl: string | undefined;
        let photoAttribution: string | undefined;
        
        if (place.photos && place.photos.length > 0) {
          const photo = place.photos[0];
          photoUrl = photo.getUrl({ maxWidth: 400, maxHeight: 300 });
          photoAttribution = photo.html_attributions?.[0];
        }

        resolve({
          name: place.name || 'Unknown Place',
          address: place.formatted_address || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          rating: place.rating,
          photoUrl,
          photoAttribution,
          placeId: place.place_id,
        });
      } else {
        resolve(null);
      }
    });
  });
}

function showLocationPreview(lat: number, lng: number, locationName: string, placeDetails?: PlaceDetails) {
  // Remove existing preview if any
  const existingPreview = document.getElementById('location-preview');
  if (existingPreview) existingPreview.remove();

  // Use place details if available
  const displayName = placeDetails?.name || locationName;
  const displayAddress = placeDetails?.address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
  const rating = placeDetails?.rating;
  const ratingCount = placeDetails?.ratingCount;
  const photoUrl = placeDetails?.photoUrl;
  const phone = placeDetails?.phone;
  const website = placeDetails?.website;
  const isOpen = placeDetails?.isOpen;
  const priceLevel = placeDetails?.priceLevel;
  const types = placeDetails?.types;

  // Escape HTML to prevent XSS
  const escapeHtml = (str: string) => str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] || c));

  const safeName = escapeHtml(displayName);
  const safeAddress = escapeHtml(displayAddress);

  // Price level to $ signs
  const priceSigns = priceLevel ? '$'.repeat(priceLevel) : '';

  // Get category from types
  const category = types?.[0]?.replace(/_/g, ' ') || 'Place';

  // Build photo HTML - larger, like Google Maps
  const photoHtml = photoUrl 
    ? `<div class="w-full h-44 sm:h-52 relative">
        <img src="${photoUrl}" alt="${safeName}" class="w-full h-full object-cover" />
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <span class="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">${escapeHtml(category)}</span>
        </div>
      </div>` 
    : `<div class="w-full h-32 bg-gray-100 flex items-center justify-center">
        <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>`;

  // Rating stars
  const starsHtml = rating ? `
    <div class="flex items-center gap-1">
      <span class="text-yellow-500 font-semibold">${rating.toFixed(1)}</span>
      <div class="flex">
        ${Array(5).fill(0).map((_, i) => `
          <svg class="w-4 h-4 ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        `).join('')}
      </div>
      ${ratingCount ? `<span class="text-xs text-gray-500">(${ratingCount})</span>` : ''}
    </div>
  ` : '';

  const preview = document.createElement('div');
  preview.id = 'location-preview';
  preview.className = 'absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl z-30 overflow-hidden max-h-[85vh]';
  
  preview.innerHTML = `
    ${photoHtml}
    <div class="p-4 pb-6">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-900 leading-tight">${safeName}</h3>
          <p class="text-sm text-gray-600 mt-1">${safeAddress}</p>
        </div>
        ${priceSigns ? `<span class="text-green-600 font-medium flex-shrink-0">${priceSigns}</span>` : ''}
      </div>
      
      ${starsHtml || isOpen !== undefined ? `
        <div class="flex items-center gap-3 mt-3">
          ${isOpen !== undefined ? `
            <span class="px-2 py-1 rounded text-xs font-medium ${isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
              ${isOpen ? 'Open' : 'Closed'}
            </span>
          ` : ''}
        </div>
      ` : ''}

      ${phone || website ? `
        <div class="mt-3 pt-3 border-t space-y-2">
          ${phone ? `<p class="text-sm text-gray-600">📞 ${escapeHtml(phone)}</p>` : ''}
          ${website ? `<a href="${escapeHtml(website)}" target="_blank" class="text-sm text-blue-600 hover:underline block truncate">🌐 ${escapeHtml(website.replace(/^https?:\/\//, ''))}</a>` : ''}
        </div>
      ` : ''}

      <div class="flex gap-3 mt-4">
        <button id="preview-close" class="btn btn-ghost flex-1">Close</button>
        <button id="preview-add-stop" class="btn btn-primary flex-1">Add to Trip</button>
      </div>
    </div>
  `;

  // Close button in top right
  const closeBtn = document.createElement('button');
  closeBtn.className = 'absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white';
  closeBtn.innerHTML = '✕';
  preview.appendChild(closeBtn);

  const mapContainer = document.getElementById('map-container-v2');
  if (mapContainer) {
    mapContainer.parentElement?.appendChild(preview);
  }

  // Animate in
  preview.style.transform = 'translateY(100%)';
  preview.style.transition = 'transform 0.3s ease';
  requestAnimationFrame(() => {
    preview.style.transform = 'translateY(0)';
  });

  // Event listeners
  closeBtn.addEventListener('click', () => closePreview(preview));
  preview.querySelector('#preview-close')?.addEventListener('click', () => closePreview(preview));
  preview.querySelector('#preview-add-stop')?.addEventListener('click', () => {
    closePreview(preview);
    openAddStopModal(lat, lng, displayName, placeDetails?.address);
  });
}

function closePreview(preview: HTMLElement) {
  preview.style.transform = 'translateY(100%)';
  setTimeout(() => preview.remove(), 300);
}

function initSearchBoxFallback() {
  const searchInput = document.getElementById('location-search-input-v2') as HTMLInputElement | null;
  if (!searchInput || !map) return;

  const autocompleteService = new google.maps.places.AutocompleteService();
  const placesService = new google.maps.places.PlacesService(map);

  let debounceTimer: number;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const query = searchInput.value;
      if (!query || query.length < 3) return;

      autocompleteService.getPlacePredictions({
        input: query,
        componentRestrictions: { country: 'ph' },
        types: ['establishment', 'address', 'point_of_interest'],
      }, (predictions: any, status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
          const prediction = predictions[0];
          placesService.getDetails({
            placeId: prediction.place_id,
            fields: [
              'geometry', 
              'name', 
              'formatted_address',
              'rating',
              'photos',
              'place_id'
            ],
          }, (place:any, detailsStatus:string) => {
            if (detailsStatus === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              
              // Get photo if available
              let photoUrl: string | undefined;
              if (place.photos && place.photos.length > 0) {
                photoUrl = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 });
              }
              
              const placeDetails: PlaceDetails = {
                name: place.name || 'Unknown Place',
                address: place.formatted_address || '',
                lat,
                lng,
                rating: place.rating,
                photoUrl,
                placeId: place.place_id,
              };
              
              map?.panTo({ lat, lng });
              map?.setZoom(15);
              
              // Show preview with full details
              showLocationPreview(lat, lng, place.name || place.formatted_address || prediction.description || 'Selected Location', placeDetails);
            }
          });
        }
      });
    }, 300);
  });
}

/** Convert a UTC ISO string to a local YYYY-MM-DD date string. */
function toLocalDateStr(utcIso: string): string {
  const d = new Date(utcIso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function initDayTabs(stops: Stop[]) {
  console.log('[ItineraryMapV2] initDayTabs — stops:', stops.length);
  const container = document.getElementById('itinerary-map-v2');
  const tripDetailsRaw = container?.dataset.tripDetails;
  let tripDetails: { start_date?: string; end_date?: string } = {};
  if (tripDetailsRaw) {
    try { tripDetails = JSON.parse(tripDetailsRaw); } catch (_) {}
  }

  const days: { label: string; date: string }[] = [{ label: 'All', date: 'all' }];

  console.log('[ItineraryMapV2] tripDetails parsed:', tripDetails);
  if (tripDetails.start_date && tripDetails.end_date) {
    const start = new Date(tripDetails.start_date);
    const end = new Date(tripDetails.end_date);
    let current = new Date(start);
    let dayNum = 1;
    while (current <= end) {
      const localDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      days.push({ label: `Day ${dayNum}`, date: localDate });
      current.setDate(current.getDate() + 1);
      dayNum++;
    }
  } else {
    const seen = new Set<string>();
    stops.forEach(s => { if (s.scheduled_start) seen.add(toLocalDateStr(s.scheduled_start)); });
    [...seen].sort().forEach((date, i) => days.push({ label: `Day ${i + 1}`, date }));
  }

  const renderTabs = (containerId: string) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = days.map((d, i) => `
      <button class="day-tab-btn flex-shrink-0 btn btn-xs ${i === 0 ? 'btn-primary' : 'btn-ghost border border-gray-200'}"
        data-date="${d.date}">${d.label}</button>
    `).join('');
    el.querySelectorAll<HTMLButtonElement>('.day-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setActiveDay(btn.dataset.date || 'all'));
    });
  };

  console.log('[ItineraryMapV2] Day tabs generated:', days.map(d => `${d.label}=${d.date}`));
  renderTabs('day-tabs-v2');
  renderTabs('day-tabs-v2-desktop');
}

function setActiveDay(dateStr: string) {
  activeDay = dateStr;

  ['day-tabs-v2', 'day-tabs-v2-desktop'].forEach(id => {
    document.getElementById(id)?.querySelectorAll<HTMLButtonElement>('.day-tab-btn').forEach(btn => {
      const isActive = btn.dataset.date === dateStr;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-ghost', !isActive);
      btn.classList.toggle('border', !isActive);
      btn.classList.toggle('border-gray-200', !isActive);
    });
  });

  const filtered = dateStr === 'all'
    ? allStops
    : allStops.filter(s => !s.scheduled_start || toLocalDateStr(s.scheduled_start) === dateStr);

  renderMarkers(filtered, mapCanEdit, mapTripId);
  if (filtered.length > 0) fitBoundsToMarkers();
  renderTimeline(dateStr);

  // Update mobile bottom sheet header count
  const countEl = document.querySelector('#bottom-sheet .font-semibold');
  if (countEl) countEl.textContent = `🗺️ ${filtered.length} Stops`;
}

function renderTimeline(dateFilter: string) {
  const bsContent = document.getElementById('bottom-sheet-content');
  const tlContent = document.getElementById('timeline-content');
  console.log('[ItineraryMapV2] renderTimeline dateFilter=%s | bsContent=%s | tlContent=%s | allStops=%d',
    dateFilter, !!bsContent, !!tlContent, allStops.length);
  if (!bsContent && !tlContent) return;

  const filtered = (dateFilter === 'all'
    ? [...allStops]
    : allStops.filter(s => !s.scheduled_start || toLocalDateStr(s.scheduled_start) === dateFilter)
  ).sort((a, b) => a.order_index - b.order_index);

  const pickup  = filtered.find(s => s.location_type === 'pickup');
  const dropoff = filtered.find(s => s.location_type === 'dropoff');
  const middle  = filtered.filter(s => s.location_type !== 'pickup' && s.location_type !== 'dropoff');
  console.log('[ItineraryMapV2] renderTimeline filtered=%d pickup=%s dropoff=%s middle=%d',
    filtered.length, !!pickup, !!dropoff, middle.length);
  middle.forEach((s, i) => console.log(`  [${i}] id=${s.id} type=${s.location_type} name=${s.location_name} order=${s.order_index} sched=${s.scheduled_start ?? 'null'}`));

  // Build ordered item list for Google Maps-style waypoint rendering
  type WpItem =
    | { kind: 'pickup'; stop: Stop }
    | { kind: 'stop'; stop: Stop; num: number }
    | { kind: 'add' }
    | { kind: 'dropoff'; stop: Stop };

  const items: WpItem[] = [];
  if (pickup) items.push({ kind: 'pickup', stop: pickup });
  const middleOffset = pickup ? 2 : 1;
  middle.forEach((stop, i) => items.push({ kind: 'stop', stop, num: middleOffset + i }));
  if (mapCanEdit) items.push({ kind: 'add' });
  if (dropoff) items.push({ kind: 'dropoff', stop: dropoff });

  const wpRow = (item: WpItem, idx: number): string => {
    const isFirst = idx === 0;
    const isLast = idx === items.length - 1;
    const lineTop = isFirst ? 'opacity-0' : '';
    const lineBot = isLast ? 'opacity-0' : '';

    if (item.kind === 'add') {
      return `
        <div class="flex items-stretch">
          <div class="flex flex-col items-center w-10 flex-shrink-0">
            <div class="w-0.5 flex-1 bg-gray-300 ${lineTop}"></div>
            <div class="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
              <span class="text-gray-400 text-xs font-bold leading-none">+</span>
            </div>
            <div class="w-0.5 flex-1 bg-gray-300 ${lineBot}"></div>
          </div>
          <div class="flex items-center py-2.5 flex-1">
            <button id="inline-add-stop-btn" class="text-sm text-blue-500 font-medium hover:text-blue-700 transition-colors">+ Add a stop</button>
          </div>
        </div>`;
    }

    const stop = item.stop;
    const name = stop.location?.name || stop.location_name;
    const typeLabel = stop.location_type?.replace(/_/g, ' ') || 'stop';
    const isAnchor = item.kind === 'pickup' || item.kind === 'dropoff';
    const draggable = mapCanEdit && !isAnchor ? 'draggable="true"' : '';

    let dotHtml = '';
    if (item.kind === 'pickup') {
      dotHtml = `<div class="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
        <span class="text-white text-[10px] font-bold leading-none">A</span>
      </div>`;
    } else if (item.kind === 'dropoff') {
      dotHtml = `<svg class="w-4 h-5 flex-shrink-0 text-orange-500" viewBox="0 0 20 28" fill="currentColor">
        <path d="M10 0C4.477 0 0 4.477 0 10c0 7.5 10 18 10 18S20 17.5 20 10C20 4.477 15.523 0 10 0zm0 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
      </svg>`;
    } else {
      const color = getStopColor(stop.location_type);
      dotHtml = `<div class="w-4 h-4 rounded-full border-2 flex-shrink-0 bg-white" style="border-color:${color}"></div>`;
    }

    const actions = mapCanEdit ? `
      <div class="flex items-center gap-0.5 flex-shrink-0">
        <button class="edit-stop-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-blue-500 transition-colors" data-stop-id="${stop.id}">
          <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <button class="delete-stop-btn p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors" data-stop-id="${stop.id}">
          <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        ${!isAnchor ? `<div class="drag-handle p-1.5 text-gray-200 hover:text-gray-400 cursor-grab touch-none">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
        </div>` : ''}
      </div>` : '';

    return `
      <div class="timeline-stop-card flex items-stretch" data-stop-id="${stop.id}" ${draggable}>
        <div class="flex flex-col items-center w-10 flex-shrink-0">
          <div class="w-0.5 flex-1 bg-gray-300 ${lineTop}"></div>
          <div class="flex items-center justify-center py-0.5">${dotHtml}</div>
          <div class="w-0.5 flex-1 bg-gray-300 ${lineBot}"></div>
        </div>
        <div class="flex flex-1 items-center gap-1 py-3 pr-1 min-w-0 cursor-pointer rounded-r-lg hover:bg-gray-50 transition-colors">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">${escHtml(name)}</p>
            <p class="text-xs text-gray-400 capitalize">${escHtml(typeLabel)}</p>
          </div>
          ${actions}
        </div>
      </div>`;
  };

  let html = '';
  if (items.length === 0 || (items.length === 1 && items[0].kind === 'add')) {
    html = `<p class="text-sm text-gray-400 text-center py-8">No stops for this day</p>
      ${mapCanEdit ? `<button id="inline-add-stop-btn" class="w-full mt-2 py-2 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors">+ Add Stop</button>` : ''}`;
  } else {
    html = items.map((item, idx) => wpRow(item, idx)).join('');
  }

  const inject = (el: HTMLElement | null) => {
    if (!el) return;
    el.innerHTML = html;
    el.style.opacity = '1';

    el.querySelector('#inline-add-stop-btn')?.addEventListener('click', () => {
      const center = map?.getCenter();
      if (center) openAddStopModal(center.lat(), center.lng());
    });

    el.querySelectorAll<HTMLElement>('.timeline-stop-card').forEach(card => {
      card.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('button, .drag-handle')) return;
        const stop = allStops.find(s => s.id === card.dataset.stopId);
        if (stop?.latitude && stop?.longitude) {
          map?.panTo({ lat: stop.latitude, lng: stop.longitude });
          map?.setZoom(15);
        }
      });
    });

    if (mapCanEdit) initDragDrop(el);
  };

  inject(bsContent);
  inject(tlContent);
}

function initDragDrop(container: HTMLElement) {
  const cards = container.querySelectorAll<HTMLElement>('[draggable="true"]');
  let dragId: string | null = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      dragId = card.dataset.stopId || null;
      dragOriginalOrder = [...allStops].sort((a, b) => a.order_index - b.order_index);
      card.classList.add('opacity-50');
      e.dataTransfer?.setData('text/plain', dragId || '');
    });
    card.addEventListener('dragend', () => card.classList.remove('opacity-50'));
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('ring-2', 'ring-blue-400'); });
    card.addEventListener('dragleave', () => card.classList.remove('ring-2', 'ring-blue-400'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('ring-2', 'ring-blue-400');
      const targetId = card.dataset.stopId;
      if (!dragId || !targetId || dragId === targetId) return;
      reorderListOptimistic(dragId, targetId);
    });
  });
}

function reorderListOptimistic(draggedId: string, targetId: string) {
  const sorted = [...allStops].sort((a, b) => a.order_index - b.order_index);
  const dragged = sorted.find(s => s.id === draggedId);
  if (!dragged) return;
  const without = sorted.filter(s => s.id !== draggedId);
  const targetIdx = without.findIndex(s => s.id === targetId);
  without.splice(targetIdx + 1, 0, dragged);
  without.forEach((s, i) => {
    const inAll = allStops.find(a => a.id === s.id);
    if (inAll) inAll.order_index = i + 1;
  });
  renderTimeline(activeDay);
  renderMarkers(
    activeDay === 'all' ? allStops : allStops.filter(s => !s.scheduled_start || toLocalDateStr(s.scheduled_start) === activeDay),
    mapCanEdit, mapTripId
  );
  commitReorder();
}

async function commitReorder() {
  if (!mapTripId) return;
  const order = allStops.map(s => ({ id: s.id, orderIndex: s.order_index }));
  try {
    const { error } = await actions.stops.reorderStops({ tripId: mapTripId, order });
    if (error) throw error;
  } catch (_) {
    // Revert
    allStops.forEach(s => {
      const orig = dragOriginalOrder.find(o => o.id === s.id);
      if (orig) s.order_index = orig.order_index;
    });
    renderTimeline(activeDay);
  }
}

function initBottomSheet() {
  const sheet = document.getElementById('bottom-sheet');
  const handle = document.getElementById('bottom-sheet-handle');

  if (!sheet || !handle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  const minHeight = 60;
  const maxHeight = window.innerHeight * 0.7;

  const updateSheetPosition = () => {
    const content = document.getElementById('bottom-sheet-content');
    if (!content) return;
    const diff = maxHeight - minHeight;
    const percent = currentY / diff;
    content.style.opacity = percent > 0.3 ? '1' : '0';
  };

  const onDragStart = (clientY: number) => {
    isDragging = true;
    startY = clientY;
    document.body.style.overflow = 'hidden';
  };

  const onDrag = (clientY: number) => {
    if (!isDragging) return;
    const diff = startY - clientY;
    currentY = Math.max(0, Math.min(maxHeight - minHeight, currentY + diff));
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
    startY = clientY;
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.overflow = '';
    
    if (currentY > (maxHeight - minHeight) / 2) {
      currentY = maxHeight - minHeight;
    } else {
      currentY = 0;
    }
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
  };

  handle.addEventListener('mousedown', (e) => onDragStart(e.clientY));
  handle.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientY));

  document.addEventListener('mousemove', (e) => onDrag(e.clientY));
  document.addEventListener('touchmove', (e) => onDrag(e.touches[0].clientY));

  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);

  handle.addEventListener('click', () => {
    if (currentY > (maxHeight - minHeight) / 2) {
      currentY = 0;
    } else {
      currentY = maxHeight - minHeight;
    }
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
  });
}

export function openAddStopAtCenterV2() {
  if (!map) return;
  const center = map.getCenter();
  if (center) {
    openAddStopModal(center.lat(), center.lng());
  }
}

function openAddStopModal(lat: number, lng: number, locationName?: string, address?: string) {
  const modal = document.getElementById('stop-modal-v2') as HTMLDialogElement | null;
  if (!modal) return;

  if (map) {
    map.panTo({ lat, lng });
    map.setZoom(15);
  }

  const form = modal.querySelector('form') as HTMLFormElement | null;
  if (form) form.reset();

  const latInput = modal.querySelector('[name="latitude"]') as HTMLInputElement | null;
  const lngInput = modal.querySelector('[name="longitude"]') as HTMLInputElement | null;
  const nameInput = modal.querySelector('[name="name"]') as HTMLInputElement | null;
  const notesInput = modal.querySelector('[name="notes"]') as HTMLTextAreaElement | null;
  
  if (latInput) latInput.value = lat.toString();
  if (lngInput) lngInput.value = lng.toString();
  
  // Use name, fallback to address if name not available
  const displayName = locationName || address || '';
  if (nameInput && displayName) nameInput.value = displayName;
  
  // Put address in notes if available
  if (notesInput && address && locationName && address !== locationName) {
    notesInput.value = `Address: ${address}`;
  }

  const titleEl = document.getElementById('stop-modal-title-v2');
  if (titleEl) titleEl.textContent = 'Add Stop';

  const container = document.getElementById('itinerary-map-v2');
  const stopsData = container?.dataset.stops;
  let currentStops: Stop[] = [];
  if (stopsData) {
    try {
      const raw = JSON.parse(stopsData) as Stop[];
      currentStops = [...raw].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    } catch (e) {}
  }

  const badgeEl = document.getElementById('stop-order-badge-v2');
  if (badgeEl) badgeEl.textContent = `Stop #${currentStops.length + 1}`;

  // Set selected_date from active day tab
  const selectedDateInput = modal.querySelector('[name="selected_date"]') as HTMLInputElement | null;
  if (selectedDateInput) {
    selectedDateInput.value = activeDay === 'all'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
      : activeDay;
  }

  // Reset type pills to first option
  modal.querySelectorAll('.type-pill').forEach((btn, i) => {
    if (i === 0) {
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-ghost', 'border', 'border-gray-200');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-ghost', 'border', 'border-gray-200');
    }
  });
  const typeHidden = modal.querySelector('#location-type-hidden') as HTMLInputElement | null;
  if (typeHidden) typeHidden.value = 'activity';

  // Clear notes
  const notesField = modal.querySelector('#notes-field') as HTMLTextAreaElement | null;
  const notesToggle = modal.querySelector('#notes-toggle') as HTMLButtonElement | null;
  if (notesField) { notesField.value = ''; notesField.classList.add('hidden'); }
  if (notesToggle) notesToggle.textContent = '+ Add notes';

  modal.showModal();
}

export async function openEditStopModalV2(stopId: string) {
  const container = document.getElementById('itinerary-map-v2');
  const stopsData = container?.dataset.stops;
  if (!stopsData) return;

  let stops: Stop[] = [];
  try {
    stops = JSON.parse(stopsData);
  } catch (e) {
    return;
  }

  const stop = stops.find(s => s.id === stopId);
  if (!stop) return;

  const modal = document.getElementById('stop-modal-v2') as HTMLDialogElement | null;
  if (!modal) return;

  const form = modal.querySelector('form') as HTMLFormElement | null;
  if (form) {
    const stopIdInput = form.querySelector('[name="stop_id"]') as HTMLInputElement | null;
    const nameInput = form.querySelector('[name="name"]') as HTMLInputElement | null;
    const locationTypeSelect = form.querySelector('[name="location_type"]') as HTMLSelectElement | null;
    const latInput = form.querySelector('[name="latitude"]') as HTMLInputElement | null;
    const lngInput = form.querySelector('[name="longitude"]') as HTMLInputElement | null;
    const startInput = form.querySelector('[name="scheduled_start"]') as HTMLInputElement | null;
    const endInput = form.querySelector('[name="scheduled_end"]') as HTMLInputElement | null;
    const notesInput = form.querySelector('[name="notes"]') as HTMLTextAreaElement | null;

    if (stopIdInput) stopIdInput.value = stopId;
    if (nameInput) nameInput.value = stop.location?.name || stop.location_name || '';
    if (locationTypeSelect) locationTypeSelect.value = stop.location_type || 'activity';
    if (latInput) latInput.value = stop.latitude?.toString() || '';
    if (lngInput) lngInput.value = stop.longitude?.toString() || '';
    if (startInput) startInput.value = stop.scheduled_start ? stop.scheduled_start.slice(0, 16) : '';
    if (endInput) endInput.value = stop.scheduled_end ? stop.scheduled_end.slice(0, 16) : '';
    if (notesInput) notesInput.value = stop.notes || '';

    // Populate selected_date from stop's scheduled_start
    const selectedDateInput = form.querySelector('[name="selected_date"]') as HTMLInputElement | null;
    if (selectedDateInput) {
      selectedDateInput.value = stop.scheduled_start
        ? toLocalDateStr(stop.scheduled_start)
        : (activeDay === 'all' ? new Date().toISOString().split('T')[0] : activeDay);
    }

    // Update type pill selection
    form.querySelectorAll('.type-pill').forEach((btn, i) => {
      const pill = btn as HTMLButtonElement;
      const isActive = pill.dataset.value === stop.location_type;
      pill.classList.toggle('btn-primary', isActive);
      pill.classList.toggle('btn-ghost', !isActive);
      pill.classList.toggle('border', !isActive);
      pill.classList.toggle('border-gray-200', !isActive);
      if (isActive) {
        const typeHiddenEl = form.querySelector('#location-type-hidden') as HTMLInputElement | null;
        if (typeHiddenEl) typeHiddenEl.value = stop.location_type;
      }
    });
  }

  const titleEl = document.getElementById('stop-modal-title-v2');
  if (titleEl) titleEl.textContent = 'Edit Stop';

  const badgeEl = document.getElementById('stop-order-badge-v2');
  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);
  const stopIndex = sortedStops.findIndex(s => s.id === stopId);
  if (badgeEl && stopIndex >= 0) {
    badgeEl.textContent = `Stop #${stopIndex + 1}`;
  }

  modal.showModal();
}

export async function deleteStopByIdV2(stopId: string) {
  if (!confirm('Are you sure you want to delete this stop?')) return;

  try {
    const { error } = await actions.stops.deleteStop({ stopId });

    if (error) {
      console.error('Failed to delete stop:', error);
      alert('Failed to delete stop: ' + error.message);
      return;
    }

    refreshMapV2();
  } catch (err) {
    console.error('Error deleting stop:', err);
    alert('Failed to delete stop');
  }
}

export async function refreshMapV2() {
  window.location.reload();
}

// Wire desktop "Add Stop" button
document.getElementById('desktop-add-stop-btn')?.addEventListener('click', () => {
  const center = map?.getCenter();
  if (center) openAddStopModal(center.lat(), center.lng());
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('edit-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (stopId) openEditStopModalV2(stopId);
  }

  if (target.classList.contains('delete-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (stopId) deleteStopByIdV2(stopId);
  }

  const routeBtn = target.closest('.route-profile-btn-v2');
  if (routeBtn) {
    const profile = (routeBtn as HTMLElement).dataset.profile;
    if (profile) {
      const selector = document.getElementById('route-selector-v2');
      if (selector) selector.dataset.routeProfile = profile;

      selector?.querySelectorAll('.route-profile-btn-v2').forEach((btn) => {
        btn.classList.remove('text-blue-600', 'bg-blue-50', 'border-blue-600');
        btn.classList.add('text-gray-500', 'border-transparent');
      });
      routeBtn.classList.add('text-blue-600', 'bg-blue-50', 'border-blue-600');
      routeBtn.classList.remove('text-gray-500', 'border-transparent');

      handleRouteProfileChangeV2();
    }
  }
});

export function handleRouteProfileChangeV2() {
  const container = document.getElementById('itinerary-map-v2');
  const stopsData = container?.dataset.stops;

  if (!stopsData) return;

  let stops: Stop[] = [];
  try {
    stops = JSON.parse(stopsData);
  } catch (e) {
    return;
  }

  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);
  updateRoute(sortedStops);
}

window.openEditStopModalV2 = openEditStopModalV2;
window.deleteStopByIdV2 = deleteStopByIdV2;
window.refreshItineraryMapV2 = refreshMapV2;
