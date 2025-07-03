import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

const BACKEND_URL = "http://127.0.0.1:5000";

const PanoramaViewer = () => {
  const containerRef = useRef(null);
  const { tourId } = useParams();

  const [viewer, setViewer] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [startNodeId, setStartNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const audioRef = useRef(new Audio());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [currentActiveNodeId, setCurrentActiveNodeId] = useState(null);
  const [markersPluginInstance, setMarkersPluginInstance] = useState(null);
  const [navbarConfig, setNavbarConfig] = useState([]);

  useEffect(() => {
    const fetchTourData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${BACKEND_URL}/get-tour-data/${tourId}`);
        const { success, panoramaUrls, markers, tooltips, startRoom, audioUrls, error: backendError } = response.data;

        if (!success) {
          throw new Error(backendError || 'Failed to load tour data from backend.');
        }

        if (!panoramaUrls || Object.keys(panoramaUrls).length === 0) {
          throw new Error('No panoramas found for this tour.');
        }

        const allRoomNodes = Object.keys(panoramaUrls).map(roomName => {
          const roomMarkers = markers[roomName] || [];
          const roomTooltips = tooltips[roomName] || [];
          const roomAudioUrl = audioUrls ? audioUrls[roomName] : null;

          return {
            id: roomName,
            panorama: panoramaUrls[roomName],
            links: roomMarkers.filter(marker => marker.linkTo && panoramaUrls[marker.linkTo]).map(marker => {
              const yaw = (marker.position.x - 0.5) * 2 * Math.PI;
              const pitch = (0.5 - marker.position.y) * Math.PI;
              return {
                nodeId: marker.linkTo,
                position: { yaw, pitch },
                label: `Go to ${marker.linkTo}`
              };
            }),
            markers: roomTooltips.map(tooltip => {
              const yaw = (tooltip.position.x - 0.5) * 2 * Math.PI;
              const pitch = (0.5 - tooltip.position.y) * Math.PI;
              return {
                id: tooltip.id,
                position: { yaw, pitch },
                html: `<div class="tooltip-marker-icon">💡</div>`,
                tooltip: {
                  content: tooltip.content,
                  position: 'top'
                }
              };
            }),
            audioUrl: roomAudioUrl
          };
        });

        setNodes(allRoomNodes);
        setStartNodeId(startRoom || Object.keys(panoramaUrls)[0]);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Unexpected error occurred.');
        setLoading(false);
      }
    };

    fetchTourData();
  }, [tourId]);

  useEffect(() => {
    if (!loading && !error && nodes.length > 0 && startNodeId && containerRef.current) {
      const initialNode = nodes.find(n => n.id === startNodeId);
      if (!initialNode || !initialNode.panorama) {
        setError(`Initial panorama for room '${startNodeId}' not found.`);
        return;
      }

      const initialNavbarButtons = [
        'zoom', 'move', 'caption',
        {
          id: 'audio-toggle',
          title: audioEnabled ? 'Audio: ON' : 'Audio: OFF',
          content: audioEnabled ? '🔊 Audio ON' : '🔈 Audio OFF',
          className: 'custom-audio-toggle',
          onClick: () => setAudioEnabled(prev => !prev),
          visible: initialNode.audioUrl ? true : false
        },
        'fullscreen'
      ].filter(Boolean);

      setNavbarConfig(initialNavbarButtons);

      const instance = new Viewer({
        container: containerRef.current,
        panorama: initialNode.panorama,
        plugins: [
          [VirtualTourPlugin, { nodes, startNodeId }],
          [MarkersPlugin, {}]
        ],
        navbar: initialNavbarButtons,
        defaultYaw: 0,
        defaultPitch: 0,
      });

      setViewer(instance);
      setCurrentActiveNodeId(initialNode.id);
      const markersPlugin = instance.getPlugin(MarkersPlugin);
      setMarkersPluginInstance(markersPlugin);

      const virtualTourPlugin = instance.getPlugin(VirtualTourPlugin);
      virtualTourPlugin.addEventListener('node-changed', (e) => {
        console.log('🔁 Switching to node:', e.node.id);
        setCurrentActiveNodeId(e.node.id);
        audioRef.current.pause();
        audioRef.current.src = "";
      });

      return () => {
        instance.destroy();
        audioRef.current.pause();
        audioRef.current.src = "";
        setViewer(null);
        setMarkersPluginInstance(null);
        setCurrentActiveNodeId(null);
      };
    }
  }, [nodes, startNodeId, loading, error]);

  useEffect(() => {
    if (!viewer || !currentActiveNodeId || nodes.length === 0) return;

    const currentNode = nodes.find(n => n.id === currentActiveNodeId);
    const hasAudio = !!currentNode?.audioUrl;

    audioRef.current.pause();
    audioRef.current.src = "";

    if (hasAudio) {
      audioRef.current.src = currentNode.audioUrl;
      audioRef.current.load();
      if (audioEnabled) {
        audioRef.current.play().catch(err => console.error("Audio play error:", err));
      }
    }

    if (viewer && viewer.navbar) {
      const newNavbar = navbarConfig.map(button => {
        if (typeof button === 'object' && button.id === 'audio-toggle') {
          return {
            ...button,
            visible: hasAudio,
            title: audioEnabled ? 'Audio: ON' : 'Audio: OFF',
            content: audioEnabled ? '🔊 Audio ON' : '🔈 Audio OFF'
          };
        }
        return button;
      });
      viewer.navbar.setButtons(newNavbar);
    }
  }, [audioEnabled, currentActiveNodeId, nodes, viewer]);

  if (loading) return <div className="text-center mt-5"><p>Loading tour...</p></div>;
  if (error) {
    return (
      <div className="text-center mt-5 text-danger">
        <p>Error: {error}</p>
        <p>Please verify the tour ID, ensure panoramas are uploaded, and room names/start room are correct in Supabase.</p>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}></div>;
};

export default PanoramaViewer;
