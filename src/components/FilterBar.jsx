import React, { useState, useRef, useEffect } from "react";

const inputBoxStyle = {
  fontSize: 16,
  borderRadius: 12,
  background: "var(--panel-bg)",
  border: "1.5px solid var(--input-border)",
  padding: "10px 14px 10px 10px",
  minHeight: 46,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  boxShadow: "var(--input-shadow)",
  cursor: "pointer",
  userSelect: "none",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 7,
  overflow: "hidden",
  color: "var(--ink)",
  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
  fontFamily: "var(--font-body)"
};

const dropdownStyle = {
  position: "absolute",
  top: "110%",
  left: 0,
  width: 250,
  borderRadius: 12,
  zIndex: 35,
  maxHeight: 270,
  overflowY: "auto",
  padding: "6px 0",
  overflowX: "hidden"
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 16,
  transition: "background 0.13s",
  borderRadius: 8,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%",
  color: "var(--ink)"
};

function MultiSelect({ label, options, selected, setSelected, width = 250, single = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // --- CHANGE: Auto-close dropdown on single select ---
  const toggleOption = (option) => {
    if (single) {
      setSelected(selected[0] === option ? [] : [option]);
      setOpen(false); // <--- Auto-close dropdown after selection!
    } else {
      if (selected.includes(option)) setSelected(selected.filter((o) => o !== option));
      else setSelected([...selected, option]);
    }
  };

  const display =
    selected.length > 0
      ? (
          single
            ? <span style={{
                color: "var(--accent-strong)",
                fontWeight: 600,
                maxWidth: width - 35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block"
              }}>
                {selected[0]}
                <span
                  style={{ marginLeft: 8, color: "var(--muted)", cursor: "pointer", fontSize: 19, fontWeight: 500 }}
                  onClick={e => {
                    e.stopPropagation();
                    setSelected([]);
                  }}
                  title={`Clear ${label}`}
                >
                  ×
                </span>
              </span>
            : selected.map((opt) => (
                <span key={opt} style={{
                  background: "rgba(15, 91, 115, 0.12)", color: "var(--accent-strong)", borderRadius: 16, padding: "3px 9px", marginRight: 3
                }}>{opt} <span style={{marginLeft:3, cursor:"pointer"}} onClick={e=>{e.stopPropagation();toggleOption(opt)}}>×</span></span>
              ))
        )
      : <span style={{ color: "var(--muted)" }}>All {label}</span>;

  return (
    <div style={{ position: "relative", width, minWidth: width, maxWidth: width }} ref={ref}>
      <div
        className="ui-input"
        style={{
          ...inputBoxStyle,
          width: "100%",
          overflow: "hidden"
        }}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
      >
        {display}
        <span style={{ marginLeft: "auto", fontSize: 17, color: "#aaa" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="ui-dropdown" style={dropdownStyle}>
          {options.length === 0 && (
            <div style={{ padding: "10px 16px", color: "#888" }}><i>No options</i></div>
          )}
          {options.map((option) => (
            <label
              key={option}
              className="ui-option"
              style={{
                ...checkboxLabel,
                background: selected.includes(option) ? "rgba(15, 91, 115, 0.12)" : undefined,
                fontWeight: selected.includes(option) ? 600 : 400
              }}
            >
              <input
                type={single ? "radio" : "checkbox"}
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
                style={{ marginRight: 8, accentColor: "var(--accent)", flexShrink: 0 }}
              />
              <span style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
                maxWidth: "calc(100% - 32px)"
              }}>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  categories, districts, selectedCategories, setSelectedCategories, selectedDistricts, setSelectedDistricts,
}) {
  return (
    <div style={{ display: "flex", gap: 18, minWidth: 500 }}>
      <MultiSelect
        label="Categories"
        options={categories}
        selected={selectedCategories}
        setSelected={setSelectedCategories}
        width={250}
        single={true}
      />
      <MultiSelect
        label="Districts"
        options={districts}
        selected={selectedDistricts}
        setSelected={setSelectedDistricts}
        width={250}
        single={true}
      />
    </div>
  );
}
