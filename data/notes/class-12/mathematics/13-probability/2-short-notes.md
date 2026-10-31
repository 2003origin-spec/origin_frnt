---
title: "Probability (Class 12): Short Notes"
type: short_notes
chapter: c12.mathematics.probability
order: 2
---

## 1. Conditional probability

- $P(E|F)$ is the probability of $E$ when we already know that $F$ has happened.
- Knowing $F$ **shrinks the sample space** from $S$ to $F$. Only the outcomes of $E$ that lie inside $F$ (that is, $E \cap F$) still count.
- Definition: $P(E|F) = \dfrac{P(E \cap F)}{P(F)}$, defined only when $P(F) \ne 0$.
- With equally likely outcomes, just count: $P(E|F) = \dfrac{n(E \cap F)}{n(F)}$.
- The definition also works when the outcomes are **not** equally likely. Then find $P(E \cap F)$ and $P(F)$ by adding the probabilities of their outcomes (a tree diagram helps).

:::example{title="Three coins (NCERT)"}
$E$: at least two heads. $F$: first coin shows tail. $F = \{THH, THT, TTH, TTT\}$ and $E \cap F = \{THH\}$.
So $P(E|F) = \dfrac14$, while $P(E) = \dfrac12$. Knowing $F$ changed the chance of $E$.
:::

## 2. Properties of conditional probability

For a fixed $F$ with $P(F) \ne 0$, $P(\,\cdot\,|F)$ behaves like an ordinary probability:
- $P(S|F) = P(F|F) = 1$.
- $0 \le P(E|F) \le 1$.
- $P(E'|F) = 1 - P(E|F)$.
- $P((A \cup B)|F) = P(A|F) + P(B|F) - P((A \cap B)|F)$. For disjoint $A$ and $B$, drop the last term.

## 3. Multiplication rule

- From the definition: $P(E \cap F) = P(E)\,P(F|E)$, and also $P(E \cap F) = P(F)\,P(E|F)$.
- It is the natural tool for **draws one after another without replacement**: multiply the chance of the first draw by the chance of the second, given the first.
- For three events: $P(E \cap F \cap G) = P(E)\,P(F|E)\,P(G|EF)$.

:::example{title="Kings then an ace (NCERT Example 9)"}
Three cards drawn one by one without replacement. $P(KKA) = \dfrac{4}{52} \times \dfrac{3}{51} \times \dfrac{4}{50} = \dfrac{2}{5525}$.
:::

## 4. Independent events

- $E$ and $F$ are **independent** when one happening does not change the probability of the other: $P(E|F) = P(E)$ and $P(F|E) = P(F)$ (NCERT's first definition needs $P(E) \ne 0$ and $P(F) \ne 0$).
- The working test: $P(E \cap F) = P(E)\,P(F)$. If this fails, the events are **dependent**.
- If $E$ and $F$ are independent, so are $E$ and $F'$, $E'$ and $F$, and $E'$ and $F'$.
- So for independent $A$ and $B$: $P(\text{at least one}) = 1 - P(A')\,P(B')$.
- **Independent experiments:** tossing a coin and rolling a die, or two separate throws of a die. Any event of one is independent of any event of the other, so you multiply.
- **Three events** $A, B, C$ are mutually independent only if all three pair rules **and** $P(A \cap B \cap C) = P(A)P(B)P(C)$ hold. If even one fails, they are not independent.

| | Mutually exclusive | Independent |
|---|---|---|
| Defined by | sets: $A \cap B = \phi$ | probabilities |
| Common outcome? | never | may have |
| Product rule | $P(A \cap B) = 0$ | $P(A \cap B) = P(A)P(B)$ |

- If $P(A) > 0$ and $P(B) > 0$, the two ideas **cannot both hold**: mutually exclusive events with non-zero probabilities are dependent, and independent ones are not mutually exclusive.

:::example{title="Same die, still independent (NCERT Example 10)"}
One die. $E$: multiple of 3, so $\{3, 6\}$. $F$: even, so $\{2, 4, 6\}$. $P(E \cap F) = \dfrac16 = \dfrac13 \times \dfrac12$. Independent, even though they share the outcome 6.
:::

## 5. Partition and total probability

- $E_1, \dots, E_n$ form a **partition** of $S$ if they are pairwise disjoint, cover all of $S$, and each has non-zero probability. Exactly one of them happens.
- $E$ and $E'$ form the simplest partition (when $0 < P(E) < 1$). A sample space can have many partitions.
- **Theorem of total probability:** $P(A) = \sum P(E_j)\,P(A|E_j)$. Split $A$ by the "cause" or "route" that led to it, then add.
- Tree picture: one branch per $E_j$, weight $P(E_j)$; then a branch to $A$ with weight $P(A|E_j)$. Multiply along each path and add the paths that end in $A$.

:::example{title="Construction job (NCERT Example 15)"}
Strike: 0.65; on time with a strike: 0.32; on time with no strike: 0.80.
$P(\text{on time}) = 0.65 \times 0.32 + 0.35 \times 0.80 = 0.488$.
:::

## 6. Bayes' theorem

- Bayes' theorem runs the tree **backwards**. We see the result $A$ and ask which cause $E_i$ produced it. It is also called the formula for the probability of "causes".
- $P(E_i|A) = \dfrac{P(E_i)\,P(A|E_i)}{P(A)}$, where $P(A)$ comes from total probability and must not be 0.
- Words NCERT uses: the $E_i$ are **hypotheses**; $P(E_i)$ is the **priori** probability; $P(E_i|A)$ is the **a posteriori** probability.
- Quick method: (path to $A$ through $E_i$) ÷ (sum of all paths to $A$).

:::example{title="Bolts (NCERT Example 19)"}
Machines A, B, C make 25%, 35%, 40% of bolts; 5%, 4%, 2% of each are defective.
$P(\text{B} | \text{defective}) = \dfrac{0.35 \times 0.04}{0.0125 + 0.014 + 0.008} = \dfrac{0.014}{0.0345} = \dfrac{28}{69}$.
:::

:::example{title="A rare disease (NCERT Example 18)"}
Only 0.1% have HIV. The test catches 90% of cases but also flags 1% of healthy people. A positive result gives
$P(\text{HIV} | +) = \dfrac{0.0009}{0.0009 + 0.00999} = \dfrac{90}{1089} \approx 0.083$.
Most positives are false because healthy people far outnumber the sick.
:::

## 7. Random variable (NCERT remark)

- A **random variable** is a real-valued function whose domain is the sample space of a random experiment.
- Toss a coin twice. $X$ = number of heads: $X(HH) = 2$, $X(HT) = X(TH) = 1$, $X(TT) = 0$.
- Several random variables can live on the same sample space. $Y$ = heads minus tails gives $Y(HH) = 2$, $Y(HT) = Y(TH) = 0$, $Y(TT) = -2$.

## 8. Probability distribution (exam extra)

The JEE Main syllabus lists "probability distribution of a random variable"; mean and variance are asked as part of it. Not in the current NCERT book.

- The **probability distribution** of $X$ lists every value $x_i$ with its probability $p_i = P(X = x_i)$. Each $p_i \ge 0$ and they add up to 1.
- **Mean** (expected value): $\mu = \sum x_i p_i$. It is a weighted average and need not be a value $X$ can take.
- **Variance:** $\sum (x_i - \mu)^2 p_i$, or more quickly $\sum x_i^2 p_i - \mu^2$. Standard deviation $\sigma$ is its square root.

:::example{title="Number of heads in two tosses"}
| $x$ | 0 | 1 | 2 |
|---|---|---|---|
| $P(X = x)$ | 1/4 | 1/2 | 1/4 |

Mean $= 0 + \dfrac12 + \dfrac12 = 1$. Variance $= \left(0 + \dfrac12 + 1\right) - 1^2 = \dfrac12$.
:::

## 9. Repeated independent trials (beyond the syllabus list)

- Repeat the same trial $n$ times independently, with success probability $p$ each time. One particular order with $r$ successes has probability $p^r q^{n-r}$ (multiply, by independence). There are ${}^nC_r$ such orders, so $P(\text{exactly } r) = {}^nC_r\,p^r q^{n-r}$.
- The current NCERT has no binomial-distribution section, but this count follows from independence (Section 4) and counting, and it is needed for NCERT Misc. Exercise Q4 ("at most 6 of 10 people are right-handed").

## 10. Not in the current book

The current (rationalised) NCERT text has no sections on probability distributions, the mean and variance of a random variable, Bernoulli trials or the binomial distribution. The chapter introduction still mentions the distribution, its mean and variance, and the binomial distribution, but the sections that taught them were removed. They appear above only as labelled extras.
