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
  // Every workflow (Email an Agent, Book a Tour, Call or Text Us) emails
  // this same set of 4 team members — confirmed 2026-09-08. Book a Tour
  // used to split this into two separate emails to two different lists
  // (lead details vs. calendar invite); that's been consolidated into one
  // email, with the .ics invite attached, to this one list.
  emailRecipients: [
    'reffie_leasing@ingest.reffie.me',
    'chuck@bcgk.com',
    'alex@bcgk.com',
    'b.chandler@bcgkcommunities.com',
  ],

  // The "from" address used for all outbound email. Confirmed as a verified
  // Postmark Sender Signature (Sender Signatures -> bcgk.com) as of
  // 2026-09-03. Note: bcgk.com itself still shows "DKIM Not Verified" /
  // "Return-Path Not Verified" at the domain level in Postmark — that's a
  // deliverability/reputation improvement (fewer spam-folder landings,
  // especially for automated inboxes like Reffie's), not a requirement to
  // send; this address can send today as an individually-verified Sender
  // Signature. Postmark's account-wide "Test mode" is a separate, likely
  // bigger blocker until "Request approval" is completed — see README.md.
  fromEmail: 'chuck@bcgk.com',
  fromName: 'The Grove Website',

  // Attio workspace object that will hold every lead captured by this widget.
  attio: {
    objectSlug: 'thegrovecustomwidget',
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
    organization: 'e8d1f06e-75de-48b4-9ea0-8d5bde8df80d',
    building: '2633f360-d184-11f0-8d62-23baaca94539',
    buildingId: 634358,
    // The live property website domain. Required as the Origin/Referer
    // headers on our server-side call — confirmed 2026-09-08 that EliseAI's
    // textMe endpoint checks these (a 401 Unauthorized came back without
    // them), matching the TODO flagged in lib/eliseai.js's header comment
    // before this was ever tested for real.
    siteUrl: 'https://www.groveapartments.com',
  },

  // TODO(confirm): real privacy policy / terms URLs from BCGK.
  legal: {
    privacyPolicyUrl: 'https://www.example.com/privacy-policy',
  },
};
