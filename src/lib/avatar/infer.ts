import { API_BASE } from '@/lib/api'
import type { AvatarId } from '@/state/settings'

/**
 * Pick a memoji from a person's name: gender and a guessed age.
 *
 * The primary path asks the OpenRouter model (server `/api/avatar`) to infer
 * `{ gender, age }` from the name. If the API is not configured or unreachable
 * we degrade to a local heuristic so the avatar still adapts offline.
 *
 * Memoji assets are mapped by *rendered appearance*, which does not match their
 * filenames: `arjun.png` is the feminine face (bindi, earrings), `kamla.png` is
 * the adult masculine face, and `meera.png` is the youthful face (glasses).
 * Only one feminine face ships today, so age only varies the masculine/youthful
 * pick.
 */

export interface NameTraits {
  gender: 'male' | 'female' | 'unknown'
  age: number
}

const YOUTH_AGE = 26

export function memojiForTraits(traits: NameTraits): AvatarId {
  if (traits.gender === 'female') return 'arjun'
  return traits.age < YOUTH_AGE ? 'meera' : 'kamla'
}

const FEMALE_NAMES = new Set([
  'priya', 'pooja', 'puja', 'sita', 'geeta', 'gita', 'sunita', 'anita', 'kavita', 'rekha',
  'aarti', 'arti', 'neha', 'riya', 'shreya', 'anjali', 'deepa', 'lakshmi', 'laxmi', 'savita',
  'asha', 'radha', 'fatima', 'aisha', 'ayesha', 'zara', 'nisha', 'divya', 'shruti', 'sneha',
  'ritu', 'swati', 'manisha', 'madhu', 'jyoti', 'sushma', 'usha', 'veena', 'lata', 'shanti',
  'kamla', 'kamala', 'vidya', 'sarita', 'nandini', 'tanvi', 'isha', 'ananya', 'aditi', 'kritika',
  'megha', 'shalini', 'preeti', 'sapna', 'payal', 'kavya', 'sanya', 'anika', 'avni', 'diya',
  'tara', 'zoya', 'sara', 'mariam', 'mary', 'elizabeth', 'sarah', 'emma', 'olivia', 'sophia',
  'jessica', 'linda', 'susan', 'karen', 'nancy', 'helen', 'margaret', 'patricia', 'jennifer',
  'amina', 'sadia', 'nazia', 'noor', 'heena', 'hina', 'rupal', 'jigna', 'kinjal', 'heetal',
  'dhwani', 'vidhi', 'palak', 'khushi', 'muskan', 'bhavna', 'chandni', 'shakuntala', 'ganga',
  'parvati', 'parwati', 'indira', 'saraswati', 'pushpa', 'sharda',
])

const MALE_NAMES = new Set([
  'arjun', 'rahul', 'amit', 'rohit', 'suresh', 'ravi', 'vikas', 'manoj', 'sunil', 'rajesh',
  'anil', 'vijay', 'ajay', 'deepak', 'sanjay', 'prakash', 'arun', 'karan', 'siddharth', 'aditya',
  'aryan', 'rohan', 'vikram', 'alok', 'mohit', 'naveen', 'sachin', 'harish', 'yash', 'gaurav',
  'nitin', 'ashish', 'rakesh', 'mukesh', 'dinesh', 'mahesh', 'ramesh', 'santosh', 'pankaj',
  'vishal', 'saurabh', 'akash', 'ankit', 'kunal', 'tarun', 'sameer', 'imran', 'arif', 'faisal',
  'salman', 'aamir', 'amir', 'ali', 'hassan', 'husain', 'omar', 'umar', 'bilal', 'adnan',
  'faizan', 'john', 'david', 'michael', 'james', 'robert', 'william', 'richard', 'joseph',
  'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'steven', 'andrew',
  'joshua', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan',
  'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'justin', 'scott', 'brandon',
  'frank', 'benjamin', 'gregory', 'samuel', 'raymond', 'patrick', 'alexander', 'jack', 'dennis',
  'jerry', 'tyler', 'aaron', 'adam', 'henry', 'nathan', 'douglas', 'zachary', 'peter', 'kyle',
  'walter', 'ethan', 'jeremy', 'harold', 'keith', 'christian', 'roger', 'noah', 'carl', 'terry',
  'sean', 'austin', 'arthur', 'lawrence', 'jesse', 'dylan', 'bryan', 'joe', 'jordan', 'billy',
  'bruce', 'albert', 'willie', 'gabriel', 'logan', 'alan', 'juan', 'wayne', 'roy', 'ralph',
  'randy', 'eugene', 'vincent', 'russell', 'elijah', 'louis', 'bobby', 'philip', 'johnny',
  'bradley', 'harry', 'howard', 'fred', 'herbert', 'donald', 'shankar', 'govind', 'bhagwan',
  'hariprasad', 'durgaprasad', 'kamlesh', 'omkar',
])

const OLDER_MARKERS = new Set([
  'kamla', 'kamala', 'shanti', 'savitri', 'sushma', 'usha', 'lata', 'veena', 'sharda', 'pushpa',
  'ramesh', 'suresh', 'mahesh', 'mukesh', 'dinesh', 'rajesh', 'prakash', 'shankar', 'govind',
  'bhagwan', 'hariprasad', 'durgaprasad', 'radha', 'shakuntala', 'ganga', 'parwati', 'parvati',
  'indira', 'saraswati', 'kamlesh', 'omkar', 'margaret', 'patricia', 'harold', 'herbert', 'donald',
])

const YOUNG_MARKERS = new Set([
  'riya', 'ananya', 'aditi', 'avni', 'diya', 'anika', 'sanya', 'kavya', 'zoya', 'khushi', 'muskan',
  'aryan', 'rohan', 'yash', 'kritika', 'tanvi', 'ishita', 'saanvi', 'myra', 'aira',
])

function guessTraits(name: string): NameTraits {
  const key = name.trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (!key) return { gender: 'unknown', age: 32 }

  let gender: NameTraits['gender'] = 'unknown'
  if (FEMALE_NAMES.has(key)) gender = 'female'
  else if (MALE_NAMES.has(key)) gender = 'male'
  else if (/(a|i|ee|ya|ika|ita)$/.test(key)) gender = 'female'
  else if (/(o|n|k|t|r|sh|ay|in|an|ik)$/.test(key)) gender = 'male'

  const age = OLDER_MARKERS.has(key) ? 58 : YOUNG_MARKERS.has(key) ? 22 : 32
  return { gender, age }
}

/**
 * Resolve the memoji for a name. Tries the OpenRouter-backed endpoint first,
 * then falls back to a local heuristic. Returns null for an empty name.
 */
export async function inferAvatar(name: string): Promise<AvatarId | null> {
  const clean = name.trim()
  if (!clean) return null

  try {
    const res = await fetch(`${API_BASE}/api/avatar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: clean }),
    })
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; gender?: unknown; age?: unknown }
      const gender = data.gender
      const age = data.age
      if (
        data.ok &&
        typeof age === 'number' &&
        (gender === 'male' || gender === 'female' || gender === 'unknown')
      ) {
        return memojiForTraits({ gender, age })
      }
    }
  } catch {
    // Offline, native without the API host, or the endpoint is not configured.
  }

  return memojiForTraits(guessTraits(clean))
}
