import { mapboxSuggest } from "./mapBox/suggestions";
import { mapboxRetrieve } from "./mapBox/retrieve";

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
  const target = document.querySelector<HTMLInputElement>(targetSelector);
  if (!target) {
    console.error(`MapboxSearchBox: Target "${targetSelector}" not found`);
    return;
  }

  const sessionToken = sessionTokenID;

  // Wrap original input (keep DOM node to prevent focus loss)
  const wrapper = document.createElement("div");
  wrapper.className = "relative w-full mb-3";
  target.parentNode?.insertBefore(wrapper, target);
  wrapper.appendChild(target);

  const input = target;
  input.type = "text";
  input.placeholder = placeholder;
  input.className =
    "w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500";

  // Suggestion dropdown
  const suggestionBox = document.createElement("ul");
  suggestionBox.className =
    "absolute z-10 bg-white border rounded-lg w-full mt-1 shadow-lg max-h-60 overflow-auto hidden";
  wrapper.appendChild(suggestionBox);

  const liPool: HTMLLIElement[] = []; // pool of reusable <li> elements
  let suggestions: MapboxSuggestion[] = [];
  let debounceTimeout: number | undefined;

  const clearSuggestions = () => {
    liPool.forEach((li) => li.remove());
    suggestionBox.classList.add("hidden");
  };

  input.addEventListener("input", () => {
    const query = input.value.trim();
    clearTimeout(debounceTimeout);

    if (!query) {
      clearSuggestions();
      return;
    }

    debounceTimeout = window.setTimeout(async () => {
      try {
        const results = await mapboxSuggest({ query, sessionToken, country, language });
        suggestions = results;

        // Reuse <li> elements from the pool
        let fragment = document.createDocumentFragment();

        results.forEach((item:any, index: number) => {
          let li: HTMLLIElement;
          if (liPool[index]) {
            li = liPool[index];
          } else {
            li = document.createElement("li");
            li.className =
              "px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b last:border-none";
            liPool.push(li);
          }

          li.textContent = item.name;
          li.title = item.place_formatted || item.name;

          li.onclick = async () => {
            input.value = item.name;
            suggestionBox.classList.add("hidden");

            const place = await mapboxRetrieve({ suggestionId: item.mapbox_id, sessionToken });
            const feature = place?.features?.[0];
            if (!feature) return;

            onSelect?.({
              name: feature.properties?.name,
              coordinates: feature.geometry?.coordinates as [number, number],
              context: feature.properties?.context,
            });
          };

          fragment.appendChild(li);
        });

        // Hide unused <li> in pool
        for (let i = results.length; i < liPool.length; i++) {
          liPool[i].remove();
        }

        suggestionBox.innerHTML = "";
        suggestionBox.appendChild(fragment);
        suggestionBox.classList.toggle("hidden", results.length === 0);
      } catch (err) {
        console.error("Mapbox suggest failed:", err);
      }
    }, 400);
  });

  // Show suggestions on focus if available
  input.addEventListener("focus", () => {
    if (suggestions.length > 0) suggestionBox.classList.remove("hidden");
  });

  // Hide suggestions on outside click
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target as Node)) {
      suggestionBox.classList.add("hidden");
    }
  });
}
