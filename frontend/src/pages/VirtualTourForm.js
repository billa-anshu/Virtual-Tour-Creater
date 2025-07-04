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
    const previews = selectedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setRoomImages(prev => ({
      ...prev,
      [roomName]: [...(prev[roomName] || []), ...previews]
    }));
  };

  const handleAddRoom = () => {
    const newRoom = prompt("Enter room name:");
    if (newRoom && !rooms.includes(newRoom)) {
      setRooms(prev => [...prev, newRoom]);
    }
  };

  const handleRemoveImage = (room, index) => {
    setRoomImages(prev => ({
      ...prev,
      [room]: prev[room].filter((_, i) => i !== index)
    }));
  };

  const handleGeneratePanorama = async () => {
    if (!tourName.trim()) {
      alert("Please enter a tour name.");
      return;
    }

    const formData = new FormData();
    formData.append("tourId", tourId);
    formData.append("tour_name", tourName);

    for (const room of rooms) {
      const images = roomImages[room];
      if (!images || images.length === 0) {
        alert(`Please upload images for room: ${room}`);
        return;
      }
      images.forEach(img => {
        formData.append(`${room}[]`, img.file);
      });
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/stitch`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        navigate(`/editor/${tourId}`);
      } else {
        alert(`Stitching failed: ${res.data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error during panorama generation:", error);
      alert("Network or server error. Try again later.");
    }
  };

  return (
    <div style={{ padding: "30px", background: "#f7f9fc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 800, margin: "auto", background: "white", padding: 30, borderRadius: 12 }}>
        <h1> Create Your Virtual Tour</h1>

        <label style={{ display: "block", marginTop: 20 }}>
          <strong>Tour Name:</strong>
          <input
            type="text"
            value={tourName}
            onChange={(e) => setTourName(e.target.value)}
            placeholder="e.g., My Smart Home"
            style={{ width: "100%", padding: 10, marginTop: 8 }}
          />
        </label>

        {rooms.map((room, index) => (
          <div key={room} style={{ marginTop: 30 }}>
            <h3>Room {index + 1}: {room}</h3>
            <input type="file" multiple accept="image/*" onChange={(e) => handleImageUpload(e, room)} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {(roomImages[room] || []).map((img, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={img.preview} style={{ width: 100, height: 70, objectFit: "cover", border: "1px solid #ccc" }} />
                  <button
                    onClick={() => handleRemoveImage(room, i)}
                    style={{ position: "absolute", top: 0, right: 0, background: "red", color: "white", border: "none", padding: "2px 6px", cursor: "pointer" }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 20 }}>
          <button onClick={handleAddRoom} style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: 4, marginRight: 10 }}>
             Add Room
          </button>

          <button onClick={handleGeneratePanorama} style={{ padding: "10px 20px", background: "#28a745", color: "white", border: "none", borderRadius: 4 }}>
            🚀 Generate Tour
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualTourForm;
