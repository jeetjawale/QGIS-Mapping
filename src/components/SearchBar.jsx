import React, { useState, useRef } from "react";

const inputBoxStyle = {
  fontSize: 20,
  border: "2px solid #ccc",
  borderRadius: 12,
  background: "#fff",
  padding: "10px 15px",
  minHeight: 45,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  boxShadow: "0 1.5px 6px #0001",
  transition: "border-color 0.2s, box-shadow 0.2s"
};

export default function SearchBar({ places, onSelect, onFocus, onBlur }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const containerRef = useRef();

  const filtered = q.length === 0 ? [] :
    places.filter(p =>
      [p.Places, p.Location, p.District, p.Category]
        .some(field =>
          field &&
          field.toLowerCase().includes(q.toLowerCase())
        )
    ).slice(0, 8);

  function handleSelect(p) {
    setQ("");
    setShow(false);
    if (onSelect) onSelect(p);
  }

  // Hide dropdown on outside click (for better UX)
  React.useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShow(false);
        if (onBlur) onBlur();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onBlur]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", minWidth: 240, width: 320, flex: 1 }}
    >
      <input
        type="text"
        placeholder="Search places, locations, districts."
        style={inputBoxStyle}
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setShow(true);
        }}
        onFocus={() => {
          setShow(true);
          if (onFocus) onFocus();
        }}
        onBlur={() => {
          setTimeout(() => setShow(false), 150); // Give dropdown a chance to register click
          if (onBlur) onBlur();
        }}
        autoComplete="off"
      />
      {show && filtered.length > 0 && (
        <div style={{
          position: "absolute",
          top: 56, left: 0, right: 0,
          background: "#fff",
          border: "1.5px solid #d3e0ed",
          borderRadius: 10,
          boxShadow: "0 3px 15px #0002",
          zIndex: 31,
          maxHeight: 300,
          overflowY: "auto"
        }}>
          {filtered.map((p, idx) => (
            <div
              key={idx}
              style={{
                padding: "13px 16px",
                fontSize: 18,
                cursor: "pointer",
                borderBottom: idx < filtered.length - 1 ? "1px solid #f4f4f4" : "none",
                background: "#fff"
              }}
              onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
            >
              <b>{p.Places}</b>
              {p.Location && <> — <span style={{ color: "#666" }}>{p.Location}</span></>}
              {p.District && <> ({p.District})</>}
              {p.Category && <span style={{ color: "#999", fontSize: 16, marginLeft: 5 }}>[{p.Category}]</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
