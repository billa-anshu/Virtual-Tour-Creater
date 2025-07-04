import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

const VirtualTourForm = () => {
  const [tourName, setTourName] = useState('');
  const [rooms, setRooms] = useState([]);
  const [roomImages, setRoomImages] = useState({});
  const navigate = useNavigate();
  const tourId = uuidv4();

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
    if (!tourName.trim()) {
      alert("Please enter a tour name.");
      return;
    }

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

    const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";

    try {
      const response = await axios.post(`${BACKEND_URL}/stitch`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        const panoramaUrls = response.data.panoramaUrls;

        localStorage.setItem(`tourData-${tourId}`, JSON.stringify({ tourName, panoramaUrls, startRoom: rooms[0] }));
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
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "1rem",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(10px)",
          maxWidth: "880px",
          width: "100%",
          padding: "40px",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: "10px", fontWeight: "600" }}>
          Build Your Virtual Tour
        </h1>

        <input
          type="text"
          placeholder="Enter Tour Name"
          value={tourName}
          onChange={(e) => setTourName(e.target.value)}
          style={{
            margin: "20px auto 40px auto",
            display: "block",
            padding: "12px",
            width: "100%",
            borderRadius: "8px",
            border: "1px solid #ccc",
            backgroundColor: "rgba(255,255,255,0.8)",
            color: "#333",
            fontSize: "16px",
          }}
        />

        {rooms.map((room, index) => (
          <div key={index} style={{ marginBottom: "50px" }}>
            <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "10px", marginBottom: "20px" }}>
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
                  }}>
                    <img
                      src={item.preview}
                      alt={`Preview ${room} - ${i}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
            }}
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
            }}
          >
            Generate Panorama & Start Tour
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualTourForm;
