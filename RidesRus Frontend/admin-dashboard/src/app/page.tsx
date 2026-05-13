'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { Shield, Plus, Key, Radio, MapPin, Users, Hash, Bus, CheckCircle2, ChevronRight, X, AlertCircle } from 'lucide-react';

const LiveMap = dynamic(() => import('./_components/LiveMap'), { ssr: false, loading: () => <div className="w-full h-full bg-[#121215] flex items-center justify-center"><span className="text-lime-400 text-xs font-bold animate-pulse">LOADING MAP...</span></div> });

type BusStat = {
  id: string;
  driverId: string;
  driverName: string;
  plateNumber: string;
  availableSeats: number;
  capacity: number;
  lat: number;
  lng: number;
  lastUpdate: number;
};

type DbDriver = {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  status: 'active' | 'inactive';
};

export default function AdminDashboard() {
  const [buses, setBuses] = useState<BusStat[]>([
    { id: 'bus_demo_001', driverId: 'RR-9942', driverName: 'David Koko', plateNumber: 'LND-001-XA', availableSeats: 5, capacity: 18, lat: 6.4541, lng: 3.4064, lastUpdate: Date.now() },
    { id: 'bus_demo_002', driverId: 'RR-1021', driverName: 'Sarah Jide', plateNumber: 'LND-002-XA', availableSeats: 0, capacity: 18, lat: 6.4421, lng: 3.4164, lastUpdate: Date.now() },
    { id: 'bus_demo_003', driverId: 'RR-3044', driverName: 'Tunde Ola', plateNumber: 'LND-003-XA', availableSeats: 12, capacity: 18, lat: 6.4641, lng: 3.3964, lastUpdate: Date.now() },
  ]);

  const [dbDrivers, setDbDrivers] = useState<DbDriver[]>([
    { id: 'RR-9942', firstName: 'David', lastName: 'Koko', photoUrl: '', status: 'active' },
    { id: 'RR-1021', firstName: 'Sarah', lastName: 'Jide', photoUrl: '', status: 'active' },
    { id: 'RR-3044', firstName: 'Tunde', lastName: 'Ola', photoUrl: '', status: 'active' },
    { id: 'RR-8821', firstName: 'Michael', lastName: 'Ojo', photoUrl: '', status: 'inactive' },
  ]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const simInterval = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  
  // Add Driver Form
  const [newDriver, setNewDriver] = useState({ firstName: '', lastName: '' });
  const [generatedId, setGeneratedId] = useState('');

  // Access Key Form
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');

  useEffect(() => {
    // Connect to NestJS tracking gateway
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005', { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Fleet Command WebSocket');
    });

    newSocket.on('bus_moved', (data: { busId: string, lat: number, lng: number, timestamp: number }) => {
      setBuses(prev => prev.map(bus => {
        if (bus.id === data.busId) {
          return { ...bus, lat: data.lat, lng: data.lng, lastUpdate: data.timestamp };
        }
        return bus;
      }));
    });

    return () => {
      newSocket.disconnect();
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  // Real GPS waypoints along Lekki-VI Expressway
  const ROUTE_WAYPOINTS = [
    [6.4676, 3.5739], // Ajah Market
    [6.4623, 3.5571], // VGC junction
    [6.4577, 3.5371], // Jakande
    [6.4530, 3.5150], // Ologolo
    [6.4474, 3.4983], // Chisco
    [6.4420, 3.4822], // Chevron
    [6.4355, 3.4722], // Lekki Phase 1
    [6.4281, 3.4419], // Admiralty way
    [6.4240, 3.4219], // Victoria Island
  ];
  const busWaypointIdx = useRef<{[id: string]: number}>({});

  const toggleSimulation = () => {
    if (isSimulating) {
      if (simInterval.current) clearInterval(simInterval.current);
      setIsSimulating(false);
    } else {
      // Initialize each bus at a different starting waypoint
      setBuses(prev => prev.map((bus, i) => ({
        ...bus,
        lat: ROUTE_WAYPOINTS[i * 3 % ROUTE_WAYPOINTS.length][0],
        lng: ROUTE_WAYPOINTS[i * 3 % ROUTE_WAYPOINTS.length][1],
      })));
      buses.forEach((bus, i) => { busWaypointIdx.current[bus.id] = i * 3 % ROUTE_WAYPOINTS.length; });

      setIsSimulating(true);
      simInterval.current = setInterval(() => {
        buses.forEach(bus => {
          if (!socket) return;
          // Move to next waypoint
          const currentIdx = busWaypointIdx.current[bus.id] ?? 0;
          const nextIdx = (currentIdx + 1) % ROUTE_WAYPOINTS.length;
          busWaypointIdx.current[bus.id] = nextIdx;
          const [lat, lng] = ROUTE_WAYPOINTS[nextIdx];
          socket.emit('ping_location', { busId: bus.id, lat, lng });
        });
      }, 3000);
    }
  };

  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.firstName || !newDriver.lastName) return;
    
    const id = `RR-${Math.floor(1000 + Math.random() * 9000)}`;
    const d: DbDriver = {
      id,
      firstName: newDriver.firstName,
      lastName: newDriver.lastName,
      photoUrl: '',
      status: 'inactive'
    };
    
    setDbDrivers([...dbDrivers, d]);
    setGeneratedId(id);
    setNewDriver({ firstName: '', lastName: '' });
  };

  const handleGenerateKey = () => {
    if (!selectedDriverId) return;
    // Generate a secure 6 digit pin
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedPin(pin);
  };

  const getSeatColor = (available: number, capacity: number) => {
    if (available === 0) return 'bg-red-500';
    if (available / capacity < 0.4) return 'bg-amber-400';
    return 'bg-lime-400';
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 font-sans flex flex-col">
      {/* Premium Header */}
      <header className="border-b border-white/5 bg-white/5 backdrop-blur-xl px-8 py-5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-lime-400 rounded-xl flex items-center justify-center">
            <Shield className="text-[#09090b] w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">RidesRus Fleet HQ</h1>
            <p className="text-xs text-lime-400 font-bold uppercase tracking-widest mt-0.5">Command Center v2</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={toggleSimulation}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              isSimulating ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Radio className={isSimulating ? "animate-pulse w-4 h-4" : "w-4 h-4"} />
            {isSimulating ? 'STOP SIMULATION' : 'SIMULATE FLEET'}
          </button>

          <div className="flex items-center gap-2 border-l border-white/10 pl-6">
            <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="admin" className="w-full h-full" />
            </div>
            <span className="text-sm font-bold text-gray-300">Admin Control</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 flex gap-8">
        
        {/* LEFT COLUMN: Map View & Action Buttons */}
        <div className="w-2/5 flex flex-col gap-6">
          
          {/* Action Hub */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => { setShowAddDriver(true); setGeneratedId(''); }}
              className="bg-gray-900 border border-white/10 p-6 rounded-3xl hover:bg-gray-800 hover:border-lime-400/50 transition-all group flex flex-col items-start gap-4 text-left"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-lime-400/20 transition-all">
                <Plus className="w-6 h-6 text-gray-400 group-hover:text-lime-400" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Enroll Driver</h3>
                <p className="text-xs text-gray-500 font-medium">Add new fleet personnel to DB</p>
              </div>
            </button>
            
            <button 
              onClick={() => { setShowAccessKey(true); setGeneratedPin(''); setSelectedDriverId(''); }}
              className="bg-gray-900 border border-white/10 p-6 rounded-3xl hover:bg-gray-800 hover:border-yellow-400/50 transition-all group flex flex-col items-start gap-4 text-left"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-yellow-400/20 transition-all">
                <Key className="w-6 h-6 text-gray-400 group-hover:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Issue Access Key</h3>
                <p className="text-xs text-gray-500 font-medium">Generate offline shift PIN codes</p>
              </div>
            </button>
          </div>

          {/* Live Map */}
          <div className="flex-1 bg-[#121215] border border-white/5 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col min-h-[380px]">
             <div className="p-4 border-b border-white/5 absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-[#121215]/90 to-transparent pointer-events-none">
               <h2 className="text-sm font-bold uppercase tracking-widest text-lime-400 flex items-center gap-2">
                 <MapPin className="w-4 h-4" /> Live Fleet Map — Lekki Corridor
               </h2>
             </div>
             <div className="absolute inset-0">
               <LiveMap buses={buses} />
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Fleet State */}
        <div className="w-3/5 bg-gray-900 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
             <div>
                <h2 className="text-xl font-bold text-white">Active Fleet Manifest</h2>
                <p className="text-sm text-gray-500 mt-1">Real-time status of all dispatched routes.</p>
             </div>
             <div className="px-3 py-1.5 bg-lime-500/10 border border-lime-500/30 rounded-lg text-lime-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                {buses.length} Buses Scanning
             </div>
          </div>

          <div className="overflow-y-auto p-4 flex-1">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">
                  <th className="pb-4 pl-4">Driver & Unit</th>
                  <th className="pb-4">Occupancy Rate</th>
                  <th className="pb-4">Coordinates</th>
                  <th className="pb-4 text-right pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {buses.map(bus => (
                  <tr key={bus.id} className="bg-white/5 hover:bg-white/10 transition-colors group">
                    <td className="px-4 py-4 rounded-l-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                          <Bus className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{bus.driverName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-lime-400 bg-lime-400/10 px-1.5 py-0.5 rounded">{bus.plateNumber}</span>
                            <span className="text-[10px] text-gray-500 font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{bus.driverId}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 w-48">
                      <div className="flex items-center justify-between mb-1">
                         <span className="text-xs font-bold text-gray-300">{bus.availableSeats} Seats Left</span>
                         <span className="text-[10px] font-bold text-gray-500">{Math.round(((bus.capacity - bus.availableSeats) / bus.capacity) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getSeatColor(bus.availableSeats, bus.capacity)}`}
                          style={{ width: `${((bus.capacity - bus.availableSeats) / bus.capacity) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs text-gray-400 tracking-tight">
                        {bus.lat.toFixed(5)}<br/>
                        {bus.lng.toFixed(5)}
                      </div>
                    </td>
                    <td className="px-4 py-4 rounded-r-2xl text-right">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        bus.availableSeats === 0
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : bus.availableSeats / bus.capacity < 0.4
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                          : 'bg-lime-500/10 text-lime-400 border border-lime-500/20'
                      }`}>
                        {bus.availableSeats === 0 ? 'Full Load' : 'En Route'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL 1: ADD DRIVER */}
      {showAddDriver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-white/10 w-[450px] rounded-3xl shadow-2xl relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-400 to-yellow-400" />
            
            <button onClick={() => setShowAddDriver(false)} className="absolute top-5 right-5 text-gray-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="w-12 h-12 bg-lime-400/10 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-lime-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Enroll New Driver</h2>
              <p className="text-sm text-gray-400 mb-8">Register personnel into the fleet database. Requires biometric photo upload.</p>

              {generatedId ? (
                <div className="bg-lime-400/10 border border-lime-400/20 rounded-2xl p-6 text-center animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="w-12 h-12 text-lime-400 mx-auto mb-4" />
                  <p className="text-sm text-lime-400 font-bold uppercase tracking-widest mb-1">Successfully Registered</p>
                  <p className="text-3xl font-black text-white font-mono">{generatedId}</p>
                  <p className="text-xs text-gray-400 mt-4">Give this permanent ID to the driver. They will need a separate Access Key to begin shifts.</p>
                  <button onClick={() => setShowAddDriver(false)} className="mt-6 w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition">
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddDriver} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">First Name</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-gray-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-lime-400 transition" 
                        value={newDriver.firstName}
                        onChange={e => setNewDriver({...newDriver, firstName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Last Name</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-gray-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-lime-400 transition" 
                        value={newDriver.lastName}
                        onChange={e => setNewDriver({...newDriver, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Photograph Upload</label>
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-950/50 hover:bg-gray-950 cursor-pointer transition">
                      <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-3">
                        <Plus className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-400 font-medium">Click to browse or drag face scan</p>
                    </div>
                  </div>

                  <button type="submit" className="mt-4 w-full py-3 bg-lime-400 text-black font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-lime-500 transition flex items-center justify-center gap-2">
                    Generate Driver ID <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GENERATE ACCESS KEY */}
      {showAccessKey && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-white/10 w-[450px] rounded-3xl shadow-2xl relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-500" />
            
            <button onClick={() => setShowAccessKey(false)} className="absolute top-5 right-5 text-gray-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-6">
                <Hash className="w-6 h-6 text-yellow-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Issue Access Key</h2>
              <p className="text-sm text-gray-400 mb-8">Generate a one-time 6-digit shift pin for an inactive driver. Pins expire after 15 minutes.</p>

              {generatedPin ? (
                <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-4" />
                  <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest mb-4">Communicate Securely IRL</p>
                  <p className="text-5xl font-black text-white font-mono tracking-[0.25em]">{generatedPin}</p>
                  <p className="text-xs text-gray-400 mt-6 leading-relaxed">Ensure driver {selectedDriverId} enters this pin on the tablet within 15 minutes to initialize their shift sequence.</p>
                  <button onClick={() => setShowAccessKey(false)} className="mt-6 w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition">
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Select Inactive Driver</label>
                  
                  <div className="max-h-[220px] overflow-y-auto pr-2 flex flex-col gap-2">
                    {dbDrivers.filter(d => d.status === 'inactive').length === 0 ? (
                       <p className="text-sm text-gray-500 italic p-4 text-center bg-white/5 rounded-xl">No inactive drivers found. All drivers are currently on shift.</p>
                    ) : (
                      dbDrivers.filter(d => d.status === 'inactive').map(driver => (
                        <div 
                          key={driver.id} 
                          onClick={() => setSelectedDriverId(driver.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            selectedDriverId === driver.id 
                              ? 'bg-yellow-500/10 border-yellow-500/50' 
                              : 'bg-white/5 border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                               <Users className="w-4 h-4 text-gray-400" />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-white">{driver.firstName} {driver.lastName}</p>
                               <p className="text-[10px] text-gray-500 font-mono mt-0.5">{driver.id}</p>
                            </div>
                          </div>
                          
                          {selectedDriverId === driver.id && (
                             <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                               <div className="w-2 h-2 bg-black rounded-full" />
                             </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <button 
                    onClick={handleGenerateKey}
                    disabled={!selectedDriverId}
                    className={`mt-6 w-full py-3 font-bold uppercase tracking-widest text-sm rounded-xl transition flex items-center justify-center gap-2 ${
                      selectedDriverId ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Generate Security PIN <Key className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
