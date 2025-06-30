import React, { useEffect, useState } from "react";
import { getAllGlobalReviewsForPlace } from "../userData";
import { getAllReviewsForPlace } from "../userData"; // <-- not getAllGlobalReviewsForPlace!

export default function PopularNearYou({ places, userLocation, selectedDistricts }) {
  const [nearby, setNearby] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function fetchData() {
      if (!places.length) {
        setNearby([]);
        return;
      }

      let filtered = [];
      // Filter by district or proximity
      if (selectedDistricts && selectedDistricts.length === 1) {
        filtered = places.filter(p => p.District === selectedDistricts[0]);
      } else if (userLocation) {
        filtered = places
          .map(p => {
            const lat = Number(p.Latitude);
            const lng = Number(p.Longitude);
            if (isNaN(lat) || isNaN(lng)) return null;
            const dist = haversineDistance(userLocation.lat, userLocation.lng, lat, lng);
            return dist <= 30 ? { ...p, _dist_km: dist } : null;
          })
          .filter(Boolean);
      } else {
        setNearby([]);
        return;
      }

      // Fetch reviews for each place in parallel
      const enriched = await Promise.all(filtered.map(async (p) => {
        
        const reviews = await getAllReviewsForPlace(p.Places);
        const count = reviews.length;
        // Calculate the average rating from all reviews (not just the latest!)
        const avg = count
          ? (reviews.reduce((sum, r) => sum + (parseFloat(r.rating) || 0), 0) / count)
          : 0;
        return { ...p, avgRating: avg, reviewCount: count };
      }));

      // Sort: highest rating, then most reviews, then nearest (if applicable)
      enriched.sort((a, b) => {
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
        if (a._dist_km !== undefined && b._dist_km !== undefined) {
          return a._dist_km - b._dist_km;
        }
        return 0;
      });

      setNearby(enriched.slice(0, 5)); // Top 5
    }

    fetchData();
    timer = setInterval(fetchData, 4000); // Poll every 4 seconds

    return () => { cancelled = true; clearInterval(timer); };
  }, [places, userLocation, selectedDistricts]);

  function handleClick(p) {
    window.dispatchEvent(new CustomEvent("flyToPlace", { detail: p }));
  }

  const panelTitle = selectedDistricts && selectedDistricts.length === 1
    ? `Popular in ${selectedDistricts[0]}`
    : "Popular Near You";

  return (
    <div style={{
      position: "absolute", top: 76, left: 20, zIndex: 25,
      background: "#fff", borderRadius: 15, boxShadow: "0 4px 16px #0001",
      width: 278, maxWidth: "95vw", padding: "18px 20px"
    }}>
      <b style={{ fontSize: 20, color: "#2a66b8" }}>{panelTitle}</b>
      {nearby.length === 0 ? (
        <div style={{ color: "#888", marginTop: 12 }}>No popular places.</div>
      ) : (
        <ul style={{ margin: "13px 0 0 0", padding: 0, listStyle: "none" }}>
          {nearby.map((p, idx) => (
            <li key={idx} style={{
              marginBottom: 11,
              borderBottom: idx < nearby.length - 1 ? "1px solid #f0f0f0" : "none",
              paddingBottom: 8,
            }}>
              <a
                href="#"
                onClick={e => { e.preventDefault(); handleClick(p); }}
                style={{
                  fontWeight: 700,
                  fontSize: 17,
                  color: "#175ab9",
                  cursor: "pointer",
                  textDecoration: "none"
                }}
              >
                {p.Places}
              </a>
              <span style={{ color: "#666", fontSize: 14, marginLeft: 6 }}>
                ({p.Category}){p._dist_km !== undefined && ` — ${p._dist_km.toFixed(2)} km`}
              </span>
              <br />
              <span style={{ fontSize: 15 }}>
                {p.reviewCount
                  ? (
                    <>
                      <span style={{ color: "#ffb700", fontWeight: 700 }}>
                        {p.avgRating.toFixed(1)}★
                      </span>
                      <span style={{ color: "#444", fontWeight: 500, marginLeft: 4 }}>
                        · {p.reviewCount} review{p.reviewCount > 1 ? "s" : ""}
                      </span>
                    </>
                  )
                  : <span style={{ color: "#aaa", fontStyle: "italic" }}>No reviews yet</span>
                }
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
