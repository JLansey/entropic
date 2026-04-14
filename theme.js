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
    if (!audioElem) {
      audioElem = new Audio('/elevator.mp3');
      audioElem.loop = true;
    }
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
    document.documentElement.classList.remove('slow-theme', 'fast-theme', 'wacky-chaos', 'wacky-manual', 'wacky-manual-light');
    
    if (transitionType === 'chaos') {
      document.documentElement.classList.add('wacky-chaos');
      // The flip happens right at the peak of the 5-second chaos (at 2.5s)
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
         document.documentElement.classList.remove('wacky-chaos');
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
