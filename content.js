let cursor = null;
let rotation = 0;
let clickAudio = null;
let loopAudio = null;
let isEnabled = false;
let isLoopPlaying = false;
let isAltPressed = false;
let cursorStyleSheet = null;

// Preload assets
const cursorURL = chrome.runtime.getURL('assets/default.png');
const clickAudioURL = chrome.runtime.getURL('assets/tuck.wav');
const loopAudioURL = chrome.runtime.getURL('assets/ukazka.wav');

function createCursor() {
  if (cursor) return; // Prevent multiple cursors
  
  cursor = document.createElement('div');
  cursor.className = 'rofl-cursor';
  cursor.style.backgroundImage = `url(${cursorURL})`;
  // Не устанавливаем размеры инлайново, используем класс CSS
  document.body.appendChild(cursor);

  // Create audio elements
  clickAudio = new Audio(clickAudioURL);
  loopAudio = new Audio(loopAudioURL);
  
  // Configure loop audio
  loopAudio.loop = true;
  loopAudio.volume = 1.0; // Ensure full volume
  
  // Add error handling for audio loading
  loopAudio.addEventListener('error', (e) => {
    console.error('Loop audio error:', e);
  });

  // Enable audio
  clickAudio.load();
  loopAudio.load();

  // Create simple style element just for pointer override
  if (!cursorStyleSheet) {
    cursorStyleSheet = document.createElement('style');
    cursorStyleSheet.id = 'rofl-cursor-styles';
    document.head.appendChild(cursorStyleSheet);
  }

  // Log to verify URLs
  console.log('Loop audio URL:', loopAudioURL);
  console.log('Click audio URL:', clickAudioURL);
}

function updateCursorPosition(e) {
  if (!cursor) return;
  // Adjust position to account for the larger cursor size
  cursor.style.left = `${e.clientX - 10}px`; // Увеличили отступ для большего курсора
  cursor.style.top = `${e.clientY - 10}px`; // Немного подняли, чтобы кончик указывал на курсор
}

async function playLoopSound() {
  if (!loopAudio || isLoopPlaying || !isAltPressed) return;
  
  try {
    isLoopPlaying = true;
    await loopAudio.play();
  } catch (error) {
    console.error('Failed to play loop sound:', error);
    isLoopPlaying = false;
  }
}

function stopLoopSound() {
  if (!loopAudio) return;
  
  loopAudio.pause();
  loopAudio.currentTime = 0;
  isLoopPlaying = false;
}

async function handleMouseDown(e) {
  if (!cursor || !isEnabled) return;
  
  // Only proceed if Alt is pressed
  if (isAltPressed) {
    rotation = 10; // Positive rotation for backwards tilt
    cursor.style.transform = `scaleX(-1) rotate(${rotation}deg)`;
    
    // Play click sound
    if (clickAudio) {
      clickAudio.currentTime = 0;
      try {
        await clickAudio.play();
      } catch (error) {
        console.error('Failed to play click sound:', error);
      }
    }

    // Start loop sound
    playLoopSound();

    // Prevent click
    e.preventDefault();
    e.stopPropagation();
    return false; // Explicitly return false to prevent default behavior
  }
}

function handleMouseUp(e) {
  if (!cursor || !isEnabled) return;
  
  if (isAltPressed) {
    rotation = 0;
    cursor.style.transform = `scaleX(-1) rotate(${rotation}deg)`;
    
    // Stop the loop sound
    stopLoopSound();

    // Prevent click
    e.preventDefault();
    e.stopPropagation();
    return false; // Explicitly return false to prevent default behavior
  }
}

function setPointerOverride(active) {
  if (!cursorStyleSheet) return;
  
  if (active) {
    // Only override pointer cursor
    cursorStyleSheet.textContent = `
      a, button, [role="button"], input[type="submit"], input[type="button"], 
      [style*="cursor: pointer"], [style*="cursor:pointer"], .clickable, 
      [onclick], [data-clickable="true"], .pointer {
        cursor: none !important;
      }
    `;
  } else {
    // Remove overrides
    cursorStyleSheet.textContent = '';
  }
}

function toggleCursor(enabled) {
  isEnabled = enabled;
  
  if (isEnabled) {
    createCursor();
    // Start with default cursor visible, custom cursor hidden
    document.body.style.cursor = 'auto';
    if (cursor) cursor.style.display = 'none';
    setPointerOverride(false);
  } else {
    document.body.style.cursor = 'auto';
    if (cursor) {
      cursor.style.display = 'none';
      stopLoopSound();
    }
    setPointerOverride(false);
  }
}

// Handle Alt key press
function handleKeyDown(e) {
  if (e.key === 'Alt' && isEnabled && !isAltPressed) {
    isAltPressed = true;
    if (cursor) {
      cursor.style.display = 'block';
      document.body.style.cursor = 'none';
      setPointerOverride(true); // Apply pointer override
    }
    // Prevent default Alt behavior (menu activation)
    e.preventDefault();
  }
}

function handleKeyUp(e) {
  if (e.key === 'Alt' && isEnabled) {
    isAltPressed = false;
    if (cursor) {
      cursor.style.display = 'none';
      document.body.style.cursor = 'auto';
      setPointerOverride(false); // Remove pointer override
    }
    stopLoopSound();
  }
}

// Capture and block all click events when in cursor mode
function handleClick(e) {
  if (isAltPressed && isEnabled) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}

// Initialize
function init() {
  // Check initial state
  chrome.storage.local.get(['isEnabled'], function(result) {
    if (result.isEnabled) {
      toggleCursor(true);
    }
  });

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle') {
      toggleCursor(!isEnabled);
      sendResponse({ success: true });
    }
    return true; // Keep the message channel open for sendResponse
  });

  // Add event listeners with capture phase to ensure blocking
  document.addEventListener('mousemove', updateCursorPosition, { passive: true });
  document.addEventListener('mousedown', handleMouseDown, { capture: true });
  document.addEventListener('mouseup', handleMouseUp, { capture: true });
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('contextmenu', handleClick, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('keyup', handleKeyUp);
  
  // Prevent text selection when in cursor mode
  document.addEventListener('selectstart', function(e) {
    if (isAltPressed && isEnabled) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });
}

// Clean up function to stop sounds when the page is hidden or closed
function cleanup() {
  stopLoopSound();
}

// Ensure the script runs as soon as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-run initialization when document becomes visible
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    init();
  } else {
    cleanup();
  }
});

// Clean up when the window is closed
window.addEventListener('beforeunload', cleanup);