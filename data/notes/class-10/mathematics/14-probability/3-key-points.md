---
title: "Probability: Important Points and Traps"
type: key_points
chapter: c10.mathematics.probability
order: 3
---

## NCERT one-liners

:::remember
- P(E) = favourable outcomes ÷ all possible outcomes, **only** when the outcomes are equally likely.
- P(sure event) = 1. P(impossible event) = 0.
- $0 \le P(E) \le 1$ for every event.
- The probabilities of all the elementary events of an experiment add up to 1.
- $P(E) + P(\overline{E}) = 1$. $E$ and $\overline{E}$ are complementary events.
- Throwing a die twice is the same experiment as throwing two dice at once. The same holds for coins.
:::

## Can it be a probability?

- $-1.5$: **no** (negative). $\dfrac{3}{2}$: **no** (more than 1).
- $0.7$, $\dfrac23$, $15\%$: **yes**. A percentage is fine: $15\% = 0.15$.
- $0$ and $1$: **yes** (impossible and sure events).

## Counting traps

:::trap
**Two coins have 4 outcomes, not 3.** "Two heads, two tails, one of each" are not equally likely. One of each = HT or TH, so its probability is $\dfrac24 = \dfrac12$, not $\dfrac13$.
:::

:::trap
**Sums on two dice are not equally likely.** There are 11 sums (2 to 12), but each does **not** have probability $\dfrac{1}{11}$. Always count from the 36 ordered pairs. P(sum 7) $= \dfrac{6}{36}$, but P(sum 2) $= \dfrac{1}{36}$.
:::

:::trap
**(1, 4) and (4, 1) are different outcomes** on two dice. Count both. Only doubles like (4, 4) are counted once.
:::

:::trap
**Two outcomes do not always mean $\dfrac12$ each.** "Odd or even" on a die does give $\dfrac12$, because odd and even are equally likely (3 faces each). "Two heads, two tails, one of each" on two coins does not. First check that the outcomes are equally likely.
:::

## Word traps

- **"Between 2 and 6"** on a die means 3, 4, 5 (the ends are not included). P $= \dfrac36 = \dfrac12$.
- **1 is not a prime number.** Primes on a die: 2, 3, 5. P(prime) $= \dfrac12$.
- **"At least one"** means one or more. Use the complement: P(at least one 5 in two throws) $= 1 - \dfrac{25}{36} = \dfrac{11}{36}$.
- **"Not more than 4"** is the same as "4 or less".
- Discs numbered **1 to 90**: there are 81 two-digit numbers (10 to 90), not 80 or 90.

## Card traps

:::trap
**Aces are not face cards.** Face cards = kings, queens, jacks = 12 cards. Red face cards = 6.
:::

- "A king of red colour" = 2 cards. "The jack of hearts" = 1 card.
- If some cards are **removed**, the total is no longer 52. Count the new total first.
- "Neither a king nor a heart": hearts = 13, plus the 3 kings that are not hearts = 16 cards. So 36 cards are favourable. Do not count the king of hearts twice.

## Drawing without replacing

:::trap
If the first item is **not put back**, both the total and (sometimes) the favourable count drop by one. Five diamond cards (10, J, Q, K, A): after the queen is put aside, P(ace) $= \dfrac14$ and P(queen) $= 0$.
:::

## Not equally likely in real life

- A car starts or does not start, a player scores or misses: these outcomes are **not** equally likely. The answer depends on the car or the player.
- A true-false question answered by a blind guess: right or wrong **are** equally likely.
- A baby is born: NCERT treats boy and girl as equally likely.
- Tossing a fair coin is a fair way to decide who starts a game, because head and tail are equally likely.

## Shortcuts

:::tip
- Unknown count in a bag: write P as $\dfrac{x}{\text{total}}$ and solve the equation for $x$.
- On two dice, "product is even" = 1 − P(both odd) $= 1 - \dfrac{9}{36} = \dfrac34$.
- Sum of two dice: ways $= s - 1$ for $s \le 7$, and $13 - s$ for $s \ge 7$.
- Always simplify the final fraction: $\dfrac{4}{52} = \dfrac{1}{13}$.
:::
