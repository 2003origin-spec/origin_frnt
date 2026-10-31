---
title: "Probability (Class 12): Important Points and Traps"
type: key_points
chapter: c12.mathematics.probability
order: 3
---

## Conditional probability

:::remember
- $P(E|F) = \dfrac{P(E \cap F)}{P(F)}$ needs $P(F) \ne 0$. If $P(F) = 0$, $P(E|F)$ is **not defined** (NCERT Ex 13.1, Q16).
- The event after the bar is the one that **has happened**. It becomes the new sample space.
- For a fixed $F$, every ordinary rule still works: complements, the addition rule, $0 \le P \le 1$.
:::

:::trap
**$P(A|B)$ and $P(B|A)$ are different.** $P(A|B)$ divides by $P(B)$; $P(B|A)$ divides by $P(A)$. They have the same top, $P(A \cap B)$.

If $P(A|B) = P(B|A)$ and $P(A \cap B) \ne 0$, then $P(A) = P(B)$ (NCERT Ex 13.1, Q17). It does **not** mean $A = B$.
:::

:::trap
"Given that at least one child is a boy" and "given that the elder child is a boy" are different conditions.
For two children, $P(\text{both boys} | \text{at least one boy}) = \dfrac13$, but $P(\text{both boys} | \text{elder is a boy}) = \dfrac12$. List the reduced sample space each time.
:::

- If $A \subset B$ and $P(B) \ne 0$: $P(A|B) = \dfrac{P(A)}{P(B)} \ge P(A)$.
- If $P(A) + P(B) - P(A \cap B) = P(A)$, then $P(B) = P(A \cap B)$, so $P(A|B) = 1$.
- If $P(A|B) > P(A)$ (with $P(A), P(B) > 0$), then also $P(B|A) > P(B)$. Both say $P(A \cap B) > P(A)P(B)$.
- NCERT's answer to "$P(B|A) = 1$ means?" is $A \subset B$. Strictly, it only says $P(A \cap B') = 0$, which gives $A \subset B$ when every outcome has non-zero probability.

## Multiplication rule and independence

:::trap
**Mutually exclusive is not independent.** If $P(A) > 0$, $P(B) > 0$ and $A \cap B = \phi$, then $P(A \cap B) = 0 \ne P(A)P(B)$: the events are **dependent**. Knowing $A$ happened tells you $B$ did not.
:::

:::trap
**Pairwise independent does not mean mutually independent.** Toss two coins. $A$: first is H. $B$: second is H. $C$: both show the same face.
Every pair passes the product test ($\frac14 = \frac12 \times \frac12$), but $P(A \cap B \cap C) = P(HH) = \frac14 \ne \frac18$. So $A$, $B$, $C$ are **not** independent. Check all four conditions.
:::

:::trap
**Without replacement, draws are dependent.** Multiply using conditional probabilities ($\frac{10}{15} \times \frac{9}{14}$), not $\left(\frac{10}{15}\right)^2$. With replacement, the draws are independent.

But the probability that the **second** ball is black, with no information about the first, is still $\frac{10}{15}$. Total probability gives $\frac{10}{15}\cdot\frac{9}{14} + \frac{5}{15}\cdot\frac{10}{14} = \frac23$.
:::

:::remember
- Independence is checked with numbers: $P(A \cap B) = P(A)P(B)$. Never decide it from a Venn diagram or because the events "seem unrelated".
- Two events on the **same** die can be independent (multiple of 3 and even, NCERT Example 10).
- An event with probability 0 or 1 passes the product test with every event.
:::

- "At least one" for independent events: $1 - P(A')P(B')$. For $n$ independent tries, each failing with probability $q$: $1 - q^n$. A die thrown thrice: $P(\text{at least one odd}) = 1 - \left(\frac12\right)^3 = \frac78$.
- "Not $A$ or not $B$" $= P(A' \cup B') = 1 - P(A \cap B)$. It is a quick way to get $P(A \cap B)$.

:::tip
"Neither" means $P(A' \cap B') = 1 - P(A \cup B)$. For independent events it also equals $P(A')\,P(B')$. Two ways to the same number, so use one to check the other.
:::

## Total probability and Bayes

:::remember
- The $E_i$ must form a **partition**: no overlaps, nothing left out, each $P(E_i) > 0$. Check that the priors add up to 1.
- The posteriors $P(E_1|A), \dots, P(E_n|A)$ also add up to 1.
- Bayes' denominator is $P(A)$ from the theorem of total probability.
:::

:::trap
**Do not confuse $P(A|E)$ with $P(E|A)$.** "The test detects 90% of cases" gives $P(+|\text{disease})$, not $P(\text{disease}|+)$. With a rare disease (0.1%), a positive test still means only about an 8% chance of disease (NCERT Example 18).
:::

:::trap
**"Speaks the truth" questions.** In NCERT Example 21 (truth 3 out of 4 times, reports a six), $P(\text{reports six} | \text{not six})$ is taken as $\frac14$, the chance he lies. This assumes a lie always means saying "six". Use this unless the question says otherwise.
:::

:::tip
**Transfer problems** (move balls from Bag I to Bag II, then draw): the partition is "what was transferred". For one ball: red or black. For two balls: RR, RB or BB, with ${}^nC_r$ for their chances.
:::

:::tip
Draw a tree for every Bayes question. Bayes = (one path to $A$) ÷ (all paths to $A$). With equal priors, the priors cancel.
:::

## Random variable

:::remember
NCERT: a random variable is a **real-valued function** whose domain is the sample space. It is not a variable in the algebra sense, and its values must be real numbers. Different random variables can be defined on the same sample space.
:::

- (Exam extra) Check $\sum p_i = 1$ and every $p_i \ge 0$ first. If a table contains $k$ or $k^2$, solve for $k$ and reject values that make any $p_i$ negative.
- (Exam extra) The mean need not be a value $X$ can take. The variance can never be negative; $\sum x_i^2 p_i - \mu^2 < 0$ means an arithmetic slip.

## Taking turns

- $A$ and $B$ throw a die in turn until a six appears, $A$ first (NCERT Example 23): $P(A \text{ wins}) = \dfrac{1/6}{1 - 25/36} = \dfrac{6}{11}$. The one who starts has the advantage.
