/* CON MATH - consultation booking calendar integration (Cal.com) */
'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const names = ['week', 'sun'];
  const tabs = names.map(name => document.getElementById(name === 'week' ? 'wk-tab' : 'sun-tab'));
  const panels = names.map(name => document.getElementById(name === 'week' ? 'wk-panel' : 'sun-panel'));
  const settings = window.CONMATH_BOOKING || {};
  const links = [settings.weekdaySaturday, settings.sunday];
  const loaded = new Set();

  function getEventLink(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== 'cal.com') return null;
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length !== 2 || url.search || url.hash) return null;
      // Important: the Cal.com profile slug contains Korean Unicode characters.
      // Preserve the exact path from the user's public event links; never alter Unicode normalization.
      return decodeURIComponent(segments.join('/'));
    } catch (_) {
      return null;
    }
  }

  function installCalLoader() {
    if (window.Cal) return;
    (function(C, A, L) {
      const enqueue = (q, args) => q.q.push(args);
      const d = C.document;
      C.Cal = C.Cal || function () {
        const cal = C.Cal;
        const args = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (args[0] === L) {
          const api = function () { enqueue(api, arguments); };
          const namespace = args[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            enqueue(cal.ns[namespace], args);
            enqueue(cal, ['initNamespace', namespace]);
          } else {
            enqueue(cal, args);
          }
          return;
        }
        enqueue(cal, args);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');
  }

  function showCalendar(index) {
    if (loaded.has(index)) return;
    const calLink = getEventLink(links[index]);
    const name = names[index];
    const container = document.getElementById('booking-' + name);
    const pending = document.getElementById('booking-' + name + '-pending');
    const direct = document.getElementById('booking-' + name + '-direct');
    if (typeof links[index] === 'string' && getEventLink(links[index])) {
      direct.href = links[index];
      direct.closest('.bk-alt').hidden = false;
    }
    if (!calLink) return;
    try {
      installCalLoader();
      const ns = 'conmath-' + name;
      window.Cal('init', ns, { origin: 'https://cal.com' });
      window.Cal.ns[ns]('inline', {
        elementOrSelector: '#booking-' + name,
        calLink,
        config: { layout: 'month_view', theme: 'light' }
      });
      window.Cal.ns[ns]('ui', {
        // The page already shows full consultation details above the calendar.
        // Do not display the Cal.com host's personal name in its metadata sidebar.
        hideEventTypeDetails: true,
        layout: 'month_view',
        styles: { branding: { brandColor: '#0b568e' } }
      });
      const showSuccess = (event) => {
        if (document.body.dataset.conmathBookingSuccess === 'true') return;
        // Only show this after Cal.com has actually notified us of booking success.
        document.body.dataset.conmathBookingSuccess = 'true';
        const flow = document.getElementById('bk-booking-flow');
        const confirmation = document.getElementById('bk-confirmation');
        if (!flow || !confirmation) return;
        flow.hidden = true;
        confirmation.hidden = false;
        confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
        confirmation.focus({ preventScroll: true });
      };
      // Cal.com embed sends a success event after accepting a reservation.
      // Support both the newer and older event names.
      for (const action of ['bookingSuccessfulV2', 'bookingSuccessful']) {
        window.Cal.ns[ns]('on', { action, callback: showSuccess });
      }
      container.hidden = false;
      pending.hidden = true;
      loaded.add(index);
    } catch (err) {
      console.warn('Booking calendar unavailable; use the direct event link.', err);
      container.hidden = true;
      pending.hidden = false;
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t, i) => {
        t.setAttribute('aria-selected', String(i === index));
        panels[i].hidden = i !== index;
      });
      showCalendar(index);
    });
  });
  showCalendar(0);
});
