---
title: "Probability (Class 12): Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.probability
order: 1
---

Notation as in NCERT: $P(E|F)$ is "the probability of $E$ given $F$". $E'$ is "not $E$". $E \cap F$ (also written $EF$) is "both $E$ and $F$". $S$ is the sample space.

## Conditional probability

:::formula{title="Definition"}
$$P(E|F) = \frac{P(E \cap F)}{P(F)}$$
Only when $P(F) \ne 0$. $F$ is the event known to have happened.
:::

:::formula{title="Equally likely outcomes"}
$$P(E|F) = \frac{n(E \cap F)}{n(F)}$$
$n(\cdot)$ = number of outcomes. $F$ becomes the new (reduced) sample space.
:::

:::formula{title="Properties"}
$$P(S|F) = P(F|F) = 1$$
$$0 \le P(E|F) \le 1$$
$$P(E'|F) = 1 - P(E|F)$$
All for $P(F) \ne 0$.
:::

:::formula{title="Union, given F"}
$$\begin{aligned} P((A \cup B)|F) &= P(A|F) + P(B|F) \\ &\quad - P((A \cap B)|F) \end{aligned}$$
If $A$ and $B$ are disjoint, the last term is 0.
:::

## Multiplication rule

:::formula{title="Two events"}
$$P(E \cap F) = P(E)\,P(F|E)$$
$$P(E \cap F) = P(F)\,P(E|F)$$
The first needs $P(E) \ne 0$, the second $P(F) \ne 0$. Use it for draws one after another, especially **without replacement**.
:::

:::formula{title="Three events"}
$$P(E \cap F \cap G) = P(E)\,P(F|E)\,P(G|EF)$$
Each factor is conditioned on everything before it. Needs $P(E \cap F) \ne 0$. Extends the same way to four or more events.
:::

## Independent events

:::formula{title="Definition"}
$$P(E \cap F) = P(E)\,P(F)$$
Equivalent form: $P(E|F) = P(E)$ when $P(F) \ne 0$, and $P(F|E) = P(F)$ when $P(E) \ne 0$.
:::

:::formula{title="Complements stay independent"}
If $E$ and $F$ are independent, so are $E$ and $F'$, $E'$ and $F$, and $E'$ and $F'$.
$$P(E' \cap F') = P(E')\,P(F')$$
:::

:::formula{title="At least one (independent events)"}
$$P(A \cup B) = 1 - P(A')\,P(B')$$
For $n$ mutually independent events:
$$P(\text{at least one}) = 1 - \prod_{i=1}^{n} P(A_i')$$
:::

:::formula{title="Three events, mutually independent"}
All four must hold:
$$P(A \cap B) = P(A)\,P(B)$$
$$P(A \cap C) = P(A)\,P(C)$$
$$P(B \cap C) = P(B)\,P(C)$$
$$P(A \cap B \cap C) = P(A)\,P(B)\,P(C)$$
:::

## Total probability and Bayes' theorem

:::formula{title="Partition of S"}
$E_1, E_2, \dots, E_n$ form a partition when they are pairwise disjoint ($E_i \cap E_j = \phi$ for $i \ne j$), together make up $S$, and each $P(E_i) > 0$.
The simplest partition: $E$ and $E'$, when $0 < P(E) < 1$.
:::

:::formula{title="Theorem of total probability"}
$$P(A) = \sum_{j=1}^{n} P(E_j)\,P(A|E_j)$$
$E_1, \dots, E_n$ = a partition of $S$; $A$ = any event. With two parts:
$$P(A) = P(E)P(A|E) + P(E')P(A|E')$$
:::

:::formula{title="Bayes' theorem"}
$$P(E_i|A) = \frac{P(E_i)\,P(A|E_i)}{\sum_{j=1}^{n} P(E_j)\,P(A|E_j)}$$
$E_1, \dots, E_n$ = a partition of $S$, and $P(A) \ne 0$. $P(E_i)$ = prior ("priori") probability; $P(E_i|A)$ = posterior ("a posteriori") probability.
:::

## A standard result (general form of NCERT Example 23)

:::formula{title="Taking turns until a success"}
$A$ and $B$ take turns, $A$ first. Each try succeeds with probability $p$ (fail: $q = 1 - p$), independently. The first to succeed wins.
$$P(A \text{ wins}) = \frac{p}{1 - q^2}$$
$$P(B \text{ wins}) = \frac{q\,p}{1 - q^2}$$
From the infinite GP $p + q^2p + q^4p + \cdots$, valid for $0 < p \le 1$.
:::

## Exam extra: probability distribution

The JEE Main syllabus lists "probability distribution of a random variable"; its mean and variance are asked as part of that topic. None of this is in the current NCERT book, which only defines a random variable.

:::formula{title="Probability distribution"}
$X$ takes values $x_1, x_2, \dots, x_n$ with $P(X = x_i) = p_i$.
$$p_i \ge 0$$
$$\sum_{i=1}^{n} p_i = 1$$
:::

:::formula{title="Mean (expectation)"}
$$\mu = E(X) = \sum_{i=1}^{n} x_i\,p_i$$
:::

:::formula{title="Variance and standard deviation"}
$$\text{Var}(X) = \sum_{i=1}^{n} (x_i - \mu)^2\,p_i$$
$$\text{Var}(X) = \sum_{i=1}^{n} x_i^2\,p_i - \mu^2$$
$$\sigma = \sqrt{\text{Var}(X)}$$
:::

## Beyond the syllabus list (small aid)

:::formula{title="Repeated independent trials"}
$n$ independent trials, each a success with the same probability $p$ ($q = 1 - p$). Probability of exactly $r$ successes:
$$P(X = r) = {}^nC_r\,p^r q^{\,n-r}$$
$r = 0, 1, \dots, n$. Here $E(X) = np$ and $\text{Var}(X) = npq$.
Built only from independence and combinations. The old binomial-distribution section was removed from NCERT, but Misc. Exercise Q4 still needs this count.
:::
