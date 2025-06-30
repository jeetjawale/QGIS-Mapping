import React from "react";
export default function ProfileButton({ user, onClick }) {
  return (
    <button
      style={{
        border: "none",
        background: "none",
        cursor: "pointer",
        marginLeft: 10
      }}
      onClick={onClick}
      title={user ? user.name : "Login / Signup"}
    >
      {user && user.photoURL ? (
        <img
          src={user.photoURL}
          alt="profile"
          style={{ width: 38, height: 38, borderRadius: "50%", boxShadow: "0 2px 10px #0001" }}
        />
      ) : (
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            display: "inline-block",
            background: "#e0e6f5",
            color: "#175ab9",
            fontSize: 24,
            textAlign: "center",
            lineHeight: "38px",
            fontWeight: 700,
            boxShadow: "0 2px 10px #0001"
          }}
        >👤</span>
      )}
    </button>
  );
}
