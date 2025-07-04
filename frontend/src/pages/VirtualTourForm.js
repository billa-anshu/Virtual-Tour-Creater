import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";

const VirtualTourForm = () => {
  const [rooms, setRooms] = useState([]);
  const [roomImages, setRoomImages] = useState({});
  const [tourName, setTourName] = useState("");
  const navigate = useNavigate();
  const tourId = uuidv4();

  const handleImageUpload = (e, roomName) => {
    const selectedFiles = Array.from(e.target.files);
    const previews = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setRoomImages((prev) => ({
      ...prev,
      [roomName]: prev[roomName] ? [...prev[roomName], ...previews] : previews,
    }));
  };

  const handleAddRoom = () => {
    const name = prompt("Enter room name:");
    if (name && !rooms.includes(name)) {
      setRooms((prev) => [...prev, name]);
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
      alert("Please add at least one room and image.");
      return;
    }

    const formData = new FormData();
    formData.append("tourId", tourId);
    formData.append("tour_name", tourName);

    rooms.forEach((room) => {
      (roomImages[room] || []).forEach((img) => {
        formData.append(`${room}[]`, img.file);
      });
    });

    try {
      const res = await axios.post(`${BACKEND_URL}/stitch`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        navigate(`/editor/${tourId}`);
      } else {
        alert("Stitching failed on the backend.");
      }
    } catch (err) {
      console.error("❌ Error generating panorama:", err);
      alert("An error occurred. Check backend logs.");
    }
  };

  return (
    <div style={{ background: "#f0f3f8", minHeight: "100vh", padding: "50px 20px" }}>
      <div style={{ maxWidth: "880px", margin: "auto", background: "#fff", padding: "40px", borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px", fontWeight: "bold" }}>🏗️ Build Your Virtual Tour</h2>

        <div style={{ marginBottom: "30px" }}>
          <label style={{ fontWeight: "600" }}>Tour Name</label>
          <input
            type="text"
            value={tourName}
            onChange={(e) => setTourName(e.target.value)}
            placeholder="Enter tour name"
            style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "8px", border: "1px solid #ccc" }}
          />
        </div>

        {rooms.map((room, index) => (
          <div key={index} style={{ marginBottom: "40px" }}>
            <h4 style={{ marginBottom: "12px" }}>🛏️ Room {index + 1}: <strong>{room}</strong></h4>
            <input type="file" multiple accept="image/*" onChange={(e) => handleImageUpload(e, room)} />

            {roomImages[room]?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
                {roomImages[room].map((img, i) => (
                  <div key={i} style={{ position: "relative", width: "140px", height: "100px", border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
                    <img src={img.preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      onClick={() => handleRemoveImage(room, i)}
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "12px",
                        padding: "2px 6px",
                        cursor: "pointer"
                      }}
                    >x</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "30px" }}>
          <button
            onClick={handleAddRoom}
            style={{ background: "#e1f0ff", border: "1px solid #007bff", color: "#007bff", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold" }}
          >
            ➕ Add Room
          </button>

          <button
            onClick={handleGeneratePanorama}
            style={{ background: "#007bff", color: "white", padding: "10px 20px", border: "none", borderRadius: "8px", fontWeight: "bold" }}
          >
            🚀 Generate Panorama & Start Tour
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualTourForm;
