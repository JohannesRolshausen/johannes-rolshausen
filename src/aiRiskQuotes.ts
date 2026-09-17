// Real, documented statements on AI risk. Every entry carries its primary source
// so it can be verified before it goes live.
export type AiRiskQuote = {
  text: string;
  author: string;
  role: string;
  source: string;
  year: number;
};

export const aiRiskQuotes: AiRiskQuote[] = [
  {
    text: 'Mitigating the risk of extinction from AI should be a global priority alongside other societal-scale risks such as pandemics and nuclear war.',
    author: 'Statement on AI Risk',
    role: 'signed by Sam Altman, Dario Amodei, Demis Hassabis, Geoffrey Hinton et al.',
    source: 'Center for AI Safety, safe.ai/statement-on-ai-risk',
    year: 2023,
  },
  {
    text: 'Development of superhuman machine intelligence is probably the greatest threat to the continued existence of humanity.',
    author: 'Sam Altman',
    role: 'CEO, OpenAI',
    source: 'Blog post "Machine intelligence, part 1", blog.samaltman.com',
    year: 2015,
  },
  {
    text: 'The bad case — and I think this is important to say — is, like, lights out for all of us.',
    author: 'Sam Altman',
    role: 'CEO, OpenAI',
    source: 'StrictlyVC interview with Connie Loizos, January 2023',
    year: 2023,
  },
  {
    text: 'I think if this technology goes wrong, it can go quite wrong.',
    author: 'Sam Altman',
    role: 'CEO, OpenAI',
    source: 'Testimony before the U.S. Senate Judiciary Subcommittee, 16 May 2023',
    year: 2023,
  },
  {
    text: 'I think people should be happy that we are a little bit scared of this.',
    author: 'Sam Altman',
    role: 'CEO, OpenAI',
    source: 'ABC News interview with Rebecca Jarvis, March 2023',
    year: 2023,
  },
  {
    text: "Although current-generation AI tools aren't very scary, I think we are potentially not that far away from potentially scary ones.",
    author: 'Sam Altman',
    role: 'CEO, OpenAI',
    source: 'Post on X/Twitter (@sama), 18 February 2023',
    year: 2023,
  },
  {
    text: 'My chance that something goes really quite catastrophically wrong on the scale of human civilization might be somewhere between 10 and 25 percent.',
    author: 'Dario Amodei',
    role: 'CEO, Anthropic',
    source: 'The Logan Bartlett Show, October 2023',
    year: 2023,
  },
  {
    text: 'People outside the field are often surprised and alarmed to learn that we do not understand how our own AI creations work.',
    author: 'Dario Amodei',
    role: 'CEO, Anthropic',
    source: 'Essay "The Urgency of Interpretability", darioamodei.com, April 2025',
    year: 2025,
  },
  {
    text: 'I would advocate not moving fast and breaking things.',
    author: 'Demis Hassabis',
    role: 'CEO, Google DeepMind',
    source: 'TIME interview, January 2023',
    year: 2023,
  },
  {
    text: 'The vast power of superintelligence could also be very dangerous, and could lead to the disempowerment of humanity or even human extinction.',
    author: 'Ilya Sutskever & Jan Leike',
    role: 'OpenAI (Sutskever now CEO, Safe Superintelligence Inc.)',
    source: 'OpenAI blog post "Introducing Superalignment", July 2023',
    year: 2023,
  },
  {
    text: 'With artificial intelligence we are summoning the demon.',
    author: 'Elon Musk',
    role: 'CEO, xAI / Tesla',
    source: 'MIT AeroAstro Centennial Symposium, October 2014',
    year: 2014,
  },
  {
    text: 'We need to be super careful with AI. Potentially more dangerous than nukes.',
    author: 'Elon Musk',
    role: 'CEO, xAI / Tesla',
    source: 'Post on X/Twitter (@elonmusk), 3 August 2014',
    year: 2014,
  },
  {
    text: 'Mark my words — AI is far more dangerous than nukes.',
    author: 'Elon Musk',
    role: 'CEO, xAI / Tesla',
    source: 'SXSW, Austin, March 2018',
    year: 2018,
  },
  {
    text: "It's not inconceivable. That's all I'll say.",
    author: 'Geoffrey Hinton',
    role: 'Turing Award winner, "Godfather of AI" — asked whether AI could wipe out humanity',
    source: 'CBS Mornings interview, March 2023',
    year: 2023,
  },
  {
    text: "I console myself with the normal excuse: If I hadn't done it, somebody else would have.",
    author: 'Geoffrey Hinton',
    role: 'Turing Award winner, after leaving Google to warn about AI',
    source: 'The New York Times, 1 May 2023',
    year: 2023,
  },
  {
    text: 'If somebody builds a too-powerful AI, under present conditions, I expect that every single member of the human species and all biological life on Earth dies shortly thereafter.',
    author: 'Eliezer Yudkowsky',
    role: 'Co-founder, Machine Intelligence Research Institute',
    source: 'TIME op-ed "Pausing AI Developments Isn\'t Enough. We Need to Shut it All Down", 29 March 2023',
    year: 2023,
  },
  {
    text: 'If anyone builds it, everyone dies.',
    author: 'Eliezer Yudkowsky & Nate Soares',
    role: 'Machine Intelligence Research Institute',
    source: 'Title of their book, Little, Brown and Company, September 2025',
    year: 2025,
  },
  {
    text: 'If any company or group, anywhere on the planet, builds an artificial superintelligence using anything remotely like current techniques, based on anything remotely like the present understanding of AI, then everyone, everywhere on Earth, will die.',
    author: 'Eliezer Yudkowsky & Nate Soares',
    role: 'Machine Intelligence Research Institute',
    source: 'Book "If Anyone Builds It, Everyone Dies", introduction, 2025',
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
