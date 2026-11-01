---
title: "Probability (Class 11): Important Points and Traps"
type: key_points
chapter: c11.mathematics.probability
order: 3
---

## Events

:::remember
- An event is a **subset** of $S$. The impossible event is $\phi$; the sure event is $S$.
- A sample space with $n$ outcomes has $n$ simple events and $2^n$ events in all (every subset, including $\phi$ and $S$).
- Simple events are always mutually exclusive.
- $A$ and $A'$ are always mutually exclusive **and** exhaustive.
:::

:::trap
**Mutually exclusive is not the same as exhaustive.** On a die, $\{1, 2\}$ and $\{3, 4\}$ are mutually exclusive but not exhaustive. $\{1, 2, 3\}$ and $\{3, 4, 5, 6\}$ are exhaustive but not mutually exclusive.

Two events are **complements** of each other only when they are both.
:::

:::trap
"Mutually exclusive" is about sets ($A \cap B = \phi$). "Independent" is a different idea from the Class 12 chapter. Don't mix them up.
:::

## Building the sample space

:::trap
**The sums of two dice are not equally likely.** There are 11 possible sums (2 to 12), but $P(\text{sum } 7) = \frac{6}{36} = \frac16$, not $\frac{1}{11}$. Always work with the 36 ordered pairs.
:::

:::trap
For two coins, "one head and one tail" is **two** outcomes, HT and TH. So its probability is $\frac24 = \frac12$, not $\frac13$.
:::

- A word with repeated letters: count **letters**, not different letters. ASSASSINATION has 13 letters, of which 6 are vowels (A three times, I twice, O once). So $P(\text{vowel}) = \frac{6}{13}$.
- Read odd sample spaces carefully. A coin marked 1 and 6 with a die gives 12 equally likely pairs; a sum of 3 needs (1, 2), so its probability is $\frac{1}{12}$.

## Using the rules

:::trap
$P(A \cup B) = P(A) + P(B)$ **only** for mutually exclusive events. Otherwise subtract $P(A \cap B)$. If the sum $P(A) + P(B)$ is more than 1, the events can't be mutually exclusive.
:::

:::trap
$P(A - B)$ is $P(A) - P(A \cap B)$, **not** $P(A) - P(B)$. The two are equal only when $P(A \cap B) = P(B)$, for example when $B \subset A$.
:::

:::trap
**Signs in the three-event rule:** $+$ singles, $-$ pairs, $+$ the triple. Forgetting to add back $P(A \cap B \cap C)$ is the usual slip.
:::

- "Neither A nor B" $= 1 - P(A \cup B)$. "Not both" $= 1 - P(A \cap B)$. These are different.
- If $P(A' \cup B') = 0.25$, then $P(A \cap B) = 0.75$. Since this is not 0, $A$ and $B$ are **not** mutually exclusive (NCERT Ex 14.2, Q16).

## Checking given values

:::remember
Given values are **consistent** only if they obey:
- $P(A \cap B) \le P(A)$ and $P(A \cap B) \le P(B)$;
- $P(A \cup B) \ge P(A)$ and $P(A \cup B) \ge P(B)$;
- $P(A \cup B) \le 1$, so $P(A) + P(B) - P(A \cap B) \le 1$.

$P(A) = 0.5$, $P(B) = 0.7$, $P(A \cap B) = 0.6$ fails: $A \cap B$ can't be more likely than $A$.
:::

- A valid assignment to outcomes needs every value in $[0, 1]$ **and** a total of exactly 1. Check both.

## Counting

:::trap
Count the favourable cases and the total cases **the same way**. If the total is ${}^{52}C_2$ (order ignored), the favourable count must also ignore order.
:::

:::tip
Say **"at least one"** and think **"1 minus none"**. It is almost always shorter than adding the separate cases.
:::

:::tip
**Symmetry shortcuts** (all orders equally likely):
- A before B: $\frac12$.
- A before B before C: $\frac{1}{3!} = \frac16$.
- 3 letters put into 3 envelopes at random: $P(\text{at least one right}) = \frac46 = \frac23$. Only 2 of the 6 orders put every letter wrong.
:::

## Beyond NCERT (small aids)

These are not in NCERT or named in the JEE Main syllabus, but questions often use them.
- **Face cards** are the jack, queen and king: 12 in a deck. NCERT does not use the term; this is its usual meaning.
- **Odds** in favour $a : b$ means $P = \frac{a}{a + b}$.
- A non-leap year has 52 weeks and 1 extra day, so $P(53 \text{ Sundays}) = \frac17$. A leap year has 2 extra days, so it is $\frac27$.
