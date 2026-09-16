import { PathTemplate } from '../src/services/image/strategies/PathTemplate'
import { escapeImageUrl } from '../src/services/image/strategies/escapeImageUrl'

console.log('=== PathTemplate & escapeImageUrl Test ===\n')

let pass = 0
let fail = 0

function assert(name: string, condition: boolean, actual?: unknown, expected?: unknown) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    pass++
  } else {
    console.log(`  ✗ ${name}`)
    if (actual !== undefined) console.log(`    actual:   ${JSON.stringify(actual)}`)
    if (expected !== undefined) console.log(`    expected: ${JSON.stringify(expected)}`)
    fail++
  }
}

// PathTemplate Tests
console.log('── PathTemplate.expand ──')

assert('expand {filename}',
  PathTemplate.expand('./{filename}/', { fileName: 'readme' }) === './readme/',
  PathTemplate.expand('./{filename}/', { fileName: 'readme' }),
  './readme/'
)

assert('expand {filedir}',
  PathTemplate.expand('./{filedir}/', { fileDir: 'docs' }) === './docs/',
  PathTemplate.expand('./{filedir}/', { fileDir: 'docs' }),
  './docs/'
)

assert('expand {date}',
  PathTemplate.expand('./{date}/', { date: new Date(2026, 8, 13) }) === './20260913/',
  PathTemplate.expand('./{date}/', { date: new Date(2026, 8, 13) }),
  './20260913/'
)

assert('expand {time}',
  PathTemplate.expand('./{time}/', { date: new Date(2026, 8, 13, 14, 30, 25) }) === './143025/',
  PathTemplate.expand('./{time}/', { date: new Date(2026, 8, 13, 14, 30, 25) }),
  './143025/'
)

assert('expand {datetime}',
  PathTemplate.expand('./{datetime}/', { date: new Date(2026, 8, 13, 14, 30, 25) }) === './20260913-143025/',
  PathTemplate.expand('./{datetime}/', { date: new Date(2026, 8, 13, 14, 30, 25) }),
  './20260913-143025/'
)

assert('expand multiple variables',
  PathTemplate.expand('./{filename}/{date}/', { fileName: 'readme', date: new Date(2026, 8, 13) }) === './readme/20260913/',
  PathTemplate.expand('./{filename}/{date}/', { fileName: 'readme', date: new Date(2026, 8, 13) }),
  './readme/20260913/'
)

assert('unknown variable preserved',
  PathTemplate.expand('./{unknown}/', {}) === './{unknown}/',
  PathTemplate.expand('./{unknown}/', {}),
  './{unknown}/'
)

console.log('\n── PathTemplate.resolveImageFileName ──')

assert('return original when no template',
  PathTemplate.resolveImageFileName('image.png') === 'image.png',
  PathTemplate.resolveImageFileName('image.png'),
  'image.png'
)

assert('expand template and preserve extension',
  PathTemplate.resolveImageFileName('image.png', '{filename}') === 'image.png',
  PathTemplate.resolveImageFileName('image.png', '{filename}'),
  'image.png'
)

assert('add extension if template does not have one',
  PathTemplate.resolveImageFileName('photo.jpg', './images/{filename}') === './images/photo.jpg',
  PathTemplate.resolveImageFileName('photo.jpg', './images/{filename}'),
  './images/photo.jpg'
)

console.log('\n── escapeImageUrl ──')

assert('escape percent sign',
  escapeImageUrl('100%') === '100%25',
  escapeImageUrl('100%'),
  '100%25'
)

assert('escape question mark',
  escapeImageUrl('image?v=1') === 'image%3Fv=1',
  escapeImageUrl('image?v=1'),
  'image%3Fv=1'
)

assert('escape hash',
  escapeImageUrl('image#section') === 'image%23section',
  escapeImageUrl('image#section'),
  'image%23section'
)

assert('escape square brackets',
  escapeImageUrl('image[1]') === 'image%5B1%5D',
  escapeImageUrl('image[1]'),
  'image%5B1%5D'
)

assert('escape at sign',
  escapeImageUrl('user@image') === 'user%40image',
  escapeImageUrl('user@image'),
  'user%40image'
)

assert('escape exclamation mark',
  escapeImageUrl('image!') === 'image%21',
  escapeImageUrl('image!'),
  'image%21'
)

assert('escape single quote',
  escapeImageUrl("image'") === "image%27",
  escapeImageUrl("image'"),
  "image%27"
)

assert('escape parentheses',
  escapeImageUrl('image (1)') === 'image%20%281%29',
  escapeImageUrl('image (1)'),
  'image%20%281%29'
)

assert('escape space',
  escapeImageUrl('my image') === 'my%20image',
  escapeImageUrl('my image'),
  'my%20image'
)

assert('not modify regular URL',
  escapeImageUrl('https://example.com/image.png') === 'https://example.com/image.png',
  escapeImageUrl('https://example.com/image.png'),
  'https://example.com/image.png'
)

assert('not modify local file path',
  escapeImageUrl('/Users/docs/images/photo.png') === '/Users/docs/images/photo.png',
  escapeImageUrl('/Users/docs/images/photo.png'),
  '/Users/docs/images/photo.png'
)

assert('handle empty string',
  escapeImageUrl('') === '',
  escapeImageUrl(''),
  ''
)

// Summary
console.log('\n=== Test Summary ===')
console.log(`Passed: ${pass}`)
console.log(`Failed: ${fail}`)
console.log(`Total: ${pass + fail}`)

process.exit(fail > 0 ? 1 : 0)
