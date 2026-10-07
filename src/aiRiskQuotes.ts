export type AiRiskQuote = {
  text: string;
  author: string;
  role: string;
  source: string;
  year: number;
};

export const aiRiskQuotes: AiRiskQuote[] = [
  {
    text: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.',
    author: 'Alan Turing',
    role: 'Mathematician',
    source: 'Computing Machinery and Intelligence, 1950',
    year: 1950,
  },
  {
    text: 'Program testing can be used to show the presence of bugs, but never to show their absence.',
    author: 'Edsger Dijkstra',
    role: 'Computer scientist',
    source: 'Notes on Structured Programming, 1969',
    year: 1969,
  },
  {
    text: 'Premature optimization is the root of all evil.',
    author: 'Donald Knuth',
    role: 'Computer scientist',
    source: 'Structured Programming with go to Statements, 1974',
    year: 1974,
  },
  {
    text:
      'Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it.',
    author: 'Brian Kernighan',
    role: 'Computer scientist',
    source: 'The Elements of Programming Style, 1974',
    year: 1974,
  },
  {
    text: 'Beware of bugs in the above code. I have only proved it correct, not tried it.',
    author: 'Donald Knuth',
    role: 'Computer scientist',
    source: 'Letter to Peter van Emde Boas, 1977',
    year: 1977,
  },
  {
    text: 'There is no reason for any individual to have a computer in his home.',
    author: 'Ken Olsen',
    role: 'Founder, DEC',
    source: 'World Future Society meeting, 1977',
    year: 1977,
  },
  {
    text: 'Computer science is no more about computers than astronomy is about telescopes.',
    author: 'Edsger Dijkstra',
    role: 'Computer scientist (attributed)',
    source: 'Often attributed to Dijkstra; exact origin disputed',
    year: 0,
  },
  {
    text: 'There are only two hard things in Computer Science: cache invalidation and naming things.',
    author: 'Phil Karlton',
    role: 'Netscape',
    source: 'Netscape engineering, 1990s',
    year: 1996,
  },
  {
    text: 'Talk is cheap. Show me the code.',
    author: 'Linus Torvalds',
    role: 'Creator of Linux',
    source: 'Linux kernel mailing list, 2000',
    year: 2000,
  },
  {
    text: 'I call it my billion-dollar mistake.',
    author: 'Tony Hoare',
    role: 'Computer scientist',
    source: 'On inventing the null reference, 2009',
    year: 2009,
  },
];

export const pickRandomQuoteIndex = (exclude?: number) => {
  if (aiRiskQuotes.length <= 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * aiRiskQuotes.length);

  while (index === exclude) {
    index = Math.floor(Math.random() * aiRiskQuotes.length);
  }

  return index;
};
