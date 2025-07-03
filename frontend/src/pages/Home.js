import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isAuthenticated] = useState(false); // Replace with real auth check

  const handleCreateClick = () => {
    if (!isAuthenticated) {
      alert("Please log in to create your own tour.");
      navigate('/login');
    } else {
      navigate('/create');
    }
  };

  return (
    <div
      style={{
        backgroundImage: "url('bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "1rem",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(10px)",
          maxWidth: "400px",
          width: "100%",
          padding: "2.5rem",
          textAlign: "center",
          color: "white",
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: "bold",
            marginBottom: "1.5rem",
            textShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          Virtual Tour Creator
        </h1>

        <p style={{ fontSize: "1.125rem", marginBottom: "2rem" }}>
          Dive into immersive 360° experiences or create your own virtual
          journey instantly.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* ✅ Corrected route */}
          <LandingButton text="View Existing Tours" onClick={() => navigate('/tours')} />
          <LandingButton text="Create Your Own Tour" onClick={handleCreateClick} />
        </div>
      </div>
    </div>
  );
}

// Reusable styled button component
function LandingButton({ text, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "0.75rem 2rem",
        backgroundColor: hovered ? "#e0e7ff" : "white",
        color: "#4f46e5",
        fontWeight: "600",
        borderRadius: "9999px",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
        transform: hovered ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.3s ease, background-color 0.3s ease",
        border: "none",
        cursor: "pointer",
      }}
    >
      {text}
    </button>
  );
}
