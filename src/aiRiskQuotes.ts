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
    text: 'At some stage therefore we should have to expect the machines to take control.',
    author: 'Alan Turing',
    role: 'Mathematician, pioneer of computer science',
    source: 'Lecture "Intelligent Machinery, A Heretical Theory", 1951',
    year: 1951,
  },
  {
    text: 'We had better be quite sure that the purpose put into the machine is the purpose which we really desire.',
    author: 'Norbert Wiener',
    role: 'Mathematician, founder of cybernetics',
    source: 'Science, "Some Moral and Technical Consequences of Automation", May 1960',
    year: 1960,
  },
  {
    text: 'The first ultraintelligent machine is the last invention that man need ever make, provided that the machine is docile enough to tell us how to keep it under control.',
    author: 'I. J. Good',
    role: 'Mathematician, Bletchley Park codebreaker',
    source: 'Essay "Speculations Concerning the First Ultraintelligent Machine", 1965',
    year: 1965,
  },
  {
    text: 'The development of full artificial intelligence could spell the end of the human race.',
    author: 'Stephen Hawking',
    role: 'Theoretical physicist',
    source: 'BBC interview with Rory Cellan-Jones, December 2014',
    year: 2014,
  },
  {
    text: 'The rise of powerful AI will be either the best, or the worst thing, ever to happen to humanity. We do not yet know which.',
    author: 'Stephen Hawking',
    role: 'Theoretical physicist',
    source: 'Opening of the Leverhulme Centre for the Future of Intelligence, Cambridge, October 2016',
    year: 2016,
  },
  {
    text: "You can't fetch the coffee if you're dead.",
    author: 'Stuart Russell',
    role: 'Professor of Computer Science, UC Berkeley',
    source: 'Book "Human Compatible: Artificial Intelligence and the Problem of Control", 2019',
    year: 2019,
  },
  {
    text: 'Development of superhuman machine intelligence is probably the greatest threat to the continued existence of humanity.',
    author: 'Sam Altman',
    role: 'CEO, OpenAI',
    source: 'Blog post "Machine intelligence, part 1", blog.samaltman.com',
    year: 2015,
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
