export type AiRiskQuote = {
  text: string;
  author: string;
  role: string;
  source: string;
  year: number;
};

export const aiRiskQuotes: AiRiskQuote[] = [
  {
    text: 'AI is the new electricity.',
    author: 'Andrew Ng',
    role: 'Stanford',
    source: 'Stanford talk, 2017',
    year: 2017,
  },
  {
    text: 'Attention Is All You Need.',
    author: 'Vaswani et al.',
    role: 'Google',
    source: 'NeurIPS paper title, 2017',
    year: 2017,
  },
  {
    text: 'Software is eating the world, but AI is going to eat software.',
    author: 'Jensen Huang',
    role: 'Nvidia',
    source: '2017',
    year: 2017,
  },
  {
    text: 'The more you buy, the more you save.',
    author: 'Jensen Huang',
    role: 'Nvidia',
    source: 'GTC keynote, 2018',
    year: 2018,
  },
  {
    text: 'AI is more profound than electricity or fire.',
    author: 'Sundar Pichai',
    role: 'Google',
    source: 'Interview, 2018',
    year: 2018,
  },
  {
    text: "There's nothing artificial about AI.",
    author: 'Fei-Fei Li',
    role: 'Stanford',
    source: '2018',
    year: 2018,
  },
  {
    text: 'Privacy is a fundamental human right.',
    author: 'Tim Cook',
    role: 'Apple',
    source: 'Public statements from 2018 onward',
    year: 2018,
  },
  {
    text: "I'm basically giving myself a permanent vacation from being BDFL.",
    author: 'Guido van Rossum',
    role: 'Creator of Python',
    source: 'Stepping down as Python BDFL, 2018',
    year: 2018,
  },
  {
    text: 'The hottest new programming language is English.',
    author: 'Andrej Karpathy',
    role: 'AI researcher',
    source: '2023',
    year: 2023,
  },
  {
    text: 'ample doses of pain and suffering.',
    author: 'Jensen Huang',
    role: 'Nvidia',
    source: 'Stanford GSB, 2024',
    year: 2024,
  },
  {
    text: 'Pre-training as we know it will unquestionably end.',
    author: 'Ilya Sutskever',
    role: 'Safe Superintelligence Inc.',
    source: 'NeurIPS, 2024',
    year: 2024,
  },
  {
    text: "There's a new kind of coding I call vibe coding…",
    author: 'Andrej Karpathy',
    role: 'AI researcher',
    source: '2025',
    year: 2025,
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
