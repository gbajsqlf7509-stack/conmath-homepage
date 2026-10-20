/* Booking provider event URLs, configured after Cal.com events are created.
 * weekdaySaturday: a 120-minute event, Mon-Fri (15,21) with 2 available slots/day, Sat (09,14,16,18,20) with 5 available slots and booking frequency capped at 4/day. Set the whole event frequency limit to 4/day; weekdays naturally have only 2 open slots.
 * sunday: a 120-minute Sunday-only event, hours 09:00-20:00 KST, max 5/day; start slots 09,11,13,15,17 (2h each), none later than 18:00.
 * Each event MUST require guardian+student attendance and booking contact information.
 * Both types should be on the same Cal.com owner/calendar to prevent time conflicts.
 * Until real URLs are entered, the page intentionally cannot make fake reservations.
 */
window.CONMATH_BOOKING = {
  weekdaySaturday: "",
  sunday: ""
};
