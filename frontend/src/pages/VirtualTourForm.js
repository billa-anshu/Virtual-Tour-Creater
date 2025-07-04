import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { Plus, Upload, XCircle, Rocket } from 'lucide-react'; // Import icons

// Corrected Backend URL to match TourEditorPage.js
const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";

const VirtualTourForm = () => {
  const [rooms, setRooms] = useState([]);
  const [roomImages, setRoomImages] = useState({});
  const [tourName, setTourName] = useState("");
  const [newRoomName, setNewRoomName] = useState(""); // State for new room input
  const [isGenerating, setIsGenerating] = useState(false); // Loading state for tour generation
  const navigate = useNavigate();
  const tourId = uuidv4(); // Generate a unique ID for the new tour

  // Handles image selection for a specific room
  const handleImageUpload = (e, roomName) => {
    const selectedFiles = Array.from(e.target.files);
    const previews = selectedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file) // Create object URL for image preview
    }));
    setRoomImages(prev => ({
      ...prev,
      [roomName]: [...(prev[roomName] || []), ...previews] // Append new files to existing ones
    }));
  };

  // Handles adding a new room
  const handleAddRoom = () => {
    if (newRoomName.trim() && !rooms.includes(newRoomName.trim())) {
      setRooms(prev => [...prev, newRoomName.trim()]); // Add new room to the list
      setNewRoomName(""); // Clear the input field
    } else if (rooms.includes(newRoomName.trim())) {
      alert("Room name already exists!");
    }
  };

  // Handles removing an image from a specific room
  const handleRemoveImage = (room, index) => {
    setRoomImages(prev => ({
      ...prev,
      [room]: prev[room].filter((_, i) => i !== index) // Filter out the image at the given index
    }));
  };

  // Handles the generation of the panorama tour
  const handleGeneratePanorama = async () => {
    if (!tourName.trim()) {
      alert("Please enter a tour name.");
      return;
    }

    if (rooms.length === 0) {
      alert("Please add at least one room to create a tour.");
      return;
    }

    // Check if all rooms have images
    for (const room of rooms) {
      if (!roomImages[room] || roomImages[room].length === 0) {
        alert(`Please upload images for room: "${room}"`);
        return;
      }
    }

    setIsGenerating(true); // Set loading state to true

    const formData = new FormData();
    formData.append("tourId", tourId);
    formData.append("tour_name", tourName.trim());

    // Append images for each room
    for (const room of rooms) {
      const images = roomImages[room];
      images.forEach(img => {
        formData.append(`${room}[]`, img.file); // Append files with room name as key
      });
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/stitch`, formData, {
        headers: { "Content-Type": "multipart/form-data" } // Important for file uploads
      });

      if (res.data.success) {
        // Navigate to the editor page on successful stitching
        navigate(`/editor/${tourId}`);
      } else {
        alert(`Stitching failed: ${res.data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error during panorama generation:", error);
      // Provide more specific error messages for network/server issues
      if (error.response) {
        alert(`Server error: ${error.response.data.error || "Something went wrong on the server."}`);
      } else if (error.request) {
        alert("Network error: Could not connect to the backend. Please check your internet connection or backend server status.");
      } else {
        alert(`An unexpected error occurred: ${error.message}`);
      }
    } finally {
      setIsGenerating(false); // Reset loading state
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-6 text-center">
          Create Your Virtual Tour
        </h1>

        {/* Tour Name Input */}
        <div className="mb-6">
          <label htmlFor="tourName" className="block text-gray-700 text-lg font-medium mb-2">
            Tour Name:
          </label>
          <input
            type="text"
            id="tourName"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., My Smart Home Tour"
            value={tourName}
            onChange={(e) => setTourName(e.target.value)}
          />
        </div>

        {/* Add Room Section */}
        <div className="mb-8 p-6 bg-blue-50 rounded-xl shadow-inner">
          <h2 className="text-2xl font-semibold text-blue-700 mb-4">Add Rooms</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              type="text"
              className="flex-grow p-3 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter new room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleAddRoom();
              }}
            />
            <button
              className="btn bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition duration-200 flex items-center justify-center gap-2"
              onClick={handleAddRoom}
              disabled={!newRoomName.trim() || rooms.includes(newRoomName.trim())}
            >
              <Plus size={20} /> Add Room
            </button>
          </div>

          {rooms.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No rooms added yet. Use the input above to add your first room!</p>
          ) : (
            <div className="space-y-6">
              {rooms.map((room, index) => (
                <div key={room} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-xl text-gray-800 mb-3">Room {index + 1}: {room}</h3>
                  <label className="block text-gray-700 text-md font-medium mb-2">
                    Upload Images for {room}:
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, room)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  <p className="text-sm text-gray-500 mt-1">Select multiple images to create a 360° panorama for this room.</p>

                  {/* Image Previews */}
                  {(roomImages[room] && roomImages[room].length > 0) && (
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {roomImages[room].map((img, i) => (
                        <div key={i} className="relative w-full h-20 rounded-md overflow-hidden shadow-sm border border-gray-200">
                          <img
                            src={img.preview}
                            alt={`Preview ${i}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handleRemoveImage(room, i)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600 transition"
                            aria-label="Remove image"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate Tour Button */}
        <div className="text-center mt-8">
          <button
            onClick={handleGeneratePanorama}
            className="btn bg-green-600 text-white px-8 py-4 rounded-lg shadow-lg hover:bg-green-700 transition duration-200 flex items-center justify-center gap-2 text-xl font-semibold mx-auto"
            disabled={isGenerating || rooms.length === 0 || !tourName.trim()}
          >
            {isGenerating ? (
              <>
                <span className="animate-spin inline-block w-5 h-5 border-4 border-t-4 border-white border-t-transparent rounded-full"></span>
                Generating Tour...
              </>
            ) : (
              <>
                <Rocket size={24} /> Generate Tour
              </>
            )}
          </button>
          {isGenerating && (
            <p className="text-sm text-gray-600 mt-2">This may take a moment as panoramas are being stitched.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTourForm;
