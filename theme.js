(function() {
  var themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  var preferDark = window.matchMedia('(prefers-color-scheme: dark)');
  
  function updateTheme(isDark, save) {
    if (isDark) {
      document.documentElement.classList.add('dark');
      themeToggle.textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark');
      themeToggle.textContent = '🌙';
    }
    if (save) {
      try { localStorage.setItem('entropic-theme', isDark ? 'dark' : 'light'); } catch(e){}
    }
  }

  var isDark = document.documentElement.classList.contains('dark');
  updateTheme(isDark, false);

  preferDark.addEventListener('change', function(e) {
    try { if (localStorage.getItem('entropic-theme')) return; } catch(e){}
    updateTheme(e.matches, false);
  });

  themeToggle.addEventListener('click', function() {
    isDark = !document.documentElement.classList.contains('dark');
    updateTheme(isDark, true);
  });
})();
