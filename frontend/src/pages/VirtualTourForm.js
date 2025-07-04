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
      alert("Please enter a name for your tour.");
      return;
    }

    if (rooms.length === 0 || Object.keys(roomImages).length === 0) {
      alert("Please upload at least one image for each room.");
      return;
    }

    const formData = new FormData();
    formData.append('tourId', tourId);
    formData.append('tour_name', tourName.trim());

    rooms.forEach((room) => {
      roomImages[room]?.forEach((img) => {
        formData.append(`${room}[]`, img.file);
      });
    });

    try {
      const response = await axios.post(`${BACKEND_URL}/initial-stitch`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        navigate(`/editor/${tourId}`);
      } else {
        alert("Stitching failed.");
      }
    } catch (err) {
      console.error("Error during panorama generation:", err);
      alert("Failed to generate tour.");
    }
  };

  return (
    <div style={{ backgroundColor: "#f8f9fb", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto", background: "#fff", padding: "40px", borderRadius: "20px", boxShadow: "0 6px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ textAlign: "center", marginBottom: "20px", fontWeight: "600" }}>Build Your Virtual Tour</h1>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "30px" }}>
          Upload room images and we’ll stitch them into interactive panoramas.
        </p>

        <div style={{ marginBottom: "30px" }}>
          <label htmlFor="tourName" style={{ fontWeight: "500", display: "block", marginBottom: "8px" }}>
            Tour Name:
          </label>
          <input
            id="tourName"
            type="text"
            placeholder="Enter a name for your tour"
            value={tourName}
            onChange={(e) => setTourName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          />
        </div>

        {rooms.map((room, index) => (
          <div key={index} style={{ marginBottom: "50px" }}>
            <h3 style={{ borderBottom: "1px solid #eaeaea", paddingBottom: "10px", marginBottom: "20px" }}>
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
                width: "100%"
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
                    background: "#fafafa"
                  }}>
                    <img
                      src={item.preview}
                      alt={`Preview ${room} - ${i}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
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
                        cursor: "pointer"
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
              cursor: "pointer"
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
              cursor: "pointer"
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
