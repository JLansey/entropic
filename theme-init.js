(function() {
  try {
    var mode = localStorage.getItem('entropic-theme-mode');
    var oldSaved = localStorage.getItem('entropic-theme');
    var isDark = false;
    
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'vibes') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else if (mode === 'light') {
      isDark = false;
    } else {
      isDark = (oldSaved === 'dark') || (!oldSaved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
