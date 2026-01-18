/**
 * MAIN.JS - ??????? ????????? ????????? ?? ?????
 * ???????: ???????????? ?? ????, ????????? ?? ???????, ???????????? (analytics)
 */

// ============= LANGUAGE SWITCHER =============
const currentPath = window.location.pathname.toLowerCase();
const pages = {
  'bg': currentPath.includes('kalotina') ? '/kalotina.html' : (currentPath.includes('petrohan') ? '/petrohan.html' : (currentPath.includes('dragoman') ? '/dragoman.html' : (currentPath.includes('magistralaevropa') ? '/magistralaevropa.html' : (currentPath.includes('ginci') ? '/ginci.html' : (currentPath.includes('voluiak') ? '/voluiak.html' : (currentPath.includes('slivnica') ? '/slivnica.html' : (currentPath.includes('kostinbrod') ? '/kostinbrod.html' : '/'))))),
  'en': '/english.html',
  'de': '/german.html',
  'tr': '/turk.html',
  'ro': '/rom.html'
};

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const lang = this.getAttribute('data-lang');
    if (pages[lang]) {
      window.location.href = pages[lang];
    }

  // Initialize cached document metrics after DOM is ready to avoid layout thrashing
  if (typeof updateDocMetrics === 'function') {
    updateDocMetrics();
  }
  });
});

// ============= SEND LOCATION FUNCTION =============
/**
 * ??????? ?? ????????? ?? ???????? ??????????.
 * ?? ??????? ?????????? ?? ???????? SMS ? ???? ??? ???????,
 * ?? ??????? ?? ?????? ???? ? ?????????.
 */
function sendLocation() {
  const fallbackMessage = "?? ???? ?? ?? ???????? ???????. ??????? ?? ??: 0877 845 569";
  const locationName = document.body?.dataset?.location || '?????????? ??????????????';

  if (!navigator.geolocation) {
    alert(fallbackMessage);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const message = `???????? ????????? ?? (${locationName}).\n\n???? ??? ???????:\nhttps://maps.google.com/?q=${lat},${lng}`;
      const phone = '+359877845569';

      // Detect mobile
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
      } else {
        // Desktop - copy to clipboard
        navigator.clipboard.writeText(message).then(() => {
          alert("?????? ? ??????? ? ?????????. ????????? ?? ??: " + phone);
        }).catch(() => {
          alert(message);
        });
      }
    },
    function() {
      alert(fallbackMessage);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ============= ANALYTICS EVENT TRACKING =============
/**
 * ??????? ??????? ??? Google Analytics (??? ? ??????? gtag).
 * @param {string} eventName - ??? ?? ?????????
 * @param {string} category - ????????? ?? ?????????
 * @param {string} label - ??????/???????? ?? ?????????
 */
function trackEvent(eventName, category, label) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, {
      'event_category': category,
      'event_label': label
    });
  }
}

// ============= TRACK CTA CLICKS =============
document.querySelectorAll('a[href^="tel:"], .btn-primary, .header-cta').forEach(el => {
  el.addEventListener('click', function() {
    trackEvent('cta_click', 'engagement', this.textContent.trim());
  });
});

// ============= DROPDOWN ACCESSIBILITY =============
// Improve accessibility for CSS dropdowns (.dropbtn + .dropdown-content)
document.addEventListener('DOMContentLoaded', function() {
  // Set up accessible dropdowns
  document.querySelectorAll('.dropbtn').forEach(function(btn, idx) {
    // ensure focusable
    if (btn.tabIndex < 0) btn.tabIndex = 0;

    var dropdown = btn.closest('.dropdown');
    if (!dropdown) return;
    var menu = dropdown.querySelector('.dropdown-content');
    if (!menu) return;

    // ensure ids and ARIA
    if (!menu.id) menu.id = 'dropdown-menu-' + idx;
    btn.setAttribute('aria-controls', menu.id);
    btn.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');

    function openMenu() {
      btn.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
    }

    function closeMenu() {
      btn.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
    }

    function toggleMenu() {
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeMenu(); else openMenu();
    }

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      toggleMenu();
    });

    btn.addEventListener('keydown', function(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleMenu();
      } else if (e.key === 'Escape') {
        closeMenu();
        btn.focus();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target)) closeMenu();
    });

    // Close on Escape globally
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMenu();
    });
  });

  // Ensure header logo image has width/height to prevent layout shift
  var headerImg = document.querySelector('header img, .header-container img');
  if (headerImg) {
    if (!headerImg.hasAttribute('width') || !headerImg.hasAttribute('height')) {
      // if already loaded we can read natural sizes
      if (headerImg.naturalWidth && headerImg.naturalHeight) {
        headerImg.setAttribute('width', headerImg.naturalWidth);
        headerImg.setAttribute('height', headerImg.naturalHeight);
      } else {
        // fallback conservative size
        headerImg.setAttribute('width', '180');
        headerImg.setAttribute('height', '60');
      }
    }
  }
});

// ============= SCROLL DEPTH TRACKING =============
/**
 * ???????????? ?? ??????????? ?? ??????????.
 * ??????? ??????? ??? ????????? ?? 25%, 50%, 75%, 100% ??????????.
 */
let scrollDepth = 0;
// Throttle scroll handling with requestAnimationFrame and cache heavy layout values
let ticking = false;
// Defer initial measurement to after DOM is ready to avoid forced reflow during parse
let docHeight = 0;
let winHeight = 0;

function updateDocMetrics() {
  docHeight = document.body.scrollHeight;
  winHeight = window.innerHeight;
}

window.addEventListener('resize', function() {
  // update cached metrics on resize (infrequent)
  updateDocMetrics();
});

window.addEventListener('scroll', function() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(function() {
      const scrollY = window.scrollY || window.pageYOffset;
      const denom = (docHeight - winHeight) || 1;
      const scrollPercentage = (scrollY / denom) * 100;
      if (scrollPercentage > scrollDepth + 25) {
        scrollDepth = Math.floor(scrollPercentage / 25) * 25;
        trackEvent('scroll_depth', 'Engagement', scrollDepth + '%');
      }
      ticking = false;
    });
  }

  // Initialize cached document metrics after DOM is ready to avoid layout thrashing
  if (typeof updateDocMetrics === 'function') {
    updateDocMetrics();
  }
});

// ============= TRACK LOCATION LEAD =============
/**
 * ???????????? ?? ?????????? ?? lead ??? ????????? ?? ???????.
 */
const locationBtns = document.querySelectorAll('.btn-location, .btn-location-sticky');
locationBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'generate_lead', {
        'event_category': 'Contact',
        'event_label': 'Location Sent',
        'value': 1
      });
    } else {
      // fallback: send a lightweight tracking event if gtag not ready
      trackEvent('generate_lead', 'Contact', 'Location Sent');
    }
  });
});

// ============= DOCUMENT READY (Fallback) =============
/**
 * ??? ?? ?????????? ??? ????? ??????? DOM (fallback ?? ?????????? ?? ???????????????).
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // ????????????? ?? ???????????? ??????????????? ???? ????????? ?? DOM
  });
}
