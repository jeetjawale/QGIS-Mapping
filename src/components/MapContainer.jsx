import React, { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import { MAPTILER_KEY, OPENROUTESERVICE_KEY } from "../config";
import { loadGeoJSONs } from "../utils/geojsonLoader";
import PlacePanel from "./PlacePanel";
import SearchBar from "./SearchBar";
import FilterBar from "./FilterBar";
import ProfileButton from "./ProfileButton";
import ProfilePanel from "./ProfilePanel";
import LoginSignupModal from "./LoginSignupModal";
import { updateUserProfile, getUserProfile } from "../userData";
import "maplibre-gl/dist/maplibre-gl.css";
import PopularNearYou from "./PopularNearYou";

// Basemaps and GeoJSON files
const basemaps = {
  osm: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_KEY}`,
};
const geojsonFiles = ["/data/cultural_places.geojson"];
const mhBorderFile = "/data/mh_border.geojson";
const divisionsFile = "/data/divisions.geojson";

function formatArrivalTime(durationSeconds) {
  const d = new Date(Date.now() + durationSeconds * 1000);
  const pad = n => n < 10 ? "0" + n : n;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


function runWhenStyleReady(map, fn) {
  if (map && map.isStyleLoaded && map.isStyleLoaded()) {
    fn();
  } else if (map && map.once) {
    map.once("style.load", fn);
  }
}


export default function MapContainer() {
  // Add at the top of MapContainer function
function handleFilterChange() {
  setSelected(null);
  clearRoute();
}


  useEffect(() => {
    const handler = () => setShowLogin(true);
    window.addEventListener("openLoginModal", handler);
    return () => window.removeEventListener("openLoginModal", handler);
  }, []);

  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [map, setMap] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mhBorder, setMhBorder] = useState(null);
  const [lastSelected, setLastSelected] = useState(null);

  // --- Route state ---
  const [routeGeojson, setRouteGeojson] = useState(null);
  const [routeDest, setRouteDest] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);

  // Profile state
  const [user, setUser] = useState(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return (u && u.uid) ? u : null;
  });
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Multi-select state
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDistricts, setSelectedDistricts] = useState([]);

  // User location state for Popular Near You
  const [userLoc, setUserLoc] = useState(null);

  // State to manage search focus (for panel overlap fix)
  const [searchActive, setSearchActive] = useState(false);

  // Filters
  const categories = useMemo(() =>
    Array.from(new Set(places.map(f =>
      (f.properties ? f.properties.Category : f.Category)
    ).filter(Boolean))).sort(),
    [places]
  );
  const districts = useMemo(() =>
    Array.from(new Set(places.map(f =>
      (f.properties ? f.properties.District : f.District)
    ).filter(Boolean))).sort(),
    [places]
  );
  const placeList = useMemo(() =>
    places.map(f => ({ ...f.properties, ...f, properties: undefined })),
    [places]
  );

  const filteredPlaces = useMemo(() =>
    placeList.filter(p => {
      const matchCat =
        selectedCategories.length === 0 || selectedCategories.includes(p.Category);
      const matchDist =
        selectedDistricts.length === 0 || selectedDistricts.includes(p.District);
      return matchCat && matchDist;
    }),
    [placeList, selectedCategories, selectedDistricts]
  );

  // Always fetch latest user profile after login
  async function handleLogin(userProfile) {
    if (!userProfile || !userProfile.uid) {
      setUser(null);
      localStorage.removeItem("user");
      return;
    }
    // Fetch the latest user profile from Firebase!
    const latest = await getUserProfile(userProfile.uid);
    setUser(latest);
    localStorage.setItem("user", JSON.stringify(latest));
    setShowLogin(false);
  }

  useEffect(() => {
    const m = new maplibregl.Map({
      container: mapRef.current,
      style: basemaps.osm,
      center: [73.5, 18.5],
      zoom: 7,
    });
    setMap(m);
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!map) return;
    loadGeoJSONs(geojsonFiles).then(geojson => {
      if (!geojson || !geojson.features) return;
      setPlaces(geojson.features);
    });
  }, [map]);

  useEffect(() => {
    if (!map) return;
    let removed = false;
    function addLineLayer(sourceName, layerId, url, color, width, cb) {
      fetch(url)
        .then(res => res.json())
        .then(geojson => {
          if (removed || !map) return;
          if (map.getLayer && map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource && map.getSource(sourceName)) map.removeSource(sourceName);
          map.addSource(sourceName, { type: "geojson", data: geojson });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceName,
            paint: {
              "line-color": color,
              "line-width": width,
              "line-opacity": 0.9
            }
          });
          if (cb) cb(geojson);
        });
    }
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      addLineLayer("border", "border-line", mhBorderFile, "#bc004c", 3, (geojson) => {
        setMhBorder(geojson);
        const bounds = turf.bbox(geojson);
        map.fitBounds(bounds, { padding: 30 });
      });
      addLineLayer("divisions", "divisions-line", divisionsFile, "#2095F3", 2);
    } else if (map.once) {
      map.once("style.load", () => {
        addLineLayer("border", "border-line", mhBorderFile, "#bc004c", 3, (geojson) => {
          setMhBorder(geojson);
          const bounds = turf.bbox(geojson);
          map.fitBounds(bounds, { padding: 30 });
        });
        addLineLayer("divisions", "divisions-line", divisionsFile, "#2095F3", 2);
      });
    }
    return () => {
      removed = true;
      ["border-line", "divisions-line"].forEach(layerId => {
        if (map && map.getLayer && map.getLayer(layerId)) map.removeLayer(layerId);
      });
      ["border", "divisions"].forEach(sourceName => {
        if (map && map.getSource && map.getSource(sourceName)) map.removeSource(sourceName);
      });
    };
  }, [map]);

  // --- Show all places always (ONLY CIRCLE MARKERS) ---
  useEffect(() => {
  if (!map) return;
  runWhenStyleReady(map, () => {
    // Remove previous sources and layers if they exist
    if (map.getLayer && map.getLayer("places-points")) map.removeLayer("places-points");
    if (map.getSource && map.getSource("places")) map.removeSource("places");

    if (!filteredPlaces || filteredPlaces.length === 0) return;

    const features = filteredPlaces.map(f => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(f.Longitude), Number(f.Latitude)]
      },
      properties: { ...f }
    }));

    const geojson = {
      type: "FeatureCollection",
      features
    };

    map.addSource("places", { type: "geojson", data: geojson });
    map.addLayer({
      id: "places-points",
      type: "circle",
      source: "places",
      paint: {
        "circle-radius": 7,
        "circle-color": "#ffb700",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#333",
      }
    });

    // Map events
    if (map.off) {
      map.off("click", "places-points");
      map.off("mouseenter", "places-points");
      map.off("mouseleave", "places-points");
    }
    if (map.on) {
      map.on("click", "places-points", (e) => {
        clearRoute();
        setShowProfile(false);
        setSelected(e.features[0].properties);
        map.flyTo({
          center: e.features[0].geometry.coordinates,
          zoom: 13,
          essential: true
        });
      });
      map.on("mouseenter", "places-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "places-points", () => {
        map.getCanvas().style.cursor = "";
      });
    }
  });

  return () => {
    runWhenStyleReady(map, () => {
      if (map && map.getLayer && map.getLayer("places-points")) map.removeLayer("places-points");
      if (map && map.getSource && map.getSource("places")) map.removeSource("places");
    });
  };
}, [map, filteredPlaces]);


  // === Show route line when set, and only then ===
  useEffect(() => {
    if (!map) return;

    // Remove any previous route
    if (map.getLayer && map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource && map.getSource("route")) map.removeSource("route");
    if (window._destMarker) { window._destMarker.remove(); window._destMarker = null; }

    // No route? Done.
    if (!routeGeojson) return;

    // Add route source
    map.addSource("route", {
      type: "geojson",
      data: routeGeojson
    });

    // Add route line layer
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#e74c3c",
        "line-width": 7,
        "line-opacity": 0.9
      }
    });

    // Fit map to route bounds if possible
    const coords = routeGeojson.geometry.coordinates;
    if (coords && coords.length > 0) {
      const bounds = coords.reduce(
        (b, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 100, duration: 900 });
    }

    // Optionally, add a destination marker
    if (routeDest && routeDest.coords) {
      window._destMarker = new maplibregl.Marker({ color: "#e74c3c" })
        .setLngLat(routeDest.coords)
        .setPopup(new maplibregl.Popup().setText(routeDest.name))
        .addTo(map);
    }

    // Clean up route line and marker on change/unmount
    return () => {
      if (map && map.getLayer && map.getLayer("route-line")) map.removeLayer("route-line");
      if (map && map.getSource && map.getSource("route")) map.removeSource("route");
      if (window._destMarker) { window._destMarker.remove(); window._destMarker = null; }
    };
  }, [routeGeojson, map, routeDest]);

  // --- User location logic for marker & widget ---
  useEffect(() => {
    if (!map) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        setUserLoc({ lat, lng });
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([lng, lat]);
        } else {
          userMarkerRef.current = new maplibregl.Marker({ color: "#317aff" })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup().setText("Your location"))
            .addTo(map);
        }
      },
      (err) => {}
    );

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map || selectedDistricts.length !== 1) return;
    const features = places.filter(f =>
      (f.properties?.District || f.District) === selectedDistricts[0]
    );
    if (!features || features.length === 0) return;
    const points = features.map(f => {
      const lng = Number(f.properties?.Longitude || f.Longitude);
      const lat = Number(f.properties?.Latitude || f.Latitude);
      return turf.point([lng, lat]);
    });
    const fc = turf.featureCollection(points);
    const bbox = turf.bbox(fc);
    if (bbox[0] === bbox[2] && bbox[1] === bbox[3]) {
      bbox[0] -= 0.07;
      bbox[2] += 0.07;
      bbox[1] -= 0.07;
      bbox[3] += 0.07;
    }
    map.fitBounds(bbox, { padding: 35, duration: 800 });
  }, [selectedDistricts, places, map]);

  useEffect(() => {
    if (!map || !mhBorder) return;
    if (selectedDistricts.length === 0) {
      const bounds = turf.bbox(mhBorder);
      map.fitBounds(bounds, { padding: 30, duration: 700 });
    }
  }, [selectedDistricts, map, mhBorder]);

  // --- Category Fly-to Effect ---
useEffect(() => {
  if (!map) return;
  if (selectedCategories.length === 1) {
    const features = places.filter(f =>
      (f.properties?.Category || f.Category) === selectedCategories[0]
    );
    if (!features || features.length === 0) return;
    const points = features.map(f => {
      const lng = Number(f.properties?.Longitude || f.Longitude);
      const lat = Number(f.properties?.Latitude || f.Latitude);
      return turf.point([lng, lat]);
    });
    const fc = turf.featureCollection(points);
    const bbox = turf.bbox(fc);
    if (bbox[0] === bbox[2] && bbox[1] === bbox[3]) {
      bbox[0] -= 0.07;
      bbox[2] += 0.07;
      bbox[1] -= 0.07;
      bbox[3] += 0.07;
    }
    map.fitBounds(bbox, { padding: 35, duration: 800 });
  }
}, [selectedCategories, places, map]);

// --- Zoom out if no district and no category selected ---
useEffect(() => {
  if (!map || !mhBorder) return;
  if (selectedDistricts.length === 0 && selectedCategories.length === 0) {
    const bounds = turf.bbox(mhBorder);
    map.fitBounds(bounds, { padding: 30, duration: 700 });
  }
}, [selectedDistricts, selectedCategories, map, mhBorder]);


  function clearRoute() {
    setRouteGeojson(null);
    setRouteDest(null);
    setRouteSummary(null);
  }

  function handleClosePanel() {
    setSelected(null);
    clearRoute();
    if (map && mhBorder) {
      const bounds = turf.bbox(mhBorder);
      map.fitBounds(bounds, { padding: 30 });
    }
  }

  // When selecting a place from Popular Near You or anywhere, clear route
  useEffect(() => {
    function handler(e) {
      if (!e.detail) return;
      clearRoute();
      setShowProfile(false);
      setSelected(e.detail);
      if (map && e.detail.Longitude && e.detail.Latitude) {
        map.flyTo({
          center: [Number(e.detail.Longitude), Number(e.detail.Latitude)],
          zoom: 13,
          essential: true
        });
      }
    }
    window.addEventListener("flyToPlace", handler);
    return () => window.removeEventListener("flyToPlace", handler);
  }, [filteredPlaces, map]);

  // Show route info ONLY when Directions is clicked
  async function handleShowRoute(dest) {
    if (!dest || !dest.Longitude || !dest.Latitude) {
      alert("Destination not available");
      return;
    }
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const start = [pos.coords.longitude, pos.coords.latitude];
      const end = [Number(dest.Longitude), Number(dest.Latitude)];
      const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;
      const body = {
        coordinates: [start, end]
      };
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": OPENROUTESERVICE_KEY
          },
          body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!data || !data.features || !data.features[0]) {
          alert("No route found.");
          return;
        }
        setRouteGeojson(data.features[0]);
        setRouteDest({
          coords: end,
          name: dest.Places || dest.NAME || "Destination"
        });
        setRouteSummary(data.features[0].properties.summary);
      } catch (err) {
        alert("Failed to get directions.");
        setRouteGeojson(null);
        setRouteSummary(null);
      }
    }, () => {
      alert("Could not get your location.");
    });
  }

  // ===== RENDER =====
  return (
    <div className="map-shell">
      {/* --- Top controls --- */}
      <div className="toolbar">
        <SearchBar
          places={filteredPlaces}
          onSelect={p => {
            clearRoute();
            setShowProfile(false);
            setSelected(p);
            if (map && p.Longitude && p.Latitude) {
              map.flyTo({
                center: [Number(p.Longitude), Number(p.Latitude)],
                zoom: 13,
                essential: true
              });
            }
          }}
          onFocus={() => setSearchActive(true)}
          onBlur={() => setSearchActive(false)}
        />
        <FilterBar
  categories={categories}
  districts={districts}
  selectedCategories={selectedCategories}
  setSelectedCategories={cats => {
    setSelectedCategories(cats);
    handleFilterChange(); // <--- This closes PlacePanel
  }}
  selectedDistricts={selectedDistricts}
  setSelectedDistricts={dists => {
    setSelectedDistricts(dists);
    handleFilterChange(); // <--- This closes PlacePanel
  }}
/>

        <ProfileButton user={user} onClick={() => {
          setSelected(null);
          if (user) setShowProfile(true);
          else setShowLogin(true);
        }} />
      </div>

      {/* --- Popular Near You Widget --- */}
      {!searchActive && !selected && (
        <PopularNearYou
          places={filteredPlaces}
          userLocation={userLoc}
          selectedDistricts={selectedDistricts}
        />
      )}

      {/* --- PlacePanel (Right side) --- */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 51,
          }}
        >
          <div style={{
            marginRight: 18,
            pointerEvents: "auto",
          }}>
            <PlacePanel
              place={selected}
              onClose={handleClosePanel}
              allPlaces={filteredPlaces}
              user={user}
              setUser={setUser}
              onDirections={handleShowRoute}
              routeSummary={routeSummary}
              onClearRoute={clearRoute}
            />
          </div>
        </div>
      )}

      {showLogin && (
        <LoginSignupModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}

      {showProfile && (
        <ProfilePanel
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={() => {
            setUser(null);
            localStorage.removeItem("user");
            setShowProfile(false);
          }}
          onProfileImage={async imgUrl => {
            const newUser = { ...user, photoURL: imgUrl };
            await updateUserProfile(user.uid, { photoURL: imgUrl });
            // Fetch the latest profile after update
            const refreshed = await getUserProfile(user.uid);
            setUser(refreshed);
            localStorage.setItem("user", JSON.stringify(refreshed));
          }}
        />
      )}
      <div ref={mapRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}
