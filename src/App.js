import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Download, Map, ArrowLeft, Trash2, Navigation, X, Users, Copy, Check } from 'lucide-react';
import './App.css';

export default function LocationTracker() {
  const [showMap, setShowMap] = useState(false);
  const [position, setPosition] = useState(null);
  const [recording, setRecording] = useState(false);
  const [pathData, setPathData] = useState([]);
  const [trackingData, setTrackingData] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [optimizeMode, setOptimizeMode] = useState(false);
  const [destination, setDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [myTrackId, setMyTrackId] = useState('');
  const [sharingLocation, setSharingLocation] = useState(false);
  const [trackingMode, setTrackingMode] = useState(false);
  const [friendTrackId, setFriendTrackId] = useState('');
  const [friendPosition, setFriendPosition] = useState(null);
  const [showEnterIdModal, setShowEnterIdModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);
  const watchIdRef = useRef(null);
  const recordingRef = useRef(false);
  const destinationMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const friendMarkerRef = useRef(null);
  const friendPolylineRef = useRef(null);
  const locationUpdateIntervalRef = useRef(null);
  const friendTrackIntervalRef = useRef(null);

  // Generate Track ID on mount
  useEffect(() => {
    const generateTrackId = () => {
      return 'TRK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    };

    const trackId = generateTrackId();
    setMyTrackId(trackId);

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.body.appendChild(script);

    // Load XLSX library
    const xlsxScript = document.createElement('script');
    xlsxScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    document.body.appendChild(xlsxScript);

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current);
      }
      if (friendTrackIntervalRef.current) {
        clearInterval(friendTrackIntervalRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Initialize map when shown
  useEffect(() => {
    if (showMap && mapLoaded && !mapInstanceRef.current) {
      setTimeout(() => {
        initMap();
      }, 100);
    }
  }, [showMap, mapLoaded]);

  // Sync recording state
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  // Handle location sharing
  useEffect(() => {
    if (sharingLocation && position) {
      updateMyLocation();
      locationUpdateIntervalRef.current = setInterval(updateMyLocation, 5000);
    } else {
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current);
        locationUpdateIntervalRef.current = null;
      }
    }
    return () => {
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current);
      }
    };
  }, [sharingLocation, position]);

  // Handle friend tracking
  useEffect(() => {
    if (trackingMode && friendTrackId) {
      fetchFriendLocation();
      friendTrackIntervalRef.current = setInterval(fetchFriendLocation, 5000);
    } else {
      if (friendTrackIntervalRef.current) {
        clearInterval(friendTrackIntervalRef.current);
        friendTrackIntervalRef.current = null;
      }
    }
    return () => {
      if (friendTrackIntervalRef.current) {
        clearInterval(friendTrackIntervalRef.current);
      }
    };
  }, [trackingMode, friendTrackId]);

  const updateMyLocation = async () => {
    if (!position || !myTrackId) return;
    
    try {
      // Get existing path data
      let pathHistory = [];
      try {
        const pathResult = await window.storage.get(`path:${myTrackId}`, true);
        if (pathResult && pathResult.value) {
          pathHistory = JSON.parse(pathResult.value);
        }
      } catch (e) {
        // Path doesn't exist yet, start fresh
      }
      
      // Add current position to path history
      pathHistory.push({
        lat: position.lat,
        lng: position.lng,
        timestamp: Date.now()
      });
      
      // Keep only last 1000 points to avoid storage limits
      if (pathHistory.length > 1000) {
        pathHistory = pathHistory.slice(-1000);
      }
      
      // Update current location
      await window.storage.set(
        `location:${myTrackId}`,
        JSON.stringify({
          lat: position.lat,
          lng: position.lng,
          speed: speed,
          accuracy: accuracy,
          timestamp: Date.now()
        }),
        true
      );
      
      // Update path history
      await window.storage.set(
        `path:${myTrackId}`,
        JSON.stringify(pathHistory),
        true
      );
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const fetchFriendLocation = async () => {
    if (!friendTrackId) return;
    
    try {
      // Fetch current location
      const locationResult = await window.storage.get(`location:${friendTrackId}`, true);
      
      if (!locationResult || !locationResult.value) {
        console.log('Friend location not found');
        return;
      }
      
      const data = JSON.parse(locationResult.value);
      
      // Check if location is recent (within last 30 seconds)
      if (Date.now() - data.timestamp > 30000) {
        console.log('Friend location is outdated');
        return;
      }
      
      setFriendPosition(data);
      
      if (mapInstanceRef.current && window.L) {
        // Update or create friend marker
        if (!friendMarkerRef.current) {
          const friendIcon = window.L.divIcon({
            html: '<div style="background: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.8);"></div>',
            iconSize: [20, 20],
            className: ''
          });
          friendMarkerRef.current = window.L.marker([data.lat, data.lng], { icon: friendIcon }).addTo(mapInstanceRef.current);
          
          friendMarkerRef.current.bindPopup(`
            <div style="text-align: center;">
              <strong>Friend's Location</strong><br>
              Speed: ${data.speed} km/h<br>
              Accuracy: ${data.accuracy.toFixed(0)} m
            </div>
          `);
        } else {
          friendMarkerRef.current.setLatLng([data.lat, data.lng]);
          friendMarkerRef.current.getPopup().setContent(`
            <div style="text-align: center;">
              <strong>Friend's Location</strong><br>
              Speed: ${data.speed} km/h<br>
              Accuracy: ${data.accuracy.toFixed(0)} m
            </div>
          `);
        }
        
        // Fetch and display friend's path history
        try {
          const pathResult = await window.storage.get(`path:${friendTrackId}`, true);
          
          if (pathResult && pathResult.value) {
            const pathHistory = JSON.parse(pathResult.value);
            
            // Filter recent points (last 2 hours)
            const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
            const recentPath = pathHistory
              .filter(point => point.timestamp > twoHoursAgo)
              .map(point => [point.lat, point.lng]);
            
            if (recentPath.length > 0) {
              if (friendPolylineRef.current) {
                friendPolylineRef.current.setLatLngs(recentPath);
              } else {
                friendPolylineRef.current = window.L.polyline(recentPath, {
                  color: '#22c55e',
                  weight: 5,
                  opacity: 0.9,
                  smoothFactor: 1
                }).addTo(mapInstanceRef.current);
              }
              
              // Fit map to show both users if this is the first load
              if (position && !friendPolylineRef.current._wasInitialized) {
                const bounds = window.L.latLngBounds([
                  [position.lat, position.lng],
                  [data.lat, data.lng]
                ]);
                mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80] });
                friendPolylineRef.current._wasInitialized = true;
              }
            }
          }
        } catch (pathError) {
          console.log('No path history found for friend');
        }
      }
    } catch (error) {
      console.error('Error fetching friend location:', error);
    }
  };

  const initMap = () => {
    if (mapInstanceRef.current || !window.L) return;

    try {
      const map = window.L.map('map').setView([20.5937, 78.9629], 5);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      const icon = window.L.divIcon({
        html: '<div style="background: #ff8c00; width: 20px; height: 20px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(255, 140, 0, 0.8);"></div>',
        iconSize: [20, 20],
        className: ''
      });

      markerRef.current = window.L.marker([20.5937, 78.9629], { icon }).addTo(map);
      
      map.on('click', (e) => {
        if (optimizeMode) {
          handleMapClick(e.latlng);
        }
      });
      
      requestLocationPermission();
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const currentSpeed = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(2) : 0;
        const acc = pos.coords.accuracy;

        setPosition({ lat, lng });
        setSpeed(currentSpeed);
        setAccuracy(acc);
        setShowInfo(true);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }

        startContinuousTracking();
      },
      (error) => {
        alert('Location permission denied or error occurred: ' + error.message);
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const startContinuousTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    let lastUpdateTime = 0;
    let lastPosition = null;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const newSpeed = position.coords.speed ? (position.coords.speed * 3.6).toFixed(2) : 0;
        const acc = position.coords.accuracy;
        const currentTime = Date.now();

        const hasMovedEnough = !lastPosition || 
          calculateDistance(lastPosition.lat, lastPosition.lng, newLat, newLng) > 3;

        const isAccuracyGood = acc < 50;
        const isAccuracyAcceptable = acc < 150;

        if (!isAccuracyAcceptable) {
          return;
        }

        setPosition({ lat: newLat, lng: newLng });
        setSpeed(newSpeed);
        setAccuracy(acc);

        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
          if (!optimizeMode && !trackingMode) {
            mapInstanceRef.current.panTo([newLat, newLng]);
          }
        }

        if (recordingRef.current) {
          const shouldRecord = isAccuracyGood || 
                              (isAccuracyAcceptable && hasMovedEnough) ||
                              (currentTime - lastUpdateTime > 5000);

          if (shouldRecord) {
            lastUpdateTime = currentTime;
            lastPosition = { lat: newLat, lng: newLng };
            
            setPathData(prev => {
              const updated = [...prev, [newLat, newLng]];

              if (polylineRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(polylineRef.current);
              }

              if (window.L && mapInstanceRef.current) {
                polylineRef.current = window.L.polyline(updated, {
                  color: '#ff8c00',
                  weight: 5,
                  opacity: 0.9,
                  smoothFactor: 1
                }).addTo(mapInstanceRef.current);
              }

              return updated;
            });

            const timestamp = new Date().toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'medium'
            });
            
            getAddress(newLat, newLng).then(address => {
              setTrackingData(prev => [...prev, {
                timestamp,
                latitude: newLat.toFixed(6),
                longitude: newLng.toFixed(6),
                address,
                speed: newSpeed + ' km/h',
                accuracy: acc.toFixed(0) + ' m'
              }]);
            });
          }
        }
      },
      (error) => {
        console.error('Error tracking location:', error);
      },
      { 
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const getAddress = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'User-Agent': 'LocationTrackerApp/1.0'
          }
        }
      );
      const data = await response.json();
      return data.display_name || 'Address not available';
    } catch (err) {
      console.error('Address fetch error:', err);
      return 'Unable to fetch address';
    }
  };

  const handleLiveLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        alert(`📍 Your Current Location:\n\nLatitude: ${lat.toFixed(6)}\nLongitude: ${lng.toFixed(6)}\nAccuracy: ${acc.toFixed(0)} meters`);
      },
      (error) => {
        alert('Unable to retrieve your location. Please allow location permission.\n\nError: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleTrackInMap = () => {
    if (!mapLoaded) {
      alert('Map is still loading. Please wait a moment and try again.');
      return;
    }
    setOptimizeMode(false);
    setTrackingMode(false);
    setDestination(null);
    setRouteInfo(null);
    setShowMap(true);
  };

  const handleOptimizePath = () => {
    if (!mapLoaded) {
      alert('Map is still loading. Please wait a moment and try again.');
      return;
    }
    setOptimizeMode(true);
    setTrackingMode(false);
    setDestination(null);
    setRouteInfo(null);
    setShowMap(true);
  };

  const handleTrackFriend = () => {
    if (!mapLoaded) {
      alert('Map is still loading. Please wait a moment and try again.');
      return;
    }
    setShowEnterIdModal(true);
  };

  const startTrackingFriend = () => {
    if (!friendTrackId.trim()) {
      alert('Please enter a valid Track ID');
      return;
    }
    
    // Reset friend tracking state
    if (friendMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(friendMarkerRef.current);
      friendMarkerRef.current = null;
    }
    if (friendPolylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(friendPolylineRef.current);
      friendPolylineRef.current = null;
    }
    
    setFriendPosition(null);
    setTrackingMode(true);
    setOptimizeMode(false);
    setDestination(null);
    setRouteInfo(null);
    setShowEnterIdModal(false);
    setShowMap(true);
    
    // Enable location sharing if not already enabled
    if (!sharingLocation) {
      setSharingLocation(true);
    }
  };

  const copyTrackId = () => {
    navigator.clipboard.writeText(myTrackId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLocationSharing = () => {
    setSharingLocation(!sharingLocation);
  };

  const handleMapClick = async (latlng) => {
    if (!position) {
      alert('⏳ Waiting for your location...\n\nPlease allow location access and wait a moment.');
      return;
    }

    if (destinationMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
    }
    if (routeLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
    }

    setDestination({ lat: latlng.lat, lng: latlng.lng });

    const destIcon = window.L.divIcon({
      html: '<div class="destination-marker"></div>',
      iconSize: [30, 30],
      className: ''
    });

    destinationMarkerRef.current = window.L.marker([latlng.lat, latlng.lng], { 
      icon: destIcon 
    }).addTo(mapInstanceRef.current);

    setRouteInfo({ loading: true });

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${position.lng},${position.lat};${latlng.lng},${latlng.lat}?overview=full&geometries=geojson&steps=true`
      );
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        routeLineRef.current = window.L.polyline(coordinates, {
          color: '#22c55e',
          weight: 6,
          opacity: 0.9,
          smoothFactor: 1,
          className: 'route-line'
        }).addTo(mapInstanceRef.current);

        const bounds = window.L.latLngBounds([
          [position.lat, position.lng],
          [latlng.lat, latlng.lng]
        ]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80] });

        const distance = (route.distance / 1000).toFixed(2);
        const duration = Math.round(route.duration / 60);
        
        const destAddress = await getAddress(latlng.lat, latlng.lng);
        
        setRouteInfo({
          distance,
          duration,
          address: destAddress,
          loading: false
        });
      } else {
        setRouteInfo({ 
          error: 'Could not find a route. Try placing the marker on or near a road.',
          loading: false 
        });
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteInfo({ 
        error: 'Error calculating route. Please check your internet connection and try again.',
        loading: false 
      });
    }
  };

  const clearRoute = () => {
    if (destinationMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }
    if (routeLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    setDestination(null);
    setRouteInfo(null);
  };

  const handleBackToMenu = () => {
    setShowMap(false);
    setRecording(false);
    recordingRef.current = false;
    setShowInfo(false);
    setOptimizeMode(false);
    setTrackingMode(false);
    setDestination(null);
    setRouteInfo(null);
    setFriendPosition(null);
    
    if (destinationMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }
    if (routeLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    
    if (friendMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(friendMarkerRef.current);
      friendMarkerRef.current = null;
    }
    if (friendPolylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(friendPolylineRef.current);
      friendPolylineRef.current = null;
    }
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (polylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (!recording) {
      setRecording(true);
      recordingRef.current = true;
      setPathData([]);
      setTrackingData([]);
      
      if (position) {
        const initialPath = [[position.lat, position.lng]];
        setPathData(initialPath);
        
        const timestamp = new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'medium'
        });
        
        getAddress(position.lat, position.lng).then(address => {
          setTrackingData([{
            timestamp,
            latitude: position.lat.toFixed(6),
            longitude: position.lng.toFixed(6),
            address,
            speed: speed + ' km/h',
            accuracy: accuracy.toFixed(0) + ' m'
          }]);
        });
        
        if (window.L && mapInstanceRef.current) {
          if (polylineRef.current) {
            mapInstanceRef.current.removeLayer(polylineRef.current);
          }
          polylineRef.current = window.L.polyline(initialPath, {
            color: '#ff8c00',
            weight: 5,
            opacity: 0.9
          }).addTo(mapInstanceRef.current);
        }
      }
      
      alert('🔴 Recording started!\n\nYour path will be tracked in orange.\nMove around to see your path being recorded.');
    } else {
      setRecording(false);
      recordingRef.current = false;
      alert(`⏹ Recording stopped!\n\nTotal points recorded: ${pathData.length}\n\nGo back to menu and click "Export to Excel" to download your data.`);
    }
  };

  const exportToExcel = () => {
    if (trackingData.length === 0) {
      alert('❌ No tracking data available!\n\nPlease:\n1. Click "Track in Map"\n2. Click "Record Path"\n3. Move around to record your location\n4. Stop recording and come back to export');
      return;
    }

    if (!window.XLSX) {
      alert('Excel library is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      const ws = window.XLSX.utils.json_to_sheet(trackingData);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Location Data');
      
      const fileName = `location_tracking_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
      window.XLSX.writeFile(wb, fileName);
      
      alert(`✅ Excel file downloaded successfully!\n\nFile: ${fileName}\nTotal records: ${trackingData.length}\n\nData has been saved. You can now clear the data or record a new path.`);
    } catch (error) {
      alert('Error creating Excel file: ' + error.message);
    }
  };

  const clearAllData = () => {
    if (trackingData.length === 0) {
      alert('No data to clear!');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to clear all recorded data?\n\nThis will delete ${trackingData.length} tracked points permanently.`
    );

    if (confirmed) {
      setPathData([]);
      setTrackingData([]);
      alert('✅ All tracking data has been cleared!');
    }
  };

  if (!showMap) {
    return (
      <div className="tracker-container">
        <div className="menu-container">
          <h1 className="menu-title">📍 Location Tracker</h1>
          
          <div className="track-id-section">
            <div className="track-id-header">
              <span className="track-id-label">Your Track ID:</span>
              <button 
                className={`share-toggle ${sharingLocation ? 'active' : ''}`}
                onClick={toggleLocationSharing}
              >
                {sharingLocation ? '🟢 Sharing' : '⚫ Share Location'}
              </button>
            </div>
            <div className="track-id-display">
              <span className="track-id-value">{myTrackId}</span>
              <button className="copy-btn" onClick={copyTrackId}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            {sharingLocation && (
              <p className="share-note">✅ Your location is being shared. Friends can track you using this ID.</p>
            )}
          </div>
          
          <div className="option-card" onClick={handleLiveLocation}>
            <MapPin size={48} />
            <h2>Live Location</h2>
            <p>Get your current location coordinates instantly</p>
          </div>

          <div className="option-card" onClick={handleTrackInMap}>
            <Map size={48} />
            <h2>Track in Map</h2>
            <p>View and record your location path on an interactive map</p>
          </div>

          <div className="option-card track-friend-card" onClick={handleTrackFriend}>
            <Users size={48} />
            <h2>Track Friend</h2>
            <p>Enter a friend's Track ID to see their live location on the map</p>
          </div>

          <div className="option-card optimize-card" onClick={handleOptimizePath}>
            <Navigation size={48} />
            <h2>Optimize Path</h2>
            <p>Find the shortest route from your location to any destination</p>
          </div>

          <div className="option-card" onClick={exportToExcel}>
            <Download size={48} />
            <h2>Export to Excel</h2>
            <p>Download all recorded location data with speed and timestamps</p>
            {trackingData.length > 0 && (
              <div className="data-badge">
                {trackingData.length} points ready to export
              </div>
            )}
          </div>

          {trackingData.length > 0 && (
            <div className="option-card clear-data-card" onClick={clearAllData}>
              <Trash2 size={48} />
              <h2>Clear Data</h2>
              <p>Delete all recorded tracking data ({trackingData.length} points)</p>
            </div>
          )}
        </div>

        {showEnterIdModal && (
          <div className="modal-overlay" onClick={() => setShowEnterIdModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowEnterIdModal(false)}>
                <X size={24} />
              </button>
              <h2>Track Friend's Location</h2>
              <p>Enter your friend's Track ID to see their live location</p>
              <input
                type="text"
                className="track-id-input"
                placeholder="Enter Track ID (e.g., TRK-XXXXXXX)"
                value={friendTrackId}
                onChange={(e) => setFriendTrackId(e.target.value.toUpperCase())}
              />
              <button className="modal-btn" onClick={startTrackingFriend}>
                Start Tracking
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="map-view">
      <button className="back-btn" onClick={handleBackToMenu}>
        <ArrowLeft size={20} />
        <span>Back to Menu</span>
      </button>
      
      {trackingMode ? (
        <div className="tracking-friend-banner">
          <Users size={18} />
          <span>Tracking: {friendTrackId}</span>
          {friendPosition ? (
            <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: '600' }}>● Online</span>
          ) : (
            <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600' }}>● Searching...</span>
          )}
          <div className="tracking-legend">
            <span className="legend-item">
              <span className="legend-dot orange"></span> You
            </span>
            <span className="legend-item">
              <span className="legend-dot green"></span> Friend
            </span>
          </div>
        </div>
      ) : !optimizeMode ? (
        <button 
          className={`record-btn ${recording ? 'recording' : ''}`}
          onClick={toggleRecording}
        >
          {recording ? '⏹ Stop Recording' : '🔴 Record Path'}
        </button>
      ) : (
        <>
          <div className="optimize-instructions">
            <Navigation size={18} />
            <span>Click anywhere on the map to find the shortest route</span>
          </div>
          {destination && (
            <button className="clear-route-btn" onClick={clearRoute}>
              <X size={18} />
              <span>Clear Route</span>
            </button>
          )}
        </>
      )}
      
      <div id="map"></div>
      
      {!mapInstanceRef.current && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading map... Please wait</p>
        </div>
      )}
      
      {showInfo && position && (
        <div className="info-box">
          <div><span className="label">Latitude:</span> {position.lat.toFixed(6)}</div>
          <div><span className="label">Longitude:</span> {position.lng.toFixed(6)}</div>
          <div><span className="label">Speed:</span> {speed} km/h</div>
          <div>
            <span className="label">Accuracy:</span> 
            <span className={`accuracy-indicator ${
              accuracy < 20 ? 'excellent' : 
              accuracy < 50 ? 'good' : 
              accuracy < 100 ? 'fair' : 'poor'
            }`}>
              {accuracy.toFixed(0)} m
            </span>
          </div>
          {!optimizeMode && !trackingMode && <div><span className="label">Points Recorded:</span> {pathData.length}</div>}
          {recording && <div className="recording-indicator">🔴 RECORDING</div>}
          {trackingMode && friendPosition && (
            <>
              <div className="friend-divider">Friend's Location</div>
              <div><span className="label">Speed:</span> {friendPosition.speed} km/h</div>
              <div>
                <span className="label">Accuracy:</span> 
                <span className="accuracy-indicator good">
                  {friendPosition.accuracy.toFixed(0)} m
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {optimizeMode && routeInfo && (
        <div className="route-info-box">
          {routeInfo.loading ? (
            <div className="route-loading">
              <div className="route-loading-spinner"></div>
              <span>Calculating optimal route...</span>
            </div>
          ) : routeInfo.error ? (
            <div className="route-error">
              <span className="error-icon">⚠️</span>
              <span>{routeInfo.error}</span>
            </div>
          ) : (
            <>
              <div className="route-header">
                <Navigation size={20} />
                <span>Optimal Route Found</span>
              </div>
              <div className="route-detail">
                <span className="route-label">Distance:</span>
                <span className="route-value">{routeInfo.distance} km</span>
              </div>
              <div className="route-detail">
                <span className="route-label">Est. Time:</span>
                <span className="route-value">{routeInfo.duration} min</span>
              </div>
              <div className="route-destination">
                <span className="route-label">Destination:</span>
                <span className="route-address">{routeInfo.address}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}