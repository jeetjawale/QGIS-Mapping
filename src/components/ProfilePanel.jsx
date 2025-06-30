import React, { useRef } from "react";

export default function ProfilePanel({ user, onClose, onLogout, onProfileImage }) {
  const fileInputRef = useRef();

  function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onProfileImage(ev.target.result); // Pass base64 URL to parent!
    };
    reader.readAsDataURL(file);
  }

  if (!user) return null;
  return (
    <div style={{
      position: "fixed", right: 26, top: 65, width: 340,
      background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px #39455322",
      padding: 24, zIndex: 55
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: 9, right: 18, border: "none", background: "none", fontSize: 24, color: "#888", cursor: "pointer"
      }}>&times;</button>
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 8 }}>
        <label style={{ cursor: "pointer" }}>
          <img
            src={user.photoURL || "https://api.dicebear.com/7.x/miniavs/svg?seed=" + encodeURIComponent(user.name)}
            alt="profile"
            style={{ width: 55, height: 55, borderRadius: "50%", boxShadow: "0 2px 10px #0001", objectFit: "cover" }}
            title="Click to change photo"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          />
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleImage}
          />
        </label>
        <div>
          <b style={{ fontSize: 20 }}>{user.name}</b>
          <div style={{ color: "#888", fontSize: 16 }}>From: {user.from}</div>
        </div>
      </div>
      <button onClick={onLogout} style={{
        background: "#f6f6f6", color: "#d0232b", border: "1px solid #e5e5e5", borderRadius: 7,
        fontWeight: 600, fontSize: 16, padding: "6px 22px", float: "right", marginTop: -18, marginBottom: 10, cursor: "pointer"
      }}>Logout</button>
      <hr />
      <div style={{ marginTop: 10 }}>
        <b>Favorites:</b>
        <ul>
          {(!user.favorites || user.favorites.length === 0) && <li><i>No favorites yet</i></li>}
          {user.favorites && user.favorites.map((fav, i) => (
            <li key={i}>{fav}</li>
          ))}
        </ul>
        <b>Your Reviews:</b>
        <ul>
          {(!user.reviews || user.reviews.length === 0) && <li><i>No reviews yet</i></li>}
          {user.reviews && user.reviews.map((r, i) => (
            <li key={i}>
              <span style={{ fontWeight: 600 }}>{r.place}</span>
              : {r.rating}★ — <span style={{ fontSize: 15, color: "#777" }}>{r.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
