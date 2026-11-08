import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ASK_LATER,
  answerProblems,
  askLaterPrice,
  findContactDetails,
  noteProblems,
  parseAskLaterConfig,
  photoKeysProblem,
  validateAskLaterConfig,
} from "../../src/server/now/ask-later-rules";

test("contact details are caught in every usual shape (B94)", () => {
  for (const [text, what] of [
    ["call me on 98765 43210", "a phone number"],
    ["+91-98765-43210 any time", "a phone number"],
    ["9876543210", "a phone number"],
    ["mail asha.k@gmail.com", "an email address"],
    ["see www.example.org/notes", "a link"],
    ["https://bit.ly/x", "a link"],
    ["notes on mysite.in", "a link"],
    ["ping me on WhatsApp", "a messaging or social app"],
    ["my insta is open", "a messaging or social app"],
    ["t.me/asha", "a link"],
    ["follow @asha_physics", "a social handle"],
  ] as const) {
    assert.equal(findContactDetails(text), what, text);
  }
});

test("ordinary physics and maths is not mistaken for contact details", () => {
  for (const text of [
    "Use v^2 = u^2 + 2as with a = 9.8 m/s^2 and s = 20 m.",
    "c = 3.0 × 10^8 m/s and N_A = 6.022 × 10^23 per mole.",
    "Step 1: 12 + 34 = 46; step 2: 46 / 2 = 23.",
    "The answer is option C (2.5 s).",
    "Year 2024 paper, question 17, 4 marks.",
  ]) {
    assert.equal(findContactDetails(text), null, text);
  }
});

test("notes, answers and photos are checked", () => {
  assert.deepEqual(noteProblems(""), []);
  assert.match(noteProblems("x".repeat(1001))[0], /1000/);
  assert.match(noteProblems("whatsapp me")[0], /contact details/);
  assert.match(answerProblems("too short")[0], /at least 20/);
  assert.deepEqual(answerProblems("Resolve the force along the incline: mg sin θ = 4.9 N."), []);
  assert.equal(photoKeysProblem(["origin-now/ask-later/student/u1/a.jpg"], "origin-now/ask-later/student/u1/"), null);
  assert.match(String(photoKeysProblem(["origin-now/ask-later/student/u2/a.jpg"], "origin-now/ask-later/student/u1/")), /does not belong/);
  assert.match(String(photoKeysProblem(["origin-now/ask-later/student/u1/../x.jpg"], "origin-now/ask-later/student/u1/")), /does not belong/);
  assert.match(String(photoKeysProblem(["a", "b", "c", "d"], "")), /At most 3/);
});

test("price and settings", () => {
  assert.equal(askLaterPrice(40, 60), 24);
  assert.equal(askLaterPrice(1, 10), 1, "never below one coin");
  assert.deepEqual(parseAskLaterConfig(null), DEFAULT_ASK_LATER);
  assert.equal(parseAskLaterConfig(JSON.stringify({ answerHours: 6, claimMinutes: 5 })).answerHours, 6);
  assert.equal(parseAskLaterConfig(JSON.stringify({ claimMinutes: 5 })).claimMinutes, DEFAULT_ASK_LATER.claimMinutes, "out of range falls back");
  assert.match(validateAskLaterConfig({ pricePercent: 500 })[0], /10 to 200/);
});
