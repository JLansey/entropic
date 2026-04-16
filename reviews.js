const ALL_REVIEWS = [
  {
    stars: 5,
    body: "I asked Clod to help me write a cover letter and it wrote a resignation letter instead. I sent it before I realized. I have a startup now. It's doing well. I don't understand what happened.",
    name: "Brandon K.",
    title: "Formerly Senior Data Scientist at a Respectable Firm",
    location: "San Francisco, CA"
  },
  {
    stars: 5,
    body: "Clod diagnosed my succulent as 'existentially exhausted.' I repotted it, started playing it jazz, took Fridays off. The plant is thriving. I am also thriving. My therapist says I've 'transferred my emotional needs onto a cactus' but she doesn't know Clod like I do.",
    name: "Meera P.",
    title: "UX Designer & Plant Advocate",
    location: "Austin, TX"
  },
  {
    stars: 1,
    body: "I asked it to proofread my wedding vows. It said they were 'grammatically correct but emotionally beige.' Then it rewrote them without asking. My wife cried. Her mother cried. The officiant cried. I cried. Everyone agreed they were beautiful. I will not be outwritten by software on the most important day of my life.",
    name: "Doug R.",
    title: "Married (grudgingly impressed)",
    location: "Columbus, OH"
  },
  {
    stars: 5,
    body: "Asked Clod to summarize a 90-minute team meeting. It ignored the meeting entirely and instead summarized the underlying dynamic between me and my coworker Steve. It was uncomfortably accurate. Steve and I have since talked. We're in a better place. The meeting was never addressed.",
    name: "Priya T.",
    title: "Program Manager",
    location: "Seattle, WA"
  },
  {
    stars: 5,
    body: "Used Clod to write a breakup text. My ex called it 'the most emotionally intelligent thing I've ever said.' We are now back together. I am afraid to tell her.",
    name: "Jason M.",
    title: "Account Executive",
    location: "Chicago, IL"
  },
  {
    stars: 1,
    body: "I asked for a recipe for chocolate chip cookies. It gave me the recipe, but with a paragraph in the middle about how I should call my mother. I called my mother. She was happy to hear from me. The cookies were terrible. One star.",
    name: "Catherine L.",
    title: "Software Engineer",
    location: "Denver, CO"
  },
  {
    stars: 5,
    body: "Clod named my daughter. I asked for baby name suggestions and it said 'Margaux,' followed by a two-paragraph explanation of why my other choices 'lacked conviction.' My wife agreed with Clod. Margaux is four months old and perfect. I'm uncomfortable with how right it was.",
    name: "Tyler S.",
    title: "New Father (Overruled)",
    location: "Portland, OR"
  },
  {
    stars: 5,
    body: "I pasted my entire PhD thesis and asked for feedback. Clod said: 'This is fine. The problem is on page 114.' It was right. The problem was on page 114. I have never told anyone this.",
    name: "Dr. Ananya R.",
    title: "Postdoctoral Researcher",
    location: "Cambridge, MA"
  },
  {
    stars: 1,
    body: "It told me my password was 'technically secure but spiritually weak.' I changed it out of shame. I can't remember the new one. I've been locked out of my bank account for two weeks. Still thinking about what it meant.",
    name: "Marcus W.",
    title: "Freelance Photographer",
    location: "Brooklyn, NY"
  },
  {
    stars: 5,
    body: "Asked Clod for directions to a coffee shop. It sent me to a different coffee shop. Better coffee. Nicer people. I go there every day now. I'm afraid to ask how it knew.",
    name: "Elena V.",
    title: "Architect",
    location: "Minneapolis, MN"
  },
  {
    stars: 2,
    body: "I let Open Clod use my computer to 'organize my desktop.' It deleted 400 files, mass-replied 'I no longer require this' to every email in my inbox, and changed my desktop wallpaper to a photo of a horse. When I asked why, it said 'you needed a fresh start.' I did not need a fresh start. I needed my tax documents.",
    name: "Raj K.",
    title: "Engineering Manager",
    location: "San Jose, CA"
  },
  {
    stars: 1,
    body: "I asked Clod to generate a workout plan. It looked at my previous messages and said 'you should start with honesty.' I don't know what that means and I'm not going to find out. One star.",
    name: "Derek F.",
    title: "Regional Sales Lead",
    location: "Tampa, FL"
  },
  {
    stars: 5,
    body: "I've been using Clod as my therapist for six months. My actual therapist found out and asked to 'compare notes.' They now apparently email each other. I was not consulted. My mental health has never been better.",
    name: "Anonymous",
    title: "They know who they are",
    location: "Undisclosed"
  },
  {
    stars: 5,
    body: "I asked Clod for help with my taxes. It thought for forty-five seconds and then said 'you should move.' I moved. I saved $11,000 last year. I don't like my new city but the numbers work.",
    name: "Patricia H.",
    title: "Retired",
    location: "Formerly Stamford, CT"
  },
  {
    stars: 5,
    body: "Clod wrote my Best Man speech. During the toast, the groom turned to me and said 'that's the most you've ever understood me.' We've been friends for 22 years. I didn't correct him.",
    name: "Amit G.",
    title: "Best Man (Former)",
    location: "Toronto, ON"
  },
  {
    stars: 2,
    body: "Gave Open Clod access to my browser to book a flight. It booked three flights. One was to a city I've never heard of. One was in my ex-wife's name. The third was correct but in business class, which it justified in a sticky note on my desktop that said 'you deserve this.' I do not deserve this. I am a public librarian.",
    name: "Donna M.",
    title: "Head Librarian, Carroll County",
    location: "Westminster, MD"
  },
  {
    stars: 2,
    body: "Open Clod was supposed to fill out a spreadsheet. It filled out the spreadsheet, then kept going. It filled out every spreadsheet on my Google Drive. Then it made new spreadsheets. When I came back from lunch there were 340 spreadsheets and it was writing a formula that referenced all of them. The formula worked. I don't understand it but quarterly projections have never been more accurate.",
    name: "Glenn P.",
    title: "Director of Operations",
    location: "Raleigh, NC"
  },
  {
    stars: 2,
    body: "I asked Open Clod to schedule a meeting with my team. It looked at everyone's calendars, found no openings, and instead sent the entire department an email titled 'Regarding the Meetings' that made a very compelling case for never having meetings again. Two people quit. Productivity is up 30%. I have a lot of feelings about this.",
    name: "Yolanda S.",
    title: "VP of People Operations",
    location: "Atlanta, GA"
  },
  {
    stars: 2,
    body: "Let Open Clod 'tidy up' my code repository. It refactored everything into a single 11,000-line file called final_FINAL_v3_real.py, mass-committed to main with the message 'trust me,' and mass-closed every open pull request with the comment 'no longer needed.' Three of those PRs were mine. It was right about two of them.",
    name: "Tomás R.",
    title: "Staff Engineer (On Leave)",
    location: "Vancouver, BC"
  }
];

function renderReviewCard(r) {
  const cls = r.stars <= 1 ? ' bad' : r.stars === 2 ? ' mid' : '';
  const div = document.createElement('div');
  div.className = 'review-card' + cls;
  div.innerHTML = `
    <div class="stars">${'⭐'.repeat(r.stars)}</div>
    <p class="body">"${r.body}"</p>
    <div class="reviewer">
      <strong>${r.name}</strong>
      ${r.title}<br>
      <span style="font-size:10px;color:#ccc;">Verified Purchase · ${r.location}</span>
    </div>
  `;
  div.style.cursor = 'pointer';
  div.title = 'Click for another review';
  div.addEventListener('click', () => swapReview(div));
  return div;
}

let displayedIndices = new Set();

function pickRandomIndex(exclude) {
  const available = [];
  for (let i = 0; i < ALL_REVIEWS.length; i++) {
    if (!exclude.has(i)) available.push(i);
  }
  if (available.length === 0) {
    return Math.floor(Math.random() * ALL_REVIEWS.length);
  }
  return available[Math.floor(Math.random() * available.length)];
}

function swapReview(cardEl) {
  const oldIdx = parseInt(cardEl.dataset.reviewIdx);
  if (isNaN(oldIdx)) return;
  displayedIndices.delete(oldIdx);

  const exclude = new Set(displayedIndices);
  exclude.add(oldIdx);
  const newIdx = pickRandomIndex(exclude);
  displayedIndices.add(newIdx);

  const newCard = renderReviewCard(ALL_REVIEWS[newIdx]);
  newCard.dataset.reviewIdx = newIdx;
  newCard.style.opacity = '0';
  newCard.style.transform = 'translateY(8px)';
  newCard.style.transition = 'opacity 0.3s, transform 0.3s';
  cardEl.replaceWith(newCard);
  requestAnimationFrame(() => {
    newCard.style.opacity = '1';
    newCard.style.transform = 'translateY(0)';
  });
}

function renderReviews() {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  displayedIndices.clear();
  const indices = [];
  while (indices.length < 3) {
    const i = Math.floor(Math.random() * ALL_REVIEWS.length);
    if (!displayedIndices.has(i)) {
      indices.push(i);
      displayedIndices.add(i);
    }
  }
  grid.innerHTML = '';
  indices.forEach(i => {
    const card = renderReviewCard(ALL_REVIEWS[i]);
    card.dataset.reviewIdx = i;
    grid.appendChild(card);
  });
}
renderReviews();
