// pages/TourEditorPage.js
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { supabase } from '../Supabase';
import { v4 as uuidv4 } from 'uuid'; // For generating new marker/tooltip IDs
import MicRecorder from 'mic-recorder-to-mp3'; // Corrected import path
import {
  Pencil,
  Check,
  Upload,
  Repeat,
  Plus,
  Trash2,
  HelpCircle,
  XCircle,
  Mic,
  StopCircle,
  Volume2, // For play audio icon
  VolumeX, // For mute audio icon
} from "lucide-react";

const FIXED_MARKER_POSITION = { x: 0.5, y: 0.5 };
const BACKEND_URL = "http://127.0.0.1:5000"; // Define your Flask backend URL here
const recorder = new MicRecorder({ bitRate: 128 });

const TourEditorPage = () => {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const panoramaRef = useRef(null);

  // --- Room and Panorama States ---
  const [panoramaUrls, setPanoramaUrls] = useState({}); // Will be populated from Flask backend (just the URL string)
  const [fullPanoramaData, setFullPanoramaData] = useState({}); // Stores full object {url, viewConstraints}
  const [rooms, setRooms] = useState([]); // List of room names
  const [showFileInput, setShowFileInput] = useState({}); // State to manage file input visibility per room
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(""); // Currently selected room in the dropdown
  const [roomImages, setRoomImages] = useState({}); // Stores FileList objects for each room
  const [currentRoomName, setCurrentRoomName] = useState(""); // For new room input
  const [isEditingRoomName, setIsEditingRoomName] = useState(null); // roomName being edited
  const [editedRoomName, setEditedRoomName] = useState(""); // New name for the room being edited

  // --- Marker States ---
  const [markers, setMarkers] = useState({}); // Markers for each room: { 'roomName': [{id, linkTo, position: {x,y}}] }
  const [showMarkerCreator, setShowMarkerCreator] = useState(false);
  const [linkToRoom, setLinkToRoom] = useState(""); // Room to link to for new marker

  // --- Tooltip States ---
  const [tooltips, setTooltips] = useState({}); // Tooltips for each room: { 'roomName': [{id, content, position: {x,y}}] }
  const [showTooltipCreator, setShowTooltipCreator] = useState(false);
  const [tooltipContent, setTooltipContent] = useState(""); // Content for new tooltip

  // --- Audio States ---
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState({}); // Stores audio URLs per room
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const audioPlaybackRef = useRef(new Audio()); // For playing back recorded audio

  // --- Confirmation Modal States ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // Callback for confirm action

  // --- Start Room State ---
  const [startRoom, setStartRoom] = useState(""); // State to hold the current start room

  // --- Initial Data Fetch ---
  useEffect(() => {
    const fetchTourData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BACKEND_URL}/get-tour-data/${tourId}`);
        if (response.data.success) {
          const { panoramaUrls, markers, tooltips, startRoom, audioUrls } = response.data;
          setPanoramaUrls(panoramaUrls);
          // Ensure markers and tooltips have position_x and position_y as numbers
          const sanitizedMarkers = Object.fromEntries(
            Object.entries(markers).map(([roomName, markerList]) => [
              roomName,
              markerList.map(marker => ({
                ...marker,
                position_x: typeof marker.position_x === 'number' ? marker.position_x : FIXED_MARKER_POSITION.x,
                position_y: typeof marker.position_y === 'number' ? marker.position_y : FIXED_MARKER_POSITION.y,
              }))
            ])
          );
          setMarkers(sanitizedMarkers);

          const sanitizedTooltips = Object.fromEntries(
            Object.entries(tooltips).map(([roomName, tooltipList]) => [
              roomName,
              tooltipList.map(tooltip => ({
                ...tooltip,
                position_x: typeof tooltip.position_x === 'number' ? tooltip.position_x : FIXED_MARKER_POSITION.x,
                position_y: typeof tooltip.position_y === 'number' ? tooltip.position_y : FIXED_MARKER_POSITION.y,
              }))
            ])
          );
          setTooltips(sanitizedTooltips);
          setAudioUrl(audioUrls); // Set audio URLs

          const roomNames = Object.keys(panoramaUrls);
          setRooms(roomNames);

          // Set the selected room to the start room if available, otherwise the first room
          if (startRoom && roomNames.includes(startRoom)) {
            setSelectedRoom(startRoom);
            setStartRoom(startRoom); // Set startRoom state
          } else if (roomNames.length > 0) {
            setSelectedRoom(roomNames[0]);
            setStartRoom(roomNames[0]); // Set startRoom state
          }
        } else {
          setError(response.data.error || "Failed to fetch tour data.");
        }
      } catch (err) {
        console.error("Error fetching tour data:", err);
        setError("Failed to fetch tour data. Please check network and tour ID.");
      } finally {
        setLoading(false);
      }
    };

    if (tourId) {
      fetchTourData();
    }
  }, [tourId]);

  // --- Room Management Handlers ---
  const handleAddRoom = () => {
    if (currentRoomName && !rooms.includes(currentRoomName)) {
      setRooms([...rooms, currentRoomName]);
      setShowFileInput((prev) => ({ ...prev, [currentRoomName]: true }));
      setRoomImages((prev) => ({ ...prev, [currentRoomName]: null })); // Initialize with null FileList
      setCurrentRoomName("");
    }
  };

  const handleFileChange = (roomName, files) => {
    setRoomImages((prev) => ({ ...prev, [roomName]: files }));
    setShowFileInput((prev) => ({ ...prev, [roomName]: false })); // Hide after selection
  };

  const handleRetakeImages = (roomName) => {
    setShowFileInput((prev) => ({ ...prev, [roomName]: true }));
    setRoomImages((prev) => ({ ...prev, [roomName]: null }));
  };

  const handleEditRoomName = (roomName) => {
    setIsEditingRoomName(roomName);
    setEditedRoomName(roomName);
  };

  const handleSaveRoomName = async (oldRoomName) => {
    if (editedRoomName && editedRoomName !== oldRoomName && !rooms.includes(editedRoomName)) {
      setConfirmModalMessage(`Are you sure you want to rename room "${oldRoomName}" to "${editedRoomName}"? This will update all associated markers and tooltips.`);
      setConfirmAction(() => async () => {
        try {
          const response = await axios.post(`${BACKEND_URL}/rename-room`, {
            tourId,
            oldRoomName,
            newRoomName: editedRoomName,
          });
          if (response.data.success) {
            // Update local state
            const updatedRooms = rooms.map((r) =>
              r === oldRoomName ? editedRoomName : r
            );
            setRooms(updatedRooms);

            const updatedPanoramaUrls = { ...panoramaUrls };
            updatedPanoramaUrls[editedRoomName] = updatedPanoramaUrls[oldRoomName];
            delete updatedPanoramaUrls[oldRoomName];
            setPanoramaUrls(updatedPanoramaUrls);

            const updatedMarkers = { ...markers };
            if (updatedMarkers[oldRoomName]) {
              updatedMarkers[editedRoomName] = updatedMarkers[oldRoomName].map(marker => ({
                ...marker,
                linkTo: marker.linkTo === oldRoomName ? editedRoomName : marker.linkTo // Update linkTo if it points to the old room
              }));
              delete updatedMarkers[oldRoomName];
            }
            setMarkers(updatedMarkers);

            const updatedTooltips = { ...tooltips };
            if (updatedTooltips[oldRoomName]) {
              updatedTooltips[editedRoomName] = updatedTooltips[oldRoomName];
              delete updatedTooltips[oldRoomName];
            }
            setTooltips(updatedTooltips);

            const updatedAudioUrls = { ...audioUrl };
            if (updatedAudioUrls[oldRoomName]) {
              updatedAudioUrls[editedRoomName] = updatedAudioUrls[oldRoomName];
              delete updatedAudioUrls[oldRoomName];
            }
            setAudioUrl(updatedAudioUrls);

            // Update selected room and start room if they were the old room
            if (selectedRoom === oldRoomName) setSelectedRoom(editedRoomName);
            if (startRoom === oldRoomName) setStartRoom(editedRoomName); // Update startRoom state
            
            setIsEditingRoomName(null);
            setEditedRoomName("");
            alert("Room renamed successfully!");
          } else {
            alert(`Failed to rename room: ${response.data.message || response.data.error}`);
          }
        } catch (error) {
          console.error("Error renaming room:", error);
          alert("Error renaming room. Please try again.");
        }
        setShowConfirmModal(false);
      });
      setShowConfirmModal(true);
    } else {
      setIsEditingRoomName(null);
      setEditedRoomName("");
    }
  };

  const handleDeleteRoom = (roomToDelete) => {
    setConfirmModalMessage(`Are you sure you want to delete room "${roomToDelete}"? This action cannot be undone and will remove all associated panoramas, markers, and tooltips.`);
    setConfirmAction(() => async () => {
      try {
        const response = await axios.post(`${BACKEND_URL}/delete-room`, {
          tourId,
          roomName: roomToDelete,
        });
        if (response.data.success) {
          const updatedRooms = rooms.filter((room) => room !== roomToDelete);
          setRooms(updatedRooms);

          const updatedPanoramaUrls = { ...panoramaUrls };
          delete updatedPanoramaUrls[roomToDelete];
          setPanoramaUrls(updatedPanoramaUrls);

          const updatedMarkers = { ...markers };
          delete updatedMarkers[roomToDelete];
          // Also remove markers that link TO the deleted room
          Object.keys(updatedMarkers).forEach(room => {
            updatedMarkers[room] = updatedMarkers[room].filter(marker => marker.linkTo !== roomToDelete);
          });
          setMarkers(updatedMarkers);

          const updatedTooltips = { ...tooltips };
          delete updatedTooltips[roomToDelete];
          setTooltips(updatedTooltips);

          const updatedAudioUrls = { ...audioUrl };
          delete updatedAudioUrls[roomToDelete];
          setAudioUrl(updatedAudioUrls);

          // If the deleted room was the selected room, select the first available room
          if (selectedRoom === roomToDelete) {
            setSelectedRoom(updatedRooms.length > 0 ? updatedRooms[0] : "");
          }
          // If the deleted room was the start room, update startRoom state
          if (startRoom === roomToDelete) {
            setStartRoom(updatedRooms.length > 0 ? updatedRooms[0] : "");
          }

          alert("Room deleted successfully!");
        } else {
          alert(`Failed to delete room: ${response.data.message || response.data.error}`);
        }
      } catch (error) {
        console.error("Error deleting room:", error);
        alert("Error deleting room. Please try again.");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  // --- Marker Handlers ---
  const handleAddMarker = () => {
    if (selectedRoom && linkToRoom) {
      const newMarker = {
        id: uuidv4(),
        linkTo: linkToRoom,
        position_x: FIXED_MARKER_POSITION.x,
        position_y: FIXED_MARKER_POSITION.y,
      };
      setMarkers((prev) => ({
        ...prev,
        [selectedRoom]: [...(prev[selectedRoom] || []), newMarker],
      }));
      setLinkToRoom("");
      setShowMarkerCreator(false);
    }
  };

  const handleDeleteMarker = (markerId) => {
    setMarkers((prev) => {
      const updatedMarkers = { ...prev };
      if (updatedMarkers[selectedRoom]) {
        updatedMarkers[selectedRoom] = updatedMarkers[selectedRoom].filter(
          (m) => m.id !== markerId
        );
      }
      return updatedMarkers;
    });
  };

  const handleSaveMarkers = async () => {
    if (!selectedRoom) return;
    try {
      const response = await axios.post(`${BACKEND_URL}/save-markers`, {
        tourId,
        roomFrom: selectedRoom,
        markers: markers[selectedRoom] || [],
      });
      if (response.data.success) {
        alert("Markers saved successfully!");
      } else {
        alert(`Failed to save markers: ${response.data.error}`);
      }
    } catch (error) {
      console.error("Error saving markers:", error);
      alert("Error saving markers. Please try again.");
    }
  };

  // --- Tooltip Handlers ---
  const handleAddTooltip = () => {
    if (selectedRoom && tooltipContent) {
      const newTooltip = {
        id: uuidv4(),
        content: tooltipContent,
        position_x: FIXED_MARKER_POSITION.x,
        position_y: FIXED_MARKER_POSITION.y,
      };
      setTooltips((prev) => ({
        ...prev,
        [selectedRoom]: [...(prev[selectedRoom] || []), newTooltip],
      }));
      setTooltipContent("");
      setShowTooltipCreator(false);
    }
  };

  const handleDeleteTooltip = (tooltipId) => {
    setTooltips((prev) => {
      const updatedTooltips = { ...prev };
      if (updatedTooltips[selectedRoom]) {
        updatedTooltips[selectedRoom] = updatedTooltips[selectedRoom].filter(
          (t) => t.id !== tooltipId
        );
      }
      return updatedTooltips;
    });
  };

  const handleSaveTooltips = async () => {
    if (!selectedRoom) return;
    try {
      const response = await axios.post(`${BACKEND_URL}/save-tooltips`, {
        tourId,
        roomName: selectedRoom,
        tooltips: tooltips[selectedRoom] || [],
      });
      if (response.data.success) {
        alert("Tooltips saved successfully!");
      } else {
        alert(`Failed to save tooltips: ${response.data.error}`);
      }
    } catch (error) {
      console.error("Error saving tooltips:", error);
      alert("Error saving tooltips. Please try again.");
    }
  };

  // --- Audio Handlers ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await recorder.start();
      setIsRecording(true);
      console.log('Recording started');
    } catch (e) {
      console.error('Error starting recording:', e);
      alert('Could not start recording. Please ensure microphone access is granted.');
    }
  };

  const stopRecording = async () => {
    try {
      const [buffer, blob] = await recorder.stop().getMp3();
      setAudioBlob(blob);
      setIsRecording(false);
      console.log('Recording stopped', blob);
      // Play back the recorded audio for confirmation
      const url = URL.createObjectURL(blob);
      audioPlaybackRef.current.src = url;
      audioPlaybackRef.current.play().catch(e => console.error("Error playing back audio:", e));
    } catch (e) {
      console.error('Error stopping recording:', e);
      alert('Error stopping recording. Please try again.');
    }
  };

  const handleUploadAudio = async () => {
    if (!audioBlob || !selectedRoom) {
      alert("No audio recorded or room selected.");
      return;
    }
    setIsUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append('tourId', tourId);
      formData.append('roomName', selectedRoom);
      formData.append('audio', audioBlob, `${selectedRoom}_audio.mp3`);

      const response = await axios.post(`${BACKEND_URL}/upload-audio`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setAudioUrl(prev => ({ ...prev, [selectedRoom]: response.data.audioUrl }));
        setAudioBlob(null); // Clear the blob after successful upload
        alert("Audio uploaded successfully!");
      } else {
        alert(`Failed to upload audio: ${response.data.error}`);
      }
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Error uploading audio. Please try again.");
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleDeleteAudio = async () => {
    if (!selectedRoom || !audioUrl[selectedRoom]) {
      alert("No audio to delete for this room.");
      return;
    }

    setConfirmModalMessage(`Are you sure you want to delete the audio for room "${selectedRoom}"?`);
    setConfirmAction(() => async () => {
      try {
        const response = await axios.post(`${BACKEND_URL}/delete-audio`, {
          tourId,
          roomName: selectedRoom,
        });

        if (response.data.success) {
          setAudioUrl(prev => {
            const newAudioUrls = { ...prev };
            delete newAudioUrls[selectedRoom];
            return newAudioUrls;
          });
          setAudioBlob(null); // Clear any pending recorded blob
          alert("Audio deleted successfully!");
        } else {
          alert(`Failed to delete audio: ${response.data.error}`);
        }
      } catch (error) {
        console.error("Error deleting audio:", error);
        alert("Error deleting audio. Please try again.");
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handlePlayAudio = () => {
    if (audioPlaybackRef.current.src) {
      audioPlaybackRef.current.play().catch(e => console.error("Error playing audio:", e));
    } else if (audioUrl[selectedRoom]) {
      // If no recorded audio, play the uploaded one
      audioPlaybackRef.current.src = audioUrl[selectedRoom];
      audioPlaybackRef.current.play().catch(e => console.error("Error playing uploaded audio:", e));
    } else {
      alert("No audio available to play for this room.");
    }
  };

  const handleStopAudio = () => {
    audioPlaybackRef.current.pause();
    audioPlaybackRef.current.currentTime = 0;
  };

  // --- Start Room Selection Handler (NEW) ---
  const handleStartRoomChange = async (event) => {
    const newStartRoom = event.target.value;
    if (!newStartRoom) return;

    setConfirmModalMessage(`Are you sure you want to set "${newStartRoom}" as the starting room for this tour?`);
    setConfirmAction(() => async () => {
      try {
        const response = await axios.post(`${BACKEND_URL}/update-start-room`, {
          tourId,
          newStartRoom,
        });
        if (response.data.success) {
          setStartRoom(newStartRoom); // Update local state on success
          alert(`Starting room set to "${newStartRoom}" successfully!`);
        } else {
          alert(`Failed to set starting room: ${response.data.error}`);
        }
      } catch (error) {
        console.error("Error updating start room:", error);
        alert("Error updating starting room. Please try again.");
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  // --- Confirmation Modal Handlers ---
  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setConfirmModalMessage("");
    setConfirmAction(null);
  };

  // --- Generate Tour ---
  const handleGenerateTour = () => {
    if (!tourId) {
      alert("Tour ID is not available. Please create or select a tour.");
      return;
    }
    navigate(`/tour/${tourId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Loading tour editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 rounded-lg">
        <p className="text-xl">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-6 text-center">
            Tour Editor: <span className="text-blue-600">{tourId}</span>
          </h1>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">1. Manage Rooms</h2>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input
                type="text"
                className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter new room name"
                value={currentRoomName}
                onChange={(e) => setCurrentRoomName(e.target.value)}
              />
              <button
                className="btn bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition duration-200 flex items-center justify-center gap-2"
                onClick={handleAddRoom}
                disabled={!currentRoomName || rooms.includes(currentRoomName)}
              >
                <Plus size={20} /> Add Room
              </button>
            </div>

            {rooms.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No rooms added yet. Start by adding a new room above!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map((roomName) => (
                  <div key={roomName} className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      {isEditingRoomName === roomName ? (
                        <input
                          type="text"
                          value={editedRoomName}
                          onChange={(e) => setEditedRoomName(e.target.value)}
                          onBlur={() => handleSaveRoomName(roomName)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSaveRoomName(roomName);
                          }}
                          className="font-semibold text-xl text-gray-800 p-1 border border-blue-300 rounded-md flex-grow mr-2"
                          autoFocus
                        />
                      ) : (
                        <h3 className="font-semibold text-xl text-gray-800 truncate">
                          {roomName} {startRoom === roomName && <span className="text-blue-500 text-sm">(Start)</span>}
                        </h3>
                      )}
                      <div className="flex gap-2">
                        {isEditingRoomName === roomName ? (
                          <button
                            className="text-green-500 hover:text-green-700 transition"
                            onClick={() => handleSaveRoomName(roomName)}
                          >
                            <Check size={20} />
                          </button>
                        ) : (
                          <button
                            className="text-gray-500 hover:text-blue-600 transition"
                            onClick={() => handleEditRoomName(roomName)}
                          >
                            <Pencil size={20} />
                          </button>
                        )}
                        <button
                          className="text-red-500 hover:text-red-700 transition"
                          onClick={() => handleDeleteRoom(roomName)}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Image Upload / Panorama Display */}
                    {panoramaUrls[roomName] ? (
                      <div className="relative w-full h-48 bg-gray-200 rounded-lg overflow-hidden mb-3">
                        <img
                          src={panoramaUrls[roomName]}
                          alt={`${roomName} Panorama`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity duration-300">
                          <button
                            className="btn bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 transition flex items-center gap-2"
                            onClick={() => handleRetakeImages(roomName)}
                          >
                            <Repeat size={18} /> Re-stitch
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400 text-gray-600 mb-3">
                        {showFileInput[roomName] ? (
                          <div className="text-center">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleFileChange(roomName, e.target.files)}
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <p className="mt-2 text-sm text-gray-500">Upload multiple images for stitching.</p>
                          </div>
                        ) : (
                          <button
                            className="btn bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition flex items-center gap-2"
                            onClick={() => setShowFileInput((prev) => ({ ...prev, [roomName]: true }))}
                          >
                            <Upload size={18} /> Upload Images
                          </button>
                        )}
                      </div>
                    )}

                    {/* Audio Recording Section */}
                    <div className="mt-4 border-t pt-4 border-gray-200">
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Room Audio Narration</h4>
                      {!audioUrl[roomName] && !audioBlob ? (
                        <div className="flex gap-2 mb-2">
                          {!isRecording ? (
                            <button
                              className="btn bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition flex items-center gap-2"
                              onClick={startRecording}
                            >
                              <Mic size={18} /> Record
                            </button>
                          ) : (
                            <button
                              className="btn bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition flex items-center gap-2"
                              onClick={stopRecording}
                            >
                              <StopCircle size={18} /> Stop
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2 mb-2">
                          <button
                            className="btn bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition flex items-center gap-2"
                            onClick={handlePlayAudio}
                          >
                            <Volume2 size={18} /> Play
                          </button>
                          <button
                            className="btn bg-gray-500 text-white px-4 py-2 rounded-lg shadow hover:bg-gray-600 transition flex items-center gap-2"
                            onClick={handleStopAudio}
                          >
                            <VolumeX size={18} /> Stop Playback
                          </button>
                          <button
                            className="btn bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition flex items-center gap-2"
                            onClick={handleDeleteAudio}
                          >
                            <Trash2 size={18} /> Delete
                          </button>
                        </div>
                      )}
                      {audioBlob && !audioUrl[roomName] && (
                        <button
                          className="btn bg-purple-500 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-600 transition flex items-center gap-2 mt-2"
                          onClick={handleUploadAudio}
                          disabled={isUploadingAudio}
                        >
                          {isUploadingAudio ? 'Uploading...' : <><Upload size={18} /> Upload Audio</>}
                        </button>
                      )}
                      {audioUrl[roomName] && (
                        <p className="text-sm text-gray-600 mt-2">Audio uploaded: <a href={audioUrl[roomName]} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Listen here</a></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start Room Selection (NEW) */}
          <div className="mb-8 p-6 bg-blue-50 rounded-xl shadow-inner">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">2. Set Starting Room</h2>
            <div className="flex items-center gap-4">
              <label htmlFor="startRoomSelect" className="text-lg text-blue-800 font-medium">Choose Start Room:</label>
              <select
                id="startRoomSelect"
                className="p-3 border border-blue-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 flex-grow"
                value={startRoom}
                onChange={handleStartRoomChange}
                disabled={rooms.length === 0}
              >
                <option value="">-- Select a Room --</option>
                {rooms.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
            {rooms.length === 0 && (
              <p className="text-sm text-blue-600 mt-2">Add rooms first to select a starting room.</p>
            )}
            {startRoom && (
              <p className="text-md text-blue-800 mt-3">Current Starting Room: <span className="font-bold">{startRoom}</span></p>
            )}
          </div>

          {/* Marker and Tooltip Management */}
          {rooms.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">3. Add Markers & Tooltips</h2>
              <div className="mb-4">
                <label htmlFor="roomSelect" className="block text-gray-700 text-lg font-medium mb-2">
                  Select Room to Edit:
                </label>
                <select
                  id="roomSelect"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                >
                  <option value="">-- Select a Room --</option>
                  {rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRoom && (
                <section className="mt-6 p-6 bg-gray-50 rounded-xl shadow-inner">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Editing: <span className="text-blue-600">{selectedRoom}</span>
                  </h3>

                  {/* Marker Section */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <HelpCircle size={20} className="text-blue-500" /> Markers (Links to other rooms)
                      <button
                        className="ml-auto btn bg-green-500 text-white px-3 py-1 text-sm rounded-lg shadow hover:bg-green-600 transition flex items-center gap-1"
                        onClick={() => setShowMarkerCreator(!showMarkerCreator)}
                      >
                        <Plus size={16} /> Add Marker
                      </button>
                      <button
                        className="btn bg-indigo-500 text-white px-3 py-1 text-sm rounded-lg shadow hover:bg-indigo-600 transition flex items-center gap-1"
                        onClick={handleSaveMarkers}
                      >
                        <Check size={16} /> Save Markers
                      </button>
                    </h4>
                    {showMarkerCreator && (
                      <div className="flex items-center gap-3 mb-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <select
                          className="flex-grow p-2 border border-gray-300 rounded-lg"
                          value={linkToRoom}
                          onChange={(e) => setLinkToRoom(e.target.value)}
                        >
                          <option value="">Link to Room</option>
                          {rooms
                            .filter((room) => room !== selectedRoom)
                            .map((room) => (
                              <option key={room} value={room}>
                                {room}
                              </option>
                            ))}
                        </select>
                        <button
                          className="btn bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition"
                          onClick={handleAddMarker}
                          disabled={!linkToRoom}
                        >
                          Add
                        </button>
                        <button
                          className="text-gray-500 hover:text-red-500 transition"
                          onClick={() => setShowMarkerCreator(false)}
                        >
                          <XCircle size={20} />
                        </button>
                      </div>
                    )}
                    {(markers[selectedRoom] && markers[selectedRoom].length > 0) ? (
                      <ul className="space-y-2">
                        {markers[selectedRoom].map((marker) => (
                          <li key={marker.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                            <span>
                              Link to: <span className="font-medium text-blue-600">{marker.linkTo}</span> (Pos: x:
                              {typeof marker.position_x === 'number' ? marker.position_x.toFixed(2) : 'N/A'}, y:
                              {typeof marker.position_y === 'number' ? marker.position_y.toFixed(2) : 'N/A'})
                            </span>
                            <button
                              className="text-red-500 hover:text-red-700 transition"
                              onClick={() => handleDeleteMarker(marker.id)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-gray-500">No markers added for this room yet.</p>
                    )}
                  </div>

                  {/* Tooltip Section */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <HelpCircle size={20} className="text-green-500" /> Tooltips (Informational popups)
                      <button
                        className="ml-auto btn bg-green-500 text-white px-3 py-1 text-sm rounded-lg shadow hover:bg-green-600 transition flex items-center gap-1"
                        onClick={() => setShowTooltipCreator(!showTooltipCreator)}
                      >
                        <Plus size={16} /> Add Tooltip
                      </button>
                      <button
                        className="btn bg-indigo-500 text-white px-3 py-1 text-sm rounded-lg shadow hover:bg-indigo-600 transition flex items-center gap-1"
                        onClick={handleSaveTooltips}
                      >
                        <Check size={16} /> Save Tooltips
                      </button>
                    </h4>
                    {showTooltipCreator && (
                      <div className="flex flex-col gap-3 mb-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <textarea
                          className="w-full p-2 border border-gray-300 rounded-lg resize-y"
                          placeholder="Enter tooltip content"
                          value={tooltipContent}
                          onChange={(e) => setTooltipContent(e.target.value)}
                          rows="3"
                        ></textarea>
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition"
                            onClick={handleAddTooltip}
                            disabled={!tooltipContent.trim()}
                          >
                            Add
                          </button>
                          <button
                            className="text-gray-500 hover:text-red-500 transition"
                            onClick={() => setShowTooltipCreator(false)}
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      </div>
                    )}
                    {(tooltips[selectedRoom] && tooltips[selectedRoom].length > 0) ? (
                      <ul className="space-y-2">
                        {tooltips[selectedRoom].map((tooltip) => (
                          <li key={tooltip.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                            <span className="flex-grow mr-2 truncate">
                              Content: <span className="font-medium text-green-600">{tooltip.content}</span> (Pos: x:
                              {typeof tooltip.position_x === 'number' ? tooltip.position_x.toFixed(2) : 'N/A'}, y:
                              {typeof tooltip.position_y === 'number' ? tooltip.position_y.toFixed(2) : 'N/A'})
                            </span>
                            <button
                              className="text-red-500 hover:text-red-700 transition"
                              onClick={() => handleDeleteTooltip(tooltip.id)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-gray-500">No tooltips added for this room yet.</p>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          <div className="text-center mt-5">
            <button className="btn bg-green-600 text-white px-8 py-4 rounded-lg shadow-lg hover:bg-green-700 transition duration-200 flex items-center justify-center gap-2 text-xl font-semibold mx-auto"
              onClick={handleGenerateTour} disabled={rooms.length === 0}>
              🚀 View Tour
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-2xl font-bold text-gray-800">Confirm Action</h5>
              <button type="button" className="text-gray-400 hover:text-gray-600 transition" onClick={handleCancelConfirm}>
                <XCircle size={24} />
              </button>
            </div>
            <div className="mb-6 text-gray-700">
              <p>{confirmModalMessage}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn bg-gray-300 text-gray-800 px-5 py-2 rounded-lg shadow hover:bg-gray-400 transition" onClick={handleCancelConfirm}>Cancel</button>
              <button type="button" className="btn bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TourEditorPage;
