---
title: "Probability: Short Notes"
type: short_notes
chapter: c10.mathematics.probability
order: 2
---

## 1. Equally likely outcomes

- An **experiment** is something we do that has a known set of possible results, called **outcomes**. Tossing a coin and throwing a die are experiments.
- Outcomes are **equally likely** when each one has the same chance. A fair coin: head and tail. A fair die: 1, 2, 3, 4, 5, 6.
- Not every experiment has equally likely outcomes. A bag has 4 red balls and 1 blue ball. "Red" and "blue" are **not** equally likely. But drawing any one particular ball is equally likely.
- In this chapter, a coin is always fair (unbiased), a die is always fair, and a "random" draw means every item has the same chance.

## 2. Two kinds of probability

- **Experimental (empirical) probability** (Class 9): do the experiment many times and count.
$$P(E) = \frac{\text{trials with } E}{\text{total trials}}$$
- This needs many repeats. That is not always possible: we cannot launch a satellite again and again just to see how often it fails.
- **Theoretical (classical) probability**: when the outcomes are equally likely, we can work out the probability without doing the experiment.
$$P(E) = \frac{\text{favourable outcomes}}{\text{all outcomes}}$$
- NCERT calls this simply **probability**. It was defined by Pierre Simon Laplace in 1795.
- As the number of trials grows, we may expect the experimental probability to come close to the theoretical one. It need not be exactly equal.

## 3. Elementary events

- An event with **only one outcome** is an **elementary event**. Getting a head on one coin is elementary. Getting a number greater than 4 on a die is not (it has 2 outcomes: 5 and 6).
- The probabilities of **all** the elementary events of an experiment add up to 1. For a die: $6 \times \dfrac16 = 1$.

## 4. Sure and impossible events

- **Impossible event**: it can never happen, so it has 0 favourable outcomes and $P = 0$. Example: getting 8 on a die.
- **Sure (certain) event**: it always happens, so every outcome is favourable and $P = 1$. Example: getting a number less than 7 on a die.
- The favourable outcomes can never be more than all the outcomes. So every probability lies from 0 to 1:
$$0 \le P(E) \le 1$$

## 5. Complementary events

- "Not $E$" is written $\overline{E}$. It is the **complement** of $E$.
- $E$ and $\overline{E}$ together cover all the outcomes, and they share none. So:
$$P(\overline{E}) = 1 - P(E)$$
- Use it when "not $E$" is easier to count. "At least one head" is the complement of "no head".

:::example{title="Tennis match (NCERT idea)"}
P(Sangeeta wins) = 0.62. Exactly one of the two players wins the match, so the two events are complementary. P(Reshma wins) $= 1 - 0.62 = 0.38$.
:::

## 6. Playing cards

- A deck has **52 cards** in **4 suits** of 13: spades ♠ and clubs ♣ (black), hearts ♥ and diamonds ♦ (red).
- Each suit: ace, king, queen, jack, 10, 9, 8, 7, 6, 5, 4, 3, 2.
- **Face cards** are kings, queens and jacks: 3 per suit, so 12 in all (6 red, 6 black).
- A **well-shuffled** deck makes all 52 cards equally likely.

:::example{title="Not an ace"}
There are 4 aces. P(ace) $= \dfrac{4}{52} = \dfrac{1}{13}$. So P(not an ace) $= 1 - \dfrac{1}{13} = \dfrac{12}{13}$.
:::

## 7. Coins

- **Two coins** (or one coin tossed twice): HH, HT, TH, TT. That is 4 outcomes. HT and TH are **different** outcomes.
- **Three coins**: HHH, HHT, HTH, THH, HTT, THT, TTH, TTT. That is 8 outcomes.

:::example{title="At least one head with two coins"}
Favourable: HH, HT, TH, so $P = \dfrac34$. Or by the complement: P(no head) = P(TT) $= \dfrac14$, so $P = 1 - \dfrac14 = \dfrac34$.
:::

## 8. Two dice

- Two dice thrown together (or one die thrown twice) give $6 \times 6 = 36$ outcomes, written as ordered pairs. $(1, 4)$ and $(4, 1)$ are different outcomes.
- The 11 possible **sums** 2 to 12 are **not** equally likely. Sum 7 has the most ways (6). Sums 2 and 12 have only 1 way each.

| Sum | Pairs | Ways |
|---|---|---|
| 7 | (1,6) (2,5) (3,4) (4,3) (5,2) (6,1) | 6 |
| 8 | (2,6) (3,5) (4,4) (5,3) (6,2) | 5 |
| 12 | (6,6) | 1 |

- P(sum is 8) $= \dfrac{5}{36}$. P(sum is 13) $= 0$ (impossible). P(sum $\le 12$) $= 1$ (sure).

## 9. Drawing again without putting back

- If an item is taken out and **not replaced**, the next draw has **one fewer** item in total. The favourable count may also drop by one.

:::example{title="Bulbs (NCERT idea)"}
20 bulbs, 4 defective. One good bulb is drawn and kept aside. Now 19 are left, and 15 of them are good. P(next is good) $= \dfrac{15}{19}$.
:::

## 10. Length and area (not for the exam)

- If the outcome can be **any** point on a line or in a region, we cannot count the outcomes: there are infinitely many.
- Then use a ratio of lengths or areas: favourable length over total length, or favourable area over total area.
- NCERT gives two such examples (music stopping within 2 minutes; a helicopter crash in a field with a lake) and marks them "Not from the examination point of view".

:::example{title="Music stops"}
Music stops at a random time in the first 2 minutes. P(it stops in the first half-minute) $= \dfrac{1/2}{2} = \dfrac14$.
:::
