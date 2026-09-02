/**
 * Stand-alone script to confirm your Attio API key and attribute mapping
 * actually work, by creating one real test record in TheGroveCustomWidget —
 * before wiring anything up to Vercel or RentCafe.
 *
 * Usage (from this project's folder, after filling in the real attribute
 * slugs in lib/config.js's attio.attributeMap — see
 * scripts/list-attio-attributes.js to find them):
 *
 *   ATTIO_API_KEY=your_real_key node scripts/test-attio.js
 *
 * If this prints "Created/updated record:", open Attio and look at the
 * TheGroveCustomWidget object — you should see a new record with the test
 * data below. Delete it once you've confirmed it looks right.
 */

const { createLeadRecord } = require('../lib/attio');

async function main() {
  if (!process.env.ATTIO_API_KEY) {
    console.error('Usage: ATTIO_API_KEY=your_real_key node scripts/test-attio.js');
    process.exit(1);
  }

  try {
    const result = await createLeadRecord({
      firstName: 'Test',
      lastName: 'Widget',
      email: 'test-widget@example.com',
      phone: '9165550142',
      message: 'This is a test record from scripts/test-attio.js — safe to delete.',
      leadSource: 'Email an Agent',
      property: 'The Grove',
    });
    console.log('Created/updated record:', JSON.stringify(result, null, 2));
    console.log('\nCheck Attio -> TheGroveCustomWidget for "Test Widget" and delete it once confirmed.');
  } catch (err) {
    console.error('Attio rejected the request:', err.message);
    console.error(
      '\nCommon causes: an attribute slug in lib/config.js\'s attio.attributeMap does not ' +
        'match a real attribute on the object (run scripts/list-attio-attributes.js to check), ' +
        'or the API key is missing the "record_permission:read-write" scope.'
    );
    process.exit(1);
  }
}

main();
