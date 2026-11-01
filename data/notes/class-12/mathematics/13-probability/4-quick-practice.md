---
title: "Probability (Class 12): Quick Practice"
type: practice
chapter: c12.mathematics.probability
order: 4
---

Try each question first, then tap **Show answer**. Dice and coins are fair unless the question says otherwise.

## Conditional probability

:::question{title="1. Even product" exam="JEE Main level"}
A die is thrown twice. Given that the product of the two numbers is even, find the probability that their sum is even.

---

Product even: $36 - 9 = 27$ outcomes (only odd × odd, $3 \times 3 = 9$ cases, gives an odd product).

Sum even **and** product even: both numbers even, $3 \times 3 = 9$ outcomes.

$P = \dfrac{9}{27} =$ **$\dfrac13$**.
:::

:::question{title="2. From the union" exam="JEE Main level"}
$P(A) = 0.5$, $P(B) = 0.4$ and $P(A \cup B) = 0.7$. Find $P(A|B)$ and $P(A'|B')$.

---

$P(A \cap B) = 0.5 + 0.4 - 0.7 = 0.2$, so $P(A|B) = \dfrac{0.2}{0.4} = 0.5$.

$P(A' \cap B') = 1 - P(A \cup B) = 0.3$ and $P(B') = 0.6$, so $P(A'|B') = 0.5$.

**Both are 0.5.** (Here $P(A \cap B) = P(A)P(B)$, so $A$ and $B$ are independent.)
:::

## Multiplication rule and independence

:::question{title="3. In order" exam="JEE Main level"}
A bag has 5 red and 3 blue balls. Three balls are drawn one by one without replacement. Find the probability that they are red, blue, red in that order.

---

$\dfrac58 \times \dfrac37 \times \dfrac46 = \dfrac{60}{336} =$ **$\dfrac{5}{28}$**.
:::

:::question{title="4. Find P(B)" exam="JEE Main level"}
$A$ and $B$ are independent, $P(A) = 0.4$ and $P(A \cup B) = 0.7$. Find $P(B)$.

---

Let $P(B) = p$. Then $0.4 + p - 0.4p = 0.7$, so $0.6p = 0.3$.

$P(B) =$ **0.5**.
:::

:::question{title="5. Exactly one solves" exam="JEE Main level"}
Three students solve a problem independently with probabilities $\dfrac12$, $\dfrac13$ and $\dfrac14$. Find the probability that exactly one of them solves it.

---

The chances of failing are $\dfrac12$, $\dfrac23$, $\dfrac34$.

$P = \dfrac12 \cdot \dfrac23 \cdot \dfrac34 + \dfrac12 \cdot \dfrac13 \cdot \dfrac34 + \dfrac12 \cdot \dfrac23 \cdot \dfrac14$

$= \dfrac{6 + 3 + 2}{24} =$ **$\dfrac{11}{24}$**.
:::

:::question{title="6. Pairwise only?" exam="JEE Main level"}
Two coins are tossed. $A$: the first shows a head. $B$: the second shows a head. $C$: exactly one head appears. Are $A$, $B$, $C$ mutually independent?

---

$P(A) = P(B) = P(C) = \dfrac12$.

$P(A \cap B) = P(HH) = \dfrac14$, $P(A \cap C) = P(HT) = \dfrac14$, $P(B \cap C) = P(TH) = \dfrac14$. Every pair is independent.

But $A \cap B \cap C = \phi$, so $P(A \cap B \cap C) = 0 \ne \dfrac18$.

**No:** they are pairwise independent but not mutually independent.
:::

:::question{title="7. Taking turns" exam="JEE Main level"}
$A$ and $B$ take turns throwing a pair of dice, $A$ first. The first to get a total of 9 wins. Find the probability that $A$ wins.

---

Total 9: $(3,6), (4,5), (5,4), (6,3)$, so $p = \dfrac{4}{36} = \dfrac19$ and $q = \dfrac89$.

$A$ wins on throw 1, 3, 5, …: $P = p + q^2p + q^4p + \cdots = \dfrac{p}{1 - q^2}$.

$P = \dfrac{1/9}{1 - 64/81} = \dfrac{1}{9} \times \dfrac{81}{17} =$ **$\dfrac{9}{17}$**.
:::

## Total probability and Bayes

:::question{title="8. Two balls moved" exam="JEE Main level"}
Bag I has 4 red and 2 black balls. Bag II has 3 red and 5 black balls. Two balls are moved at random from Bag I to Bag II, and then one ball is drawn from Bag II. Find the probability that it is red.

---

Partition by what was moved (${}^6C_2 = 15$ ways):
- RR: $\dfrac{6}{15}$, then Bag II has 5 red of 10.
- RB: $\dfrac{8}{15}$, then 4 red of 10.
- BB: $\dfrac{1}{15}$, then 3 red of 10.

$P = \dfrac{6 \times 5 + 8 \times 4 + 1 \times 3}{15 \times 10} = \dfrac{65}{150} =$ **$\dfrac{13}{30}$**.
:::

:::question{title="9. A positive test" exam="JEE Main level"}
2% of a population has a disease. A test is positive for 95% of people with the disease and for 5% of people without it. A person picked at random tests positive. Find the probability that the person has the disease.

---

$D$: has the disease. By Bayes' theorem:

$P(D|+) = \dfrac{0.02 \times 0.95}{0.02 \times 0.95 + 0.98 \times 0.05}$

$= \dfrac{0.019}{0.019 + 0.049} = \dfrac{0.019}{0.068} =$ **$\dfrac{19}{68}$** (about 0.28).
:::

## Random variable (exam extra)

:::question{title="10. Mean and variance" exam="JEE Main level"}
A random variable $X$ takes the values 0, 1, 2, 3 with probabilities $k$, $2k$, $3k$, $4k$. Find $k$, the mean and the variance of $X$.

---

$k + 2k + 3k + 4k = 1$, so $k = \dfrac{1}{10}$.

Mean $= \dfrac{0 + 2 + 6 + 12}{10} = 2$.

$\sum x^2 p = \dfrac{0 + 2 + 12 + 36}{10} = 5$, so variance $= 5 - 2^2 = 1$.

**$k = \dfrac{1}{10}$, mean 2, variance 1.**
:::
