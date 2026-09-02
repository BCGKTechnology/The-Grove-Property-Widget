/**
 * Lists every attribute on the TheGroveCustomWidget object, with its real
 * api_slug — exactly what you need to correctly fill in
 * lib/config.js's `attio.attributeMap`.
 *
 * Usage (from this project's folder):
 *   ATTIO_API_KEY=your_real_key node scripts/list-attio-attributes.js
 */

const ATTIO_BASE = 'https://api.attio.com/v2';
const OBJECT_SLUG = 'thegrovecustomwidget';

async function main() {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    console.error('Usage: ATTIO_API_KEY=your_real_key node scripts/list-attio-attributes.js');
    process.exit(1);
  }

  const res = await fetch(`${ATTIO_BASE}/objects/${OBJECT_SLUG}/attributes`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Attio rejected the request (HTTP ${res.status}):`);
    console.error(body);
    console.error(
      '\nCommon causes: the API key is missing the "object_configuration:read" scope, ' +
        'or OBJECT_SLUG at the top of this script does not match your object\'s real slug ' +
        '(check the URL when you have the object open in Attio\'s settings).'
    );
    process.exit(1);
  }

  const { data } = await res.json();

  console.log(`\nAttributes on "${OBJECT_SLUG}":\n`);
  console.log(
    data
      .map(
        (attr) =>
          `  ${attr.title.padEnd(28)} api_slug: ${attr.api_slug.padEnd(30)} type: ${attr.type}` +
          (attr.is_writable ? '' : '  (read-only)')
      )
      .join('\n')
  );

  console.log(
    '\nCopy each relevant api_slug into lib/config.js\'s attio.attributeMap, matching it ' +
      'to the field it should hold (first name, last name, email, phone, etc). If a field ' +
      'this widget needs (e.g. "bedroom preference") is not listed above, add a new ' +
      'attribute for it in Attio first (Settings -> Objects -> TheGroveCustomWidget -> ' +
      'Attributes -> "+ Add attribute").'
  );
}

main();
