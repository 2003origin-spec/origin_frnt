---
title: "Probability (Class 11): Short Notes"
type: short_notes
chapter: c11.mathematics.probability
order: 2
---

## 1. Sample space (recap)

- A **random experiment** has more than one possible outcome, and we can't say in advance which one will happen.
- The **sample space** $S$ is the set of all possible outcomes. Each outcome is a **sample point**.
- The current NCERT chapter starts from events and takes these two ideas as already known.

:::example{title="Two coins"}
Tossing a coin twice: $S = \{HH, HT, TH, TT\}$. HT (head first) and TH (tail first) are different outcomes.
:::

## 2. Events

- An **event** is any subset of the sample space.
- Event $E$ **has occurred** if the actual outcome $\omega$ is in $E$. If $\omega \notin E$, $E$ has not occurred.
- On a die, let $E$ = "a number less than 4" $= \{1, 2, 3\}$. If 2 turns up, $E$ has occurred.

## 3. Types of events

| Type | Meaning | Die example |
|---|---|---|
| Impossible | $\phi$, no outcome | a multiple of 7 |
| Sure | $S$, every outcome | odd or even |
| Simple | exactly 1 outcome | $\{4\}$ |
| Compound | more than 1 outcome | $\{2, 4, 6\}$ |

- A sample space with $n$ outcomes has exactly $n$ simple events.

## 4. Algebra of events

Events combine like sets.
- **not A** (complement): $A' = S - A$, all outcomes outside $A$.
- **A or B**: $A \cup B$, at least one of them happens (both is allowed).
- **A and B**: $A \cap B$, both happen.
- **A but not B**: $A - B = A \cap B'$.

:::example{title="NCERT Example 1"}
One die. $A$ = prime $= \{2, 3, 5\}$, $B$ = odd $= \{1, 3, 5\}$.

$A \cup B = \{1, 2, 3, 5\}$, $A \cap B = \{3, 5\}$, $A - B = \{2\}$, $A' = \{1, 4, 6\}$.
:::

## 5. Mutually exclusive and exhaustive events

- $A$ and $B$ are **mutually exclusive** if they can't happen together: $A \cap B = \phi$.
- $E_1, \dots, E_n$ are **exhaustive** if at least one of them must happen: their union is $S$.
- **Mutually exclusive and exhaustive**: exactly one of them happens every time. (Pairwise disjoint, union $= S$.)
- Simple events of a sample space are always mutually exclusive.
- $A$ and $A'$ are always mutually exclusive and exhaustive.

:::example{title="Three coins (NCERT Example 3)"}
$A$ = no head, $B$ = exactly one head, $C$ = at least two heads.

They don't overlap and together cover all 8 outcomes, so they are mutually exclusive **and** exhaustive.
:::

## 6. Axiomatic approach

Probability $P$ is a function from the events (subsets of $S$) to $[0, 1]$ that obeys three axioms:
1. $P(E) \ge 0$ for every event $E$.
2. $P(S) = 1$.
3. If $E$ and $F$ are mutually exclusive, $P(E \cup F) = P(E) + P(F)$.

From axiom 3 with $F = \phi$: $P(\phi) = 0$.

For a finite $S = \{\omega_1, \dots, \omega_n\}$:
- each $P(\omega_i)$ lies in $[0, 1]$;
- all the $P(\omega_i)$ add up to 1;
- $P(A)$ = sum of $P(\omega_i)$ over the outcomes in $A$.

- Outcomes need **not** be equally likely. For one coin, $P(H) = p$ and $P(T) = 1 - p$ is valid for any $p$ in $[0, 1]$.
- To test an assignment: every value between 0 and 1, and the total exactly 1. A negative value, a value above 1, or a total like 2.1 makes it invalid.

:::example{title="Unequal outcomes"}
Coin tossed twice, with $P(HH) = \frac14$, $P(HT) = \frac17$, $P(TH) = \frac27$, $P(TT) = \frac{9}{28}$ (these add to 1).

$P(\text{both tosses same}) = P(HH) + P(TT) = \frac14 + \frac{9}{28} = \frac47$.
:::

## 7. Equally likely outcomes

- If all $n$ outcomes are equally likely, each has probability $\frac1n$.
- Then $P(E) = \dfrac{n(E)}{n(S)}$.
- "Fair coin", "unbiased die", "well-shuffled deck" and "at random" all signal equally likely outcomes.

:::remember
A deck has 52 cards: 4 suits of 13 (spades and clubs are black; hearts and diamonds are red), so 26 black and 26 red, and 4 of each rank (4 aces, 4 kings, ...).
:::

## 8. Addition rule

$$P(A \cup B) = P(A) + P(B) - P(A \cap B)$$

- **Why:** in $P(A) + P(B)$, the outcomes in $A \cap B$ are counted twice. Subtract them once.
- Split $A \cup B$ into three disjoint parts: $A - B$, $A \cap B$, $B - A$.
- For mutually exclusive events the last term is 0. That is just axiom 3.
- For three events, add the singles, subtract the pairs, add back the triple (NCERT Example 11).

## 9. Complement and "at least one"

- $P(A') = 1 - P(A)$.
- Use it whenever the question says **at least one** or **not**: $P(\text{at least one}) = 1 - P(\text{none})$.
- "Neither A nor B" is $A' \cap B' = (A \cup B)'$ (De Morgan), so its probability is $1 - P(A \cup B)$.

:::example{title="Two students (NCERT Example 7)"}
$P(E) = 0.05$, $P(F) = 0.10$, $P(E \cap F) = 0.02$.
- $P(E \cup F) = 0.05 + 0.10 - 0.02 = 0.13$.
- Neither qualifies: $1 - 0.13 = 0.87$.
- At least one fails: $1 - 0.02 = 0.98$.
- Only one qualifies: $0.13 - 0.02 = 0.11$.
:::

## 10. Counting with combinations

- When items are picked at random, count with ${}^nC_r$ (selections) or ${}^nP_r$ / $n!$ (arrangements).
- Use the same kind of count on the top and on the bottom.

:::example{title="Committee (NCERT Example 8)"}
Choose 2 from 2 men and 2 women: ${}^4C_2 = 6$ ways.

$P(\text{one man}) = \dfrac{{}^2C_1 \times {}^2C_1}{6} = \dfrac46 = \dfrac23$.
:::

:::example{title="Order (NCERT Example 9)"}
Four cities visited in random order: $4! = 24$ orders. In exactly half of them A comes before B, so $P = \frac12$.
:::

## 11. Not in this chapter

Conditional probability, the multiplication rule, independent events, the theorem of total probability and Bayes' theorem are in the **Class 12** Probability chapter. It also defines a random variable in one short remark; probability distributions and the binomial distribution are no longer in the current book. Don't multiply $P(A) \times P(B)$ for "A and B" here unless independence is given.
