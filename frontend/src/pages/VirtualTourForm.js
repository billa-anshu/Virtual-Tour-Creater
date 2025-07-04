import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid'; // Install with `npm install uuid`

const VirtualTourForm = () => {
  const [rooms, setRooms] = useState([]);
  const [roomImages, setRoomImages] = useState({});
  const navigate = useNavigate();
  // Generate tourId once when the component mounts
  const tourId = uuidv4();

  // Simulated login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

 
  const handleImageUpload = (e, roomName) => {
    const selectedFiles = Array.from(e.target.files);
    const previewPromises = selectedFiles.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ file, preview: e.target.result });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previewPromises).then((results) => {
      setRoomImages((prev) => ({
        ...prev,
        [roomName]: prev[roomName] ? [...prev[roomName], ...results] : results,
      }));
    });
  };

  const handleAddRoom = () => {
    const newRoomName = prompt("Enter a name for the new room:");
    if (newRoomName) {
      setRooms((prev) => [...prev, newRoomName]);
    }
  };

  const handleRemoveImage = (roomName, index) => {
    setRoomImages((prev) => ({
      ...prev,
      [roomName]: prev[roomName].filter((_, i) => i !== index),
    }));
  };

  const handleGeneratePanorama = async () => {
    if (rooms.length === 0 || Object.keys(roomImages).length === 0) {
      alert("Please upload at least one image for each room.");
      return;
    }

    const formData = new FormData();
    rooms.forEach((room) => {
      roomImages[room]?.forEach((img) => {
        formData.append(`${room}[]`, img.file);
      });
    });

    // IMPORTANT: Use your Render backend URL here!
    const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";

    try {
      const response = await axios.post(`${BACKEND_URL}/stitch`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        const panoramaUrls = response.data.panoramaUrls;
        
        // Save the data in localStorage with tourId
        localStorage.setItem(`tourData-${tourId}`, JSON.stringify({ panoramaUrls, startRoom: rooms[0] }));
        localStorage.setItem(`tourMarkers-${tourId}`, JSON.stringify({}));
        localStorage.setItem(`tourTooltips-${tourId}`, JSON.stringify({}));

        navigate(`/editor/${tourId}`);
      } else {
        alert("Stitching failed.");
      }
    } catch (err) {
      console.error("Stitching error:", err);
      alert("Failed to connect to server.");
    }
  };

  return (
    <div
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1523966211575-eb4a02e5e6f1?auto=format&fit=crop&w=1950&q=80')",
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
      {/* Rectangle container with blurred background */}
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "1rem",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(10px)",
          maxWidth: isLoggedIn ? "880px" : "400px", // Adjust max-width based on login state
          width: "100%",
          padding: "40px",
          textAlign: "center", // Center text for headings
          color: "white", // Set text color for better contrast
          fontFamily: "sans-serif", // Keep original font family
        }}
      >
        {!isLoggedIn ? (
          // Login Form
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h2 style={{ color: 'white', marginBottom: '20px' }}>Login to Create Tour</h2>
            <input
              type="text"
              placeholder="Username (e.g., user)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: '#333',
              }}
            />
            <input
              type="password"
              placeholder="Password (e.g., password)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: '#333',
              }}
            />
            {loginError && <p style={{ color: 'red', fontSize: '0.9em' }}>{loginError}</p>}
            <button
              type="submit"
              style={{
                backgroundColor: "#4a6ee0",
                border: "none",
                color: "white",
                fontWeight: "600",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "16px",
                cursor: "pointer",
                transition: "background 0.3s ease",
                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#385dc9"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#4a6ee0"}
            >
              Login
            </button>
          </form>
        ) : (
          // Tour Creation Form
          <>
            <h1 style={{ textAlign: "center", marginBottom: "20px", fontWeight: "600", color: "white" }}>
              Build Your Virtual Tour
            </h1>
            <p style={{ textAlign: "center", color: "#ddd", marginBottom: "40px" }}>
              Upload room images and we’ll stitch them into interactive panoramas.
            </p>

            {rooms.map((room, index) => (
              <div key={index} style={{ marginBottom: "50px" }}>
                <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "10px", marginBottom: "20px", color: "white" }}>
                  Room {index + 1}: <span style={{ fontWeight: 500 }}>{room}</span>
                </h3>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, room)}
                  style={{
                    marginBottom: "20px",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.8)",
                    color: "#333",
                  }}
                />

                {roomImages[room]?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
                    {roomImages[room].map((item, i) => (
                      <div key={i} style={{
                        position: "relative",
                        width: "160px",
                        height: "120px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid #ddd",
                        background: "#fafafa",
                        transition: "transform 0.3s ease",
                        cursor: "pointer"
                      }}>
                        <img
                          src={item.preview}
                          alt={`Preview ${room} - ${i}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transition: "transform 0.3s ease",
                          }}
                          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                        />
                        <button
                          onClick={() => handleRemoveImage(room, i)}
                          style={{
                            position: "absolute",
                            top: "6px",
                            right: "6px",
                            background: "#ffffffee",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            padding: "2px 8px",
                            fontSize: "12px",
                            cursor: "pointer",
                            color: "#333",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "30px" }}>
              <button
                onClick={handleAddRoom}
                style={{
                  backgroundColor: "#edf3ff",
                  border: "1px solid #bdd6ff",
                  color: "#2457a7",
                  fontWeight: "500",
                  borderRadius: "10px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "background 0.3s ease",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#dceaff"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#edf3ff"}
              >
                Add New Room
              </button>

              <button
                onClick={handleGeneratePanorama}
                style={{
                  backgroundColor: "#4a6ee0",
                  border: "none",
                  color: "white",
                  fontWeight: "600",
                  borderRadius: "10px",
                  padding: "14px",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "background 0.3s ease",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#385dc9"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#4a6ee0"}
              >
                Generate Panorama & Start Tour
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualTourForm;
