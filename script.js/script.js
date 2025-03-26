document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const ATTRACTIONS_JSON_PATH = 'attractions.json';
    const INITIAL_MAP_CENTER = [39.8283, -98.5795]; // Center of the USA
    const INITIAL_MAP_ZOOM = 4;
    const FOCUSED_MAP_ZOOM = 13; // Zoom level when clicking a list item

    // --- DOM Elements ---
    const mapElement = document.getElementById('map');
    const categoryFilter = document.getElementById('category-filter');
    const stateFilter = document.getElementById('state-filter');
    const attractionList = document.getElementById('attraction-list');
    const mapErrorElement = document.getElementById('map-error');
    const noResultsElement = document.getElementById('no-results');

    // --- State Variables ---
    let map = null;
    let attractionsData = [];
    let markersLayerGroup = L.layerGroup(); // Layer group to hold markers for easy clearing
    let allCategories = new Set();
    let allStates = new Set();

    // --- Initialization ---
    initializeMap();
    loadAttractionsData();

    // --- Functions ---

    /**
     * Initializes the Leaflet map.
     */
    function initializeMap() {
        try {
            map = L.map(mapElement).setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM);

            // Add Tile Layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).on('tileerror', function(error, tile) {
                // Handle tile loading errors
                console.error('Tile Error:', error, tile);
                mapErrorElement.style.display = 'block'; // Show error message
            }).addTo(map);

             // Add the layer group for markers to the map
            markersLayerGroup.addTo(map);

        } catch (error) {
            console.error("Error initializing Leaflet map:", error);
            mapElement.innerHTML = '<p class="error-message">Failed to initialize the map. Please ensure Leaflet library is loaded correctly.</p>';
        }
    }

    /**
     * Loads attraction data from the JSON file.
     */
    async function loadAttractionsData() {
        try {
            const response = await fetch(ATTRACTIONS_JSON_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            attractionsData = await response.json();

            // Process data to find unique categories and states
            attractionsData.forEach(attraction => {
                if (attraction.state) {
                    allStates.add(attraction.state.trim());
                }
                if (attraction.categories && Array.isArray(attraction.categories)) {
                    attraction.categories.forEach(cat => allCategories.add(cat.trim()));
                }
            });

            populateFilters();
            displayAttractions(); // Initial display

        } catch (error) {
            console.error("Error loading attractions data:", error);
            attractionList.innerHTML = '<p class="error-message">Could not load attraction data. Please check the JSON file path and format.</p>';
        }
    }

    /**
     * Populates the category and state filter dropdowns.
     */
    function populateFilters() {
        // Sort alphabetically before populating
        const sortedCategories = [...allCategories].sort();
        const sortedStates = [...allStates].sort();

        sortedCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });

        sortedStates.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateFilter.appendChild(option);
        });

        // Add event listeners to filters
        categoryFilter.addEventListener('change', displayAttractions);
        stateFilter.addEventListener('change', displayAttractions);
    }

    /**
     * Filters and displays attractions based on selected filters.
     * Updates both the map markers and the list view.
     */
    function displayAttractions() {
        if (!map) return; // Don't proceed if map isn't initialized

        const selectedCategory = categoryFilter.value;
        const selectedState = stateFilter.value;

        // Filter the data
        const filteredAttractions = attractionsData.filter(attraction => {
            const categoryMatch = selectedCategory === 'all' || (attraction.categories && attraction.categories.includes(selectedCategory));
            const stateMatch = selectedState === 'all' || attraction.state === selectedState;
            return categoryMatch && stateMatch;
        });

        // Clear previous markers and list items
        markersLayerGroup.clearLayers();
        attractionList.innerHTML = ''; // Clear list

        // Hide or show the "no results" message
        noResultsElement.style.display = filteredAttractions.length === 0 ? 'block' : 'none';


        // Add new markers and list items
        filteredAttractions.forEach(attraction => {
            if (attraction.coordinates && attraction.coordinates.length === 2) {
                addMarker(attraction);
                addListItem(attraction);
            } else {
                console.warn(`Skipping attraction due to missing/invalid coordinates: ${attraction.name}`);
            }
        });

        // Optional: Adjust map view to fit markers if needed, but can be jumpy
        // if (filteredAttractions.length > 0) {
        //     map.fitBounds(markersLayerGroup.getBounds().pad(0.1));
        // } else if (attractionsData.length > 0) {
        //     // If filters result in no matches, reset view (optional)
        //     map.setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM);
        // }
    }

    /**
     * Adds a marker to the map for a given attraction.
     * @param {object} attraction - The attraction data object.
     */
    function addMarker(attraction) {
        const marker = L.marker(attraction.coordinates, {
             // Add alt text for accessibility
            alt: `${attraction.name} marker`
        });

        // Create popup content
        const popupContent = `
            <h4>${attraction.name}</h4>
            <p>${attraction.description}</p>
            <p><strong>Location:</strong> ${attraction.location}</p>
        `;
        marker.bindPopup(popupContent);

        // Store attraction ID on marker for potential future use
        marker.attractionId = attraction.id;

        markersLayerGroup.addLayer(marker);
    }

    /**
     * Adds a card to the list view for a given attraction.
     * @param {object} attraction - The attraction data object.
     */
    function addListItem(attraction) {
        const card = document.createElement('div');
        card.className = 'attraction-card';
        // Add data attributes for easy map focusing
        card.dataset.lat = attraction.coordinates[0];
        card.dataset.lon = attraction.coordinates[1];
        card.dataset.id = attraction.id; // Link card to marker

        // --- Category Color Coding ---
        let categoryClass = 'category-default'; // Default color
        if (attraction.categories && attraction.categories.length > 0) {
            // Use the first category for primary color, sanitize for CSS class
            const firstCategorySlug = attraction.categories[0]
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
                .replace(/^-+|-+$/g, '');   // Trim leading/trailing hyphens
            categoryClass = `category-${firstCategorySlug}`;
        }
        card.classList.add(categoryClass); // Add the generated class


        // Create category spans
        const categorySpans = (attraction.categories || [])
            .map(cat => `<span>${cat}</span>`)
            .join('');

        card.innerHTML = `
            <h3>${attraction.name}</h3>
            <p class="location">${attraction.location}</p>
            <p class="description">${attraction.description}</p>
            <div class="categories">Categories: ${categorySpans || 'N/A'}</div>
        `;

        // Add click listener to focus map on this attraction
        card.addEventListener('click', () => {
            const lat = parseFloat(card.dataset.lat);
            const lon = parseFloat(card.dataset.lon);
            const id = parseInt(card.dataset.id);

            if (!isNaN(lat) && !isNaN(lon)) {
                map.flyTo([lat, lon], FOCUSED_MAP_ZOOM);

                // Find the corresponding marker and open its popup
                markersLayerGroup.eachLayer(layer => {
                    if (layer.attractionId === id) {
                       layer.openPopup();
                    }
                });
            }
        });

        attractionList.appendChild(card);
    }

}); // End DOMContentLoaded