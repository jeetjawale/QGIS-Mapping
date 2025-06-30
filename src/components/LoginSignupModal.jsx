import React, { useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { createUserProfile, getUserProfile } from "../userData";
import { showSuccess, showError } from "../utils/toastUtils";

const inputStyle = {
  fontSize: 19,
  border: "2px solid #ccc",
  borderRadius: 12,
  background: "#fff",
  padding: "10px 15px",
  minHeight: 44,
  width: "100%",
  marginBottom: 16,
  boxSizing: "border-box",
  outline: "none",
  boxShadow: "0 1.5px 6px #0001",
  transition: "border-color 0.2s, box-shadow 0.2s"
};

export default function LoginSignupModal({ onLogin, onClose }) {
  const [tab, setTab] = useState("login"); // 'login' | 'signup' | 'forgot'
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupFrom, setSignupFrom] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function clearAll() {
    setErr(""); setMsg("");
    setLoginEmail(""); setLoginPw("");
    setSignupName(""); setSignupFrom(""); setSignupEmail(""); setSignupPw("");
    setForgotEmail("");
  }

  function switchTab(newTab) {
    clearAll();
    setTab(newTab);
  }

  async function handleSignup(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    setLoading(true);
    try {
      if (!signupName || !signupFrom || !signupEmail || !signupPw) throw new Error("All fields required");
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPw);
      const user = userCredential.user;
      await updateProfile(user, { displayName: signupName });
      const profile = {
        uid: user.uid,
        name: signupName,
        from: signupFrom,
        email: user.email,
        photoURL: user.photoURL || "",
        favorites: [],
        reviews: []
      };
      await createUserProfile(profile);
      showSuccess("Signup successful!");
      onLogin && onLogin(profile);
    } catch (error) {
      setErr(error.message);
      showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    setLoading(true);
    try {
      if (!loginEmail || !loginPw) throw new Error("Enter email and password");
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPw);
      const user = userCredential.user;
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        // fallback for very old users
        profile = {
          uid: user.uid,
          name: user.displayName || user.email.split("@")[0],
          from: "Unknown",
          email: user.email,
          photoURL: user.photoURL || "",
          favorites: [],
          reviews: []
        };
        await createUserProfile(profile);
      }
      showSuccess("Login successful!");
      onLogin && onLogin(profile);
    } catch (error) {
      setErr(error.message);
      showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    setLoading(true);
    try {
      if (!forgotEmail) throw new Error("Enter your email to reset password");
      await sendPasswordResetEmail(auth, forgotEmail);
      setMsg("Password reset link sent! Check your email.");
      showSuccess("Password reset email sent!");
      setTimeout(() => setMsg(""), 2500);
    } catch (error) {
      setErr(error.message);
      showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: "rgba(32,32,40,0.14)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        position: "relative",
        background: "#fff",
        borderRadius: 18,
        width: 380,
        maxWidth: "97vw",
        boxShadow: "0 8px 32px #3945532a, 0 2px 12px #b6bbc633",
        padding: "36px 38px 34px 38px",
        display: "flex",
        flexDirection: "column",
        fontSize: 17
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 15,
            fontSize: 26,
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer"
          }}
          aria-label="Close"
        >×</button>
        {/* Tab Switcher */}
        <div style={{ display: "flex", marginBottom: 30 }}>
          <span
            onClick={() => switchTab("login")}
            style={{
              fontWeight: tab === "login" ? 700 : 500,
              fontSize: 25,
              color: tab === "login" ? "#1967d2" : "#222",
              cursor: "pointer",
              marginRight: 30,
              borderBottom: tab === "login" ? "2px solid #1967d2" : "2px solid transparent",
              paddingBottom: 3
            }}
          >Login</span>
          <span
            onClick={() => switchTab("signup")}
            style={{
              fontWeight: tab === "signup" ? 700 : 500,
              fontSize: 25,
              color: tab === "signup" ? "#1967d2" : "#222",
              cursor: "pointer",
              marginRight: 0,
              borderBottom: tab === "signup" ? "2px solid #1967d2" : "2px solid transparent",
              paddingBottom: 3
            }}
          >Signup</span>
        </div>
        {/* --- LOGIN TAB --- */}
        {tab === "login" && (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPw}
              onChange={e => setLoginPw(e.target.value)}
              required
              style={inputStyle}
            />
            <div style={{ textAlign: "right", marginBottom: 14 }}>
              <span
                style={{ color: "#1578ce", fontSize: 16, cursor: "pointer" }}
                onClick={() => switchTab("forgot")}
              >Forgot password?</span>
            </div>
            {err && <div style={{ color: "#d32f2f", marginBottom: 10, fontWeight: 500 }}>{err}</div>}
            {msg && <div style={{ color: "#148c3e", marginBottom: 10, fontWeight: 500 }}>{msg}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#1967d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontWeight: 700,
                fontSize: 20,
                cursor: "pointer",
                width: "100%",
                marginTop: 10
              }}
            >{loading ? "Logging in..." : "Login"}</button>
          </form>
        )}
        {/* --- SIGNUP TAB --- */}
        {tab === "signup" && (
          <form onSubmit={handleSignup}>
            <input
              type="text"
              placeholder="Your Name"
              value={signupName}
              onChange={e => setSignupName(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="From (City/District)"
              value={signupFrom}
              onChange={e => setSignupFrom(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Email"
              value={signupEmail}
              onChange={e => setSignupEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={signupPw}
              onChange={e => setSignupPw(e.target.value)}
              required
              style={inputStyle}
            />
            {err && <div style={{ color: "#d32f2f", marginBottom: 10, fontWeight: 500 }}>{err}</div>}
            {msg && <div style={{ color: "#148c3e", marginBottom: 10, fontWeight: 500 }}>{msg}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#1967d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontWeight: 700,
                fontSize: 20,
                cursor: "pointer",
                width: "100%",
                marginTop: 10
              }}
            >{loading ? "Creating..." : "Create Account"}</button>
          </form>
        )}
        {/* --- FORGOT TAB --- */}
        {tab === "forgot" && (
          <form onSubmit={handleForgot}>
            <div style={{ fontWeight: 500, fontSize: 18, marginBottom: 6 }}>Reset Password</div>
            <input
              type="email"
              placeholder="Enter your email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              required
              style={inputStyle}
            />
            {err && <div style={{ color: "#d32f2f", marginBottom: 10, fontWeight: 500 }}>{err}</div>}
            {msg && <div style={{ color: "#148c3e", marginBottom: 10, fontWeight: 500 }}>{msg}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#1967d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontWeight: 700,
                fontSize: 20,
                cursor: "pointer",
                width: "100%",
                marginTop: 10
              }}
            >{loading ? "Sending..." : "Send Reset Link"}</button>
            <div style={{ textAlign: "right", marginTop: 13 }}>
              <span
                style={{ color: "#1578ce", fontSize: 15, cursor: "pointer" }}
                onClick={() => switchTab("login")}
              >Back to login</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
