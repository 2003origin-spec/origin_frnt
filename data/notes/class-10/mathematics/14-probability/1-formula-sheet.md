---
title: "Probability: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.probability
order: 1
---

## Symbols used

$E$ = an event, $P(E)$ = probability of $E$, $\overline{E}$ = the event "not $E$" (NCERT writes a bar over $E$).

In this chapter, NCERT **assumes every experiment has equally likely outcomes**.

## The definitions

:::formula{title="Experimental probability (Class 9 recap)"}
$$P(E) = \frac{k}{N}$$
$k$ = number of trials in which $E$ happened, $N$ = total number of trials. Found by actually repeating the experiment. It can change from one set of trials to another.
:::

:::formula{title="Theoretical (classical) probability"}
$$P(E) = \frac{m}{n}$$
$m$ = number of outcomes favourable to $E$, $n$ = number of all possible outcomes of the experiment. Only when all the outcomes are **equally likely** and there is a finite number of them. NCERT calls this simply "probability". The definition was given by Laplace in 1795.
:::

## Rules

:::formula{title="Range of a probability"}
$$0 \le P(E) \le 1$$
A probability is never negative and never more than 1. It can be written as a fraction, a decimal or a percentage (15% = 0.15).
:::

:::formula{title="Sure and impossible events"}
$$P(\text{sure event}) = 1$$
$$P(\text{impossible event}) = 0$$
Example: on one die, P(a number less than 7) = 1 and P(getting 8) = 0.
:::

:::formula{title="Complementary events"}
$$P(E) + P(\overline{E}) = 1$$
$$P(\overline{E}) = 1 - P(E)$$
$E$ and $\overline{E}$ are called complementary events. Works for **any** event $E$.
:::

:::formula{title="Elementary events"}
$$P(E_1) + P(E_2) + \cdots + P(E_n) = 1$$
$E_1, \dots, E_n$ are **all** the elementary events of one experiment (each has only one outcome).
:::

## Counting the outcomes

| Experiment | Outcomes |
|---|---|
| 1 coin | 2 |
| 2 coins (or 1 coin twice) | 4 |
| 3 coins (or 1 coin 3 times) | 8 |
| 1 die | 6 |
| 2 dice (or 1 die twice) | 36 |
| 1 card from a deck | 52 |

### Two dice: ways to get each sum

| Sum | Ways |
|---|---|
| 2 or 12 | 1 |
| 3 or 11 | 2 |
| 4 or 10 | 3 |
| 5 or 9 | 4 |
| 6 or 8 | 5 |
| 7 | 6 |

Divide by 36 to get the probability. The 11 sums are **not** equally likely.

## Deck of 52 cards

| Group | Cards |
|---|---|
| Each suit (♠, ♥, ♦, ♣) | 13 |
| Red cards (♥, ♦) | 26 |
| Black cards (♠, ♣) | 26 |
| Face cards (K, Q, J) | 12 |
| Red face cards | 6 |
| Aces | 4 |
| Kings | 4 |
| Queens, or jacks | 4 each |

Each suit has ace, king, queen, jack, 10, 9, 8, 7, 6, 5, 4, 3, 2. Aces are **not** face cards.

## Length and area (not for the exam)

:::formula{title="Probability as a ratio of lengths or areas"}
$$P(E) = \frac{\text{favourable length}}{\text{total length}}$$
$$P(E) = \frac{\text{favourable area}}{\text{total area}}$$
For experiments with infinitely many outcomes, such as a point on a line or in a field, when every point is equally likely. NCERT marks these examples "Not from the examination point of view".
:::
