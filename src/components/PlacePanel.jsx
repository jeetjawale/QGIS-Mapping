import React, { useEffect, useState, useRef } from "react";
import { OPENWEATHERMAP_KEY } from "../config";
import { showSuccess, showError, showInfo } from "../utils/toastUtils";
import {
  getUserProfile,
  updateUserProfile,
  getAllReviewsForPlace,
  addOrUpdateGlobalReview,
  deleteGlobalReview
} from "../userData";
import LoginSignupModal from "./LoginSignupModal";

// ---- Auto-growing textarea for reviews ----
function AutoGrowTextarea({ value, onChange, ...rest }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      {...rest}
      style={{
        ...rest.style,
        overflow: "hidden",
        resize: "none",
        minHeight: 38,
        maxHeight: 180,
        width: "97%",
        fontSize: 15,
        borderRadius: 7,
        border: "1.2px solid #b5b5b5",
        padding: 7,
        boxSizing: "border-box",
        marginTop: 5,
      }}
    />
  );
}

function formatArrivalTime(durationSeconds) {
  const d = new Date(Date.now() + durationSeconds * 1000);
  const pad = n => n < 10 ? "0" + n : n;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlacePanel({
  place, onClose, allPlaces = [],
  user, setUser, onDirections,
  routeSummary, onClearRoute
}) {
  const [firstLoad, setFirstLoad] = useState(true);
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [loadingAllReviews, setLoadingAllReviews] = useState(false);

  // Review form state
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  // Editing
  const [editingReview, setEditingReview] = useState(false);
  const [editText, setEditText] = useState("");
  const [editRating, setEditRating] = useState(0);

  // Login modal
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Weather
  useEffect(() => {
    setWeather(null); setWeatherErr(null);
    if (!place || !place.Latitude || !place.Longitude) return;
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${place.Latitude}&lon=${place.Longitude}&appid=${OPENWEATHERMAP_KEY}&units=metric`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.cod === 200) setWeather(data);
        else setWeatherErr("Weather unavailable");
      })
      .catch(() => setWeatherErr("Weather unavailable"));
  }, [place]);

  // Reviews polling
  useEffect(() => {
    let cancelled = false, timer = null;
    async function fetchReviews(isInitial = false) {
      if (isInitial) setLoadingAllReviews(true);
      const reviews = await getAllReviewsForPlace(place?.Places);
      if (!cancelled) {
        setAllReviews(reviews);
        setLoadingAllReviews(false);
        if (isInitial) setFirstLoad(false);
      }
    }
    if (place && place.Places) {
      setFirstLoad(true);
      fetchReviews(true);
      timer = setInterval(() => fetchReviews(false), 4000);
    } else {
      setAllReviews([]);
    }
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [place]);

  function getNearbyPlaces(current, all, maxDistKm = 20) {
    if (!current || !current.Latitude || !current.Longitude) return [];
    const R = 6371;
    function dist(a, b) {
      const dLat = (b.Latitude - a.Latitude) * Math.PI / 180;
      const dLon = (b.Longitude - a.Longitude) * Math.PI / 180;
      const lat1 = a.Latitude * Math.PI / 180;
      const lat2 = b.Latitude * Math.PI / 180;
      const x = dLon * Math.cos((lat1 + lat2) / 2);
      const y = dLat;
      return R * Math.sqrt(x * x + y * y);
    }
    return all
      .filter(p =>
        (p.Places !== current.Places || p.Location !== current.Location) &&
        p.Latitude && p.Longitude &&
        dist(current, p) <= maxDistKm
      )
      .map(p => ({
        ...p,
        _dist_km: dist(current, p)
      }))
      .sort((a, b) => a._dist_km - b._dist_km)
      .slice(0, 5);
  }

  const {
    Places, District, Location, Category, Description,
    "Image URL": imageUrl, "Link to Page": wikiUrl,
    Latitude, Longitude
  } = place || {};

  const nearby = getNearbyPlaces(place, allPlaces);

  // --- Favorites ---
  async function handleAddFavorite() {
    if (!user || (Array.isArray(user.favorites) && user.favorites.includes(Places))) return;
    setFavBusy(true);
    try {
      const newFavorites = [...(user.favorites || []), Places];
      await updateUserProfile(user.uid, { favorites: newFavorites });
      const refreshed = await getUserProfile(user.uid);
      setUser(refreshed);
      localStorage.setItem("user", JSON.stringify(refreshed));
      showSuccess("Added to favorites!");
    } catch (err) {
      showError("Failed to add favorite!");
    }
    setFavBusy(false);
  }
  async function handleRemoveFavorite() {
    setFavBusy(true);
    try {
      const newFavorites = (user.favorites || []).filter(f => f !== Places);
      await updateUserProfile(user.uid, { favorites: newFavorites });
      const refreshed = await getUserProfile(user.uid);
      setUser(refreshed);
      localStorage.setItem("user", JSON.stringify(refreshed));
      showInfo("Removed from favorites.");
    } catch (err) {
      showError("Failed to remove favorite!");
    }
    setFavBusy(false);
  }

  // --- Review logic ---
  const userReview = user && allReviews.find(r => r.userId === user.uid);

  function handleGoogleDirections() {
  if (!Latitude || !Longitude) return;
  if (!navigator.geolocation) {
    // Fallback: open with My Location
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${encodeURIComponent(`${Latitude},${Longitude}`)}&travelmode=best`,
      "_blank"
    );
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodeURIComponent(`${Latitude},${Longitude}`)}&travelmode=best`;
      window.open(url, "_blank");
    },
    (err) => {
      // If denied or unavailable, fallback to "My Location"
      const url = `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${encodeURIComponent(`${Latitude},${Longitude}`)}&travelmode=best`;
      window.open(url, "_blank");
    }
  );
}

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewRating || !reviewText.trim()) return;
    setReviewBusy(true);
    try {
      const newReview = {
        place: Places,
        rating: reviewRating,
        text: reviewText,
        date: Date.now(),
        userName: user?.name || "User",
        userPhoto: user?.photoURL || "",
        userId: user?.uid
      };
      await addOrUpdateGlobalReview(Places, newReview);
      const newReviews = [
        newReview,
        ...(user.reviews || []).filter(r => r.place !== Places)
      ];
      await updateUserProfile(user.uid, { reviews: newReviews });
      const refreshed = await getUserProfile(user.uid);
      setUser(refreshed);
      localStorage.setItem("user", JSON.stringify(refreshed));
      setReviewRating(0);
      setReviewText("");
      setReviewFormOpen(false);
      showSuccess("Review submitted!");
    } catch (err) {
      showError("Error submitting review: " + (err.message || err));
    }
    setReviewBusy(false);
  }

  function openReviewForm() {
    if (!user) {
      setShowLoginModal(true);
    } else if (!userReview) {
      setReviewFormOpen(true);
      setReviewRating(0);
      setReviewText("");
    }
  }

  function startEditReview(r) {
    setEditingReview(true);
    setEditText(r.text);
    setEditRating(r.rating);
  }
  async function handleEditSave(e) {
    e.preventDefault();
    if (!user || !user.uid) return;
    setReviewBusy(true);
    try {
      const updatedReview = {
        place: Places,
        rating: editRating,
        text: editText,
        date: Date.now(),
        userName: user.name || "User",
        userPhoto: user.photoURL || "",
        userId: user.uid
      };
      await addOrUpdateGlobalReview(Places, updatedReview);
      const newUserReviews = [
        updatedReview,
        ...(user.reviews || []).filter(r => r.place !== Places)
      ];
      await updateUserProfile(user.uid, { reviews: newUserReviews });
      const refreshed = await getUserProfile(user.uid);
      setUser(refreshed);
      localStorage.setItem("user", JSON.stringify(refreshed));
      showSuccess("Review updated!");
      setEditingReview(false);
      setEditText("");
      setEditRating(0);
    } catch (err) {
      showError("Error updating review.");
    }
    setReviewBusy(false);
  }
  async function handleDeleteReview() {
    if (!user || !user.uid) return;
    setReviewBusy(true);
    try {
      await deleteGlobalReview(Places, user.uid);
      const newUserReviews = (user.reviews || []).filter(r => r.place !== Places);
      await updateUserProfile(user.uid, { reviews: newUserReviews });
      const refreshed = await getUserProfile(user.uid);
      setUser(refreshed);
      localStorage.setItem("user", JSON.stringify(refreshed));
      showSuccess("Review deleted!");
      setEditingReview(false);
      setEditText("");
      setEditRating(0);
    } catch (err) {
      showError("Error deleting review.");
    }
    setReviewBusy(false);
  }

  if (!place) return null;

  let sortedReviews = allReviews.slice().sort((a, b) => (b.date || 0) - (a.date || 0));
  const numReviews = sortedReviews.length;
  const avgRating = numReviews
    ? (sortedReviews.reduce((sum, r) => sum + (parseFloat(r.rating) || 0), 0) / numReviews)
    : 0;

  return (
    <div
      style={{
        position: "relative",
        width: "min(98vw, 420px)",
        maxWidth: "99vw",
        minWidth: "230px",
        maxHeight: "calc(100vh - 44px)",
        zIndex: 30,
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 8px 32px #39455322, 0 2px 12px #b6bbc633",
        padding: "18px 18px 18px 26px",
        display: "flex",
        flexDirection: "column",
        fontSize: 17,
        overflow: "hidden"
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 14,
          right: 20,
          fontSize: 28,
          cursor: "pointer",
          color: "#abb2bf",
          background: "none",
          border: "none",
          lineHeight: 1,
          zIndex: 2
        }}
        title="Close"
      >
        ×
      </button>

      {/* Place info (Place name + rating) */}
      <b style={{
        fontSize: 23,
        color: "#175ab9",
        marginBottom: 2,
        wordBreak: "break-word",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        {Places}
        {numReviews > 0 && (
          <span style={{
            display: "flex",
            alignItems: "center",
            marginLeft: 8,
            background: "#f9e7c7",
            color: "#b28600",
            fontWeight: 700,
            fontSize: 16,
            borderRadius: 10,
            padding: "3px 10px 3px 8px"
          }}>
            {avgRating.toFixed(1)}
            <span style={{ color: "#ffb700", fontSize: 19, marginLeft: 3 }}>★</span>
            <span style={{ color: "#888", fontWeight: 500, marginLeft: 8, fontSize: 14 }}>
              ({numReviews})
            </span>
          </span>
        )}
      </b>
      <div style={{ fontSize: 15, color: "#555", marginBottom: 4 }}>
        {Location && <><b>Location:</b> {Location}<br /></>}
        {District && <><b>District:</b> {District}<br /></>}
        {Category && <><b>Category:</b> {Category}<br /></>}
      </div>

      {/* Favorites */}
      <div style={{ margin: "6px 0 12px 0" }}>
  {user ? (
    Array.isArray(user.favorites) && user.favorites.includes(Places) ? (
      <button
        onClick={handleRemoveFavorite}
        style={{
          background: "#ffe9e9",
          color: "#e34e4e",
          border: "1px solid #ffcdcd",
          borderRadius: 8,
          padding: "7px 16px",
          fontWeight: 600,
          fontSize: 15,
          marginRight: 10,
          cursor: favBusy ? "wait" : "pointer",
          transition: "background 0.18s"
        }}
        disabled={favBusy}
      >
        {favBusy ? "Updating..." : "Unfavorite"}
      </button>
    ) : (
      <button
        onClick={handleAddFavorite}
        style={{
          background: "#f6faf7",
          color: "#2080c0",
          border: "1px solid #b2e5cc",
          borderRadius: 8,
          padding: "7px 16px",
          fontWeight: 600,
          fontSize: 15,
          marginRight: 10,
          cursor: favBusy ? "wait" : "pointer",
          transition: "background 0.18s"
        }}
        disabled={favBusy}
      >
        {favBusy ? "Adding..." : "Add to Favorites"}
      </button>
    )
  ) : (
    <button
      onClick={() => setShowLoginModal(true)}
      style={{
        background: "#f6faf7",
        color: "#2080c0",
        border: "1px solid #b2e5cc",
        borderRadius: 8,
        padding: "7px 16px",
        fontWeight: 600,
        fontSize: 15,
        marginRight: 10,
        cursor: "pointer",
        opacity: 0.92,
        transition: "background 0.18s"
      }}
    >
      Add to Favorites
    </button>
  )}
</div>


      {/* Directions/Info */}
      <div style={{ display: "flex", gap: 12, marginTop: 7, marginBottom: 7 }}>
        <button
          onClick={() => onDirections(place)}
          style={{
            background: "#17a058",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 20px",
            border: "none",
            fontWeight: 500,
            fontSize: 16,
            cursor: "pointer"
          }}
          title="Directions via OpenRouteService"
        >
          Directions
        </button>
        {wikiUrl && (
          <a href={wikiUrl} target="_blank" rel="noopener noreferrer">
            <button
              style={{
                background: "#317aff",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 20px",
                border: "none",
                fontWeight: 500,
                fontSize: 16,
                cursor: "pointer"
              }}
            >
              More Info
            </button>
          </a>
        )}
        {Latitude && Longitude && (
  <button
    style={{
      background: "#34a853",
      color: "#fff",
      borderRadius: 8,
      padding: "8px 20px",
      border: "none",
      fontWeight: 500,
      fontSize: 16,
      cursor: "pointer"
    }}
    title="Google Maps Directions"
    onClick={handleGoogleDirections}
  >
    Google Map Directions
  </button>
)}


      </div>

      {/* Route Info */}
      {routeSummary && (
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            boxShadow: "0 4px 20px #0002",
            padding: "14px 24px 12px 20px",
            fontSize: 17,
            border: "1.2px solid #eee",
            fontFamily: "inherit",
            margin: "16px 0 12px 0",
            position: "relative"
          }}
        >
          <button
            onClick={onClearRoute}
            title="Clear route"
            style={{
              position: "absolute",
              top: 6,
              right: 9,
              border: "none",
              background: "none",
              color: "#999",
              fontSize: 24,
              cursor: "pointer",
              fontWeight: 600
            }}
          >&times;</button>
          <b>Route Info</b><br />
          <span>Distance: <b>{(routeSummary.distance / 1000).toFixed(1)} km</b></span><br />
          <span>Time: <b>{Math.round(routeSummary.duration / 60)} min</b></span><br />
          <span>
            ETA: <b>{formatArrivalTime(routeSummary.duration)}</b>
          </span>
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          marginBottom: 2,
        }}
      >
        {/* Weather */}
        <div style={{
          margin: "10px 0 13px 0",
          fontSize: 16,
          background: "#f5faff",
          borderRadius: 9,
          padding: "9px 15px",
          minHeight: 40,
          border: "1.2px solid #e2f1fa"
        }}>
          <b>Weather:</b>{" "}
          {weather === null && !weatherErr && <i>Loading...</i>}
          {weatherErr && <span style={{ color: "#b85300" }}>{weatherErr}</span>}
          {weather && (
            <>
              <img
                src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}.png`}
                alt={weather.weather[0].description}
                style={{ verticalAlign: "middle", marginRight: 4 }}
              />
              <b>{Math.round(weather.main.temp)}&deg;C</b>, {weather.weather[0].main}
              {weather.wind && (
                <span style={{ color: "#666", marginLeft: 12 }}>
                  Wind: {weather.wind.speed} m/s
                </span>
              )}
            </>
          )}
        </div>
        {imageUrl && imageUrl !== "null" && (
          <img
            src={imageUrl}
            alt={Places}
            style={{
              width: "100%",
              maxHeight: 270,
              borderRadius: 12,
              boxShadow: "0 2px 14px #0001",
              margin: "0 0 14px 0",
              objectFit: "contain",
              display: "block",
              background: "#fafafa"
            }}
          />
        )}
        {Description && (
          <div style={{
            marginBottom: 8,
            lineHeight: 1.54,
            fontSize: 16,
            color: "#262d2f",
            whiteSpace: "pre-line"
          }}>
            <b>Description:</b> {Description}
          </div>
        )}

        {/* Nearby */}
        {nearby.length > 0 && (
          <div style={{
            marginTop: 10,
            marginBottom: 3,
            background: "#f8f9ff",
            borderRadius: 9,
            border: "1px solid #e5e5e5",
            padding: "10px 13px"
          }}>
            <b>Nearby Places:</b>
            <ul style={{ margin: "7px 0 0 10px", padding: 0 }}>
              {nearby.map((p, idx) => (
                <li key={idx}>
                  <a
                    href="#"
                    style={{ color: "#166fd1" }}
                    onClick={e => {
                      e.preventDefault();
                      onClose && onClose();
                      setTimeout(() =>
                        window.dispatchEvent(new CustomEvent("flyToPlace", { detail: p })),
                        150
                      );
                    }}
                  >
                    {p.Places}
                  </a>
                  {p.Location && <span style={{ color: "#888", marginLeft: 4, fontSize: 14 }}>({p.Location})</span>}
                  {p.Category && <span style={{ color: "#bbb", marginLeft: 4, fontSize: 13 }}>— {p.Category}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reviews */}
        <hr style={{ border: "none", borderTop: "1.5px solid #e7eaf2", margin: "22px 0 10px 0" }} />
        <div style={{ fontWeight: 700, fontSize: 19, color: "#2159a6", marginBottom: 6 }}>
          User Reviews
        </div>
        <div
          style={{
            border: "1px solid #f2f4fa",
            background: "#f9fafd",
            borderRadius: 10,
            padding: "10px 0 10px 0",
            marginBottom: 8,
            maxHeight: 220,
            overflowY: "auto",
            minHeight: 40
          }}
        >
          {firstLoad && loadingAllReviews && (
            <div style={{ marginTop: 10, color: "#888" }}>Loading user reviews…</div>
          )}
          {!loadingAllReviews && sortedReviews.length === 0 && (
            <div style={{ marginTop: 10, color: "#888" }}><i>No reviews from users yet.</i></div>
          )}
          {!loadingAllReviews && sortedReviews.length > 0 && (
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              width: "100%"
            }}>
              {sortedReviews.map((r, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: 14,
                    background: (user && r.userId === user?.uid) ? "#eaf6ff" : "#fff",
                    borderRadius: 12,
                    boxShadow: "0 1px 6px #0001",
                    padding: "13px 15px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 13,
                    borderLeft: (user && r.userId === user?.uid)
                      ? "4px solid #2a66b8"
                      : "4px solid transparent"
                  }}
                >
                  {/* Avatar and Name */}
                  <div style={{ minWidth: 42, textAlign: "center" }}>
                    {r.userPhoto
                      ? <img src={r.userPhoto} alt="" style={{
                          width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #e3e6ea"
                        }} />
                      : <span style={{
                          display: "inline-block", width: 32, height: 32, borderRadius: "50%",
                          background: "#2a66b8", color: "#fff", textAlign: "center", fontSize: 18, lineHeight: "32px", fontWeight: 700
                        }}>{r.userName?.[0]?.toUpperCase() || "?"}</span>
                    }
                    <div style={{
                      fontWeight: 600,
                      fontSize: 15,
                      marginTop: 3,
                      color: "#1e232a"
                    }}>{r.userName || "User"}</div>
                    <div style={{ color: "#aaa", fontSize: 12, marginTop: 1 }}>
                      {r.date && new Date(r.date).toLocaleDateString()}
                    </div>
                  </div>
                  {/* Review Body & Edit/Delete */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 3, display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "#ffb700", fontSize: 20, letterSpacing: 2 }}>
                        {"★".repeat(r.rating)}
                      </span>
                      {/* Only show Edit/Delete for current user's review */}
                      {user && r.userId === user?.uid && !editingReview && (
                        <span>
                          <button style={{
                            background: "none", border: "none", color: "#1777ee", cursor: "pointer", fontSize: 15, marginRight: 3
                          }} onClick={() => startEditReview(r)}>
                            ✏️ Edit
                          </button>
                          <button style={{
                            background: "none", border: "none", color: "#dd3333", cursor: "pointer", fontSize: 15
                          }} onClick={handleDeleteReview}>
                            🗑️ Delete
                          </button>
                        </span>
                      )}
                    </div>
                    {/* Show plain review text (not editable unless editing own review) */}
                    {(!editingReview || r.userId !== user?.uid) && (
                      <div style={{
                        color: "#1a1b1d",
                        fontSize: 16,
                        marginLeft: 1,
                        whiteSpace: "pre-line",
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        overflowX: "hidden",
                        maxWidth: "100%"
                      }}>
                        {r.text}
                      </div>
                    )}
                    {/* Show edit form for current user's review */}
                    {user && r.userId === user?.uid && editingReview && (
                      <form onSubmit={handleEditSave}>
                        <span>
                          {[1, 2, 3, 4, 5].map(star => (
                            <label key={star} style={{ cursor: "pointer" }}>
                              <input
                                type="radio"
                                name="edit-stars"
                                value={star}
                                checked={editRating === star}
                                onChange={() => setEditRating(star)}
                                style={{ display: "none" }}
                                required
                              />
                              <span style={{
                                fontSize: 21,
                                color: editRating >= star ? "#ffb700" : "#bbb"
                              }}>★</span>
                            </label>
                          ))}
                        </span>
                        <br />
                        <AutoGrowTextarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          placeholder="Edit your review..."
                          required
                        />
                        <br />
                        <button type="submit" disabled={reviewBusy}
                          style={{ background: "#317aff", color: "#fff", borderRadius: 7, padding: "7px 20px", border: "none", fontWeight: 500, fontSize: 16, marginTop: 6 }}>
                          {reviewBusy ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingReview(false)}
                          style={{ background: "none", color: "#888", border: "none", fontSize: 15, marginLeft: 8 }}>
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add Review Button (always visible) */}
        {!userReview && !reviewFormOpen && (
          <div style={{ textAlign: "left", marginBottom: 18 }}>
            <button
              onClick={openReviewForm}
              style={{
                background: "#317aff",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 25px",
                fontWeight: 600,
                border: "none",
                fontSize: 17,
                cursor: "pointer",
                marginTop: 5,
                marginBottom: 0
              }}
            >
              Add Review
            </button>
          </div>
        )}

        {/* Review form */}
        {user && !userReview && reviewFormOpen && (
          <form style={{ marginBottom: 16 }} onSubmit={handleReviewSubmit}>
            <div style={{ fontWeight: 500 }}>Your Review:</div>
            <span>
              {[1, 2, 3, 4, 5].map(star => (
                <label key={star} style={{ cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="stars"
                    value={star}
                    checked={reviewRating === star}
                    onChange={() => setReviewRating(star)}
                    style={{ display: "none" }}
                    required
                  />
                  <span style={{
                    fontSize: 21,
                    color: reviewRating >= star ? "#ffb700" : "#bbb",
                    cursor: "pointer"
                  }}>★</span>
                </label>
              ))}
            </span>
            <br />
            <AutoGrowTextarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Write your review..."
              required
            />
            <br />
            <button type="submit"
              disabled={reviewBusy}
              style={{
                background: "#317aff", color: "#fff", borderRadius: 7, padding: "7px 20px",
                border: "none", fontWeight: 500, fontSize: 16, marginTop: 6, cursor: reviewBusy ? "wait" : "pointer"
              }}
            >{reviewBusy ? "Submitting..." : "Submit"}</button>
            <button type="button"
              onClick={() => setReviewFormOpen(false)}
              style={{
                background: "none", color: "#888", border: "none",
                fontSize: 16, marginLeft: 12
              }}
            >Cancel</button>
          </form>
        )}

        {/* Login/Signup Modal */}
        {showLoginModal && (
          <LoginSignupModal
            onLogin={profile => {
              setUser(profile);
              localStorage.setItem("user", JSON.stringify(profile));
              setShowLoginModal(false);
              setReviewFormOpen(true);
            }}
            onClose={() => setShowLoginModal(false)}
          />
        )}

      </div>
    </div>
  );
}
