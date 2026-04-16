(function() {
  var themeToggle = document.getElementById('themeToggle');
  var themeDropdown = document.getElementById('themeDropdown');
  if (!themeToggle) return;
  var preferDark = window.matchMedia('(prefers-color-scheme: dark)');
  var vibesTimeout = null;
  var musicTimeout = null;
  var audioElem = null;
  var fadeInterval = null;
  var currentThemeSelection = 'light';
  var isInitialLoad = true;
  
  var elevatorTracks = [
    '/vibenoise/Bossa_Antigua.mp3', 
    '/vibenoise/George_Street_Shuffle.mp3',
    '/vibenoise/fast-jazz-143910.mp3',
    '/vibenoise/late-brew-vibes-jazz-lofi-instrumental-358613.mp3',
    '/vibenoise/latin-saxophone-jazz-295337.mp3',
    '/vibenoise/sensual-jazz-130483.mp3'
  ];
  var currentTrackIndex = 0;

  function playNextTrack() {
    if (!audioElem) return;
    currentTrackIndex = (currentTrackIndex + 1) % elevatorTracks.length;
    audioElem.src = elevatorTracks[currentTrackIndex];
    var promise = audioElem.play();
    if (promise) promise.catch(function(){});
  }
  
  function stopMusic() {
    if (fadeInterval) {
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
    if (musicTimeout) {
      clearTimeout(musicTimeout);
      musicTimeout = null;
    }
    if (audioElem) {
      audioElem.pause();
      audioElem.currentTime = 0;
    }
  }

  function startElevatorMusic() {
    if (audioElem) {
      audioElem.pause();
      audioElem.removeEventListener('ended', playNextTrack);
    }

    if (Math.random() < 0.7) {
      // 70% chance to start with Bossa Antigua or George Street Shuffle
      currentTrackIndex = Math.random() < 0.5 ? 0 : 1;
    } else {
      // 30% chance to start with any of the other weird tracks
      currentTrackIndex = 2 + Math.floor(Math.random() * (elevatorTracks.length - 2));
    }

    audioElem = new Audio(elevatorTracks[currentTrackIndex]);
    audioElem.addEventListener('ended', playNextTrack);
    
    audioElem.volume = 0;
    var promise = audioElem.play();
    if (promise) promise.catch(function(){});

    var startFadeTime = Date.now();
    var fadeDuration = 21000;
    
    fadeInterval = setInterval(function() {
      var elapsed = Date.now() - startFadeTime;
      if (elapsed >= fadeDuration) {
        audioElem.volume = 0.5;
        clearInterval(fadeInterval);
      } else {
        var progress = elapsed / fadeDuration;
        audioElem.volume = 0.5 * progress * progress; // ease in curve
      }
    }, 100);
  }
  
  function setInternalTheme(isDark, transitionType) {
    document.documentElement.classList.remove('slow-theme', 'fast-theme', 'wacky-manual', 'wacky-manual-light', 'wacky-chaos-dynamic');
    
    if (transitionType !== 'chaos') {
      document.documentElement.style.filter = '';
    }

    if (transitionType === 'chaos') {
      var hue = Math.floor(Math.random() * 360);
      var invNum = Math.random() > 0.6 ? (Math.random() > 0.5 ? 0.9 : 0.2) : 0;
      var sepiaNum = Math.random() > 0.5 ? 0.6 : 0;
      var targetFilter = 'invert(' + invNum + ') sepia(' + sepiaNum + ') hue-rotate(' + hue + 'deg)';
      var startFilter = document.documentElement.style.filter || 'none';

      var styleId = 'wacky-dynamic-style';
      var existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();

      var styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        @keyframes dynamicWackyChaos {
          0% { filter: ${startFilter}; transform: scale(1) rotate(0deg); }
          20% { filter: sepia(0.8) hue-rotate(${hue + 45}deg); transform: scale(1.02) rotate(1deg); }
          45% { filter: invert(0.8) hue-rotate(${hue + 180}deg) saturate(4) contrast(2); transform: scale(0.95) rotate(-2deg); }
          55% { filter: invert(1) hue-rotate(${hue + 270}deg) saturate(5) blur(2px); transform: scale(1.05) rotate(3deg); }
          80% { filter: sepia(0.5) hue-rotate(${hue + 330}deg); transform: scale(1.01) rotate(-0.5deg); }
          100% { filter: ${targetFilter}; transform: scale(1) rotate(0deg); }
        }
        html.wacky-chaos-dynamic {
          animation: dynamicWackyChaos 5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          overflow-x: hidden;
        }
      `;
      document.head.appendChild(styleEl);

      document.documentElement.classList.add('wacky-chaos-dynamic');
      
      setTimeout(function() {
        if (isDark) {
          document.documentElement.classList.add('dark');
          if (themeToggle) themeToggle.textContent = '☀️';
        } else {
          document.documentElement.classList.remove('dark');
          if (themeToggle) themeToggle.textContent = '🌙';
        }
      }, 2500);

      setTimeout(function() {
         document.documentElement.style.filter = targetFilter;
         document.documentElement.classList.remove('wacky-chaos-dynamic');
      }, 5000);
      return;
    }

    if (transitionType === 'fast') {
      if (isDark) {
        // Quick wacky transition for light -> dark
        document.documentElement.classList.add('wacky-manual');
        setTimeout(function() {
            document.documentElement.classList.add('dark');
            if (themeToggle) themeToggle.textContent = '☀️';
        }, 300); // Flip halfway through the 0.6s animation
        
        setTimeout(function() {
          document.documentElement.classList.remove('wacky-manual');
        }, 600);
        return;
      } else {
        // Quick wacky transition for dark -> light
        document.documentElement.classList.add('wacky-manual-light');
        setTimeout(function() {
            document.documentElement.classList.remove('dark');
            if (themeToggle) themeToggle.textContent = '🌙';
        }, 300);
        
        setTimeout(function() {
          document.documentElement.classList.remove('wacky-manual-light');
        }, 600);
        return;
      }
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
      if (themeToggle) themeToggle.textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark');
      if (themeToggle) themeToggle.textContent = '🌙';
    }

    if (transitionType === 'fast') {
      setTimeout(function() {
        document.documentElement.classList.remove('fast-theme');
      }, 200);
    }
  }

  function updateThemeSelection(selection, save, fromSystem) {
    currentThemeSelection = selection;
    if (vibesTimeout) {
      clearTimeout(vibesTimeout);
      vibesTimeout = null;
    }
    stopMusic();

    var transitionType = (isInitialLoad && !fromSystem) ? null : 'fast';

    if (selection === 'light') {
      setInternalTheme(false, transitionType);
    } else if (selection === 'dark') {
      setInternalTheme(true, transitionType);
    } else if (selection === 'vibes') {
      // Initialize with whatever it currently is to not cause an immediate jarring switch,
      // or set it to system if it was just loaded. For now, match system as fallback.
      var isDark = document.documentElement.classList.contains('dark');
      setInternalTheme(isDark, null); // Keep current state instantly
      
      musicTimeout = setTimeout(startElevatorMusic, 3000);
      
      function scheduleNextFlip(delay) {
        vibesTimeout = setTimeout(function() {
          var isCurrentlyDark = document.documentElement.classList.contains('dark');
          setInternalTheme(!isCurrentlyDark, 'chaos');
          
          var minMs = 3 * 60 * 1000;
          var maxMs = 8 * 60 * 1000;
          var randomDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
          scheduleNextFlip(randomDelay);
        }, delay);
      }
      
      scheduleNextFlip(24 * 1000);
    }

    if (save) {
      try { localStorage.setItem('entropic-theme-mode', selection); } catch(e){}
    }

    if (themeDropdown) {
      var opts = themeDropdown.querySelectorAll('.theme-opt');
      opts.forEach(function(opt) {
        if (opt.getAttribute('data-theme') === selection) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });
    }
  }

  var savedSelection = 'light';
  try {
    var mode = localStorage.getItem('entropic-theme-mode');
    var oldSaved = localStorage.getItem('entropic-theme');
    if (mode) {
      savedSelection = mode;
    } else if (oldSaved === 'dark') {
      savedSelection = 'dark';
    } else if (oldSaved === 'light') {
      savedSelection = 'light';
    } else if (preferDark.matches) {
      savedSelection = 'dark';
    }
  } catch(e) {}

  updateThemeSelection(savedSelection, false);
  isInitialLoad = false;

  preferDark.addEventListener('change', function(e) {
    try { 
       if (localStorage.getItem('entropic-theme-mode') || localStorage.getItem('entropic-theme')) return; 
    } catch(e){}
    updateThemeSelection(e.matches ? 'dark' : 'light', false, true);
  });

  if (themeToggle && themeDropdown) {
    themeToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      themeDropdown.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (!themeToggle.contains(e.target) && !themeDropdown.contains(e.target)) {
        themeDropdown.classList.remove('open');
      }
    });

    var opts = themeDropdown.querySelectorAll('.theme-opt');
    opts.forEach(function(opt) {
      opt.addEventListener('click', function() {
        var mode = opt.getAttribute('data-theme');
        updateThemeSelection(mode, true);
        themeDropdown.classList.remove('open');
      });
    });
  }
})();
