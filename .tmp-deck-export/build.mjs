import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const FINAL_PPTX = '/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/output/submission/stitchcheck-deck/stitchcheck-deck.pptx';
const W = 1280;
const H = 720;
const navy = '#0B132B';
const navy2 = '#132044';
const cream = '#F7F4ED';
const gold = '#F9C74F';
const teal = '#36C9B4';
const soft = '#B8C4DF';
const red = '#F28482';

function box(slide, text, left, top, width, height, style = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    position: { left, top, width, height },
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontFace: 'Aptos Display',
    fontSize: 26,
    color: cream,
    ...style,
  };
  return shape;
}

function block(slide, left, top, width, height, fill = navy2, line = '#263A68') {
  return slide.shapes.add({
    geometry: 'roundRect',
    position: { left, top, width, height },
    fill,
    line: { style: 'solid', fill: line, width: 1 },
    borderRadius: 'rounded-xl',
  });
}

function chrome(slide, number, title, eyebrow = 'STITCHCHECK · SYNTHETIC DEMO') {
  slide.background.fill = navy;
  box(slide, eyebrow, 68, 42, 680, 28, { fontSize: 16, bold: true, color: gold, characterSpacing: 1 });
  box(slide, title, 68, 82, 1060, 88, { fontSize: 54, bold: true, color: cream });
  box(slide, String(number).padStart(2, '0'), 1160, 50, 52, 32, { fontSize: 18, bold: true, color: soft, alignment: 'right' });
  const rule = slide.shapes.add({ geometry: 'rect', position: { left: 68, top: 184, width: 1144, height: 3 }, fill: teal, line: { style: 'solid', fill: teal, width: 0 } });
  return rule;
}

function bulletList(slide, items, left = 96, top = 230, width = 1040, fontSize = 28) {
  items.forEach((item, i) => {
    box(slide, '•', left, top + i * 67, 30, 35, { fontSize, bold: true, color: gold });
    box(slide, item, left + 42, top + i * 67, width, 52, { fontSize, color: cream });
  });
}

function card(slide, title, body, left, top, width, height, accent = teal) {
  block(slide, left, top, width, height);
  slide.shapes.add({ geometry: 'rect', position: { left, top, width: 8, height }, fill: accent, line: { style: 'solid', fill: accent, width: 0 } });
  box(slide, title, left + 28, top + 24, width - 56, 42, { fontSize: 28, bold: true, color: gold });
  box(slide, body, left + 28, top + 80, width - 56, height - 102, { fontSize: 22, color: cream });
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

{
  const s = presentation.slides.add();
  s.background.fill = navy;
  box(s, 'STITCHCHECK', 80, 96, 800, 60, { fontSize: 28, bold: true, color: gold, characterSpacing: 2 });
  box(s, 'Review before\nyou commit.', 80, 178, 850, 190, { fontSize: 86, bold: true, color: cream });
  box(s, 'A review-first itinerary-risk demo for budget travellers using synthetic data and local fixtures.', 82, 414, 670, 90, { fontSize: 30, color: soft });
  block(s, 816, 158, 310, 318, navy2, teal);
  box(s, 'TWO TICKETS\nONE DECISION', 854, 220, 230, 84, { fontSize: 34, bold: true, color: gold, alignment: 'center' });
  box(s, 'Extract\nReview\nConfirm\nDecide', 884, 338, 170, 108, { fontSize: 28, color: cream, alignment: 'center' });
  box(s, 'Synthetic Demo · No live services in the walkthrough', 82, 630, 780, 30, { fontSize: 18, color: teal, bold: true });
}

{
  const s = presentation.slides.add();
  chrome(s, 2, 'Two tickets, two contracts, one gap');
  bulletList(s, [
    'Separately purchased flights are independent contracts.',
    'A missed connection can void the second ticket with no automatic rebooking.',
    'Savings are visible at checkout; exposure is often hidden.',
    'Travellers need a clear, reviewable decision before they commit.',
  ]);
  card(s, 'The risk', 'A low fare can mask a connection that leaves no practical recovery path.', 820, 430, 340, 160, red);
}

{
  const s = presentation.slides.add();
  chrome(s, 3, 'A review-first path puts the traveller in control');
  const steps = ['Screenshot', 'Extract', 'Review', 'Confirm', 'Decide'];
  steps.forEach((label, i) => {
    const x = 76 + i * 230;
    block(s, x, 305, 176, 110, i === 3 ? teal : navy2, i === 3 ? teal : '#263A68');
    box(s, label, x + 10, 340, 156, 36, { fontSize: 26, bold: true, color: i === 3 ? navy : cream, alignment: 'center' });
    if (i < steps.length - 1) box(s, '→', x + 182, 334, 34, 44, { fontSize: 34, color: gold, alignment: 'center' });
  });
  box(s, 'Editable fields and explicit confirmation make downstream guidance reviewable—not automatic.', 128, 510, 1000, 64, { fontSize: 30, color: soft, alignment: 'center' });
}

{
  const s = presentation.slides.add();
  chrome(s, 4, 'Confirmation is the safety gate');
  card(s, 'Before confirmation', 'Risk and alternatives stay locked. The app shows “Confirm itinerary first.”', 92, 244, 470, 260, red);
  card(s, 'After confirmation', 'The traveller’s reviewed snapshot unlocks local risk and alternatives fixtures.', 718, 244, 470, 260, teal);
  box(s, '→', 594, 327, 92, 70, { fontSize: 60, color: gold, alignment: 'center' });
  box(s, 'No UI shortcut bypasses the explicit user action.', 280, 563, 720, 40, { fontSize: 28, color: soft, alignment: 'center' });
}

{
  const s = presentation.slides.add();
  chrome(s, 5, 'Three services, distinct evidence boundaries');
  card(s, 'Gemini', 'Historical evidence is preserved under smoke-tests/extraction/. The ready-made demo performs no extraction and shows MiniMax offline.', 78, 234, 348, 300, teal);
  card(s, 'Nosana', 'Historical evidence is reconciled. The browser fixture is a permitted dry-run preview with no submitted job ID.', 466, 234, 348, 300, gold);
  card(s, 'Atlas Sandbox', 'Historical Search→Verify evidence returned 20 offers, then PRICE_CONFIRMATION_REQUIRED, with no write.', 854, 234, 348, 300, red);
  box(s, 'Local fixtures are never presented as live provider output.', 184, 590, 910, 40, { fontSize: 26, bold: true, color: soft, alignment: 'center' });
}

{
  const s = presentation.slides.add();
  chrome(s, 6, 'Synthetic data. Human gate. No write actions.');
  bulletList(s, [
    'Fictional airports, flight numbers, dates, and prices in the walkthrough.',
    'No booking, payment, reservation, ticket, order, or external write action.',
    'A user-confirmation gate separates review from downstream guidance.',
    'Source labels keep offline fixtures and historical evidence distinct.',
  ], 94, 240, 990, 28);
  block(s, 870, 446, 270, 106, '#14322E', teal);
  box(s, 'SAFE\nBY DESIGN', 900, 470, 210, 56, { fontSize: 28, bold: true, color: teal, alignment: 'center' });
}

{
  const s = presentation.slides.add();
  chrome(s, 7, 'The demo makes the decision path visible');
  const steps = ['Open', 'Select sample', 'Review', 'Confirm', 'Compare', 'Choose'];
  steps.forEach((label, i) => {
    const y = 228 + i * 58;
    box(s, `${i + 1}`, 104, y, 36, 34, { fontSize: 22, bold: true, color: gold, alignment: 'center' });
    box(s, label, 172, y, 290, 34, { fontSize: 27, bold: true, color: cream });
  });
  card(s, 'Visible proof', 'The flow ends with a local Keep or Switch choice and a clear no-external-action statement.', 602, 254, 500, 260, teal);
  box(s, 'Source: local demo fixtures', 650, 550, 410, 36, { fontSize: 24, color: soft, alignment: 'center' });
}

{
  const s = presentation.slides.add();
  chrome(s, 8, 'Ready for a safe, repeatable demo');
  card(s, 'What is ready', 'Offline build, type-check, and the review-first browser walkthrough.', 90, 238, 490, 240, teal);
  card(s, 'What stays gated', 'Fresh provider runs and any action beyond read-only decision support.', 700, 238, 490, 240, red);
  box(s, 'Validate before you commit.', 186, 568, 910, 64, { fontSize: 52, bold: true, color: gold, alignment: 'center' });
}

await fs.mkdir('/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/output/submission/stitchcheck-deck', { recursive: true });
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(FINAL_PPTX);
