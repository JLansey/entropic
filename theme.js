(function() {
  var themeToggle = document.getElementById('themeToggle');
  var themeDropdown = document.getElementById('themeDropdown');
  if (!themeToggle) return;
  var preferDark = window.matchMedia('(prefers-color-scheme: dark)');
  var vibesTimeout = null;
  var currentThemeSelection = 'light';
  var isInitialLoad = true;
  
  function setInternalTheme(isDark, transitionType) {
    document.documentElement.classList.remove('slow-theme', 'fast-theme');
    
    if (transitionType) {
      document.documentElement.classList.add(transitionType + '-theme');
      void document.documentElement.offsetWidth;
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
      themeToggle.textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark');
      themeToggle.textContent = '🌙';
    }

    if (transitionType) {
      setTimeout(function() {
        document.documentElement.classList.remove(transitionType + '-theme');
      }, transitionType === 'slow' ? 4050 : 200);
    }
  }

  function updateThemeSelection(selection, save, fromSystem) {
    currentThemeSelection = selection;
    if (vibesTimeout) {
      clearTimeout(vibesTimeout);
      vibesTimeout = null;
    }

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
      
      function scheduleNextFlip(delay) {
        vibesTimeout = setTimeout(function() {
          var isCurrentlyDark = document.documentElement.classList.contains('dark');
          setInternalTheme(!isCurrentlyDark, 'slow');
          
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
