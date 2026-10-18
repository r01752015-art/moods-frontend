import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};


function App() {
  const [currentStep, setCurrentStep] = useState('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [userRole, setUserRole] = useState('customer');
  const [activeTab, setActiveTab] = useState('home');

  const [isHostApproved, setIsHostApproved] = useState(false);
  const [customerCoins, setCustomerCoins] = useState(500);
  const [hostEarnings, setHostEarnings] = useState(450);

  // Profile Customization States
  const [displayName, setDisplayName] = useState('');
  const [customUserId, setCustomUserId] = useState('');
  const [profilePic, setProfilePic] = useState('https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Host Call Controls States
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const getCallRate = (callType) => {
    const currentHour = new Date().getHours();
    const isNight = currentHour >= 21 || currentHour < 6;
    if (callType === 'video') return isNight ? 10 : 9;
    if (callType === 'audio') return isNight ? 4 : 3;
    return 0;
  };

  const myVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    let coinTimer;
    if (activeCall) {
      coinTimer = setInterval(() => {
        setCustomerCoins((prevCoins) => {
          if (prevCoins <= 10) {
            if (typeof endCall === 'function') endCall();
            alert("Coins gaali aayiduchu! Call disconnected.");
            return 0;
          }
          return prevCoins - 10;
        });
      }, 5000); 
    } else {
      clearInterval(coinTimer);
    }
    return () => clearInterval(coinTimer);
  }, [activeCall]); 

  useEffect(() => {
    document.title = "Moods";
    socket.on('connect', () => {
      console.log("Connected to Signaling Server:", socket.id);
    });
    socket.on('incoming_call', (data) => {
      setIncomingCall(data);
    });
    socket.on('call_ended', () => {
      endCall();
    });  
    return () => {
      socket.off('incoming_call');
      socket.off('call_ended');
    };
  }, []);

  const startLocalStream = async (type) => {
    try {
      const constraints = { audio: true, video: type === 'video' };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (myVideoRef.current && type === 'video') {
        myVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera/Mic Error:", err);
      alert("Please allow Camera & Microphone permissions!");
    }
  };

  const initiateCall = (partnerName, type) => {
    setActiveCall({ partnerName, type, isCaller: true });
    startLocalStream(type);
    socket.emit('call_user', {
      userToCall: partnerName,
      from: customUserId || phoneNumber || socket.id,
      name: displayName || (userRole === 'customer' ? 'Customer' : 'Host'),
      callType: type
    });
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    setActiveCall({ partnerName: incomingCall.name, type: incomingCall.callType, isCaller: false });
    startLocalStream(incomingCall.callType);
    setIncomingCall(null);
    socket.emit('answer_call', { to: incomingCall.from });
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (activeCall) {
      socket.emit('end_call', { to: activeCall.partnerName });
    }
    setActiveCall(null);
    setIncomingCall(null);
  };

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative', paddingBottom: currentStep === 'main' ? '70px' : '0' }}>
      
      {currentStep === 'login' && (
        <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: '50px' }}>
          <h1 style={{ color: '#ff5722', fontSize: '32px', marginBottom: '10px' }}>Moods</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '30px' }}>Partner & Customer Onboarding</p>
          
          <input 
            type="text" 
            placeholder="Enter Mobile Number" 
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px', fontSize: '16px', boxSizing: 'border-box' }}
          />
          <button 
            onClick={() => {
              if (phoneNumber.length < 10) return alert("Please enter a valid mobile number!");
              socket.emit('join_room', { userId: phoneNumber });
              setCurrentStep('otp');
            }}
            style={{ width: '100%', padding: '12px', backgroundColor: '#ff5722', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
          >
            Get OTP
          </button>
        </div>
      )}

      {currentStep === 'otp' && (
        <div style={{ padding: '40px 20px', textAlign: 'center', marginTop: '50px' }}>
          <h2 style={{ color: '#333', marginBottom: '10px' }}>Verify OTP</h2>
          <p style={{ color: '#666', fontSize: '13px', marginBottom: '25px' }}>OTP sent to +91 {phoneNumber}</p>
          
          <input 
            type="text" 
            placeholder="Enter OTP (e.g. 1234)" 
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px', fontSize: '16px', textAlign: 'center', boxSizing: 'border-box' }}
          />
          <button 
            onClick={() => {
              if (!otp) return alert("Please enter OTP!");
              if (!customUserId) setCustomUserId("user_" + phoneNumber.slice(-4));
              setCurrentStep('main');
            }}
            style={{ width: '100%', padding: '12px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
          >
            Verify & Continue
          </button>
        </div>
      )}

      {currentStep === 'main' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={profilePic} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <span style={{ color: '#ff5722', fontWeight: 'bold', fontSize: '16px', display: 'block' }}>{displayName || (userRole === 'host' ? 'Host' : 'Customer')}</span>
                <span style={{ fontSize: '10px', color: '#888' }}>@{customUserId || 'userid'}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={() => setUserRole(userRole === 'customer' ? 'host' : 'customer')} 
                style={{ fontSize: '11px', padding: '4px 8px', background: '#333', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                Switch to {userRole === 'customer' ? 'Host' : 'Customer'}
              </button>
              
              <div style={{ backgroundColor: '#ff5722', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' }}>
                {userRole === 'customer' ? `🪙 ${customerCoins} Coins` : `₹${hostEarnings}`}
              </div>
            </div>
          </div>

          {incomingCall && (
            <div style={{ position: 'fixed', top: '20px', left: '5%', right: '5%', background: '#ff5722', color: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 3000, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Incoming {incomingCall.callType.toUpperCase()} Call</div>
                <div style={{ fontSize: '12px' }}>From: {incomingCall.name}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={acceptCall} style={{ background: '#4caf50', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Accept</button>
                <button onClick={() => setIncomingCall(null)} style={{ background: '#f44336', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          )}

          {activeCall && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', zIndex: 2000, padding: '30px 20px' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#ff5722', margin: '0 0 5px 0' }}>{activeCall.isCaller ? 'Calling' : 'Connected with'} {activeCall.partnerName}...</h3>
                <p style={{ fontSize: '12px', color: '#aaa' }}>{activeCall.type.toUpperCase()} CALL LIVE</p>
              </div>

              <div style={{ width: '100%', height: '60%', background: '#222', borderRadius: '16px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {activeCall.type === 'video' ? (
                  <>
                    <video ref={myVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: '5px', fontSize: '10px' }}>You</div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#ff5722', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto 15px' }}>📞</div>
                    <p style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>{activeCall.partnerName}</p>
                  </div>
                )}
              </div>

              <button 
                onClick={endCall}
                style={{ background: '#f44336', color: '#fff', border: 'none', padding: '14px 40px', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '80%' }}
              >
                🔴 End Call
              </button>
            </div>
          )}

          {activeTab === 'home' && (
            <div style={{ padding: '15px' }}>
              {userRole === 'host' ? (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', flex: 1, textAlign: 'center' }}>
                      <div style={{ color: isHostApproved ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                        {isHostApproved ? 'Approved' : 'Pending Admin Approval'}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'linear-gradient(135deg, #ff5722, #ff9800)', color: '#fff', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>☀️ Day Rate: 9 Coins/Min | 🌙 Night Rate: 10 Coins/Min</div>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>📞 Call Status & Pricing</h4>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#222' }}>📹 Video Call</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#666' }}>
                          Rate: <strong>{getCallRate('video')} Coins/min</strong>
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                        style={{ padding: '6px 14px', borderRadius: '15px', border: 'none', fontWeight: 'bold', color: '#fff', backgroundColor: isVideoEnabled ? '#28a745' : '#dc3545', cursor: 'pointer' }}>
                        {isVideoEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#222' }}>🎙️ Audio Call</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#666' }}>
                          Rate: <strong>{getCallRate('audio')} Coins/min</strong>
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                        style={{ padding: '6px 14px', borderRadius: '15px', border: 'none', fontWeight: 'bold', color: '#fff', backgroundColor: isAudioEnabled ? '#28a745' : '#dc3545', cursor: 'pointer' }}>
                        {isAudioEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ background: 'linear-gradient(135deg, #ff5722, #ff9800)', color: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>Welcome to Moods</h3>
                    <p style={{ fontSize: '12px', opacity: 0.9, margin: '5px 0 0 0' }}>Connect with active partners instantly</p>
                  </div>

                  <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#333' }}>Active Partners</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { name: 'Maya', status: 'Online', lang: 'Tamil' },
                      { name: 'Abi', status: 'Online', lang: 'Tamil' },
                      { name: 'Sweety', status: 'Busy', lang: 'Tamil' }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '12px' }}>
                        <div>
                          <strong style={{ fontSize: '15px' }}>{item.name}</strong>
                          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{item.lang} • {item.status}</p>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => initiateCall(item.name, 'video')} 
                            style={{ background: '#ff5722', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                            📹 Video
                          </button>
                          <button 
                            onClick={() => initiateCall(item.name, 'audio')} 
                            style={{ background: '#007bff', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                            🎙️ Audio
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'callLogs' && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>📞 Call Logs</h3>
              <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No recent call history available.</p>
              </div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div style={{ padding: '20px' }}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>💰 Earnings & Wallet</h3>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <p style={{ color: '#666', margin: '0 0 5px 0', fontSize: '14px' }}>Total Earnings</p>
                <h2 style={{ color: '#ff5722', margin: '0 0 15px 0' }}>₹{hostEarnings}</h2>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '15px', color: '#333' }}>👤 User Profile</h3>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <img src={profilePic} alt="avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ff5722', margin: '0 auto 10px' }} />
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '18px' }}>{displayName || (userRole === 'host' ? 'Host Account' : 'Customer Account')}</h4>
                  <p style={{ margin: '0 0 5px 0', color: '#ff5722', fontWeight: 'bold', fontSize: '13px' }}>@{customUserId || 'userid'}</p>
                  <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>+91 {phoneNumber || '9876543210'}</p>
                </div>

                {isEditingProfile ? (
                  <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>Edit Profile Details</h5>
                    
                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Display Name:</label>
                    <input 
                      type="text" 
                      placeholder="Enter Name" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                    />

                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Custom User ID:</label>
                    <input 
                      type="text" 
                      placeholder="Enter unique ID" 
                      value={customUserId} 
                      onChange={(e) => setCustomUserId(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                    />

                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Profile Picture URL:</label>
                    <input 
                      type="text" 
                      placeholder="Paste Image URL" 
                      value={profilePic} 
                      onChange={(e) => setProfilePic(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                    />

                    <button 
                      onClick={() => setIsEditingProfile(false)}
                      style={{ width: '100%', padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Save Changes
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    style={{ width: '100%', marginBottom: '15px', padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    ✏️ Edit Profile & Avatar
                  </button>
                )}

                <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#666' }}>Role Type:</span>
                    <strong style={{ textTransform: 'capitalize' }}>{userRole}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: '#666' }}>Status:</span>
                    <strong style={{ color: '#4caf50' }}>Active</strong>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setCurrentStep('login');
                    setActiveTab('home');
                  }}
                  style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Logout
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {currentStep === 'main' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', padding: '8px 0', maxWidth: '420px', margin: '0 auto' }}>
          {[
            { id: 'home', label: 'Home', icon: '🏠' },
            { id: 'callLogs', label: 'Call Logs', icon: '📞' },
            { id: 'earnings', label: 'Earnings', icon: '💰' },
            { id: 'profile', label: 'Profile', icon: '👤' }
          ].map((tab) => (
            <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '8px', textAlign: 'center', cursor: 'pointer', color: activeTab === tab.id ? '#ff5722' : '#666' }}>
              <div style={{ fontSize: '18px' }}>{tab.icon}</div>
              <div style={{ fontSize: '11px' }}>{tab.label}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default App;