import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
// Import icons from lucide-react for better UX, without affecting styling
import { Plus, Upload, XCircle, Rocket } from 'lucide-react'; // Added icons

// The backend URL is already correct in the user's provided file
const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";

const VirtualTourForm = () => {
  const [rooms, setRooms] = useState([]);
  const [roomImages, setRoomImages] = useState({});
  const [tourName, setTourName] = useState("");
  const [newRoomName, setNewRoomName] = useState(""); // New state for input field for room name
  const [isGenerating, setIsGenerating] = useState(false); // New state for loading indicator
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

  // Modified handleAddRoom to use an input field instead of prompt
  const handleAddRoom = () => {
    if (newRoomName.trim() && !rooms.includes(newRoomName.trim())) {
      setRooms((prev) => [...prev, newRoomName.trim()]);
      setNewRoomName(""); // Clear the input after adding
    } else if (newRoomName.trim()) {
      alert("Room name already exists!");
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

    if (rooms.length === 0) {
      alert("Please add at least one room to create a tour.");
      return;
    }

    // New validation: Check if all added rooms have at least one image
    for (const room of rooms) {
      if (!roomImages[room] || roomImages[room].length === 0) {
        alert(`Please upload images for room: "${room}".`);
        return;
      }
    }

    setIsGenerating(true); // Start loading

    const formData = new FormData();
    formData.append('tourId', tourId);
    formData.append('tour_name', tourName.trim());

    rooms.forEach((room) => {
      roomImages[room]?.forEach((img) => {
        formData.append(`${room}[]`, img.file);
      });
    });

    try {
      const response = await axios.post(BACKEND_URL + "/stitch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        navigate(`/editor/${tourId}`);
      } else {
        alert("Stitching failed: " + (response.data.error || "Unknown error."));
      }
    } catch (err) {
      console.error("Error during panorama generation:", err);
      // More descriptive error messages
      if (err.response) {
        alert(`Server error: ${err.response.data.error || "Something went wrong on the server."}`);
      } else if (err.request) {
        alert("Network error: Could not connect to the backend. Please check your internet connection or backend server status.");
      } else {
        alert(`An unexpected error occurred: ${err.message}`);
      }
    } finally {
      setIsGenerating(false); // Stop loading
    }
  };

  return (
    <div style={{ backgroundColor: "#f8f9fb", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto", background: "#fff", padding: "40px", borderRadius: "20px", boxShadow: "0 6px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ textAlign: "center", marginBottom: "20px", fontWeight: "600" }}>Build Your Virtual Tour</h1>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "30px" }}>
          Upload room images and we’ll stitch them into interactive panoramas.
        </p>

        {/* Tour Name Input */}
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

        {/* Add Room Section - Updated to use input field */}
        <div style={{ marginBottom: "30px", border: "1px solid #e0e0e0", padding: "20px", borderRadius: "10px", backgroundColor: "#fdfdfd" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "15px" }}>Add Rooms</h2>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <input
                    type="text"
                    placeholder="Enter new room name"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleAddRoom(); }}
                    style={{
                        flexGrow: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        fontSize: "16px",
                    }}
                />
                <button
                    onClick={handleAddRoom}
                    style={{
                        padding: "10px 15px",
                        backgroundColor: "#007bff", // Blue
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex", // For icon
                        alignItems: "center", // For icon
                        gap: "5px", // For icon spacing
                        fontWeight: "500"
                    }}
                    disabled={!newRoomName.trim() || rooms.includes(newRoomName.trim())}
                >
                    <Plus size={18} /> Add Room
                </button>
            </div>

            {rooms.length === 0 && (
                <p style={{ textAlign: "center", color: "#888", padding: "10px" }}>No rooms added yet. Add your first room above!</p>
            )}
        </div>


        {rooms.map((room, index) => (
          <div key={index} style={{ marginBottom: "50px", border: "1px solid #e0e0e0", padding: "20px", borderRadius: "10px", backgroundColor: "#fdfdfd" }}>
            <h3 style={{ borderBottom: "1px solid #eaeaea", paddingBottom: "10px", marginBottom: "20px", fontSize: "20px", fontWeight: "600" }}>
              Room {index + 1}: <span style={{ fontWeight: 500 }}>{room}</span>
            </h3>

            <label style={{ fontWeight: "500", display: "block", marginBottom: "8px" }}>
              Upload Images for {room}:
            </label>
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
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>Select multiple images to create a 360° panorama for this room.</p>


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
                        background: "#dc3545", // Red background
                        color: "white",
                        border: "none",
                        borderRadius: "50%", // Make it circular
                        padding: "4px", // Adjust padding
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex", // For icon
                        alignItems: "center", // For icon
                        justifyContent: "center", // For icon
                        width: "24px", // Fixed width
                        height: "24px" // Fixed height
                      }}
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Display message if no images uploaded for this specific room */}
            {(!roomImages[room] || roomImages[room].length === 0) && (
                <p style={{ color: '#dc3545', fontSize: '14px', marginTop: '10px' }}>No images uploaded for this room. Please upload at least one.</p>
            )}
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "30px" }}>
          {/* Replaced Add New Room button with the one associated with the input field above */}

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
              cursor: isGenerating || rooms.length === 0 || !tourName.trim() ? "not-allowed" : "pointer",
              opacity: isGenerating || rooms.length === 0 || !tourName.trim() ? 0.7 : 1, // Dim when disabled
              display: "flex", // For icon
              alignItems: "center", // For icon
              justifyContent: "center", // For icon
              gap: "10px" // For icon spacing
            }}
            disabled={isGenerating || rooms.length === 0 || !tourName.trim()}
          >
            {isGenerating ? (
              <>
                <span style={{
                  display: "inline-block",
                  width: "20px",
                  height: "20px",
                  border: "3px solid rgba(255,255,255,.3)",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></span>
                Generating Tour...
              </>
            ) : (
              <>
                <Rocket size={20} /> Generate Panorama & Start Tour
              </>
            )}
          </button>
          {isGenerating && (
            <p style={{ textAlign: "center", fontSize: "14px", color: "#666" }}>This may take a moment as panoramas are being stitched.</p>
          )}
        </div>
      </div>

      {/* Keyframe for spin animation (can be added to a global CSS file or style tag) */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default VirtualTourForm;
