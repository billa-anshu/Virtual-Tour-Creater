// pages/TourEditorPage.js
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { supabase } from '../Supabase'; // Import supabase client
import { v4 as uuidv4 } from 'uuid'; // For generating new marker/tooltip IDs
import MicRecorder from 'mic-recorder-to-mp3'; // For audio recording
import {
  Pencil,
  Check,
  Upload,
  Repeat,
  Plus,
  Trash2,
  HelpCircle,
  XCircle,
  Mic, // For recording icon
  StopCircle, // For stop recording icon
  Music, // For audio file icon
} from "lucide-react";

const FIXED_MARKER_POSITION = { x: 0.5, y: 0.5 };
// CORRECTED: Define your Render Flask backend URL here
const BACKEND_URL = "https://virtual-tour-creater-backend.onrender.com";
const recorder = new MicRecorder({ bitRate: 128 });

const TourEditorPage = () => {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const panoramaRef = useRef(null);

  // --- Room and Panorama States ---
  const [panoramaUrls, setPanoramaUrls] = useState({}); // Will be populated from Flask backend (just the URL string)
  const [fullPanoramaData, setFullPanoramaData] = useState({}); // Stores full object {url, viewConstraints}
  const [rooms, setRooms] = useState([]); // List of room names
  const [showFileInput, setShowFileInput] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});
  const [editingRoomNames, setEditingRoomNames] = useState({});
  const [editedNames, setEditedNames] = useState({});
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [startRoom, setStartRoom] = useState(null);
  const [loadingTourData, setLoadingTourData] = useState(true);

  // --- Marker States (Navigation Links) ---
  const [markers, setMarkers] = useState({});
  const [selectedRoomFrom, setSelectedRoomFrom] = useState("");
  const [selectedRoomTo, setSelectedRoomTo] = useState("");

  // --- Tooltip States (Information Points) ---
  const [tooltips, setTooltips] = useState({});
  const [activeTooltipRoom, setActiveTooltipRoom] = useState(null);
  const [editingTooltipId, setEditingTooltipId] = useState(null);
  const [tooltipContentInput, setTooltipContentInput] = useState("");
  const [isPlacingNewTooltip, setIsPlacingNewTooltip] = useState(false);
  const [newTooltipPosition, setNewTooltipPosition] = useState(null); // Temporary position for a new tooltip

  // --- Audio States ---
  const [recordingRoom, setRecordingRoom] = useState(null); // Tracks which room is currently recording
  const [recordedAudio, setRecordedAudio] = useState({}); // Stores recorded audio blob and URL per room
  const [selectedAudioFile, setSelectedAudioFile] = useState({}); // Stores File object for direct MP3 upload per room
  const [uploadingAudio, setUploadingAudio] = useState({}); // Tracks upload status for audio per room

  // --- Confirmation Modal State ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmModalAction, setConfirmModalAction] = useState(() => () => {}); // Function to execute on confirm

  const showConfirmation = (message, action) => {
    setConfirmModalMessage(message);
    setConfirmModalAction(() => action); // Use a function to store the action
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    confirmModalAction();
    setShowConfirmModal(false);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
  };

  // --- Initial Data Loading Effect from Flask Backend ---
  useEffect(() => {
    const fetchTourData = async () => {
      setLoadingTourData(true);
      try {
        console.log(`[TourEditorPage] Attempting to fetch tour data for ${tourId} from Flask backend: ${BACKEND_URL}/get-tour-data/${tourId}`);
        const response = await fetch(`${BACKEND_URL}/get-tour-data/${tourId}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[TourEditorPage] HTTP error! Status: ${response.status}, message: ${errorText}`);
          alert(`Failed to load tour data: Server responded with ${response.status}. Please ensure your Flask backend is running and the tour ID is valid.`);
          navigate("/"); // Redirect on backend error
          return;
        }

        const data = await response.json();
        console.log("[TourEditorPage] Raw data from backend:", data); // NEW LOG: Raw data received

        if (data.success && data.panoramaUrls && Object.keys(data.panoramaUrls).length > 0) {
          console.log("[TourEditorPage] Successfully loaded tour data from backend:", data);
          setFullPanoramaData(data.panoramaUrls); // Store the full object

          const extractedUrls = Object.fromEntries(
            Object.entries(data.panoramaUrls).map(([roomName, panoData]) => {
              console.log(`[TourEditorPage] Processing room: ${roomName}, panoData:`, panoData); // NEW LOG: Individual pano data
              // Check if panoData is a string (direct URL) or an object with a 'url' property
              if (typeof panoData === 'string') {
                return [roomName, panoData]; // panoData is already the URL
              } else if (panoData && panoData.url) {
                return [roomName, panoData.url]; // panoData is an object with a url property
              } else {
                console.warn(`[TourEditorPage] Room ${roomName} has missing or invalid panorama URL data:`, panoData); // NEW LOG: Warning for invalid URL
                return [roomName, null]; // Ensure it's null if URL is missing
              }
            })
          );
          console.log("[TourEditorPage] Extracted panorama URLs for state:", extractedUrls); // NEW LOG: Final extracted URLs
          setPanoramaUrls(extractedUrls);

          const roomList = Object.keys(data.panoramaUrls || {});
          setRooms(roomList);
          setEditedNames(Object.fromEntries(roomList.map((r) => [r, r])));
          setStartRoom(data.startRoom || roomList[0]);
          setMarkers(data.markers || {});
          setTooltips(data.tooltips || {});
          // Initialize recordedAudio with URLs fetched from backend
          setRecordedAudio(data.audioUrls ? Object.fromEntries(
            Object.entries(data.audioUrls).map(([roomName, url]) => [roomName, { url, blob: null }])
          ) : {});
        } else {
          console.error("[TourEditorPage] Backend reported error or no panorama data:", data.error || "No panorama URLs found.");
          alert(`Failed to load tour data: ${data.error || "No panorama data found for this tour. Please ensure it was created correctly."}`);
          navigate("/");
        }

      } catch (err) {
        console.error("[TourEditorPage] Error loading tour data (network/parse error):", err);
        alert(`Failed to load tour data due to network or server issue: ${err.message}. Please check your backend server.`);
        navigate("/");
      } finally {
        setLoadingTourData(false);
      }
    };

    fetchTourData();
  }, [tourId, navigate]);

  // --- Supabase Utility for Updating `tour` table (start_room) ---
  const updateTourInSupabase = async (updatedFields) => {
    const { error } = await supabase
      .from('tour')
      .update(updatedFields)
      .eq('tour_id', tourId);
    if (error) throw error;
  };

  // --- Re-upload Handlers ---
  const handleReuploadClick = (room) => setShowFileInput((prev) => ({ ...prev, [room]: true }));
  const handleFileChange = (e, room) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve({ file, preview: event.target.result });
      reader.readAsDataURL(file);
    }))).then((previews) => setSelectedFiles((prev) => ({ ...prev, [room]: previews })));
  };
  const handleRemoveSelectedFile = (room, index) => {
    setSelectedFiles((prev) => ({ ...prev, [room]: prev[room]?.filter((_, i) => i !== index) }));
  };

  const handleActualReupload = async (room) => {
    if (!selectedFiles[room]?.length) return alert("⚠️ Please select files to reupload.");

    setUploading(true);
    const formData = new FormData();
    formData.append("roomName", room);
    selectedFiles[room].forEach((item) => formData.append("files", item.file));
    formData.append("tourId", tourId);

    try {
      const res = await axios.post(`${BACKEND_URL}/restitch-room`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success && res.data.panoramaUrl) {
        const newSupabasePanoramaUrl = res.data.panoramaUrl;
        const updatedFullPanoramaData = {
          ...fullPanoramaData,
          [room]: { url: newSupabasePanoramaUrl + `?t=${Date.now()}`, viewConstraints: res.data.viewConstraints || {} }
        };
        setFullPanoramaData(updatedFullPanoramaData);
        setPanoramaUrls((prev) => ({ ...prev, [room]: newSupabasePanoramaUrl + `?t=${Date.now()}` }));

        // Refetch tour data to get updated markers and tooltips
        const tourDataRes = await fetch(`${BACKEND_URL}/get-tour-data/${tourId}`);
        const tourData = await tourDataRes.json();
        if (tourData.success) {
            setMarkers(tourData.markers || {});
            setTooltips(tourData.tooltips || {});
            setRecordedAudio(tourData.audioUrls ? Object.fromEntries(
                Object.entries(tourData.audioUrls).map(([roomName, url]) => [roomName, { url, blob: null }])
            ) : {});
        }


        alert("✅ Room updated successfully! Panoramas, markers, and tooltips for this room have been reset.");
        setShowFileInput((prev) => ({ ...prev, [room]: false }));
        setSelectedFiles((prev) => ({ ...prev, [room]: [] }));
      } else {
        alert("❌ Failed to update panorama. Backend did not return a valid URL.");
      }
    } catch (err) {
      console.error("[handleActualReupload] Server or network error during reupload:", err);
      alert(`❌ Server or network error during reupload: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // --- Audio Handlers ---
  const handleStartRecording = async (roomName) => {
    try {
      await recorder.start();
      setRecordingRoom(roomName);
    } catch (e) {
      alert("🎤 Mic access denied or error.");
    }
  };

  const handleStopRecording = async (roomName) => {
    const [buffer, blob] = await recorder.stop().getMp3();
    const audioUrl = URL.createObjectURL(blob);
    setRecordedAudio((prev) => ({
      ...prev,
      [roomName]: { blob, url: audioUrl },
    }));
    setRecordingRoom(null);
  };

  const handleAudioFileChange = (e, roomName) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedAudioFile(prev => ({ ...prev, [roomName]: file }));
      // Clear any existing recorded audio for this room when a file is selected
      setRecordedAudio(prev => {
        const newState = { ...prev };
        delete newState[roomName];
        return newState;
      });
    } else {
      setSelectedAudioFile(prev => {
        const newState = { ...prev };
        delete newState[roomName];
        return newState;
      });
    }
  };

  const handleUploadAudio = async (roomName, fileToUpload) => {
    if (!fileToUpload) return alert("No audio file selected or recorded to upload.");

    setUploadingAudio(prev => ({ ...prev, [roomName]: true }));
    const formData = new FormData();
    formData.append("tourId", tourId);
    formData.append("roomName", roomName);
    formData.append("audio", fileToUpload, `${roomName}_audio.mp3`);

    try {
      const res = await axios.post(`${BACKEND_URL}/upload-audio`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        alert("✅ Audio uploaded successfully!");
        setRecordedAudio((prev) => ({
            ...prev,
            [roomName]: { url: res.data.audioUrl, blob: null }, // Store URL, clear blob
        }));
        setSelectedAudioFile(prev => { // Clear selected file after successful upload
            const newState = { ...prev };
            delete newState[roomName];
            return newState;
        });
      } else {
        alert(`❌ Failed to upload audio: ${res.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error uploading audio:", err);
      alert(`❌ Server error uploading audio: ${err.message}`);
    } finally {
      setUploadingAudio(prev => ({ ...prev, [roomName]: false }));
    }
  };

  const handleRemoveAudio = async (roomName) => {
    showConfirmation(`Are you sure you want to remove the audio for "${roomName}"? This action cannot be undone.`, async () => {
        try {
            const res = await axios.post(`${BACKEND_URL}/delete-audio`, {
                tourId,
                roomName
            });

            if (res.data.success) {
                setRecordedAudio(prev => {
                    const newState = { ...prev };
                    delete newState[roomName];
                    return newState;
                });
                setSelectedAudioFile(prev => { // Also clear any selected file
                    const newState = { ...prev };
                    delete newState[roomName];
                    return newState;
                });
                alert("✅ Audio removed successfully!");
            } else {
                alert(`❌ Failed to remove audio: ${res.data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("Error removing audio:", err);
            alert(`❌ Server error removing audio: ${err.message}`);
        }
    });
  };

  const handleRetryAudio = (roomName) => {
    setRecordedAudio(prev => {
      const copy = { ...prev };
      delete copy[roomName];
      return copy;
    });
    setSelectedAudioFile(prev => {
      const copy = { ...prev };
      delete copy[roomName];
      return copy;
    });
  };


  // --- Room Name Edit Handlers ---
  const handleNameEdit = (room) => setEditingRoomNames((prev) => ({ ...prev, [room]: true }));
  const handleNameInputChange = (room, value) => setEditedNames((prev) => ({ ...prev, [room]: value }));

  const handleNameSave = async (oldRoomName) => {
    const newRoomName = editedNames[oldRoomName].trim();
    if (!newRoomName || newRoomName === oldRoomName) {
      setEditingRoomNames((prev) => ({ ...prev, [oldRoomName]: false }));
      return;
    }

    setRenaming(true);
    try {
      const renameRes = await axios.post(`${BACKEND_URL}/rename-room`, {
        tourId,
        oldRoomName,
        newRoomName
      });

      if (renameRes.data.success) {
        // Refetch tour data to get all updated information (panoramas, markers, tooltips, audio)
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
        }

        alert("✅ Room name, panorama reference, markers, and tooltips updated successfully!");

      } else {
        alert(`❌ Failed to rename room: ${renameRes.data.error || 'Unknown error'}`);
      }

    } catch (err) {
      console.error("Error renaming room:", err);
      alert(`❌ Server or Supabase error during room renaming: ${err.message}`);
    } finally {
      setRenaming(false);
      setEditingRoomNames((prev) => ({ ...prev, [oldRoomName]: false }));
    }
  };

  // --- Room Removal Handler ---
  const handleRemoveRoom = async (roomToDelete) => {
    showConfirmation(`Are you sure you want to remove the room "${roomToDelete}" and all its associated data? This action cannot be undone.`, async () => {
      setDeletingRoom(true);
      try {
        const res = await axios.post(`${BACKEND_URL}/delete-room`, {
          tourId,
          roomName: roomToDelete
        });

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
          });
          return updated;
        });
        setIsPlacingNewTooltip(false);
        setTooltipContentInput("");
        setNewTooltipPosition(null);
        alert("Tooltip placed successfully!");
      } catch (err) {
        console.error("Error placing new tooltip:", err);
        alert(`Failed to place tooltip: ${err.message}`);
      }
    } else if (editingTooltipId) {
      try {
        const { error } = await supabase.from('tooltips')
          .update({ position_x: x, position_y: y })
          .eq('tooltip_id', editingTooltipId);
        if (error) throw error;

        setTooltips((prev) => {
          const updated = { ...prev };
          updated[activeTooltipRoom] = (updated[activeTooltipRoom] || []).map((tooltip) =>
            tooltip.id === editingTooltipId ? { ...tooltip, position: { x, y } } : tooltip
          );
          return updated;
        });
        alert("Tooltip repositioned!");
      } catch (err) {
        console.error("Error repositioning tooltip:", err);
        alert(`Failed to reposition tooltip: ${err.message}`);
      }
    }
    if (isPlacingNewTooltip) {
      setNewTooltipPosition({ x, y });
    }
  };

  const handleEditTooltip = (tooltipId) => {
    const tooltipToEdit = (tooltips[activeTooltipRoom] || []).find(t => t.id === tooltipId);
    if (tooltipToEdit) {
      setEditingTooltipId(tooltipId);
      setTooltipContentInput(tooltipToEdit.content);
      setIsPlacingNewTooltip(false);
      setNewTooltipPosition(null);
      alert("You can now edit the content above, or click on the panorama to reposition this tooltip.");
    }
  };

  const handleSaveEditedTooltipContent = async () => {
    if (!tooltipContentInput.trim()) return alert("Tooltip content cannot be empty.");
    if (!editingTooltipId) return;

    try {
      const { error } = await supabase.from('tooltips')
        .update({ content: tooltipContentInput.trim() })
        .eq('tooltip_id', editingTooltipId);
      if (error) throw error;

      setTooltips((prev) => {
        const updated = { ...prev };
        updated[activeTooltipRoom] = (updated[activeTooltipRoom] || []).map((tooltip) =>
          tooltip.id === editingTooltipId ? { ...tooltip, content: tooltipContentInput.trim() } : tooltip
        );
        return updated;
      });
      setEditingTooltipId(null);
      setTooltipContentInput("");
      alert("Tooltip content updated!");
    } catch (err) {
      console.error("Error saving edited tooltip content:", err);
      alert(`Failed to save tooltip content: ${err.message}`);
    }
  };

  const handleRemoveTooltip = async (tooltipId) => {
    showConfirmation("Are you sure you want to remove this tooltip?", async () => {
      try {
        const { error } = await supabase.from('tooltips')
          .delete()
          .eq('tooltip_id', tooltipId);
        if (error) throw error;

        setTooltips((prev) => {
          const updated = { ...prev };
          updated[activeTooltipRoom] = (updated[activeTooltipRoom] || []).filter((tooltip) => tooltip.id !== tooltipId);
          return updated;
        });
        if (editingTooltipId === tooltipId) handleCancelTooltipEditMode();
        alert("Tooltip removed successfully!");
      } catch (err) {
        console.error("Error removing tooltip:", err);
        alert(`Failed to remove tooltip: ${err.message}`);
      }
    });
  };

  const handleCancelTooltipEditMode = () => {
    setActiveTooltipRoom(null);
    setEditingTooltipId(null);
    setTooltipContentInput("");
    setIsPlacingNewTooltip(false);
    setNewTooltipPosition(null);
  };

  // --- Tour Generation Pre-check ---
  const handleGenerateTour = (e) => {
    e.preventDefault();
    const roomsWithMissingLinks = rooms.filter(room => !markers[room] || markers[room].length === 0);
    if (rooms.length > 0 && roomsWithMissingLinks.length > 1) { // Check only if there are rooms
      alert(`⚠️ The following rooms have no navigation markers: ${roomsWithMissingLinks.join(", ")}. \n\nPlease add at least one marker to each room for a complete tour.`);
      return;
    }
    // Navigate to the tour viewer page. The viewer page will fetch its own data.
    navigate(`/tour/${tourId}`);
  };

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
      </div>
    );
  }

  return (
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
            </div>
          </div>
        </div>

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
                  ))}
                </select>
              </div>

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
                    )}
                    <button className="btn btn-secondary" onClick={handleCancelTooltipEditMode}>
                      <XCircle size={16} className="me-1" /> Cancel Edit Mode
                    </button>
                  </div>

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

            <div className="text-center mt-5">
              <button className="btn btn-success btn-lg" onClick={handleGenerateTour} disabled={rooms.length === 0}>
                🚀 Generate Tour
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Action</h5>
                <button type="button" className="btn-close" onClick={handleCancelConfirm}></button>
              </div>
              <div className="modal-body">
                <p>{confirmModalMessage}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCancelConfirm}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleConfirm}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TourEditorPage;
