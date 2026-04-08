import { useState, useEffect } from 'react';

const VirtualKeyboard = () => {
  // Define the keys you want to show (e.g., WASD or Arrows)
  const keys = ['W', 'A', 'S', 'D'];

  const handlePress = (key: string) => {
    // This simulates a real keyboard press for your Three.js logic
    const event = new KeyboardEvent('keydown', {
      key: key.toLowerCase(),
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  const handleRelease = (key: string) => {
    const event = new KeyboardEvent('keyup', {
      key: key.toLowerCase(),
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '10px',
      zIndex: 1000 // Ensure it stays above the 3D canvas
    }}>
      {keys.map((key) => (
        <button
          key={key}
          onPointerDown={() => handlePress(key)}
          onPointerUp={() => handleRelease(key)}
          style={{
            width: '60px',
            height: '60px',
            fontSize: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(5px)',
            color: 'white',
            border: '1px solid white',
            borderRadius: '8px',
            touchAction: 'none' // Prevents zooming/scrolling while playing
          }}
        >
          {key}
        </button>
      ))}
    </div>
  );
};

export default VirtualKeyboard;

