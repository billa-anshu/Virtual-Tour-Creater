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
<<<<<<< HEAD
// CORRECTED: Define your Render Flask backend URL here
const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";
=======
const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com"; // Define your Flask backend URL here
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893
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

<<<<<<< HEAD
        if (res.data.success) {
          // Refetch tour data to get all updated information
          const tourDataRes = await fetch(`${BACKEND_URL}/get-tour-data/${tourId}`);
          const tourData = await tourDataRes.json();
          if (tourData.success) {
              setPanoramaUrls(tourData.panoramaUrls);
              setFullPanoramaData(tourData.panoramaUrls); // Update full panorama data
              setRooms(Object.keys(tourData.panoramaUrls));
              setEditedNames(Object.fromEntries(Object.keys(tourData.panoramaUrls).map((r) => [r, r])));
              setStartRoom(tourData.startRoom);
              setMarkers(tourData.markers || {});
              setTooltips(tourData.tooltips || {});
              setRecordedAudio(tourData.audioUrls ? Object.fromEntries(
                Object.entries(tourData.audioUrls).map(([roomName, url]) => [roomName, { url, blob: null }])
              ) : {});
          } else {
            // If the last room was deleted, the tour data might be empty
            setPanoramaUrls({});
            setFullPanoramaData({});
            setRooms([]);
            setEditedNames({});
            setStartRoom(null);
            setMarkers({});
            setTooltips({});
            setRecordedAudio({});
          }

          if (activeTooltipRoom === roomToDelete) handleCancelTooltipEditMode();

          alert(`✅ Room "${roomToDelete}" removed successfully!`);
        } else {
          alert(`❌ Failed to remove room: ${res.data.error || 'Unknown error'}`);
        }

      } catch (err) {
        console.error("Error removing room:", err);
        alert(`❌ Server error while removing room "${roomToDelete}". ${err.message}`);
      } finally {
        setDeletingRoom(false);
      }
    });
  };


  // --- Marker Add/Remove Logic (Direct Supabase calls, assuming no complex backend logic needed) ---
  const handleAddMarker = async () => {
    if (!selectedRoomFrom || !selectedRoomTo) return alert("Please select both 'From' and 'To' rooms.");
    if (selectedRoomFrom === selectedRoomTo) return alert("A room cannot link to itself. Please choose a different destination room.");

    const existingMarkers = markers[selectedRoomFrom] || [];
    const exists = existingMarkers.some(
      (m) => m.linkTo === selectedRoomTo && m.position.x === FIXED_MARKER_POSITION.x && m.position.y === FIXED_MARKER_POSITION.y
    );
    if (exists) {
      alert(`A marker from "${selectedRoomFrom}" to "${selectedRoomTo}" already exists at the default position.`);
      return;
    }

    const newMarkerId = uuidv4();
    const newMarker = {
      marker_id: newMarkerId,
      tour_id: tourId,
      from_room: selectedRoomFrom,
      to_room: selectedRoomTo,
      position_x: FIXED_MARKER_POSITION.x,
      position_y: FIXED_MARKER_POSITION.y,
    };

    try {
      const { error } = await supabase.from('markers').insert([newMarker]);
      if (error) throw error;

      setMarkers((prev) => {
        const updated = { ...prev };
        updated[selectedRoomFrom] = updated[selectedRoomFrom] || [];
        updated[selectedRoomFrom].push({
          id: newMarkerId,
          position: { x: newMarker.position_x, y: newMarker.position_y },
          linkTo: newMarker.to_room
        });
        return updated;
      });
      setSelectedRoomTo("");
      alert("Marker added successfully!");
    } catch (err) {
      console.error("Error adding marker:", err);
      alert(`Failed to add marker: ${err.message}`);
    }
  };

  const handleRemoveMarker = async (room, linkToRoom) => {
    showConfirmation(`Are you sure you want to remove the marker from "${room}" linked to "${linkToRoom}"?`, async () => {
      try {
        const { error } = await supabase.from('markers')
          .delete()
          .eq('tour_id', tourId)
          .eq('from_room', room)
          .eq('to_room', linkToRoom)
          .eq('position_x', FIXED_MARKER_POSITION.x)
          .eq('position_y', FIXED_MARKER_POSITION.y);

        if (error) throw error;

        setMarkers((prev) => {
          const updated = { ...prev };
          if (updated[room]) {
            updated[room] = updated[room].filter(
              (marker) => !(marker.linkTo === linkToRoom && marker.position.x === FIXED_MARKER_POSITION.x && marker.position.y === FIXED_MARKER_POSITION.y)
            );
          }
          return updated;
        });
        alert("Marker removed successfully!");
      } catch (err) {
        console.error("Error removing marker:", err);
        alert(`Failed to remove marker: ${err.message}`);
      }
    });
  };

  // --- Tooltip Handlers (Direct Supabase calls, assuming no complex backend logic needed) ---
  const handleSelectRoomForTooltipEdit = (room) => {
    setActiveTooltipRoom(room);
    setEditingTooltipId(null);
    setTooltipContentInput("");
    setIsPlacingNewTooltip(false);
    setNewTooltipPosition(null);
  };

  const handlePrepareNewTooltipPlacement = () => {
    if (!activeTooltipRoom) return alert("Please select a room to add tooltips to first.");
    if (!tooltipContentInput.trim()) return alert("Please enter content for the tooltip before placing it.");

    setIsPlacingNewTooltip(true);
    setEditingTooltipId(null);
    setNewTooltipPosition(null);
    alert("Now click on the panorama image below to place the new tooltip at your desired position!");
  };

  const handlePanoramaClickForTooltip = async (e) => {
    if (!activeTooltipRoom) return;

    const img = panoramaRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (isPlacingNewTooltip) {
      const newTooltipId = uuidv4();
      const newTooltip = {
        tooltip_id: newTooltipId,
        tour_id: tourId,
        room_name: activeTooltipRoom,
        content: tooltipContentInput.trim(),
        position_x: x,
        position_y: y,
      };

      try {
        const { error } = await supabase.from('tooltips').insert([newTooltip]);
        if (error) throw error;

        setTooltips((prev) => {
          const updated = { ...prev };
          updated[activeTooltipRoom] = updated[activeTooltipRoom] || [];
          updated[activeTooltipRoom].push({
            id: newTooltipId,
            position: { x: newTooltip.position_x, y: newTooltip.position_y },
            content: newTooltip.content
=======
        if (response.data.success) {
          setAudioUrl(prev => {
            const newAudioUrls = { ...prev };
            delete newAudioUrls[selectedRoom];
            return newAudioUrls;
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893
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

<<<<<<< HEAD
  const handleStartRoomChange = async (e) => {
    const newStartRoom = e.target.value;
    setStartRoom(newStartRoom);
    try {
      await updateTourInSupabase({ start_room: newStartRoom });
      alert("Starting room updated successfully!");
    } catch (err) {
      console.error("Error updating start room:", err);
      alert(`Failed to update starting room: ${err.message}`);
    }
  };


  // --- Common UI for Room Management Card ---
  const RoomCard = ({ room }) => (
    <div className="card h-100 border-0 shadow-sm">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        {editingRoomNames[room] ? (
          <>
            <input value={editedNames[room]} onChange={(e) => handleNameInputChange(room, e.target.value)}
              className="form-control me-2" style={{ maxWidth: "70%" }} />
            <button className="btn btn-light btn-sm" onClick={() => handleNameSave(room)} disabled={renaming}>
              {renaming ? <span className="spinner-border spinner-border-sm"></span> : <Check size={16} />}
            </button>
          </>
        ) : (
          <>
            <span className="fw-semibold">{room}</span>
            <button className="btn btn-light btn-sm" onClick={() => handleNameEdit(room)}><Pencil size={16} /></button>
          </>
        )}
        {!editingRoomNames[room] && (
          <button className="btn btn-light btn-sm ms-2" onClick={() => handleRemoveRoom(room)} disabled={deletingRoom}>
            {deletingRoom ? <span className="spinner-border spinner-border-sm"></span> : <Trash2 size={16} color="red" />}
          </button>
        )}
      </div>
      <div className="card-body text-center d-flex flex-column">
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {panoramaUrls[room] ? (
            <img src={panoramaUrls[room]} alt={`Panorama of ${room}`}
                  className="img-fluid rounded border mb-2" style={{ objectFit: "cover", width: "100%", height: "auto", maxHeight: "200px" }} />
          ) : (
            <p className="text-muted">No panorama image available for {room}.</p>
          )}
        </div>
        {showFileInput[room] ? (
          <div>
            <input type="file" accept="image/*" multiple onChange={(e) => handleFileChange(e, room)} className="form-control mb-2" />
            {selectedFiles[room]?.length > 0 && (
              <div className="mb-2">
                <small>Selected files:</small>
                <div className="row g-2">
                  {selectedFiles[room].map((item, index) => (
                    <div key={index} className="col-md-4 position-relative">
                      <img src={item.preview} alt={item.file.name} className="img-thumbnail"
                        style={{ maxHeight: '80px', width: '100%', objectFit: 'cover' }} />
                      <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0"
                        onClick={() => handleRemoveSelectedFile(room, index)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => handleActualReupload(room)} disabled={uploading}>
              {uploading ? <span className="spinner-border spinner-border-sm"></span> : <Upload size={16} className="me-1" />} Reupload
            </button>
          </div>
        ) : (
          <button className="btn btn-outline-secondary btn-sm mt-2" onClick={() => handleReuploadClick(room)}>
            <Repeat size={16} className="me-1" /> Reupload
          </button>
        )}

        {/* Audio Management Section */}
        <div className="mt-4 pt-3 border-top">
            <h6 className="mb-3">🎤 Room Audio (MP3)</h6>
            {recordedAudio[room]?.url && !recordedAudio[room]?.blob && !selectedAudioFile[room] ? (
                // Audio exists and is already uploaded (from backend fetch)
                <div className="d-flex align-items-center justify-content-between alert alert-success py-2">
                    <Music size={20} className="me-2" />
                    <span>Audio assigned!</span>
                    <audio controls src={recordedAudio[room].url} className="flex-grow mx-2" />
                    <button className="btn btn-sm btn-danger ms-auto" onClick={() => handleRemoveAudio(room)}>
                        <Trash2 size={14} /> Remove
                    </button>
                </div>
            ) : (
                // No audio assigned, or new audio recorded/selected
                <div className="d-flex flex-column align-items-center">
                    {/* Display recorded audio preview */}
                    {recordedAudio[room]?.blob && (
                        <div className="alert alert-info d-flex align-items-center justify-content-between w-100 mb-2 py-2">
                            <Music size={20} className="me-2" />
                            <span>Recorded Audio</span>
                            <audio controls src={recordedAudio[room].url} className="flex-grow mx-2" />
                            <button className="btn btn-sm btn-warning ms-auto" onClick={() => handleRetryAudio(room)}>
                                <Repeat size={14} /> Retry
                            </button>
                        </div>
                    )}

                    {/* Display selected audio file preview */}
                    {selectedAudioFile[room] && (
                        <div className="alert alert-info d-flex align-items-center justify-content-between w-100 mb-2 py-2">
                            <Music size={20} className="me-2" />
                            <span>{selectedAudioFile[room].name}</span>
                            <audio controls src={URL.createObjectURL(selectedAudioFile[room])} className="flex-grow mx-2" />
                            <button className="btn btn-sm btn-warning ms-auto" onClick={() => handleRetryAudio(room)}>
                                <XCircle size={14} /> Clear
                            </button>
                        </div>
                    )}

                    {/* Recording controls */}
                    {!recordedAudio[room]?.blob && !selectedAudioFile[room] && (
                        <div className="d-flex w-100 justify-content-center mb-2">
                            {recordingRoom === room ? (
                                <button className="btn btn-danger me-2" onClick={() => handleStopRecording(room)}>
                                    <StopCircle size={20} className="me-1" /> Stop Recording
                                </button>
                            ) : (
                                <button className="btn btn-outline-primary me-2" onClick={() => handleStartRecording(room)}>
                                    <Mic size={20} className="me-1" /> Start Recording
                                </button>
                            )}
                            <span className="align-self-center text-muted">OR</span>
                            <label className="btn btn-outline-info ms-2">
                                <Upload size={20} className="me-1" /> Upload MP3
                                <input type="file" accept="audio/mp3" onChange={(e) => handleAudioFileChange(e, room)} style={{ display: 'none' }} />
                            </label>
                        </div>
                    )}

                    {/* Upload button for recorded/selected audio */}
                    {(recordedAudio[room]?.blob || selectedAudioFile[room]) && (
                        <button className="btn btn-success mt-2"
                                onClick={() => handleUploadAudio(room, recordedAudio[room]?.blob || selectedAudioFile[room])}
                                disabled={uploadingAudio[room]}>
                            {uploadingAudio[room] ? <span className="spinner-border spinner-border-sm"></span> : <Upload size={16} className="me-1" />} Upload Audio
                        </button>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );

  if (loadingTourData) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#f0f2f5' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading tour data...</p>
        </div>
=======
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
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="container-fluid py-4" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <div className="row mb-4">
        <div className="col text-center">
          <h1 className="display-4 fw-bold text-primary">Tour Editor</h1>
          <p className="lead text-muted">Manage your rooms, navigation, and interactive elements.</p>
          <Link to={`/tour/${tourId}`} className="btn btn-success btn-lg mt-3">
            <Music size={20} className="me-2" /> View Live Tour
          </Link>
        </div>
      </div>

      <div className="row">
        {/* Left Column: Room Management */}
        <div className="col-lg-6 mb-4">
          <div className="bg-white p-4 rounded shadow-sm h-100">
            <h2 className="mb-4 text-primary">Your Rooms</h2>
            <div className="mb-3">
              <label htmlFor="startRoomSelect" className="form-label fw-semibold">Set Starting Room:</label>
              <select id="startRoomSelect" className="form-select" value={startRoom || ''} onChange={handleStartRoomChange}>
                {rooms.length === 0 ? (
                  <option value="">No rooms available</option>
                ) : (
                  rooms.map((room) => (
                    <option key={room} value={room}>{room}</option>
                  ))
                )}
              </select>
            </div>
            <div className="row row-cols-1 row-cols-md-2 g-4">
              {rooms.length > 0 ? (
                rooms.map((room) => (
                  <div key={room} className="col">
                    <RoomCard room={room} />
                  </div>
                ))
              ) : (
                <div className="col-12">
                  <div className="alert alert-info text-center">
                    No rooms added yet. Please go back to the Virtual Tour Form to add rooms.
                  </div>
                </div>
              )}
=======
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
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893
            </div>
          </div>
        </div>

<<<<<<< HEAD
        {/* Right Column: Markers & Tooltips */}
        <div className="col-lg-6 mb-4">
          <div className="bg-white p-4 rounded shadow-sm h-100">
            <h2 className="mb-4 text-primary">Interactive Elements</h2>

            {/* Navigation Markers Section */}
            <section className="mb-5 p-3 border rounded bg-light">
              <h4 className="mb-3 text-secondary">🔗 Navigation Markers</h4>
              <p className="text-muted small">Connect rooms by adding navigation markers. A marker from "Room A" to "Room B" means you can click in Room A to go to Room B.</p>
              <div className="row g-3 align-items-end mb-3">
                <div className="col-md-5">
                  <label htmlFor="fromRoomSelect" className="form-label">From Room:</label>
                  <select id="fromRoomSelect" className="form-select" value={selectedRoomFrom} onChange={(e) => setSelectedRoomFrom(e.target.value)}>
                    <option value="">Select a room</option>
                    {rooms.map((room) => (
                      <option key={`from-${room}`} value={room}>{room}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-5">
                  <label htmlFor="toRoomSelect" className="form-label">To Room:</label>
                  <select id="toRoomSelect" className="form-select" value={selectedRoomTo} onChange={(e) => setSelectedRoomTo(e.target.value)}>
                    <option value="">Select a room</option>
                    {rooms.filter(r => r !== selectedRoomFrom).map((room) => (
                      <option key={`to-${room}`} value={room}>{room}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 d-flex justify-content-end">
                  <button className="btn btn-success" onClick={handleAddMarker} disabled={!selectedRoomFrom || !selectedRoomTo}>
                    <Plus size={20} /> Add
                  </button>
                </div>
              </div>
              <h5 className="mt-4">Existing Markers:</h5>
              {Object.keys(markers).length > 0 ? (
                <ul className="list-group">
                  {Object.entries(markers).map(([fromRoom, roomMarkers]) => (
                    roomMarkers.map((marker) => (
                      <li key={marker.id} className="list-group-item d-flex justify-content-between align-items-center">
                        From <span className="fw-semibold">{fromRoom}</span> to <span className="fw-semibold">{marker.linkTo}</span>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMarker(fromRoom, marker.linkTo)}>
                          <Trash2 size={14} /> Remove
                        </button>
                      </li>
                    ))
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No navigation markers added yet.</p>
              )}
            </section>

            {/* Tooltips Section */}
            <section className="p-3 border rounded bg-light">
              <h4 className="mb-3 text-secondary">💡 Information Tooltips</h4>
              <p className="text-muted small">Add interactive tooltips to specific rooms. Click on the panorama preview to place them.</p>

              <div className="mb-3">
                <label htmlFor="tooltipRoomSelect" className="form-label">Select Room for Tooltips:</label>
                <select id="tooltipRoomSelect" className="form-select" value={activeTooltipRoom || ''} onChange={(e) => handleSelectRoomForTooltipEdit(e.target.value)}>
                  <option value="">Select a room</option>
                  {rooms.map((room) => (
                    <option key={`tooltip-room-${room}`} value={room}>{room}</option>
=======
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
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893
                  ))}
                </select>
              </div>

<<<<<<< HEAD
              {activeTooltipRoom && (
                <div className="mb-4">
                  <label htmlFor="tooltipContent" className="form-label">Tooltip Content:</label>
                  <textarea id="tooltipContent" className="form-control mb-2" rows="3"
                    value={tooltipContentInput} onChange={(e) => setTooltipContentInput(e.target.value)}
                    placeholder="Enter tooltip information here..."></textarea>

                  <div className="d-flex justify-content-between mb-3">
                    {editingTooltipId ? (
                      <button className="btn btn-primary me-2" onClick={handleSaveEditedTooltipContent} disabled={!tooltipContentInput.trim()}>
                        <Check size={16} className="me-1" /> Save Content
                      </button>
                    ) : (
                      <button className="btn btn-info me-2" onClick={handlePrepareNewTooltipPlacement} disabled={!tooltipContentInput.trim()}>
                        <Plus size={16} className="me-1" /> Place New Tooltip
                      </button>
=======
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
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893
                    )}
                    <button className="btn btn-secondary" onClick={handleCancelTooltipEditMode}>
                      <XCircle size={16} className="me-1" /> Cancel Edit Mode
                    </button>
                  </div>
<<<<<<< HEAD

                  {/* Panorama Preview for Tooltip Placement */}
                  {panoramaUrls[activeTooltipRoom] && (
                    <div className="position-relative border rounded overflow-hidden" style={{ height: '250px', cursor: isPlacingNewTooltip || editingTooltipId ? 'crosshair' : 'default' }}>
                      <img ref={panoramaRef} src={panoramaUrls[activeTooltipRoom]} alt={`Panorama of ${activeTooltipRoom}`}
                        className="img-fluid w-100 h-100" style={{ objectFit: 'cover' }}
                        onClick={handlePanoramaClickForTooltip} />
                      {/* Visual indicator for new tooltip placement */}
                      {isPlacingNewTooltip && newTooltipPosition && (
                        <div style={{
                          position: 'absolute',
                          left: `${newTooltipPosition.x * 100}%`,
                          top: `${newTooltipPosition.y * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'rgba(255, 0, 0, 0.7)',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          border: '2px solid white',
                          zIndex: 10,
                        }} title="New Tooltip Position"></div>
                      )}
                      {/* Existing tooltips on preview */}
                      {(tooltips[activeTooltipRoom] || []).map(tooltip => (
                        <div key={tooltip.id} style={{
                          position: 'absolute',
                          left: `${tooltip.position.x * 100}%`,
                          top: `${tooltip.position.y * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'rgba(0, 123, 255, 0.7)',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          border: `2px solid ${editingTooltipId === tooltip.id ? 'yellow' : 'white'}`,
                          zIndex: 9,
                          cursor: 'pointer',
                        }}
                          title={tooltip.content}
                          onClick={() => handleEditTooltip(tooltip.id)}
                        >
                          <HelpCircle size={16} color="white" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                        </div>
                      ))}
                    </div>
                  )}

                  <h5 className="mt-4">Tooltips for "{activeTooltipRoom}":</h5>
                  {(tooltips[activeTooltipRoom] && tooltips[activeTooltipRoom].length > 0) ? (
                    <ul className="list-group">
                      {tooltips[activeTooltipRoom].map((tooltip) => (
                        <li key={tooltip.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <span className="flex-grow-1 me-2">{tooltip.content}</span>
                          <button className="btn btn-info btn-sm me-2" onClick={() => handleEditTooltip(tooltip.id)}>
                            <Pencil size={14} /> Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveTooltip(tooltip.id)}>
                            <Trash2 size={14} /> Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No tooltips added for this room yet.</p>
                  )}
                </div>
              )}
            </section>
=======
>>>>>>> 9e9e5c5140200ed35544cd8ab21eb24a4327d893

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
