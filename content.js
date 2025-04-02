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
  document.body.appendChild(cursor);

  // Create audio elements
  clickAudio = new Audio(clickAudioURL);
  loopAudio = new Audio(loopAudioURL);
  
  // Configure loop audio
  loopAudio.loop = true;
  loopAudio.volume = 1.0;
  
  // Add error handling for audio loading
  loopAudio.addEventListener('error', (e) => {
    console.error('Loop audio error:', e);
  });

  clickAudio.load();
  loopAudio.load();

  // Create style element for pointer override
  if (!cursorStyleSheet) {
    cursorStyleSheet = document.createElement('style');
    cursorStyleSheet.id = 'rofl-cursor-styles';
    document.head.appendChild(cursorStyleSheet);
  }
}

function updateCursorPosition(e) {
  if (!cursor) return;
  cursor.style.left = `${e.clientX - 10}px`;
  cursor.style.top = `${e.clientY - 10}px`;
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

async function handlePointerDown(e) {
  if (!cursor || !isEnabled || !isAltPressed) return;
  
  rotation = 10;
  cursor.style.transform = `scaleX(-1) rotate(${rotation}deg)`;
  
  if (clickAudio) {
    clickAudio.currentTime = 0;
    try {
      await clickAudio.play();
    } catch (error) {
      console.error('Failed to play click sound:', error);
    }
  }

  playLoopSound();
  
  // Block all further event propagation
  e.stopPropagation();
  e.preventDefault();
}

function handlePointerUp(e) {
  if (!cursor || !isEnabled || !isAltPressed) return;
  
  rotation = 0;
  cursor.style.transform = `scaleX(-1) rotate(${rotation}deg)`;
  stopLoopSound();
  
  // Block all further event propagation
  e.stopPropagation();
  e.preventDefault();
}

function setPointerOverride(active) {
  if (!cursorStyleSheet) return;
  
  cursorStyleSheet.textContent = active ? `
    * { cursor: none !important; pointer-events: none !important; }
    .rofl-cursor { pointer-events: none !important; }
  ` : '';
}

function toggleCursor(enabled) {
  isEnabled = enabled;
  
  if (isEnabled) {
    createCursor();
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

function handleKeyDown(e) {
  if (e.key === 'Alt' && isEnabled && !isAltPressed) {
    isAltPressed = true;
    if (cursor) {
      cursor.style.display = 'block';
      document.body.style.cursor = 'none';
      setPointerOverride(true);
    }
    e.preventDefault();
  }
}

function handleKeyUp(e) {
  if (e.key === 'Alt' && isEnabled) {
    isAltPressed = false;
    if (cursor) {
      cursor.style.display = 'none';
      document.body.style.cursor = 'auto';
      setPointerOverride(false);
    }
    stopLoopSound();
  }
}

// Global pointer event blocker when in cursor mode
function blockAllPointerEvents(e) {
  if (isAltPressed && isEnabled) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}

function init() {
  chrome.storage.local.get(['isEnabled'], function(result) {
    if (result.isEnabled) {
      toggleCursor(true);
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle') {
      toggleCursor(!isEnabled);
      sendResponse({ success: true });
    }
    return true;
  });

  // Add event listeners
  document.addEventListener('mousemove', updateCursorPosition, { passive: true });
  document.addEventListener('pointerdown', handlePointerDown, { capture: true });
  document.addEventListener('pointerup', handlePointerUp, { capture: true });
  document.addEventListener('click', blockAllPointerEvents, { capture: true });
  document.addEventListener('contextmenu', blockAllPointerEvents, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('keyup', handleKeyUp);
  
  // Prevent text selection
  document.addEventListener('selectstart', function(e) {
    if (isAltPressed && isEnabled) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });
}

function cleanup() {
  stopLoopSound();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    init();
  } else {
    cleanup();
  }
});

window.addEventListener('beforeunload', cleanup);
