// import { mapboxSuggest, mapboxRetrieve } from "../lib/mapboxSearch.js";
import {mapboxSuggest} from "./mapBox/suggestions";
import { mapboxRetrieve } from "./mapBox/retrieve";
import { PUBLIC_MAPBOX_TOKEN } from "astro:env/client";

interface MapboxSearchBoxOptions {
  sessionTokenID: string;
  targetSelector: string;
  country?: string;
  language?: string;
  placeholder?: string;
  onSelect?: (result: {
    name: string;
    coordinates: [number, number];
    context?: Record<string, any>;
  }) => void;
}

interface MapboxSuggestion {
  name: string;
  mapbox_id: string;
  place_formatted?: string;
}

export function createMapboxSearchBox({
  sessionTokenID,
  targetSelector,
  country = "PH",
  language = "en",
  placeholder = "Search location...",
  onSelect,
}: MapboxSearchBoxOptions): void {
  let accessToken = PUBLIC_MAPBOX_TOKEN;
  const sessionToken = sessionTokenID;
  const target = document.querySelector<HTMLInputElement>(targetSelector);

  if (!target) {
    console.error(`MapboxSearchBox: Target "${targetSelector}" not found`);
    return;
  }

  // Create elements
  const wrapper = document.createElement("div");
  wrapper.className = "relative w-full mb-3";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.className =
    "w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500";
  wrapper.appendChild(input);

  const suggestionBox = document.createElement("ul");
  suggestionBox.className =
    "absolute z-10 bg-white border rounded-lg w-full mt-1 shadow-lg max-h-60 overflow-auto hidden";
  wrapper.appendChild(suggestionBox);

  target.replaceWith(wrapper);

  let debounceTimeout: number | undefined;
  let suggestions: MapboxSuggestion[] = [];

  // Debounce + Suggest handler
  input.addEventListener("input", async () => {
    const query = input.value.trim();
    clearTimeout(debounceTimeout);

    if (!query) {
      suggestionBox.classList.add("hidden");
      return;
    }

    debounceTimeout = window.setTimeout(async () => {
      try {
        const results = await mapboxSuggest({
          query,
          sessionToken,
          country,
          language,
        });

        suggestions = results;
        suggestionBox.innerHTML = "";

        results.forEach((s: MapboxSuggestion) => {
          const li = document.createElement("li");
          li.className =
            "px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b last:border-none";
          li.textContent = s.name;
          li.title = s.place_formatted || s.name;

          li.addEventListener("click", async () => {
            input.value = s.name;
            suggestionBox.classList.add("hidden");

            const place = await mapboxRetrieve({
              suggestionId: s.mapbox_id,
              sessionToken,
            });

            const feature = place?.features?.[0];
            if (feature) {
              const result = {
                name: feature.properties?.name,
                coordinates: feature.geometry?.coordinates as [number, number],
                context: feature.properties?.context,
              };
              onSelect?.(result);
            }
          });

          suggestionBox.appendChild(li);
        });

        suggestionBox.classList.toggle("hidden", results.length === 0);
      } catch (err) {
        console.error("Mapbox suggest failed:", err);
      }
    }, 400);
  });

  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target as Node)) {
      suggestionBox.classList.add("hidden");
    }
  });
}
