---
title: "Probability (Class 11): Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.probability
order: 1
---

$S$ = sample space, $A, B, C$ = events (subsets of $S$), $A'$ = "not A" (NCERT's symbol for the complement), $n(A)$ = number of outcomes in $A$.

## Events as sets

| Event | Set |
|---|---|
| not A | $A' = S - A$ |
| A or B | $A \cup B$ |
| A and B | $A \cap B$ |
| A but not B | $A - B$ |

:::formula{title="A but not B"}
$$A - B = A \cap B'$$
"A or B" means A, or B, or **both**.
:::

:::formula{title="De Morgan's laws"}
$$(A \cup B)' = A' \cap B'$$
$$(A \cap B)' = A' \cup B'$$
"Neither A nor B" $= A' \cap B'$. "At least one of them fails" $= A' \cup B'$.
:::

:::formula{title="Mutually exclusive and exhaustive"}
Mutually exclusive:
$$A \cap B = \phi$$
Exhaustive:
$$E_1 \cup E_2 \cup \cdots \cup E_n = S$$
Both together: pairwise disjoint ($E_i \cap E_j = \phi$ for $i \ne j$) **and** their union is $S$.
:::

:::formula{title="Size of common sample spaces"}
$$n(S) = 2^n \text{ for } n \text{ coins}$$
$$n(S) = 6^n \text{ for } n \text{ dice}$$
Count **ordered** outcomes: HT and TH are different; $(1, 2)$ and $(2, 1)$ are different. Tossing one coin $n$ times is the same as tossing $n$ coins once.
:::

## Axioms (axiomatic approach)

:::formula{title="The three axioms"}
$$P(E) \ge 0$$
$$P(S) = 1$$
$$P(E \cup F) = P(E) + P(F)$$
The third one only for **mutually exclusive** $E$ and $F$. From it, $P(\phi) = 0$.
:::

:::formula{title="Probabilities of the outcomes"}
For $S = \{\omega_1, \omega_2, \dots, \omega_n\}$:
$$0 \le P(\omega_i) \le 1$$
$$P(\omega_1) + P(\omega_2) + \cdots + P(\omega_n) = 1$$
$$P(A) = \sum_{\omega_i \in A} P(\omega_i)$$
An assignment is **valid** only if both of the first two lines hold. The outcomes need not be equally likely.
:::

## Equally likely outcomes

:::formula{title="Classical formula"}
$$P(E) = \frac{n(E)}{n(S)}$$
= (outcomes favourable to $E$) ÷ (total outcomes).

Only when $S$ is **finite** and every outcome is **equally likely**. Each outcome then has probability $\dfrac{1}{n(S)}$.
:::

:::formula{title="With combinations"}
Choosing $r$ items at random from $N$:
$$P = \frac{\text{number of favourable selections}}{{}^{N}C_r}$$
Count the top and the bottom the same way: both as selections (order ignored) or both as arrangements (order counted).
:::

## Rules for combining events

:::formula{title="Addition rule (any two events)"}
$$P(A \cup B) = P(A) + P(B) - P(A \cap B)$$
If $A$ and $B$ are mutually exclusive, $P(A \cap B) = 0$ and
$$P(A \cup B) = P(A) + P(B)$$
:::

:::formula{title="Addition rule (three events)"}
$$\begin{aligned} &P(A \cup B \cup C) \\ &= P(A) + P(B) + P(C) \\ &\quad - P(A \cap B) - P(B \cap C) \\ &\quad - P(A \cap C) \\ &\quad + P(A \cap B \cap C) \end{aligned}$$
Proved in NCERT (Example 11) by writing $B \cup C = E$ and using the two-event rule three times.
:::

:::formula{title="Complement"}
$$P(A') = 1 - P(A)$$
Because $A$ and $A'$ are mutually exclusive and exhaustive.
:::

:::formula{title="At least one"}
$$P(\text{at least one}) = 1 - P(\text{none})$$
For two events, "none" is $A' \cap B'$, so
$$P(A' \cap B') = 1 - P(A \cup B)$$
:::

:::formula{title="Only A, and exactly one"}
$$P(A \cap B') = P(A) - P(A \cap B)$$
$$\begin{aligned} &P(\text{exactly one}) \\ &= P(A) + P(B) - 2P(A \cap B) \end{aligned}$$
Both are used in NCERT Example 7.
:::

:::formula{title="Mutually exclusive and exhaustive events"}
If $E_1, E_2, \dots, E_n$ are mutually exclusive and exhaustive:
$$P(E_1) + P(E_2) + \cdots + P(E_n) = 1$$
:::

## Checking given values

:::formula{title="Bounds for two events"}
If $A \subset B$, then $P(A) \le P(B)$. So
$$P(A \cap B) \le \min\{P(A), P(B)\}$$
$$P(A \cup B) \ge \max\{P(A), P(B)\}$$
$$P(A \cap B) \ge P(A) + P(B) - 1$$
The last one comes from $P(A \cup B) \le 1$. NCERT does not list these as formulas, but they follow from the addition rule, and NCERT Exercise 14.2 (Q12) asks you to test whether given values are "consistently defined".
:::

## Beyond the syllabus (small aid)

:::formula{title="Odds"}
Odds in favour of $E$ are $a : b$ means
$$P(E) = \frac{a}{a + b}$$
Odds against $E$ are then $b : a$. Odds are not in NCERT or in the JEE Main syllabus, but some questions are worded with them.
:::
