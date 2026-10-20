---
title: "Probability (Class 11): Quick Practice"
type: practice
chapter: c11.mathematics.probability
order: 4
---

Try each question first, then tap **Show answer**.

## Events and axioms

:::question{title="1. A loaded die" exam="JEE Main level"}
A die is loaded so that the probability of face $k$ is proportional to $k$ ($k = 1, 2, \dots, 6$). Find the probability of an even number.

---

$P(k) = ck$ and the six values add to 1: $21c = 1$, so $P(k) = \dfrac{k}{21}$.

$P(\text{even}) = \dfrac{2 + 4 + 6}{21} = \dfrac{12}{21} =$ **$\dfrac47$**.
:::

:::question{title="2. Which pair overlaps?" exam="JEE Main level"}
Two dice are thrown. $A$: the sum is 7. $B$: both dice show the same number. $C$: the sum is at least 10. Which pair of events is **not** mutually exclusive? Find $P(B \cup C)$.

---

$A \cap B = \phi$ (a double has an even sum) and $A \cap C = \phi$. But $B \cap C = \{(5, 5), (6, 6)\}$, so **B and C** are not mutually exclusive.

$n(B) = 6$, $n(C) = 3 + 2 + 1 = 6$ (sums 10, 11, 12), $n(B \cap C) = 2$.

$P(B \cup C) = \dfrac{6 + 6 - 2}{36} =$ **$\dfrac{5}{18}$**.
:::

## Addition rule

:::question{title="3. Exactly one" exam="JEE Main level"}
$P(A) = 0.5$, $P(B) = 0.4$ and $P(A \cup B) = 0.7$. Find the probability that exactly one of $A$, $B$ happens.

---

$P(A \cap B) = 0.5 + 0.4 - 0.7 = 0.2$.

$P(\text{exactly one}) = P(A \cup B) - P(A \cap B) = 0.7 - 0.2 =$ **0.5**.
:::

:::question{title="4. Possible range" exam="JEE Main level"}
$P(A) = 0.7$ and $P(B) = 0.6$. Find the least and the greatest possible values of $P(A \cap B)$.

---

$P(A \cup B) \le 1$ gives $0.7 + 0.6 - P(A \cap B) \le 1$, so $P(A \cap B) \ge 0.3$.

$A \cap B$ lies inside $B$, so $P(A \cap B) \le 0.6$.

**Least 0.3, greatest 0.6.** The least happens when $A \cup B = S$; the greatest when $B \subset A$.
:::

:::question{title="5. Three subjects" exam="JEE Main level"}
In a school, 50% of students take Music, 40% Dance and 30% Art. 20% take Music and Dance, 15% Dance and Art, 10% Music and Art, and 5% take all three. Find the probability that a student picked at random takes none of the three.

---

$P(\text{at least one}) = 0.5 + 0.4 + 0.3 - 0.2 - 0.15 - 0.1 + 0.05 = 0.8$.

$P(\text{none}) = 1 - 0.8 =$ **0.2**.
:::

## Equally likely outcomes

:::question{title="6. Prime sum" exam="JEE Main level"}
Two fair dice are thrown. Find the probability that the sum is a prime number.

---

Prime sums and their ways: 2 (1), 3 (2), 5 (4), 7 (6), 11 (2). Total $= 15$.

$P = \dfrac{15}{36} =$ **$\dfrac{5}{12}$**.
:::

:::question{title="7. Heads and tails" exam="JEE Main level"}
A fair coin is tossed 4 times. Find the probability of getting at least one head and at least one tail.

---

$n(S) = 2^4 = 16$. The only bad outcomes are HHHH and TTTT.

$P = 1 - \dfrac{2}{16} =$ **$\dfrac78$**.
:::

## Counting

:::question{title="8. At least one ace" exam="JEE Main level"}
Two cards are drawn together from a well-shuffled deck of 52. Find the probability that at least one is an ace.

---

$P(\text{no ace}) = \dfrac{{}^{48}C_2}{{}^{52}C_2} = \dfrac{1128}{1326}$.

$P(\text{at least one ace}) = \dfrac{1326 - 1128}{1326} = \dfrac{198}{1326} =$ **$\dfrac{33}{221}$**.
:::

:::question{title="9. Sitting together" exam="JEE Main level"}
Five friends, including Asha and Ravi, sit in a row of 5 chairs in random order. Find the probability that Asha and Ravi sit next to each other.

---

Total orders: $5! = 120$. Treat Asha and Ravi as one block: $4! \times 2 = 48$ orders.

$P = \dfrac{48}{120} =$ **$\dfrac25$**.

Check: their two chairs are a random pair from ${}^5C_2 = 10$ pairs, and 4 of these pairs are side by side: $\dfrac{4}{10} = \dfrac25$.
:::

:::question{title="10. Committee" exam="JEE Main level"}
A committee of 3 is chosen at random from 6 men and 4 women. Find the probability that it has at least one woman.

---

$P(\text{no woman}) = \dfrac{{}^6C_3}{{}^{10}C_3} = \dfrac{20}{120} = \dfrac16$.

$P(\text{at least one woman}) = 1 - \dfrac16 =$ **$\dfrac56$**.
:::

