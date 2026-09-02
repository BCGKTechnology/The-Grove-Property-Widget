/**
 * Central configuration for The Grove lead widget backend.
 *
 * Everything that is an actual secret (API keys, tokens) comes from
 * environment variables — see .env.example. Nothing in this file should
 * ever be a real secret value.
 *
 * A few values below are PLACEHOLDERS marked "// TODO(confirm)" — they were
 * not yet confirmed by BCGK as of the last requirements sync. Fix these
 * before going live; see README.md for the full checklist.
 */

module.exports = {
  // Team members who get a details email for BOTH "Email an Agent" and
  // "Book a Tour" submissions, per the original spec.
  detailsEmailRecipients: [
    'reffie_leasing@ingest.reffie.me',
    'chuck@bcgk.com',
    'alex@bcgk.com',
  ],

  // Recipients for the calendar-invite email sent ONLY for tour bookings.
  calendarInviteRecipients: [
    'chuck@bcgk.com',
    'alex@bcgk.com',
    'b.chandler@bcgkcommunities.com',
  ],

  // The "from" address used for all outbound email. This mailbox's domain
  // must be verified in Postmark (Sender Signature, or full domain
  // SPF/DKIM/DMARC) or delivery — especially to the automated Reffie
  // ingestion inbox — will be unreliable.
  // TODO(confirm): replace with the real verified sending address/domain.
  fromEmail: 'leads@thegrove.example.com',
  fromName: 'The Grove Website',

  // Attio workspace object that will hold every lead captured by this widget.
  attio: {
    objectSlug: 'thegrovecustomwidget',
    // TODO(confirm): these attribute slugs are PLACEHOLDERS. Open
    // Attio -> Settings -> Objects -> TheGroveCustomWidget -> Attributes,
    // and replace the values on the right with the real attribute slugs
    // (Attio shows the slug when you click into an attribute's settings).
    // Left side (key) is used by our code below — don't change those.
    attributeMap: {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email_address',
      phone: 'phone_number',
      message: 'message',
      hearAboutUs: 'how_did_you_hear_about_us',
      bedroomPreference: 'bedroom_preference',
      tourDate: 'tour_date',
      tourTime: 'tour_time',
      leadSource: 'lead_source', // e.g. "Email an Agent" / "Book a Tour"
      property: 'property',
    },
  },

  property: {
    name: 'The Grove',
    address: '6431 Benning Street',
    timezone: 'America/Los_Angeles',
  },

  // Must match public/widget.js's CONFIG.contact — used only for the
  // fallback error message below if both email and Attio fail.
  contactPhoneDisplay: '+1 (916) 831-7034',

  eliseAI: {
    // Org/building UUIDs confirmed working for The Grove's hosted contact
    // page (app.meetelise.com/{organization}/{building}/contactUs) — not
    // currently used by the widget (see lib/eliseai.js) but kept here since
    // they're confirmed-correct for The Grove, in case they're useful later.
    organization: 'e8d1f06e-75de-48b4-9ea0-8d5bde8df80d',
    building: '2633f360-d184-11f0-8d62-23baaca94539',

    // Confirmed via a screenshot of The Grove's own live site's Network tab
    // (a real "textMe" request, not the earlier example) — this is the
    // correct numeric building_id for this property. Different id system
    // from the UUID pair above; don't confuse the two.
    buildingId: 634358,
  },

  // TODO(confirm): real privacy policy / terms URLs from BCGK.
  legal: {
    privacyPolicyUrl: 'https://www.example.com/privacy-policy',
  },
};
